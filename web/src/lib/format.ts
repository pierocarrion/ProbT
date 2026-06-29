// ─── Number / date / currency formatters ──────────────────────────

export function fmtNumber(v: number | null | undefined, decimals = 2): string {
  if (v == null || isNaN(v)) return "—";
  return v.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmtCompact(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "—";
  return Intl.NumberFormat("en-US", { notation: "compact" }).format(v);
}

export function fmtPct(v: number | null | undefined, decimals = 1): string {
  if (v == null || isNaN(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(decimals)}%`;
}

export function fmtSigned(v: number | null | undefined, decimals = 2): string {
  if (v == null || isNaN(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(decimals)}`;
}

export function fmtPrice(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "—";
  return `$${fmtNumber(v, v < 10 ? 4 : 2)}`;
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return "—";
  }
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function utcNow(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}
