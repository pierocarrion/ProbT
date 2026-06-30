import type { Accent } from "@/types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL || "ws://127.0.0.1:8000/ws/stream";

/**
 * Cadence (ms) at which the engine pushes readings over the WebSocket and at
 * which the dashboard recomputes the "next update" countdown. Keep this in
 * sync with the `WS_PUSH_INTERVAL` constant on the engine side.
 */
export const LIVE_INTERVAL_MS = 10_000;

// ─── Accent → Tailwind classes ────────────────────────────────────
export const accentText: Record<Accent, string> = {
  green: "text-success",
  blue: "text-info",
  red: "text-destructive",
  amber: "text-warning",
  gray: "text-muted-foreground",
};

export const accentBg: Record<Accent, string> = {
  green: "bg-success",
  blue: "bg-info",
  red: "bg-destructive",
  amber: "bg-warning",
  gray: "bg-muted-foreground",
};

export const accentBgSoft: Record<Accent, string> = {
  green: "bg-success/10",
  blue: "bg-info/10",
  red: "bg-destructive/10",
  amber: "bg-warning/10",
  gray: "bg-muted",
};

// ─── Sidebar navigation ───────────────────────────────────────────
export interface NavItem {
  id: string;
  label: string;
  icon: string;
  badge?: string;
}

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Overview",
    items: [
      { id: "dashboard", label: "Dashboard", icon: "layout-dashboard" },
      { id: "probability", label: "Probability Analysis", icon: "bar-chart-3" },
      { id: "prediction", label: "AI Prediction", icon: "brain" },
      { id: "backtest", label: "Backtest", icon: "trending-up", badge: "Live" },
    ],
  },
  {
    title: "Trading",
    items: [
      { id: "trades", label: "Live Trades", icon: "arrow-right-left" },
      { id: "market", label: "Market Overview", icon: "globe" },
      { id: "heatmap", label: "Heatmap", icon: "grid-3x3" },
    ],
  },
  {
    title: "Models",
    items: [
      { id: "models", label: "ML Models", icon: "cpu" },
      { id: "features", label: "Feature Importance", icon: "list" },
      { id: "confidence", label: "Confidence", icon: "gauge" },
    ],
  },
  {
    title: "System",
    items: [
      { id: "settings", label: "Settings", icon: "settings" },
      { id: "logs", label: "Logs", icon: "scroll-text" },
    ],
  },
];

// ─── Markets for the header selector ──────────────────────────────
export const MARKETS = ["XAUUSD", "BTCUSD", "ETHUSD", "NAS100", "SPX500"];

export const TIMEFRAMES = ["1m", "5m", "15m", "1H", "4H", "1D", "1W"];

// ─── Catalog type from /api/catalog ───────────────────────────────
export interface CatalogPair {
  symbol: string;
  timeframe: string;
}
export interface CatalogResponse {
  symbols: { id: string; name: string; has_macro: boolean }[];
  timeframes: string[];
  default_symbol: string;
  default_timeframe: string;
  available_pairs: CatalogPair[];
}
