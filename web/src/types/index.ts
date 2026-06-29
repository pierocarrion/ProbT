// ─── Domain types for the probt dashboard ─────────────────────────

export interface TierA {
  probability: number;
  horizon_bars: number;
  tp_sl_ratio: string;
  is_probability: boolean;
  direction: "LONG" | "SHORT";
}

export interface NearestZone {
  kind: string | null;
  price: number | null;
  distance_pct: number | null;
  at_zone: boolean;
}

export interface TierB {
  bias: "bullish" | "bearish" | "neutral";
  nearest_zone: NearestZone;
  is_probability: boolean;
}

export interface NewsOverlay {
  score: number;
  count: number;
  summary: string;
}

export interface Sizing {
  full_kelly_pct: number;
  half_kelly_pct: number;
  final_pct: number;
  cap_pct: number;
}

export interface Reading {
  symbol: string;
  symbol_name: string;
  timeframe: string;
  asof: string;
  generated_at: string;
  price: number;
  horizon_bars: number;
  tier_a: TierA;
  tier_b: TierB;
  news: NewsOverlay;
  sizing: Sizing;
  features: Record<string, number | null>;
}

export interface EquityPoint {
  date: string;
  value: number;
  proba: number;
}

export interface BacktestMetrics {
  total_trades: number;
  win_rate: number;
  total_profit_R: number;
  total_profit_pct: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  max_drawdown_R: number;
  brier_score: number;
  brier_in_sample: number;
  threshold: number;
}

export interface BacktestResponse {
  equity_curve: EquityPoint[];
  metrics: BacktestMetrics;
}

export type Trend = "up" | "down" | "neutral";
export type Accent = "green" | "blue" | "red" | "amber" | "gray";

export interface Kpi {
  id: string;
  label: string;
  value: number | string;
  unit: string;
  change: number;
  trend: Trend;
  accent: Accent;
  sparkline: number[];
}

export interface Trade {
  time: string;
  asset: string;
  type: string;
  entry: number;
  exit: number;
  pnl: number;
  status: string;
  duration: string;
  confidence: number;
}

export interface ModelCard {
  name: string;
  type: string;
  accuracy: number;
  confidence: number;
  status: "active" | "benchmark" | "queued";
  updated: string;
  train_time: string;
  brier: number | null;
  performance: number[];
}

export interface MarketAsset {
  symbol: string;
  price: number;
  change: number;
  sparkline: number[];
  volume: number;
  prediction: string;
}

export interface HeatmapData {
  labels: string[];
  matrix: number[][];
}

export interface Gauge {
  label: string;
  value: number;
  max: number;
  accent: Accent;
}

export interface Insight {
  title: string;
  icon: string;
  text: string;
  accent: Accent;
  weight: number;
}

export interface FeatureImportance {
  feature: string;
  coefficient: number;
  abs: number;
}

export interface HealthStatus {
  status: string;
  uptime_s: number;
  reading_ready: boolean;
}
