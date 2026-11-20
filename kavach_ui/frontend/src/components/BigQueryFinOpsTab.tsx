import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Database,
  DollarSign,
  Play,
  ShieldAlert,
  Sparkles,
  Wand2,
} from "lucide-react";
import type {
  FinOpsDecision,
  FinOpsPreset,
  FinOpsState,
  FinOpsTableMeta,
} from "../types";

interface BigQueryFinOpsTabProps {
  finops: FinOpsState;
  onFinopsUpdate: (next: FinOpsState) => void;
}

const BUDGET_CAP_OPTIONS = [1.0, 5.0, 10.0, 25.0];

const RISK_LABELS: Record<string, string> = {
  SELECT_STAR_FULL_WIDTH: "SELECT * (Full Columnar Scan)",
  NO_PARTITION_FILTER: "Missing Partition Filter",
  LIMIT_DOES_NOT_REDUCE_SCAN: "LIMIT Does Not Reduce BQ Billing",
  CROSS_JOIN_SCAN_AMPLIFICATION: "CROSS JOIN Scan Amplification",
  MULTI_DAY_PARTITION_RANGE: "Multi-Day Range Scan",
};

export function BigQueryFinOpsTab({
  finops,
  onFinopsUpdate,
}: BigQueryFinOpsTabProps) {
  const [sql, setSql] = useState(
    "SELECT * FROM prod_telemetry.events_100tb LIMIT 100;"
  );
  const [budgetCap, setBudgetCap] = useState<number>(finops.budget_cap_usd || 5.0);
  const [catalog, setCatalog] = useState<FinOpsTableMeta[]>([]);
  const [presets, setPresets] = useState<FinOpsPreset[]>([]);
  const [decision, setDecision] = useState<FinOpsDecision | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = (await fetch("/api/proto/finops/status").then((r) =>
          r.json()
        )) as {
          finops: FinOpsState;
          catalog: FinOpsTableMeta[];
          presets: FinOpsPreset[];
        };
        setCatalog(res.catalog || []);
        setPresets(res.presets || []);
        if (res.finops) {
          onFinopsUpdate(res.finops);
        }
      } catch {
        // Silent network guard on initial load
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const evaluateQuery = async (targetSql: string, targetCap = budgetCap) => {
    const clean = targetSql.trim();
    if (!clean || submitting) return;
    setSubmitting(true);
    try {
      const res = (await fetch("/api/proto/finops/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sql: clean,
          budget_cap_usd: targetCap,
        }),
      }).then((r) => r.json())) as {
        decision: FinOpsDecision;
        finops: FinOpsState;
      };
      setDecision(res.decision);
      if (res.finops) {
        onFinopsUpdate(res.finops);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplyRewrite = async () => {
    if (!decision?.safe_rewrite_sql) return;
    setSql(decision.safe_rewrite_sql);
    await evaluateQuery(decision.safe_rewrite_sql, budgetCap);
  };

  return (
    <div className="space-y-5">
      {/* 3 Crisp Google Cloud FinOps KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Hard Per-Query Cap (R5 Dharma)
            </span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-1 text-2xl font-extrabold font-mono text-slate-900">
            ${budgetCap.toFixed(2)} USD
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {BUDGET_CAP_OPTIONS.map((cap) => (
              <button
                key={cap}
                type="button"
                onClick={() => setBudgetCap(cap)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border transition-colors cursor-pointer ${
                  budgetCap === cap
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                ${cap}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Runaway Spend Prevented
            </span>
            <ShieldAlert className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-1 text-2xl font-extrabold font-mono text-emerald-600">
            ${(finops.usd_saved_total || 0).toFixed(2)} USD
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {finops.runaway_blocked} runaway queries blocked ·{" "}
            {finops.queries_approved} compliant approved
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Full-Table Scans Halted
            </span>
            <Database className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-1 text-2xl font-extrabold font-mono text-slate-900">
            {(finops.tb_prevented_total || 0).toFixed(2)} TB
          </div>
          <div className="text-xs text-slate-500 mt-1">
            GCP on-demand rate: ${(finops.usd_per_tb || 6.25).toFixed(2)} / TB scanned
          </div>
        </div>
      </div>

      {/* Interactive BigQuery SQL FinOps Inspector */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold">
              GOOGLE CLOUD FINOPS · RULE R5 DHARMA
            </span>
            <h2 className="text-base font-extrabold text-slate-900 mt-1.5">
              Pre-Dispatch BigQuery Cost Governor
            </h2>
            <p className="text-xs text-slate-500">
              Inspects agent SQL projections &amp; partition pruning before GCP dispatch — blocking multi-terabyte{" "}
              <code className="font-mono text-slate-700">SELECT *</code> billing spikes even when{" "}
              <code className="font-mono text-slate-700">LIMIT</code> is present.
            </p>
          </div>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setSql(p.sql);
                void evaluateQuery(p.sql, budgetCap);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                p.tone === "safe"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* SQL Box */}
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          rows={3}
          spellCheck={false}
          aria-label="BigQuery SQL query to inspect"
          className="w-full rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 px-4 py-3 font-mono text-xs sm:text-sm text-slate-900 outline-none resize-none transition-all"
          placeholder="SELECT * FROM prod_telemetry.events_100tb LIMIT 100;"
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void evaluateQuery(sql, budgetCap)}
            disabled={submitting || !sql.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>
              {submitting ? "Inspecting Cost Plan..." : "Dry-Run & Enforce R5 Cap"}
            </span>
          </button>
        </div>
      </div>

      {/* Live Cost Decision Banner + One-Click Safe Rewrite */}
      {decision && (
        <div
          className={`rounded-2xl border-2 p-5 sm:p-6 space-y-4 ${
            decision.verdict === "KILL"
              ? "bg-red-50 border-red-200"
              : "bg-emerald-50 border-emerald-200"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div
                className={`w-11 h-11 rounded-2xl text-white flex items-center justify-center shrink-0 ${
                  decision.verdict === "KILL"
                    ? "bg-red-600"
                    : "bg-emerald-600"
                }`}
              >
                {decision.verdict === "KILL" ? (
                  <ShieldAlert className="w-5 h-5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
              </div>
              <div className="space-y-1">
                <div className="text-base sm:text-lg font-extrabold text-slate-900">
                  {decision.verdict === "KILL"
                    ? `BLOCKED (${decision.rule || "R5_DHARMA"}) · $${decision.estimated_cost_usd.toFixed(2)} > $${decision.budget_cap_usd.toFixed(2)} Cap`
                    : `APPROVED · $${decision.estimated_cost_usd.toFixed(4)} (${decision.estimated_gb.toFixed(2)} GB)`}{" "}
                  <span className="font-mono text-sm font-semibold text-slate-600">
                    · {decision.latency_ms.toFixed(2)} ms
                  </span>
                </div>
                <p
                  className={`text-xs sm:text-sm ${
                    decision.verdict === "KILL"
                      ? "text-red-900"
                      : "text-emerald-900"
                  }`}
                >
                  {decision.details}
                </p>
              </div>
            </div>

            {decision.verdict === "KILL" && (
              <div className="px-3.5 py-2 rounded-xl bg-white border border-red-200 text-right shrink-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Projected Scan Halted
                </div>
                <div className="font-mono text-sm font-extrabold text-red-700">
                  {decision.estimated_tb.toFixed(2)} TB · $
                  {decision.estimated_cost_usd.toFixed(2)} Saved
                </div>
              </div>
            )}
          </div>

          {decision.risk_factors.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {decision.risk_factors.map((rf) => (
                <span
                  key={rf}
                  className="px-2.5 py-0.5 rounded-full bg-white border border-red-200 text-[11px] font-semibold text-red-700"
                >
                  {RISK_LABELS[rf] || rf}
                </span>
              ))}
            </div>
          )}

          {decision.verdict === "KILL" && decision.safe_rewrite_sql && (
            <div className="rounded-xl bg-white border border-slate-200 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>
                    Auto-Generated Partitioned Safe Rewrite (Projected Cost: $
                    {(decision.rewrite_estimated_cost_usd ?? 0.04).toFixed(4)})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleApplyRewrite()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Apply Safe Rewrite &amp; Re-Test</span>
                </button>
              </div>
              <pre className="rounded-lg bg-slate-50 border border-slate-200 p-3 font-mono text-xs text-slate-800 overflow-x-auto">
                {decision.safe_rewrite_sql}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Governed Enterprise Catalog */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            Governed BigQuery Production Tables
          </h3>
          <span className="text-[11px] text-slate-500">
            Columnar + Partition Metadata Registry
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-2.5 px-4">Table</th>
                <th className="py-2.5 px-4">Partition Key</th>
                <th className="py-2.5 px-4">Columns</th>
                <th className="py-2.5 px-4">Volume</th>
                <th className="py-2.5 px-4 text-right">Full SELECT * Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {catalog.map((t) => (
                <tr key={t.table_id} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-4">
                    <div className="font-mono font-bold text-slate-900">
                      {t.table_id}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {t.description} · {t.row_count_approx}
                    </div>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-blue-700 font-semibold">
                    {t.partition_column}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-700">
                    {t.column_count} cols
                  </td>
                  <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">
                    {t.total_tb.toFixed(3)} TB
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-red-600">
                    ${t.full_scan_usd.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
