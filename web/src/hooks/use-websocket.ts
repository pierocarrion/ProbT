"use client";

import { useEffect, useState } from "react";
import { WS_URL } from "@/lib/constants";
import type { Reading } from "@/types";
import { useAsset } from "@/hooks/use-asset-context";

/**
 * WebSocket hook for real-time reading streaming.
 *
 * Re-opens a fresh socket whenever the selected (symbol, timeframe) changes
 * or the previous socket drops. Backoff is implemented via a `retry` counter
 * that bumps through a re-render, avoiding setTimeout recursion entirely
 * (the React Compiler flags that pattern).
 */
export function useLiveReading() {
  const { symbol, timeframe } = useAsset();
  const [reading, setReading] = useState<Reading | null>(null);
  const [connected, setConnected] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let closedByUnmount = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let ws: WebSocket | null = null;

    try {
      ws = new WebSocket(WS_URL);
    } catch {
      const delay = Math.min(1000 * 2 ** retry, 30_000);
      reconnectTimer = setTimeout(() => setRetry((r) => r + 1), delay);
      return () => { if (reconnectTimer) clearTimeout(reconnectTimer); };
    }

    ws.onopen = () => {
      setConnected(true);
      setRetry(0);
      try {
        ws?.send(JSON.stringify({ type: "subscribe", symbol, timeframe }));
      } catch {
        /* ignore */
      }
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "reading" && msg.data) {
          setReading(msg.data);
        }
      } catch {
        /* ignore malformed messages */
      }
    };

    ws.onclose = () => {
      setConnected(false);
      if (closedByUnmount) return;
      const delay = Math.min(1000 * 2 ** retry, 30_000);
      reconnectTimer = setTimeout(() => setRetry((r) => r + 1), delay);
    };

    ws.onerror = () => {
      try { ws?.close(); } catch { /* ignore */ }
    };

    return () => {
      closedByUnmount = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try { ws?.close(); } catch { /* ignore */ }
    };
  }, [symbol, timeframe, retry]);

  return { reading, connected };
}
