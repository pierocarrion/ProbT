"""Supply & Demand Zones — faithful port of the BigBeluga "Supply and Demand
Zones" Pine (v6) indicator to server-side Python.

Detects institutional accumulation/distribution footprints:
  - Supply  : 3 consecutive bear candles + volume spike → look back for the
              last bull candle (move origin). Zone = [low, low+2·ATR].
  - Demand  : mirrored (3 bull candles → last bear candle). Zone = [high-2·ATR, high].

Each zone carries a volume delta (net aggression) and its share of total delta.
Overlapping same-direction zones are merged; at most `max_zones` per side are
returned (most recent first). Mitigated zones (price closed beyond) are dropped.
"""
from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd


def _rolling_avg_prev(vol: np.ndarray) -> np.ndarray:
    """avg_incl_prev[i] = mean(vol[0..i-1]); used for extra_vol of bar i-1."""
    n = len(vol)
    out = np.zeros(n)
    csum = 0.0
    for i in range(n):
        if i > 0:
            out[i] = csum / i
        csum += vol[i]
    return out


def compute_supply_demand(
    df: pd.DataFrame,
    max_zones: int = 5,
    cooldown: int = 15,
    lookback: int = 5,
    atr_period: int = 200,
) -> dict[str, Any]:
    n = len(df)
    if n < max(atr_period, lookback + 3):
        return {"supply": [], "demand": [], "total_supply": 0.0, "total_demand": 0.0}

    open_ = df["open"].to_numpy(dtype=float)
    high = df["high"].to_numpy(dtype=float)
    low = df["low"].to_numpy(dtype=float)
    close = df["close"].to_numpy(dtype=float)
    vol = df["volume"].to_numpy(dtype=float)

    # 2·ATR (BigBeluga uses ta.atr(200)*2 as the zone width)
    prev_close = np.concatenate(([close[0]], close[:-1]))
    tr = np.maximum.reduce([
        high - low,
        np.abs(high - prev_close),
        np.abs(low - prev_close),
    ])
    atr_full = pd.Series(tr).rolling(atr_period, min_periods=1).mean().to_numpy(dtype=float)
    atr2 = atr_full * 2.0

    bear = close < open_
    bull = close > open_
    avg_prev = _rolling_avg_prev(vol)
    extra_vol_prev = np.zeros(n, dtype=bool)
    for i in range(1, n):
        # extra_vol[i-1] = vol[i-1] > mean(vol[0..i-1])
        if avg_prev[i] > 0:
            extra_vol_prev[i] = vol[i - 1] > avg_prev[i]

    supply: list[dict[str, Any]] = []
    demand: list[dict[str, Any]] = []
    count_bear = 0
    count_bull = 0

    for i in range(n):
        ev1 = extra_vol_prev[i]

        # ── Supply zone (bearish origin) ────────────────────────────
        if (i >= 2 and bear[i] and bear[i - 1] and bear[i - 2] and ev1
                and count_bear == 0):
            delta = 0.0
            for k in range(lookback + 1):
                j = i - k
                if j < 0:
                    break
                if bull[j]:
                    top = float(low[j] + atr2[i])
                    bottom = float(low[j])
                    supply.append({
                        "kind": "supply", "x1": j, "x2": i,
                        "top": top, "bottom": bottom, "delta": float(delta),
                    })
                    count_bear = 1
                    break
                delta += -vol[j] if bear[j] else vol[j]

        # ── Demand zone (bullish origin) ────────────────────────────
        if (i >= 2 and bull[i] and bull[i - 1] and bull[i - 2] and ev1
                and count_bull == 0):
            delta = 0.0
            for k in range(lookback + 1):
                j = i - k
                if j < 0:
                    break
                if bear[j]:
                    top = float(high[j])
                    bottom = float(high[j] - atr2[i])
                    demand.append({
                        "kind": "demand", "x1": j, "x2": i,
                        "top": top, "bottom": bottom, "delta": float(delta),
                    })
                    count_bull = 1
                    break
                delta += vol[j] if bull[j] else -vol[j]

        if count_bear >= 1:
            count_bear += 1
        if count_bear >= cooldown:
            count_bear = 0
        if count_bull >= 1:
            count_bull += 1
        if count_bull >= cooldown:
            count_bull = 0

    # ── mitigation ──────────────────────────────────────────────────
    supply = _mitigate(supply, close, direction="supply")
    demand = _mitigate(demand, close, direction="demand")

    # ── overlap merge (keep stronger delta) ─────────────────────────
    supply = _merge_overlap(supply)
    demand = _merge_overlap(demand)

    # most recent first, cap to max_zones
    supply = sorted(supply, key=lambda z: z["x2"], reverse=True)[:max_zones]
    demand = sorted(demand, key=lambda z: z["x2"], reverse=True)[:max_zones]

    total_supply = float(sum(abs(z["delta"]) for z in supply))
    total_demand = float(sum(abs(z["delta"]) for z in demand))
    total = total_supply + total_demand

    for z in supply + demand:
        z["pct"] = round(abs(z["delta"]) / total * 100, 1) if total > 0 else 0.0

    return {
        "supply": supply,
        "demand": demand,
        "total_supply": total_supply,
        "total_demand": total_demand,
    }


def _mitigate(zones: list[dict[str, Any]], close: np.ndarray,
              direction: str) -> list[dict[str, Any]]:
    out = []
    for z in zones:
        x2 = z["x2"]
        alive = True
        for j in range(x2 + 1, len(close)):
            if direction == "supply" and close[j] > z["top"]:
                alive = False
                break
            if direction == "demand" and close[j] < z["bottom"]:
                alive = False
                break
        if alive:
            out.append(z)
    return out


def _merge_overlap(zones: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop zones fully contained (price-wise) within a stronger same-kind zone."""
    kept: list[dict[str, Any]] = []
    for z in sorted(zones, key=lambda d: abs(d["delta"]), reverse=True):
        contained = False
        for k in kept:
            if (z["top"] <= k["top"] and z["bottom"] >= k["bottom"]):
                contained = True
                break
        if not contained:
            kept.append(z)
    return kept
