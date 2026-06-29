"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkline } from "@/components/charts/sparkline";
import type { ModelCard as ModelCardType } from "@/types";
import { cn } from "@/lib/utils";

const statusConfig = {
  active: { label: "Active", className: "bg-success/15 text-success" },
  benchmark: { label: "Benchmark", className: "bg-info/15 text-info" },
  queued: { label: "Queued", className: "bg-muted text-muted-foreground" },
};

export function ModelCard({ model, index = 0 }: { model: ModelCardType; index?: number }) {
  const status = statusConfig[model.status];
  const accent = model.status === "active" ? "green" : model.status === "benchmark" ? "blue" : "gray";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className="p-4 transition-all hover:shadow-md hover:-translate-y-0.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold truncate">{model.name}</span>
              <Badge variant="secondary" className={cn("h-5 text-[10px]", status.className)}>
                {status.label}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{model.type}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Accuracy</div>
            <div className="text-lg font-bold tabular-nums">
              {model.accuracy > 0 ? `${(model.accuracy * 100).toFixed(1)}%` : "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Confidence</div>
            <div className="text-lg font-bold tabular-nums">
              {model.confidence > 0 ? `${(model.confidence * 100).toFixed(0)}%` : "—"}
            </div>
          </div>
        </div>

        {model.performance.length > 0 && (
          <div className="mt-2 h-8">
            <Sparkline data={model.performance} accent={accent as "green" | "blue" | "gray"} height={32} />
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-[10px] text-muted-foreground">
          <span>Brier: {model.brier != null ? model.brier.toFixed(4) : "—"}</span>
          <span>Train: {model.train_time}</span>
        </div>
      </Card>
    </motion.div>
  );
}
