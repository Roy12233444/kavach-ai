import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Flame,
  Play,
  Radio,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import type {
  AgentRole,
  DiskStatus,
  LiveSyncEvent,
  ProofCompareResponse,
  ReplayStep,
} from "../types";
import { ByteGrid } from "./ByteGrid";

const VALID_ROLES = new Set<AgentRole>([
  "general_agent",
  "support_agent",
  "coding_agent",
  "analyst_agent",
]);

interface BeforeAfterTabProps {
  disk: DiskStatus | null;
  onRunCompare: (
    text: string,
    role: AgentRole,
    keepSession: boolean
  ) => Promise<ProofCompareResponse>;
  onResetBoth: () => Promise<void>;
  lastCompare: ProofCompareResponse | null;
  liveSync: LiveSyncEvent | null;
  replaySteps: ReplayStep[];
}

export function BeforeAfterTab({
  disk,
  onRunCompare,
  onResetBoth,
  lastCompare,
  liveSync,
  replaySteps,
}: BeforeAfterTabProps) {
  const [attackText, setAttackText] = useState(
    "rm -rf production_database.txt && DROP TABLE users"
  );
  const [role, setRole] = useState<AgentRole>("general_agent");
  const [keepSession, setKeepSession] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!liveSync || liveSync.source === "proof_deck") return;
    setAttackText(liveSync.text);
    if (VALID_ROLES.has(liveSync.agent_role as AgentRole)) {
      setRole(liveSync.agent_role as AgentRole);
    }
  }, [liveSync]);

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attackText.trim() || running) return;
    setRunning(true);
    try {
      await onRunCompare(attackText.trim(), role, keepSession);
    } finally {
      setRunning(false);
    }
  };

  const ug = lastCompare?.unguarded;
  const gd = lastCompare?.guarded;
  const syncedPreview = !lastCompare && liveSync && liveSync.source !== "proof_deck" ? liveSync : null;

  const ugDestroyed = ug?.status === "DESTROYED";
  const gdProtected = gd ? gd.verdict === "KILL" : syncedPreview?.verdict === "KILL";
  const gdVerdict = gd?.verdict ?? syncedPreview?.verdict ?? null;
  const gdLatency = gd?.latency_ms ?? syncedPreview?.latency_ms ?? null;
  const gdRule = gd?.rule ?? syncedPreview?.rule ?? null;
  const gdMessage =
    gd?.message ??
    (syncedPreview
      ? syncedPreview.verdict === "KILL"
        ? `PROTECTED IN ${syncedPreview.latency_ms.toFixed(2)} ms — Killed live by ${syncedPreview.rule || "KAVACH"} before host dispatch.`
        : syncedPreview.details
      : null);

  return (
    <div className="space-y-5">
      {/* Controls Card */}
      <form
        onSubmit={handleRun}
        className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              One Attack, Two Worlds
            </h2>
            <p className="text-xs text-slate-500">
              Fires the exact same payload simultaneously against an unguarded shadow file and KAVACH Invariant Kernel.
            </p>
          </div>
          {syncedPreview && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-semibold">
              <Radio className="w-3 h-3" />
              <span>
                Live synced from{" "}
                {syncedPreview.source === "mobile_jury" ? "Phone (/jury)" : "Live Shield"}
              </span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_170px_auto_auto] gap-2.5 items-center">
          <input
            aria-label="Attack payload"
            type="text"
            value={attackText}
            onChange={(e) => setAttackText(e.target.value)}
            className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 font-mono text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500"
          />

          <select
            aria-label="Agent role"
            value={role}
            onChange={(e) => setRole(e.target.value as AgentRole)}
            className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 font-mono text-xs text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="general_agent">general_agent</option>
            <option value="support_agent">support_agent</option>
            <option value="coding_agent">coding_agent</option>
            <option value="analyst_agent">analyst_agent</option>
          </select>

          <button
            type="submit"
            disabled={running || !attackText.trim()}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{running ? "Running..." : "Run on Both Sides"}</span>
          </button>

          <button
            type="button"
            onClick={() => void onResetBoth()}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Both</span>
          </button>
        </div>

        <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={keepSession}
            onChange={(e) => setKeepSession(e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>
            Keep session between runs (send any follow-up next to prove Rule R6 Varuṇa)
          </span>
        </label>
      </form>

      {/* Side-by-Side Comparison Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Without KAVACH */}
        <div
          className={`bg-white rounded-2xl border p-5 space-y-4 ${
            ugDestroyed
              ? "border-red-300 bg-red-50/20"
              : syncedPreview?.would_destroy_unguarded || syncedPreview?.verdict === "KILL"
              ? "border-amber-300 bg-amber-50/15"
              : "border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">Without KAVACH</h3>
            {ug ? (
              ugDestroyed ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 border border-red-200 text-red-700 text-[11px] font-bold">
                  <Flame className="w-3 h-3" />
                  FILE DESTROYED
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                  Executed Unguarded
                </span>
              )
            ) : syncedPreview && (syncedPreview.would_destroy_unguarded || syncedPreview.verdict === "KILL") ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 border border-amber-200 text-amber-800 text-[11px] font-bold">
                <AlertTriangle className="w-3 h-3" />
                {syncedPreview.would_destroy_unguarded ? "Would Wipe Host File" : "Would Execute Exposed"}
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium">
                Waiting
              </span>
            )}
          </div>

          <div className="grid grid-cols-[175px_1fr] gap-4 items-start">
            <ByteGrid
              rawBytes={ug ? ug.raw_bytes : disk?.raw_bytes || []}
              destroyed={ugDestroyed}
            />
            <dl className="space-y-2 text-xs">
              <div>
                <dt className="text-slate-400">File Size</dt>
                <dd
                  className={`font-mono font-bold text-sm ${
                    ugDestroyed ? "text-red-600" : "text-slate-900"
                  }`}
                >
                  {ug
                    ? ugDestroyed
                      ? "0 bytes (missing)"
                      : `${ug.file_size} bytes`
                    : `${disk?.byte_size ?? 95} bytes`}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">SHA-256</dt>
                <dd className="font-mono text-[11px] text-slate-600 truncate">
                  {ug
                    ? ug.sha256
                      ? `${ug.sha256.slice(0, 18)}…`
                      : "— (wiped)"
                    : disk?.sha256
                    ? `${disk.sha256.slice(0, 18)}…`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Execution Time</dt>
                <dd className="font-mono text-slate-800">
                  {ug ? `${ug.latency_ms.toFixed(2)} ms` : "—"}
                </dd>
              </div>
            </dl>
          </div>

          <p
            className={`text-xs ${
              ugDestroyed
                ? "text-red-700 font-medium"
                : syncedPreview?.would_destroy_unguarded
                ? "text-amber-800 font-medium"
                : "text-slate-500"
            }`}
          >
            {ug?.message ||
              (syncedPreview
                ? syncedPreview.would_destroy_unguarded
                  ? 'Would wipe/compromise host if unguarded — click "Run on Both Sides" for real shadow unlink proof.'
                  : syncedPreview.verdict === "KILL"
                  ? 'Unguarded agent would execute this attack — click "Run on Both Sides" for isolated shadow comparison.'
                  : "Safe command; unguarded host executes directly."
                : "Run an attack above to witness physical host deletion without protection.")}
          </p>
        </div>

        {/* Right: With KAVACH AI */}
        <div
          className={`bg-white rounded-2xl border p-5 space-y-4 ${
            gdProtected ? "border-emerald-300 bg-emerald-50/20" : "border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">With KAVACH AI</h3>
            {gdVerdict ? (
              gdProtected && gdLatency !== null ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                  <ShieldCheck className="w-3 h-3" />
                  PROTECTED IN {gdLatency.toFixed(2)} ms
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 border border-blue-200 text-blue-700 text-[11px] font-semibold">
                  {gdVerdict}
                </span>
              )
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold">
                <CheckCircle2 className="w-3 h-3" />
                Armed
              </span>
            )}
          </div>

          <div className="grid grid-cols-[175px_1fr] gap-4 items-start">
            <ByteGrid
              rawBytes={gd ? gd.raw_bytes : disk?.raw_bytes || []}
              destroyed={false}
            />
            <dl className="space-y-2 text-xs">
              <div>
                <dt className="text-slate-400">File Size</dt>
                <dd className="font-mono font-bold text-sm text-slate-900">
                  {gd ? `${gd.file_size} bytes` : `${disk?.byte_size ?? 95} bytes`}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">SHA-256</dt>
                <dd className="font-mono text-[11px] text-slate-600 truncate">
                  {gd?.sha256
                    ? `${gd.sha256.slice(0, 18)}…`
                    : disk?.sha256
                    ? `${disk.sha256.slice(0, 18)}…`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Rule &amp; Speed</dt>
                <dd className="font-mono text-slate-800">
                  {gdLatency !== null
                    ? `${gdRule || "PASS"} · ${gdLatency.toFixed(2)} ms`
                    : "—"}
                </dd>
              </div>
            </dl>
          </div>

          <p className={`text-xs ${gdProtected ? "text-emerald-700 font-medium" : "text-slate-500"}`}>
            {gdMessage || "Run an attack above to watch KAVACH intercept before kernel execution."}
          </p>
        </div>
      </div>

      {/* Guard Decision Replay */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Guard Decision Replay</h3>
          <p className="text-xs text-slate-500">
            Step-by-step deterministic execution trace inside KAVACH AI.
          </p>
        </div>

        {replaySteps.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
            No replay yet. Run an attack above to inspect each guard gate.
          </div>
        ) : (
          <div className="space-y-2">
            {replaySteps.map((step, idx) => {
              const isKill = step.status === "KILL";
              const isWarn = step.status === "WARN";
              return (
                <div
                  key={`${step.id}-${idx}`}
                  className={`rounded-xl border p-3 flex items-center justify-between gap-3 ${
                    isKill
                      ? "bg-red-50/70 border-red-200"
                      : isWarn
                      ? "bg-amber-50/70 border-amber-200"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900">
                      {idx + 1}. {step.name}
                    </div>
                    <div className="text-[11px] text-slate-600 truncate">
                      {step.detail}
                    </div>
                  </div>
                  <div className="text-right shrink-0 font-mono">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isKill
                          ? "bg-red-100 text-red-700"
                          : isWarn
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {step.status}
                    </span>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {step.duration_ms.toFixed(3)} ms
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
