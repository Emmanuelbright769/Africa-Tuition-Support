import { useState, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import {
  CheckCircle2, Clock, Copy, Check, X, Printer, RefreshCw, Share2, Download
} from "lucide-react";
import { toPng } from "html-to-image";

// ─── Types ────────────────────────────────────────────────────────────────────
export type ReceiptRow = {
  label: string;
  value: string;
  mono?: boolean;
  gold?: boolean;
  green?: boolean;
  red?: boolean;
  bold?: boolean;
  wide?: boolean;
};

export interface ReceiptProps {
  open: boolean;
  onClose: () => void;
  status?: "success" | "pending" | "processing";
  title?: string;
  subtitle?: string;
  amount: string;
  amountLabel?: string;
  amountInWords?: string;
  timestamp?: string;
  rows: ReceiptRow[];
  footerNote?: string;
  onNewTx?: () => void;
  newTxLabel?: string;
  referenceRow?: string;
}

// ─── Number to words (simple, for USD-range values) ──────────────────────────
const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigitsToWords(n: number): string {
  if (n < 20) return ones[n] || "";
  const t = Math.floor(n / 10);
  const o = n % 10;
  return tens[t] + (o ? " " + ones[o] : "");
}

function toWords(n: number): string {
  if (n === 0) return "Zero";
  let result = "";
  if (Math.floor(n / 1000) > 0) {
    result += twoDigitsToWords(Math.floor(n / 1000)) + " Thousand ";
    n = n % 1000;
  }
  if (Math.floor(n / 100) > 0) {
    result += ones[Math.floor(n / 100)] + " Hundred ";
    n = n % 100;
  }
  result += twoDigitsToWords(n);
  return result.trim();
}

export function amountInWords(raw: string | number): string {
  const num = typeof raw === "string" ? parseFloat(raw) : raw;
  if (isNaN(num)) return "";
  const dollars = Math.floor(num);
  const cents = Math.round((num - dollars) * 100);
  const d = toWords(dollars) + " Dollar" + (dollars !== 1 ? "s" : "");
  const c = cents > 0 ? " and " + toWords(cents) + " Cent" + (cents !== 1 ? "s" : "") : "";
  return d + c + " Only";
}

// ─── Perforated divider ───────────────────────────────────────────────────────
function PerforationDivider() {
  return (
    <div className="flex items-center -mx-1 my-0">
      <div className="w-5 h-5 rounded-full bg-background dark:bg-background border-r-0 shrink-0 -ml-2.5 border border-border" />
      <div className="flex-1 border-t-2 border-dashed border-border/60" />
      <div className="w-5 h-5 rounded-full bg-background dark:bg-background border-l-0 shrink-0 -mr-2.5 border border-border" />
    </div>
  );
}

// ─── Watermark ────────────────────────────────────────────────────────────────
function Watermark() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden rounded-b-2xl">
      <div
        className="text-[80px] font-black text-tsia-green/[0.04] dark:text-tsia-green/[0.07] leading-none whitespace-nowrap"
        style={{ transform: "rotate(-35deg)", letterSpacing: "-0.04em" }}
      >
        TSIA
      </div>
    </div>
  );
}

// ─── Main receipt component ───────────────────────────────────────────────────
export function TransactionReceipt({
  open, onClose, status = "success",
  title = "Transaction Receipt",
  subtitle,
  amount, amountLabel, amountInWords: amtWords,
  timestamp,
  rows, footerNote, onNewTx, newTxLabel = "New Transaction",
  referenceRow,
}: ReceiptProps) {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  const statusConfig = {
    success:    { label: "Successful",  cls: "bg-tsia-green/10 text-tsia-green border-tsia-green/30",  icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    pending:    { label: "Pending",     cls: "bg-amber-50 text-amber-600 border-amber-300 dark:bg-amber-900/20 dark:text-amber-400",   icon: <Clock className="w-3.5 h-3.5" /> },
    processing: { label: "Processing",  cls: "bg-blue-50 text-blue-600 border-blue-300 dark:bg-blue-900/20 dark:text-blue-400",        icon: <RefreshCw className="w-3.5 h-3.5" /> },
  }[status];

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShare = async () => {
    if (!receiptRef.current || sharing) return;
    setSharing(true);
    try {
      const dataUrl = await toPng(receiptRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: "white",
      });
      const filename = `TSIA-Receipt-${Date.now()}.png`;

      if (navigator.canShare && navigator.share) {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], filename, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "TSIA Transaction Receipt" });
          setSharing(false);
          return;
        }
      }
      // Fallback: download as PNG
      const link = document.createElement("a");
      link.download = filename;
      link.href = dataUrl;
      link.click();
    } catch {
      // ignore
    } finally {
      setSharing(false);
    }
  };

  const now = timestamp ?? new Date().toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const words = amtWords ?? amountInWords(amount.replace(/[^0-9.]/g, ""));

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden rounded-3xl border-0 shadow-2xl bg-transparent">
        <div className="bg-background dark:bg-slate-900 rounded-3xl overflow-hidden flex flex-col max-h-[92vh]">

          {/* ── Capturable receipt area ── */}
          <div ref={receiptRef} className="flex flex-col">
            {/* ── Header green banner ── */}
            <div className="bg-gradient-to-br from-tsia-green via-emerald-700 to-[#0f3d25] px-5 pt-7 pb-8 relative overflow-hidden">
              {/* Background rings */}
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5" />
              <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/5" />
              <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-tsia-gold/10" />

              {/* Logo row */}
              <div className="flex items-center justify-between mb-6 relative z-10">
                <div>
                  <p className="text-white/50 text-[9px] font-bold uppercase tracking-widest">Powered by</p>
                  <p className="text-white font-black text-xs tracking-wide">TSIA SWIFT WALLET</p>
                </div>
                <Logo variant="badge" forceDark height={38} className="opacity-90" />
              </div>

              {/* Status badge */}
              <div className="relative z-10 flex items-center gap-1.5 mb-3">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusConfig.cls}`}>
                  {statusConfig.icon}
                  {statusConfig.label}
                </span>
              </div>

              {/* Title */}
              <p className="relative z-10 text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">{title}</p>

              {/* Amount */}
              <div className="relative z-10">
                <p className="text-white font-black text-4xl leading-none">{amount}</p>
                {amountLabel && <p className="text-white/60 text-[11px] mt-0.5">{amountLabel}</p>}
                {words && <p className="text-tsia-gold/80 text-[11px] mt-1 font-medium italic">{words}</p>}
              </div>

              {/* Timestamp */}
              <p className="relative z-10 text-white/50 text-[10px] mt-3 font-mono">{now}</p>
            </div>

            {/* ── Perforated edge ── */}
            <div className="bg-background dark:bg-slate-900 px-4">
              <PerforationDivider />
            </div>

            {/* ── Receipt body ── */}
            <div className="relative bg-background dark:bg-slate-900 flex-1 overflow-y-auto px-4 pb-4">
              <Watermark />

              {subtitle && (
                <p className="text-center text-xs text-muted-foreground font-medium pt-2 pb-1">{subtitle}</p>
              )}

              {/* Receipt rows */}
              <div className="space-y-0 relative z-10">
                {rows.map((row, i) => (
                  <div key={i} className={`flex items-start justify-between py-2.5 ${i < rows.length - 1 ? "border-b border-dashed border-border/50" : ""}`}>
                    <span className={`text-[11px] font-bold uppercase tracking-wide shrink-0 mr-3 pt-0.5 ${row.gold ? "text-tsia-gold" : row.green ? "text-tsia-green" : "text-tsia-gold"}`}>
                      {row.label}
                    </span>
                    <span className={`text-right text-xs leading-snug max-w-[60%] break-all ${row.mono ? "font-mono" : "font-semibold"} ${row.red ? "text-red-500" : row.green ? "text-tsia-green" : "text-foreground"} ${row.bold ? "font-black" : ""}`}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Footer note */}
              <div className="relative z-10 mt-4 rounded-xl bg-muted/60 border border-border/60 px-3 py-2.5">
                <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                  {footerNote ?? "Keep this receipt for your records. For disputes or enquiries, contact support@tsiforafrica.com or visit tsiforafrica.com. Powered by TSIA Swift Wallet — Fintech for Educational Empowerment."}
                </p>
              </div>

              {/* TSIA footer brand */}
              <div className="relative z-10 flex items-center justify-center gap-1.5 mt-3">
                <Logo variant="badge" height={16} />
                <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">TSIA · tsiforafrica.com</span>
              </div>
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="relative z-10 bg-background dark:bg-slate-900 border-t border-border px-4 py-3 flex gap-2">
            {referenceRow && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-10 rounded-2xl text-xs"
                onClick={() => copy(referenceRow)}
                data-testid="btn-receipt-copy-ref"
              >
                {copied ? <Check className="w-3.5 h-3.5 mr-1 text-tsia-green" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {copied ? "Copied!" : "Copy Ref"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-10 rounded-2xl text-xs border-tsia-green/40 text-tsia-green hover:bg-tsia-green/5"
              onClick={handleShare}
              disabled={sharing}
              data-testid="btn-receipt-share"
            >
              {sharing
                ? <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />
                : <Share2 className="w-3.5 h-3.5 mr-1" />}
              {sharing ? "…" : "Save"}
            </Button>
            {onNewTx && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-10 rounded-2xl text-xs border-tsia-green/40 text-tsia-green hover:bg-tsia-green/5"
                onClick={onNewTx}
                data-testid="btn-receipt-new-tx"
              >
                <Printer className="w-3.5 h-3.5 mr-1" />
                {newTxLabel}
              </Button>
            )}
            <Button
              size="sm"
              className="flex-1 h-10 bg-tsia-green hover:bg-tsia-green/90 text-white font-bold rounded-2xl text-xs"
              onClick={onClose}
              data-testid="btn-receipt-close"
            >
              <Check className="w-3.5 h-3.5 mr-1" /> Done
            </Button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
