import {
  AlertTriangle,
  HardDrive,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  X,
} from "lucide-react";
import type { ToastItem } from "../types";

interface ToastAlertsProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastAlerts({ toasts, onDismiss }: ToastAlertsProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="assertive"
      className="fixed top-20 right-4 z-50 w-[min(92vw,420px)] space-y-2.5 pointer-events-none"
    >
      {toasts.map((t) => {
        const isCritical = t.level === "critical";
        const isWarn = t.level === "warn";

        const containerCls = isCritical
          ? "bg-white border-2 border-red-400 shadow-xl shadow-red-900/10"
          : isWarn
          ? "bg-white border-2 border-amber-300 shadow-xl shadow-amber-900/10"
          : "bg-white border border-emerald-300 shadow-lg";

        const iconBg = isCritical
          ? "bg-red-600 text-white"
          : isWarn
          ? "bg-amber-500 text-white"
          : "bg-emerald-600 text-white";

        const titleCls = isCritical
          ? "text-red-800"
          : isWarn
          ? "text-amber-900"
          : "text-emerald-900";

        const badgeCls = isCritical
          ? "bg-red-50 text-red-700 border-red-200"
          : isWarn
          ? "bg-amber-50 text-amber-800 border-amber-200"
          : "bg-emerald-50 text-emerald-700 border-emerald-200";

        return (
          <div
            key={t.id}
            role="alert"
            className={`pointer-events-auto rounded-2xl p-3.5 flex items-start gap-3 transition-all ${containerCls}`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}
            >
              {isCritical ? (
                <ShieldAlert className="w-5 h-5" />
              ) : isWarn ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`text-xs font-extrabold tracking-tight ${titleCls}`}>
                  {t.title}
                </span>
                {t.badge && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${badgeCls}`}
                  >
                    {t.badge.includes("MOBILE") && <Smartphone className="w-2.5 h-2.5" />}
                    {t.badge.includes("WATCHER") && <HardDrive className="w-2.5 h-2.5" />}
                    {t.badge}
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-700 leading-snug break-words">
                {t.message}
              </p>

              {t.meta && (
                <div className="font-mono text-[10px] text-slate-500 truncate">
                  {t.meta}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss alert"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
