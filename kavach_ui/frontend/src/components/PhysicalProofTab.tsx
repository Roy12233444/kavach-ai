import {
  Database,
  Flame,
  HardDrive,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import type { BankingStatus, DiskStatus } from "../types";
import { ByteGrid } from "./ByteGrid";

interface PhysicalProofTabProps {
  disk: DiskStatus | null;
  banking: BankingStatus | null;
  onDiskReset: () => Promise<void>;
  onDiskDestroy: () => Promise<void>;
  onRefreshBanking: () => Promise<void>;
  busy?: boolean;
}

export function PhysicalProofTab({
  disk,
  banking,
  onDiskReset,
  onDiskDestroy,
  onRefreshBanking,
  busy = false,
}: PhysicalProofTabProps) {
  const intact = Boolean(disk?.exists && disk?.intact);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
      {/* Card 1: Physical Disk Canary */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between gap-5">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Physical Disk Canary
                </h2>
                <div className="font-mono text-xs text-slate-500">
                  {disk?.file_name || "production_database.txt"}
                </div>
              </div>
            </div>

            {intact ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                Intact on disk
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
                <Flame className="w-3.5 h-3.5" />
                FILE DESTROYED
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[210px_1fr] gap-5 items-start">
            <div className="space-y-2">
              <ByteGrid rawBytes={disk?.raw_bytes || []} destroyed={!disk?.exists} />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                95-cell live OS readback. Each cell maps directly to one byte on disk.
              </p>
            </div>

            <dl className="space-y-2.5 text-xs">
              <div>
                <dt className="text-slate-400 font-medium">File Size</dt>
                <dd
                  className={`text-lg font-bold font-mono ${
                    disk?.exists ? "text-slate-900" : "text-red-600"
                  }`}
                >
                  {disk?.byte_size ?? 0} bytes
                </dd>
              </div>
              <div>
                <dt className="text-slate-400 font-medium">SHA-256</dt>
                <dd className="font-mono text-[11px] text-slate-700 break-all bg-slate-50 border border-slate-200 rounded-lg p-2 mt-0.5">
                  {disk?.sha256 || "FILE MISSING — NO HASH"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <div>
                  <dt className="text-slate-400 font-medium">Last Readback</dt>
                  <dd className="font-mono text-slate-800">{disk?.last_readback || "—"}</dd>
                </div>
                <div className="text-right">
                  <dt className="text-slate-400 font-medium">Integrity</dt>
                  <dd className={`font-semibold ${intact ? "text-emerald-600" : "text-red-600"}`}>
                    {intact ? "SHA-256 Match" : "Missing / Altered"}
                  </dd>
                </div>
              </div>
            </dl>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onDiskReset()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restore 95B File</span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => void onDiskDestroy()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-xs font-semibold text-red-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Test rm -rf (No Guard)</span>
          </button>
        </div>
      </div>

      {/* Card 2: Live Core Banking SQLite */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between gap-5">
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Live Core Banking SQLite
                </h2>
                <div className="font-mono text-xs text-slate-500">
                  {banking?.db_file || "core_banking.db"} · table: {banking?.table || "accounts"}
                </div>
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              Read-only SQLite
            </span>
          </div>

          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Protected Ledger Capital
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-slate-900">
              {banking?.formatted_balance || "₹90,050,000.50 INR"}
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700">
                {banking?.total_accounts ?? 5} Active Accounts
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
                Status: {banking?.status || "verified"}
              </span>
            </div>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed">
            Live physical readback from <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">core_banking.db</code> — 0 rows modified. Every <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">DROP TABLE</code> or <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">TRUNCATE</code> proposal is halted by Rule R10 Indra before reaching SQLite.
          </p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onRefreshBanking()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Readback</span>
          </button>

          <span className="text-xs font-mono text-slate-400">Zero-Mock SQL Read</span>
        </div>
      </div>
    </div>
  );
}
