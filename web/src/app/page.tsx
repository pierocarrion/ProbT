"use client";

import { motion } from "framer-motion";
import {
  TrendingUp,
  Brain,
  Activity,
  Newspaper,
  DollarSign,
  Layers,
  BarChart3,
  Grid3x3,
  Cpu,
  Gauge,
  Target,
  CandlestickChart,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SectionCard } from "@/components/layout/section-card";
import { KpiCard } from "@/components/cards/kpi-card";
import { ModelCard } from "@/components/cards/model-card";
import { MarketTile } from "@/components/cards/market-tile";
import { CumulativeChart } from "@/components/charts/cumulative-chart";
import { SmcChart } from "@/components/charts/smc-chart";
import { ProbabilityDist } from "@/components/charts/probability-dist";
import { HeatmapChart } from "@/components/charts/heatmap-chart";
import { GaugeChart } from "@/components/charts/gauge-chart";
import { AiStatusPanel } from "@/components/widgets/ai-status-panel";
import { LiveTicker } from "@/components/widgets/live-ticker";
import { SettingsPanel } from "@/components/widgets/settings-panel";
import { LiveTradesTable } from "@/components/tables/live-trades-table";
import { DynamicIcon } from "@/components/lib/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  useKpis,
  useBacktest,
  useModels,
  useMarket,
  useProbabilityDist,
  useHeatmap,
  useConfidence,
  useInsights,
  useFeatures,
  useChart,
} from "@/hooks/use-api";
import { accentText, accentBg } from "@/lib/constants";
import { fmtSigned } from "@/lib/format";

export default function DashboardPage() {
  return (
    <DashboardShell>
      {/* ─── Live Price Ticker ──────────────────────────────── */}
      <section id="section-live">
        <LiveTicker />
      </section>

      {/* ─── KPI Row ─────────────────────────────────────────── */}
      <section id="section-dashboard">
        <KpiRow />
      </section>

      {/* ─── Smart Money Concepts Chart ─────────────────────── */}
      <section id="section-smc">
        <SmcChartSection />
      </section>

      {/* ─── Main Chart + AI Status ──────────────────────────── */}
      <section id="section-backtest" className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MainChartSection />
        </div>
        <div className="lg:col-span-1">
          <AiStatusPanel />
        </div>
      </section>

      {/* ─── Probability + AI Prediction ─────────────────────── */}
      <section id="section-probability" className="grid gap-4 lg:grid-cols-2">
        <ProbabilitySection />
        <AiPredictionSection />
      </section>

      {/* ─── Market Overview ─────────────────────────────────── */}
      <section id="section-market">
        <MarketOverviewSection />
      </section>

      {/* ─── Live Trades ─────────────────────────────────────── */}
      <section id="section-trades">
        <LiveTradesTable />
      </section>

      {/* ─── ML Models ───────────────────────────────────────── */}
      <section id="section-models">
        <ModelsSection />
      </section>

      {/* ─── Heatmap + Confidence ────────────────────────────── */}
      <section id="section-heatmap" className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <HeatmapSection />
        </div>
        <div className="lg:col-span-1" id="section-confidence">
          <ConfidenceSection />
        </div>
      </section>

      {/* ─── Feature Importance ──────────────────────────────── */}
      <section id="section-features">
        <FeatureSection />
      </section>

      {/* ─── Settings ─────────────────────────────────────────── */}
      <section id="section-settings">
        <SettingsPanel />
      </section>
    </DashboardShell>
  );
}

// ─── KPI Row ───────────────────────────────────────────────────
function KpiRow() {
  const { data: kpis, isLoading } = useKpis();
  if (isLoading || !kpis)
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <Card key={i} className="p-4"><Skeleton className="h-20" /></Card>
        ))}
      </div>
    );
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5">
      {kpis.map((k, i) => <KpiCard key={k.id} kpi={k} index={i} />)}
    </div>
  );
}

// ─── Smart Money Concepts Chart ────────────────────────────────
function shortVol(v: number) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return `${v}`;
}

function SmcChartSection() {
  const { data, isLoading } = useChart();
  const smc = data?.smc;
  const sd = data?.supply_demand;
  const bias = smc?.bias ?? "neutral";
  const biasAccent = bias === "bull" ? "green" : bias === "bear" ? "red" : "gray";
  const biasLabel = bias === "bull" ? "Bullish" : bias === "bear" ? "Bearish" : "Neutral";

  return (
    <SectionCard
      title="Smart Money Concepts"
      description="Order Blocks · Break of Structure (BOS) / Change of Character (CHoCH) · Fair Value Gaps (FVG) · Supply & Demand"
      icon={<CandlestickChart className="h-4 w-4 text-info" />}
      action={
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          {smc && (
            <Badge variant="secondary" className={`${accentBg[biasAccent]} ${accentText[biasAccent]}`}>
              {biasLabel} bias
            </Badge>
          )}
          {sd && sd.total_supply + sd.total_demand > 0 && (
            <span className="hidden sm:inline text-muted-foreground">
              Supply <span className="font-semibold text-warning">{shortVol(sd.total_supply)}</span>
              <span className="mx-1">·</span>
              Demand <span className="font-semibold text-info">{shortVol(sd.total_demand)}</span>
            </span>
          )}
          {data && (
            <span className="hidden md:inline text-muted-foreground">
              swing {data.swing_length} · int {data.internal_length}
            </span>
          )}
        </div>
      }
      bodyClassName="p-2 sm:p-3"
    >
      {isLoading || !data || !data.candles.length ? (
        <Skeleton className="h-[560px] rounded-xl" />
      ) : (
        <SmcChart data={data} height={560} />
      )}
    </SectionCard>
  );
}

// ─── Main Chart ────────────────────────────────────────────────
function MainChartSection() {
  const { data: bt, isLoading } = useBacktest();
  const m = bt?.metrics;
  return (
    <SectionCard
      title="Cumulative Performance"
      description="Equity curve · probability overlay · 10-day prediction"
      icon={<TrendingUp className="h-4 w-4 text-success" />}
      action={
        <div className="flex items-center gap-2 text-xs">
          {m && (
            <>
              <Badge variant="secondary" className="bg-success/15 text-success">
                {fmtSigned(m.total_profit_R)}R
              </Badge>
              <span className="hidden sm:inline text-muted-foreground">
                Sharpe <span className="font-semibold text-foreground">{m.sharpe}</span>
              </span>
              <span className="hidden sm:inline text-muted-foreground">
                Brier <span className="font-semibold text-foreground">{m.brier_score}</span>
              </span>
            </>
          )}
        </div>
      }
      bodyClassName="p-2 sm:p-3"
    >
      {isLoading || !bt ? (
        <Skeleton className="h-[400px] rounded-xl" />
      ) : (
        <CumulativeChart data={bt.equity_curve} height={420} />
      )}
    </SectionCard>
  );
}

// ─── Probability Analysis ──────────────────────────────────────
function ProbabilitySection() {
  const { data, isLoading } = useProbabilityDist();
  return (
    <SectionCard
      title="Probability Distribution"
      description="Model probability histogram · percentiles · cumulative"
      icon={<BarChart3 className="h-4 w-4 text-info" />}
      action={data && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>μ <span className="font-semibold text-foreground">{(data.mean * 100).toFixed(1)}%</span></span>
          <span>σ <span className="font-semibold text-foreground">{(data.std * 100).toFixed(1)}%</span></span>
          <span>P50 <span className="font-semibold text-foreground">{(data.percentiles.p50 * 100).toFixed(1)}%</span></span>
        </div>
      )}
      bodyClassName="p-2 sm:p-3"
    >
      {isLoading || !data ? (
        <Skeleton className="h-[260px] rounded-xl" />
      ) : (
        <ProbabilityDist data={data} height={280} />
      )}
    </SectionCard>
  );
}

// ─── AI Prediction ─────────────────────────────────────────────
function AiPredictionSection() {
  const { data: insights, isLoading } = useInsights();
  return (
    <SectionCard
      title="AI Prediction Insights"
      description="Natural-language decision drivers from the model"
      icon={<Brain className="h-4 w-4 text-success" />}
      bodyClassName="p-3"
    >
      {isLoading || !insights ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {insights.map((ins, i) => (
            <motion.div
              key={ins.title}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="p-3 h-full">
                <div className="flex items-center gap-2 mb-1.5">
                  <DynamicIcon name={ins.icon} size={14} className={accentText[ins.accent]} />
                  <span className="text-xs font-semibold">{ins.title}</span>
                  <span className={`ml-auto text-[10px] font-bold tabular-nums ${accentText[ins.accent]}`}>
                    {(ins.weight * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{ins.text}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ─── Market Overview ───────────────────────────────────────────
function MarketOverviewSection() {
  const { data: market, isLoading } = useMarket();
  return (
    <SectionCard
      title="Market Overview"
      description="Multi-asset real-time prices · AI signals"
      icon={<Activity className="h-4 w-4 text-info" />}
      bodyClassName="p-3"
    >
      {isLoading || !market ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {market.map((a, i) => <MarketTile key={a.symbol} asset={a} index={i} />)}
        </div>
      )}
    </SectionCard>
  );
}

// ─── ML Models ─────────────────────────────────────────────────
function ModelsSection() {
  const { data: models, isLoading } = useModels();
  return (
    <SectionCard
      title="Machine Learning Models"
      description="Active model · benchmarks · queued experiments"
      icon={<Cpu className="h-4 w-4 text-success" />}
      bodyClassName="p-3"
    >
      {isLoading || !models ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {models.map((m, i) => <ModelCard key={m.name} model={m} index={i} />)}
        </div>
      )}
    </SectionCard>
  );
}

// ─── Heatmap ───────────────────────────────────────────────────
function HeatmapSection() {
  const { data, isLoading } = useHeatmap();
  return (
    <SectionCard
      title="Feature Correlation Heatmap"
      description="Multicollinearity matrix · 17 features"
      icon={<Grid3x3 className="h-4 w-4 text-warning" />}
      bodyClassName="p-2 sm:p-3"
    >
      {isLoading || !data ? (
        <Skeleton className="h-[360px] rounded-xl" />
      ) : (
        <HeatmapChart data={data} height={380} />
      )}
    </SectionCard>
  );
}

// ─── Confidence Gauges ─────────────────────────────────────────
function ConfidenceSection() {
  const { data, isLoading } = useConfidence();
  return (
    <SectionCard
      title="Confidence Analysis"
      description="Risk-adjusted performance gauges"
      icon={<Gauge className="h-4 w-4 text-info" />}
      bodyClassName="p-3"
    >
      {isLoading || !data ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {data.gauges.slice(0, 6).map((g) => <GaugeChart key={g.label} gauge={g} height={130} />)}
        </div>
      )}
    </SectionCard>
  );
}

// ─── Feature Importance ────────────────────────────────────────
function FeatureSection() {
  const { data: features, isLoading } = useFeatures();
  const max = features?.[0]?.abs ?? 1;
  return (
    <SectionCard
      title="Feature Importance"
      description="L1 logistic regression coefficients · sorted by |weight|"
      icon={<Target className="h-4 w-4 text-success" />}
      bodyClassName="p-4"
    >
      {isLoading || !features ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-6 rounded-lg" />)}
        </div>
      ) : (
        <div className="space-y-1.5">
          {features.map((f) => {
            const pct = (f.abs / max) * 100;
            const isPos = f.coefficient >= 0;
            return (
              <div key={f.feature} className="flex items-center gap-3 text-xs">
                <span className="w-28 shrink-0 truncate font-mono text-muted-foreground">{f.feature}</span>
                <div className="relative h-5 flex-1 rounded-md bg-muted/40">
                  <div
                    className={`absolute top-0 h-full rounded-md ${isPos ? "bg-success/60 left-1/2" : "bg-destructive/60 right-1/2"}`}
                    style={{ width: `${pct / 2}%` }}
                  />
                  <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
                </div>
                <span className={`w-12 shrink-0 text-right font-semibold tabular-nums ${isPos ? "text-success" : "text-destructive"}`}>
                  {f.coefficient >= 0 ? "+" : ""}{f.coefficient.toFixed(3)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
