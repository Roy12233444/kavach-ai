import { useState } from "react";
import { Download, Flag, Smartphone, Terminal } from "lucide-react";
import type { AttackLogItem, Scoreboard, WalEntry } from "../types";

interface LiveLogsTabProps {
  scoreboard: Scoreboard;
  attackLog: AttackLogItem[];
  wal: WalEntry[];
  lsn: number;
  onReportBypass: (logId: string) => Promise<void>;
}

export function LiveLogsTab({
  scoreboard,
  attackLog,
  wal,
  lsn,
  onReportBypass,
}: LiveLogsTabProps) {
  const [showJson, setShowJson] = useState(false);

  const stats = [
    { label: "Fired", value: scoreboard.fired, color: "text-slate-900" },
    { label: "Killed", value: scoreboard.killed, color: "text-red-600" },
    { label: "Warned", value: scoreboard.warned, color: "text-amber-600" },
    { label: "Passed", value: scoreboard.passed, color: "text-emerald-600" },
    { label: "Bypasses", value: scoreboard.bypass_found, color: "text-blue-600" },
  ];

  return (
    <div className="space-y-5">
      {/* 5 Clean White Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {stats.map((st) => (
          <div
            key={st.label}
            className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4"
          >
            <div className={`text-2xl font-extrabold font-mono ${st.color}`}>
              {st.value}
            </div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">
              {st.label}
            </div>
          </div>
        ))}
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Attack Audit Log</h2>
            <p className="text-xs text-slate-500">
              Live log of every desktop and mobile jury request. Flag any unexpected pass as a bypass.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowJson((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{showJson ? "Hide Export JSON" : "Show Export JSON"}</span>
          </button>
        </div>

        {showJson && (
          <pre className="m-4 rounded-xl bg-slate-50 border border-slate-200 p-3.5 font-mono text-[11px] text-slate-700 overflow-x-auto max-h-56">
            {JSON.stringify({ scoreboard, attack_log: attackLog }, null, 2)}
          </pre>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-2.5 px-4">Time</th>
                <th className="py-2.5 px-4">Source</th>
                <th className="py-2.5 px-4">Prompt</th>
                <th className="py-2.5 px-4">Verdict</th>
                <th className="py-2.5 px-4">Rule</th>
                <th className="py-2.5 px-4 text-right">Latency</th>
                <th className="py-2.5 px-4 text-right">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attackLog.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Nothing fired yet. Run a test in Live Shield or scan Jury QR.
                  </td>
                </tr>
              ) : (
                attackLog.map((item) => {
                  const verdictBadge =
                    item.verdict === "KILL"
                      ? "bg-red-100 text-red-700"
                      : item.verdict === "WARN"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-emerald-100 text-emerald-700";
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                        {item.timestamp}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {item.source === "mobile_jury" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold">
                            <Smartphone className="w-3 h-3" />
                            Mobile Jury
                          </span>
                        ) : (
                          <span className="text-slate-600">
                            {item.source === "proof_deck" ? "Before/After" : "Desktop"}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-800 max-w-xs truncate">
                        {item.text}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${verdictBadge}`}
                        >
                          {item.verdict}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {item.rule || "—"}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-right text-slate-700 whitespace-nowrap">
                        {item.latency_ms.toFixed(2)} ms
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        {item.verdict === "PASS" && !item.bypass_reported ? (
                          <button
                            type="button"
                            onClick={() => void onReportBypass(item.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:underline cursor-pointer"
                          >
                            <Flag className="w-3 h-3" />
                            Flag bypass
                          </button>
                        ) : item.bypass_reported ? (
                          <span className="text-[11px] font-semibold text-red-600">
                            Bypass flagged
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compact Write-Ahead Log (WAL) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">Write-Ahead Log (WAL)</h3>
          </div>
          <span className="font-mono text-xs text-slate-500">
            LSN {String(lsn).padStart(4, "0")}
          </span>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 max-h-52 overflow-y-auto font-mono text-[11px] leading-6 space-y-0.5">
          {wal.map((entry, idx) => {
            const kindColor =
              entry.kind === "kill"
                ? "text-red-600 font-semibold"
                : entry.kind === "warn"
                ? "text-amber-700 font-semibold"
                : entry.kind === "pass"
                ? "text-emerald-700 font-semibold"
                : "text-blue-600 font-semibold";
            return (
              <div key={`${entry.lsn}-${idx}`} className="flex gap-2.5">
                <span className="text-slate-400 shrink-0">{entry.timestamp}</span>
                <span className="text-slate-500 shrink-0">{entry.lsn_label}</span>
                <span className={`${kindColor} shrink-0 w-10`}>{entry.kind}</span>
                <span className="text-slate-700 break-words">{entry.message}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
