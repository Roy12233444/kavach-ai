import { useEffect, useState } from "react";
import { Check, Copy, Smartphone, X } from "lucide-react";

interface QrModalProps {
  open: boolean;
  juryUrl: string;
  onClose: () => void;
}

export function QrModal({ open, juryUrl, onClose }: QrModalProps) {
  const [copied, setCopied] = useState(false);
  const [nonce, setNonce] = useState(() => Date.now());

  useEffect(() => {
    if (open) setNonce(Date.now());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(juryUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable in restricted frame
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 space-y-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="qr-modal-title" className="text-base font-bold text-slate-900">
              Mobile Jury Challenge
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Scan on any smartphone (5G mobile data on Cloud Run, or venue Wi-Fi locally) to fire live attacks at KAVACH AI.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close QR dialog"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex justify-center">
          <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <img
              src={`/api/proto/jury-qr.svg?url=${encodeURIComponent(juryUrl)}&t=${nonce}`}
              alt="KAVACH AI Mobile Jury QR Code"
              className="w-52 h-52 block"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
          <code className="font-mono text-[11px] text-blue-700 truncate flex-1">
            {juryUrl}
          </code>
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 shrink-0 cursor-pointer"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>

        <a
          href="/jury"
          className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs inline-flex items-center justify-center gap-2 transition-colors"
        >
          <Smartphone className="w-4 h-4" />
          <span>Open Mobile Page (/jury)</span>
        </a>
      </div>
    </div>
  );
}
