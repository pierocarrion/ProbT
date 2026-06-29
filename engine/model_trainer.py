"""Layer 4 — model_trainer.py

Trains, calibrates and saves the Tier A model for a (symbol, timeframe) pair.

  - LogisticRegression(penalty='l1', solver='liblinear', C=0.1)
  - StandardScaler fit on train only per fold
  - TimeSeriesSplit(5) — never random splits on time series
  - CalibratedClassifierCV(method='sigmoid') = Platt scaling
  - Primary metric: Brier Score (0.25 = random, <0.22 = good, <0.18 = edge)

Outputs per pair at data/symbols/{SYMBOL}_{TF}/:
  model.pkl         = {'model': calibrated, 'scaler': StandardScaler}
  features.json     = feature column names in training order
  metrics.json      = CV Brier + metadata
  benchmarks.json   = XGBoost/RF/GradientBoost/AdaBoost/Bayesian comparison
"""
from __future__ import annotations

import json
import os
import sys
import time
import warnings

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.exceptions import ConvergenceWarning
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss
from sklearn.model_selection import TimeSeriesSplit
from sklearn.preprocessing import StandardScaler

from symbols import (
    normalize_symbol, normalize_timeframe, tf_min_bars,
    pair_path,
)

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=ConvergenceWarning)

NON_FEATURES = ["label", "label_bars", "date", "open", "high", "low", "close", "volume"]
C = 0.1


def _l1_logreg() -> LogisticRegression:
    return LogisticRegression(solver="liblinear", C=C, l1_ratio=1.0, max_iter=5000)


def train(symbol: str, timeframe: str) -> dict | None:
    """Train and persist the model for (symbol, timeframe).

    Returns metrics dict, or None if training was skipped (insufficient data).
    """
    symbol = normalize_symbol(symbol)
    timeframe = normalize_timeframe(timeframe)

    path = pair_path(symbol, timeframe, "feature_matrix.csv")
    if not os.path.exists(path):
        print(f"[model_trainer] {symbol} {timeframe}: feature_matrix.csv missing — skip")
        return None
    df = pd.read_csv(path, parse_dates=True, index_col=0)
    if "label" not in df.columns:
        print(f"[model_trainer] {symbol} {timeframe}: feature_matrix has no label — run labeler first")
        return None

    feats = [c for c in df.columns if c not in NON_FEATURES]
    if len(df) < tf_min_bars(timeframe):
        print(f"[model_trainer] {symbol} {timeframe}: only {len(df)} rows "
              f"(< {tf_min_bars(timeframe)} min) — skip")
        return None

    X = df[feats].astype(float)
    y = df["label"].astype(int)

    tscv = TimeSeriesSplit(n_splits=5)
    briers, last_coefs = [], None
    for k, (tr, te) in enumerate(tscv.split(X), 1):
        sc = StandardScaler().fit(X.iloc[tr])
        Xt = sc.transform(X.iloc[tr])
        Xs = sc.transform(X.iloc[te])
        clf = _l1_logreg()
        clf.fit(Xt, y.iloc[tr])
        proba = clf.predict_proba(Xs)[:, 1]
        bs = brier_score_loss(y.iloc[te], proba)
        briers.append(bs)
        if k == tscv.n_splits:
            last_coefs = pd.Series(clf.coef_[0], index=feats)
        print(f"  {symbol} {timeframe} fold {k}: train={len(tr):4d} test={len(te):4d} Brier={bs:.4f}")

    avg_bs = float(np.mean(briers))
    bss = 1.0 - avg_bs / 0.25
    print(f"[model_trainer] {symbol} {timeframe} avg Brier={avg_bs:.4f} BSS={bss:+.4f}")
    if last_coefs is not None:
        top = last_coefs.reindex(last_coefs.abs().sort_values(ascending=False).index)
        print(top.head(8).to_string())

    # ─── Refit on full dataset ────────────────────────────────────
    final_scaler = StandardScaler().fit(X)
    X_all = final_scaler.transform(X)
    calibrated = CalibratedClassifierCV(
        _l1_logreg(),
        method="sigmoid",
        cv=TimeSeriesSplit(n_splits=5),
    )
    calibrated.fit(X_all, y)

    joblib.dump({"model": calibrated, "scaler": final_scaler},
                pair_path(symbol, timeframe, "model.pkl"))
    with open(pair_path(symbol, timeframe, "features.json"), "w") as f:
        json.dump(feats, f, indent=2)
    metrics = {
        "symbol": symbol,
        "timeframe": timeframe,
        "cv_brier_score": round(avg_bs, 4),
        "cv_brier_skill_score": round(bss, 4),
        "cv_folds": [round(b, 4) for b in briers],
        "label_balance": {str(k): round(v, 4) for k, v in y.value_counts(normalize=True).items()},
        "n_rows": int(len(y)),
        "n_features": len(feats),
        "features": feats,
        "c": C,
        "trained_at": pd.Timestamp.now().isoformat(),
    }
    with open(pair_path(symbol, timeframe, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"[model_trainer] {symbol} {timeframe}: saved model.pkl + features.json + metrics.json")

    _train_benchmarks(symbol, timeframe, X_all, y, feats)
    return metrics


def _train_benchmarks(symbol: str, timeframe: str, X_all, y, feats):
    """Train benchmark models with the same TimeSeriesSplit protocol."""
    from sklearn.ensemble import (
        RandomForestClassifier, GradientBoostingClassifier, AdaBoostClassifier,
    )
    from sklearn.naive_bayes import GaussianNB
    try:
        from xgboost import XGBClassifier
        xgb_avail = True
    except Exception:
        xgb_avail = False

    tscv = TimeSeriesSplit(n_splits=5)
    models = {
        "RandomForest": RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42, n_jobs=1),
        "GradientBoost": GradientBoostingClassifier(n_estimators=100, max_depth=3, learning_rate=0.1, random_state=42),
        "AdaBoost": AdaBoostClassifier(n_estimators=50, learning_rate=0.5, random_state=42),
        "Bayesian": GaussianNB(),
    }
    if xgb_avail:
        models = {"XGBoost": XGBClassifier(n_estimators=100, max_depth=3, learning_rate=0.1,
                                           eval_metric="logloss", verbosity=0, n_jobs=1),
                  **models}

    results = []
    for name, clf in models.items():
        briers, accs = [], []
        for tr, te in tscv.split(X_all):
            sc = StandardScaler().fit(X_all[tr])
            Xt = sc.transform(X_all[tr])
            Xs = sc.transform(X_all[te])
            try:
                clf.fit(Xt, y.iloc[tr])
                proba = clf.predict_proba(Xs)[:, 1]
            except Exception:
                proba = np.full(len(te), 0.5)
            bs = brier_score_loss(y.iloc[te], proba)
            briers.append(float(bs))
            taken = proba >= 0.55
            acc = float((y.iloc[te][taken] == 1).mean()) if taken.sum() > 0 else 0.0
            accs.append(acc)
        avg_brier = float(np.mean(briers))
        avg_acc = float(np.mean(accs))
        sc_full = StandardScaler().fit(X_all)
        X_scaled = sc_full.transform(X_all)
        t0 = time.time()
        clf.fit(X_scaled, y)
        train_time = time.time() - t0
        results.append({
            "name": name, "type": type(clf).__name__,
            "accuracy": round(avg_acc, 4),
            "confidence": round(max(1 - avg_brier, 0), 4),
            "status": "benchmark", "brier": round(avg_brier, 4),
            "train_time": round(train_time, 2),
        })
        print(f"  {name:14s} Brier={avg_brier:.4f} Acc={avg_acc:.1%} T={train_time:.1f}s")

    with open(pair_path(symbol, timeframe, "benchmarks.json"), "w") as f:
        json.dump(results, f, indent=2)


# ─── legacy entry point (XAUUSD daily) ────────────────────────────
def train_legacy():
    """Backward-compatible train() from v1 — reads daily_feature_matrix.csv
    and writes gold_prob_model.pkl + model_features.json + metrics.json at data/."""
    from symbols import data_dir
    path = os.path.join(data_dir(), "daily_feature_matrix.csv")
    df = pd.read_csv(path, parse_dates=True, index_col=0)
    feats = [c for c in df.columns if c not in NON_FEATURES]
    X = df[feats].astype(float)
    y = df["label"].astype(int)
    tscv = TimeSeriesSplit(n_splits=5)
    briers = []
    for tr, te in tscv.split(X):
        sc = StandardScaler().fit(X.iloc[tr])
        Xt = sc.transform(X.iloc[tr])
        Xs = sc.transform(X.iloc[te])
        clf = _l1_logreg()
        clf.fit(Xt, y.iloc[tr])
        briers.append(brier_score_loss(y.iloc[te], clf.predict_proba(Xs)[:, 1]))
    avg_bs = float(np.mean(briers))
    final_scaler = StandardScaler().fit(X)
    calibrated = CalibratedClassifierCV(_l1_logreg(), method="sigmoid",
                                        cv=TimeSeriesSplit(n_splits=5))
    calibrated.fit(final_scaler.transform(X), y)
    joblib.dump({"model": calibrated, "scaler": final_scaler},
                os.path.join(data_dir(), "gold_prob_model.pkl"))
    with open(os.path.join(data_dir(), "model_features.json"), "w") as f:
        json.dump(feats, f, indent=2)
    print(f"[model_trainer] legacy XAUUSD 1D: Brier={avg_bs:.4f}")


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        train_legacy()
    elif len(args) == 2:
        train(args[0], args[1])
    else:
        print("Usage: python model_trainer.py [SYMBOL TIMEFRAME]")
