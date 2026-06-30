"use client";

import { useMemo } from "react";
import type {
  EChartsOption,
  CustomSeriesRenderItemParams,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemReturn,
  TooltipComponentFormatterCallbackParams,
} from "echarts";
import { EChartsBase, useDarkMode } from "./echarts-base";
import { accentColor } from "@/lib/chart-colors";
import type {
  ChartResponse,
  OrderBlock,
  FairValueGap,
  StructureBreak,
  SupplyDemandZone,
  SwingPoint,
  EqualHL,
} from "@/types";

// ─── overlay item shape (rendered via a custom series) ─────────────
type RectMode = "span" | "right" | "full";
interface RectItem {
  kind: "rect";
  x1: number;
  x2: number;
  top: number;
  bottom: number;
  fill: string;
  stroke?: string;
  lw?: number;
  mode: RectMode;
  dashBorder?: boolean;
}
interface LineItem {
  kind: "line";
  x1: number;
  x2: number;
  y: number;
  color: string;
  width: number;
  dashed?: boolean;
  full?: boolean;
}
interface TextItem {
  kind: "text";
  x: number;
  y: number;
  text: string;
  color: string;
  align?: "left" | "center" | "right";
  dy?: number;
  dx?: number;
  fs?: number;
  weight?: number;
}
type Item = RectItem | LineItem | TextItem;

interface Group {
  name: string;
  items: Item[];
  z: number;
}

function hex(c: string, alpha: string) {
  return `${c}${alpha}`;
}

/** Build the full ECharts option for the SMC chart. */
function buildOption(data: ChartResponse, isDark: boolean): EChartsOption {
  const candles = data.candles;
  const n = candles.length;
  const smc = data.smc;
  const sd = data.supply_demand;

  const green = accentColor("green");
  const red = accentColor("red");
  const blue = accentColor("blue");
  const amber = accentColor("amber");
  const gray = accentColor("gray");
  const axisLine = isDark ? "#262626" : "#e5e7eb";
  const labelColor = isDark ? "#9ca3af" : "#6b7280";

  const times = candles.map((c) => c.t);
  const cats = candles.map((c) => [c.o, c.c, c.l, c.h]);
  const volumes = candles.map((c) => c.v);
  const maxVol = Math.max(1, ...volumes);

  // ─── build overlay groups ──────────────────────────────────────
  const groups: Group[] = [];

  // Premium / Discount / Equilibrium (back layer)
  if (smc?.zones) {
    const z = smc.zones;
    const pd: Item[] = [
      { kind: "rect", x1: 0, x2: n - 1, top: z.premium[1], bottom: z.premium[0],
        fill: hex(red, "0d"), mode: "full" },
      { kind: "rect", x1: 0, x2: n - 1, top: z.discount[1], bottom: z.discount[0],
        fill: hex(green, "0d"), mode: "full" },
      { kind: "line", x1: 0, x2: n - 1, y: z.equilibrium, color: gray,
        width: 1, dashed: true, full: true },
    ];
    groups.push({ name: "Premium / Discount", items: pd, z: 1 });
  }

  // Order blocks (swing + internal)
  if (smc) {
    const obItems: Item[] = [];
    const pushOB = (o: OrderBlock, strong: boolean) => {
      const col = o.bias === "bull" ? green : red;
      obItems.push({
        kind: "rect", x1: o.x, x2: n - 1, top: o.top, bottom: o.bottom,
        fill: hex(col, strong ? "1f" : "14"),
        stroke: strong ? col : hex(col, "aa"), lw: strong ? 1 : 1,
        mode: "right", dashBorder: !strong,
      });
    };
    smc.order_blocks_swing.forEach((o) => pushOB(o, true));
    smc.order_blocks_internal.forEach((o) => pushOB(o, false));
    groups.push({ name: "Order Blocks", items: obItems, z: 4 });
  }

  // Fair Value Gaps
  if (smc) {
    const fvgItems: Item[] = smc.fvgs.map((f: FairValueGap): Item => {
      const col = f.bias === "bull" ? green : red;
      return {
        kind: "rect", x1: f.x, x2: n - 1, top: f.top, bottom: f.bottom,
        fill: hex(col, "18"), stroke: hex(col, "55"), lw: 0.5, mode: "right",
      };
    });
    groups.push({ name: "Fair Value Gaps", items: fvgItems, z: 3 });
  }

  // Supply / Demand zones
  if (sd && (sd.supply.length || sd.demand.length)) {
    const sdItems: Item[] = [];
    const total = sd.total_supply + sd.total_demand || 1;
    const pushSD = (z2: SupplyDemandZone) => {
      const col = z2.kind === "supply" ? amber : blue;
      const pct = (Math.abs(z2.delta) / total) * 100;
      sdItems.push({
        kind: "rect", x1: z2.x1, x2: z2.x2, top: z2.top, bottom: z2.bottom,
        fill: hex(col, "1a"), stroke: col, lw: 1.5, mode: "span",
      });
      sdItems.push({
        kind: "text", x: z2.x1, y: z2.top,
        text: `${z2.kind === "supply" ? "S" : "D"} ${pct.toFixed(0)}%`,
        color: col, align: "left", dx: 4, dy: -8, fs: 10, weight: 600,
      });
    };
    sd.supply.forEach(pushSD);
    sd.demand.forEach(pushSD);
    groups.push({ name: "Supply / Demand", items: sdItems, z: 5 });
  }

  // Structure breaks (BOS / CHoCH)
  if (smc) {
    const stItems: Item[] = [];
    smc.structures.forEach((s: StructureBreak) => {
      const col = s.bias === "bull" ? green : red;
      const internal = s.scope === "internal";
      stItems.push({
        kind: "line", x1: s.x1, x2: s.x2, y: s.price, color: col,
        width: internal ? 1 : 1.6, dashed: internal,
      });
      const mid = Math.round((s.x1 + s.x2) / 2);
      stItems.push({
        kind: "text", x: mid, y: s.price, text: s.type, color: col,
        align: "center", dy: internal ? 6 : -8, fs: internal ? 9 : 10, weight: 700,
      });
    });
    groups.push({ name: "Structure", items: stItems, z: 6 });
  }

  // Swing labels (HH / HL / LH / LL) + EQH / EQL
  if (smc) {
    const swItems: Item[] = [];
    smc.swings.forEach((s: SwingPoint) => {
      const col = s.is_high ? red : green;
      swItems.push({
        kind: "text", x: s.x, y: s.price, text: s.label, color: col,
        align: "center", dy: s.is_high ? -12 : 12, fs: 9, weight: 700,
      });
    });
    smc.eqhl.forEach((e: EqualHL) => {
      swItems.push({
        kind: "text", x: e.x, y: e.price, text: e.kind, color: amber,
        align: "center", dy: e.kind === "EQH" ? -14 : 14, fs: 9, weight: 700,
      });
    });
    groups.push({ name: "Swings", items: swItems, z: 7 });
  }

  // ─── renderItem for a group's items ────────────────────────────
  function renderGroup(items: Item[]) {
    return (
      params: CustomSeriesRenderItemParams,
      api: CustomSeriesRenderItemAPI,
    ): CustomSeriesRenderItemReturn => {
      const it = items[params.dataIndex];
      const cs = params.coordSys as unknown as {
        x: number; y: number; width: number; height: number;
      };
      const bandW = n > 1 ? api.coord([1, 0])[0] - api.coord([0, 0])[0] : 8;

      if (it.kind === "rect") {
        const topP = api.coord([it.x1, it.top]);
        const botY = api.coord([it.x1, it.bottom])[1];
        let xL: number;
        let xR: number;
        if (it.mode === "full") {
          xL = cs.x;
          xR = cs.x + cs.width;
        } else if (it.mode === "right") {
          xL = topP[0] - bandW / 2;
          xR = cs.x + cs.width;
        } else {
          xL = api.coord([it.x1, it.top])[0] - bandW / 2;
          xR = api.coord([it.x2, it.top])[0] + bandW / 2;
        }
        const style: Record<string, unknown> = { fill: it.fill };
        if (it.stroke) {
          style.stroke = it.stroke;
          style.lineWidth = it.lw ?? 1;
          if (it.dashBorder) style.lineDash = [4, 3];
        }
        return {
          type: "rect",
          shape: {
            x: xL,
            y: topP[1],
            width: Math.max(xR - xL, 1.5),
            height: Math.max(botY - topP[1], 1),
          },
          style,
          silent: true,
          z2: 0,
        };
      }
      if (it.kind === "line") {
        const y = api.coord([it.x1, it.y])[1];
        let x1p: number;
        let x2p: number;
        if (it.full) {
          x1p = cs.x;
          x2p = cs.x + cs.width;
        } else {
          x1p = api.coord([it.x1, it.y])[0];
          x2p = api.coord([it.x2, it.y])[0];
        }
        const style: Record<string, unknown> = { stroke: it.color, lineWidth: it.width };
        if (it.dashed) style.lineDash = [5, 4];
        return {
          type: "line",
          shape: { x1: x1p, y1: y, x2: x2p, y2: y },
          style,
          silent: true,
          z2: 0,
        };
      }
      // text
      const p = api.coord([it.x, it.y]);
      return {
        type: "text",
        style: {
          x: p[0] + (it.dx ?? 0),
          y: p[1] + (it.dy ?? 0),
          text: it.text,
          fill: it.color,
          fontSize: it.fs ?? 10,
          fontWeight: it.weight ?? 600,
          align: it.align ?? "center",
          verticalAlign: "middle",
        },
        silent: true,
        z2: 0,
      };
    };
  }

  const customSeries = groups.map((g) => ({
    type: "custom" as const,
    name: g.name,
    xAxisIndex: 0,
    yAxisIndex: 0,
    z: g.z,
    clip: true,
    animation: false,
    data: g.items.map(() => 0),
    renderItem: renderGroup(g.items),
  }));

  const legendNames = ["Candles", "Volume", ...groups.map((g) => g.name)];

  const option: EChartsOption = {
    animation: false,
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross", crossStyle: { color: gray } },
      backgroundColor: isDark ? "rgba(17,17,17,0.96)" : "rgba(255,255,255,0.96)",
      borderColor: isDark ? "#1f1f1f" : "#e5e7eb",
      borderWidth: 1,
      textStyle: { color: isDark ? "#fafafa" : "#111827", fontSize: 12 },
      extraCssText: "box-shadow: 0 4px 24px rgba(0,0,0,0.12); border-radius: 12px;",
      formatter: (raw: TooltipComponentFormatterCallbackParams) => {
        const p = Array.isArray(raw) ? raw : [raw];
        const i = (p[0] as { dataIndex?: number }).dataIndex;
        if (i == null || !candles[i]) return "";
        const c = candles[i];
        const up = c.c >= c.o;
        const col = up ? green : red;
        return `<div style="font-weight:600;margin-bottom:2px">${c.t}</div>
          <div style="color:${labelColor};font-size:11px;line-height:1.5">
            <span style="color:${col}">●</span> O ${fmt(c.o)} &nbsp; H ${fmt(c.h)} &nbsp; L ${fmt(c.l)} &nbsp; C ${fmt(c.c)}<br/>
            Vol ${c.v.toLocaleString()}
          </div>`;
      },
    },
    legend: {
      data: legendNames,
      top: 4,
      textStyle: { fontSize: 10, color: labelColor },
      itemWidth: 12,
      itemHeight: 8,
    },
    axisPointer: { link: [{ xAxisIndex: "all" }] },
    grid: { top: 36, bottom: 56, left: 12, right: 64, containLabel: true },
    xAxis: {
      type: "category",
      data: times,
      boundaryGap: true,
      axisLine: { lineStyle: { color: axisLine } },
      axisTick: { show: false },
      axisLabel: {
        fontSize: 10,
        color: labelColor,
        formatter: (v: string) => v.slice(5),
      },
      splitLine: { show: false },
    },
    yAxis: [
      {
        type: "value",
        scale: true,
        position: "right",
        axisLabel: { fontSize: 10, color: labelColor },
        splitLine: { lineStyle: { color: isDark ? "#1f1f1f" : "#f4f4f5" } },
      },
      {
        type: "value",
        max: maxVol * 5,
        position: "left",
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
    ],
    dataZoom: [
      {
        type: "inside",
        start: Math.max(0, 100 - (260 / n) * 100),
        end: 100,
      },
      {
        type: "slider",
        bottom: 8,
        height: 18,
        start: Math.max(0, 100 - (260 / n) * 100),
        end: 100,
        borderColor: "transparent",
        fillerColor: hex(green, "15"),
        handleStyle: { color: green, borderColor: green },
        moveHandleStyle: { color: green },
        textStyle: { fontSize: 9, color: labelColor },
      },
    ],
    series: [
      {
        name: "Candles",
        type: "candlestick",
        data: cats,
        xAxisIndex: 0,
        yAxisIndex: 0,
        z: 2,
        itemStyle: {
          color: green,
          color0: red,
          borderColor: green,
          borderColor0: red,
        },
      },
      {
        name: "Volume",
        type: "bar",
        data: candles.map((c) => ({
          value: c.v,
          itemStyle: { color: c.c >= c.o ? hex(green, "33") : hex(red, "33") },
        })),
        xAxisIndex: 0,
        yAxisIndex: 1,
        z: 1,
        barWidth: "70%",
        silent: true,
      },
      ...customSeries,
    ],
  };

  return option;
}

function fmt(v: number) {
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function SmcChart({ data, height = 560 }: { data: ChartResponse; height?: number }) {
  const isDark = useDarkMode();
  const option = useMemo(() => buildOption(data, isDark), [data, isDark]);
  return <EChartsBase option={option} height={height} />;
}
