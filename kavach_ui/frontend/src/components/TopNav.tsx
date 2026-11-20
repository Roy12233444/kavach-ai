import {
  Activity,
  Bell,
  BellOff,
  Crosshair,
  DollarSign,
  GitCompare,
  HardDrive,
  QrCode,
  RotateCcw,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import type { TabKey } from "../types";

interface TopNavProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  lastLatencyMs: number | null;
  wsConnected: boolean;
  geminiLive?: boolean;
  desktopAlertsOn: boolean;
  onToggleDesktopAlerts: () => void;
  onOpenQr: () => void;
  onResetDemo: () => void;
  resetting?: boolean;
}

const TABS: { key: TabKey; label: string; icon: typeof ShieldCheck }[] = [
  { key: "shield", label: "Live Shield", icon: ShieldCheck },
  { key: "proof", label: "Proof", icon: HardDrive },
  { key: "compare", label: "Compare", icon: GitCompare },
  { key: "redteam", label: "Red-Team 20", icon: Crosshair },
  { key: "finops", label: "FinOps R5", icon: DollarSign },
  { key: "logs", label: "Logs", icon: ScrollText },
];

export function TopNav({
  activeTab,
  onSelectTab,
  lastLatencyMs,
  wsConnected,
  geminiLive = false,
  desktopAlertsOn,
  onToggleDesktopAlerts,
  onOpenQr,
  onResetDemo,
  resetting = false,
}: TopNavProps) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Left: Crisp Brand Identity */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs shadow-blue-600/20 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
                KAVACH AI
              </span>
              <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200/80 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                {geminiLive ? "Gemini 2.5 Live" : "Hybrid Semantic"}
              </span>
            </div>
            <p className="hidden 2xl:block text-[11px] text-slate-500 whitespace-nowrap">
              Deterministic Invariant Armor for Autonomous Agents
            </p>
          </div>
        </div>

        {/* Center: Uniform Single-Line Segmented Tabs */}
        <nav
          aria-label="Primary navigation"
          className="hidden lg:flex items-center gap-1 h-9 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 shrink-0"
        >
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectTab(key)}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  active
                    ? "bg-white text-slate-900 font-semibold shadow-xs ring-1 ring-slate-200/70"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 shrink-0 ${
                    active ? "text-blue-600" : "text-slate-400"
                  }`}
                />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Uniform Height Controls (h-9 rounded-lg) */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 whitespace-nowrap shrink-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                wsConnected ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            <span>Armed</span>
            {lastLatencyMs !== null && (
              <>
                <span className="text-slate-300">·</span>
                <span className="font-mono text-slate-900 font-semibold inline-flex items-center gap-1">
                  <Activity className="w-3 h-3 text-emerald-600 shrink-0" />
                  {lastLatencyMs.toFixed(2)} ms
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleDesktopAlerts}
            title="Toggle Windows Desktop Notifications & Security Chime"
            className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            {desktopAlertsOn ? (
              <Bell className="w-3.5 h-3.5 text-slate-700 shrink-0" />
            ) : (
              <BellOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            )}
            <span>Alerts</span>
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                desktopAlertsOn ? "bg-emerald-500" : "bg-slate-300"
              }`}
            />
          </button>

          <button
            type="button"
            onClick={onOpenQr}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-xs whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5 shrink-0" />
            <span>Jury QR</span>
          </button>

          <button
            type="button"
            onClick={onResetDemo}
            disabled={resetting}
            title="Reset demo state, counters, and restore disk file"
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 shrink-0 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetting ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Compact Mobile/Tablet Tab Strip */}
      <div className="lg:hidden border-t border-slate-200 bg-slate-50/90 px-4 py-2 flex items-center gap-1.5 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectTab(key)}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all ${
                active
                  ? "bg-white text-slate-900 font-semibold shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Icon
                className={`w-3.5 h-3.5 shrink-0 ${
                  active ? "text-blue-600" : "text-slate-400"
                }`}
              />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
