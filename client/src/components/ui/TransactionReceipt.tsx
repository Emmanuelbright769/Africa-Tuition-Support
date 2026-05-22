import { useState, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import {
  CheckCircle2, Clock, Copy, Check, X, RefreshCw, Share2,
  ImageDown, FileDown
} from "lucide-react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

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

// ─── Open a blob/dataURL in a new tab (share-without-download fallback) ────────
function openInTab(url: string, revokeAfterMs = 30_000) {
  const tab = window.open(url, "_blank");
  if (!tab) {
    // Browsers sometimes block window.open — create a hidden link and click it
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  if (revokeAfterMs > 0) setTimeout(() => URL.revokeObjectURL(url), revokeAfterMs);
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
  const [busy, setBusy] = useState<null | "save-img" | "share-img" | "save-pdf" | "share-pdf">(null);
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

  const now = timestamp ?? new Date().toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const words = amtWords ?? amountInWords(amount.replace(/[^0-9.]/g, ""));

  // ── Capture receipt as PNG (pixelRatio 2 = sharp but half the size of 3) ──
  const captureImage = async (): Promise<string> => {
    if (!receiptRef.current) throw new Error("No receipt element");
    return toPng(receiptRef.current, {
      quality: 0.92,
      pixelRatio: 2,
      backgroundColor: "white",
    });
  };

  // ── Build a compact text/vector PDF (no image embedding) ──────────────────
  // This produces files ~20–80 KB instead of 1–3 MB
  const buildTextPdf = (): { pdfBlob: Blob; filename: string } => {
    const PAGE_W = 148; // A5 width in mm
    const MARGIN = 10;
    const CONTENT_W = PAGE_W - MARGIN * 2;

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });

    // ── Header green banner ──
    pdf.setFillColor(22, 101, 52);
    pdf.rect(0, 0, PAGE_W, 58, "F");

    // Decorative circle accents
    pdf.setFillColor(255, 255, 255, 0.05);
    pdf.circle(PAGE_W + 2, -4, 22, "F");
    pdf.circle(PAGE_W - 6, 2, 14, "F");

    // Branding label
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(255, 255, 255);
    pdf.setGState(new (pdf as any).GState({ opacity: 0.5 }));
    pdf.text("POWERED BY", MARGIN, 10);
    pdf.setGState(new (pdf as any).GState({ opacity: 1 }));
    pdf.setFontSize(9);
    pdf.text("TSIA SWIFT WALLET", MARGIN, 15);

    // Status pill (drawn as filled rounded rect manually)
    const statusLabel = status === "success" ? "SUCCESSFUL" : status === "pending" ? "PENDING" : "PROCESSING";
    pdf.setFillColor(status === "success" ? 134 : status === "pending" ? 217 : 96,
                     status === "success" ? 239 : status === "pending" ? 119 : 165,
                     status === "success" ? 172 : status === "pending" ?   6 : 250);
    pdf.roundedRect(MARGIN, 20, 36, 6, 1.5, 1.5, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.5);
    pdf.setTextColor(status === "success" ? 21 : status === "pending" ? 120 : 37,
                     status === "success" ? 128 : status === "pending" ?  53 : 99,
                     status === "success" ?  61 : status === "pending" ?   7 : 235);
    pdf.text(statusLabel, MARGIN + 2.5, 24.4);

    // Title
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor(200, 240, 220);
    pdf.text((title || "Transaction Receipt").toUpperCase(), MARGIN, 32);

    // Amount
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(22);
    pdf.setTextColor(255, 255, 255);
    pdf.text(amount, MARGIN, 46);

    // Amount label
    if (amountLabel) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(200, 200, 200);
      pdf.text(amountLabel, MARGIN, 51.5);
    }

    // Timestamp (top-right of header)
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.5);
    pdf.setTextColor(255, 255, 255);
    pdf.setGState(new (pdf as any).GState({ opacity: 0.55 }));
    pdf.text(now, PAGE_W - MARGIN, 54, { align: "right" });
    pdf.setGState(new (pdf as any).GState({ opacity: 1 }));

    // ── Perforated divider line ──
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineDashPattern([1.5, 1.5], 0);
    pdf.line(MARGIN + 4, 62, PAGE_W - MARGIN - 4, 62);
    pdf.setLineDashPattern([], 0);

    // ── Receipt rows ──
    let y = 70;
    const ROW_H = 9;

    rows.forEach((row, i) => {
      // Alternating row background
      pdf.setFillColor(i % 2 === 0 ? 248 : 255, i % 2 === 0 ? 250 : 255, i % 2 === 0 ? 249 : 255);
      pdf.rect(MARGIN - 2, y - 5.5, CONTENT_W + 4, ROW_H, "F");

      // Label
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.setTextColor(row.gold ? 180 : 100, row.gold ? 130 : 100, row.gold ? 0 : 100);
      pdf.text(row.label.toUpperCase(), MARGIN, y);

      // Value — right-aligned
      const isGreen = row.green;
      const isRed = row.red;
      pdf.setFont(row.mono ? "courier" : "helvetica", row.bold ? "bold" : "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(
        isGreen ? 22 : isRed ? 185 : 30,
        isGreen ? 101 : isRed ? 28 : 30,
        isGreen ? 52 : isRed ? 28 : 30,
      );

      const valText = pdf.splitTextToSize(row.value, CONTENT_W * 0.55);
      pdf.text(valText, PAGE_W - MARGIN, y, { align: "right" });
      if (valText.length > 1) y += (valText.length - 1) * 4;

      // Separator
      if (i < rows.length - 1) {
        pdf.setDrawColor(230, 230, 230);
        pdf.setLineDashPattern([0.8, 0.8], 0);
        pdf.line(MARGIN, y + 2.5, PAGE_W - MARGIN, y + 2.5);
        pdf.setLineDashPattern([], 0);
      }

      y += ROW_H;
    });

    y += 4;

    // ── Footer box ──
    pdf.setFillColor(245, 247, 246);
    pdf.setDrawColor(220, 230, 225);
    pdf.roundedRect(MARGIN, y, CONTENT_W, 16, 2, 2, "FD");

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.5);
    pdf.setTextColor(140, 140, 140);
    const note = footerNote ?? "Keep this receipt for your records. For disputes or enquiries, contact support@tsiforafrica.com or visit tsiforafrica.com.";
    const noteLines = pdf.splitTextToSize(note, CONTENT_W - 6);
    pdf.text(noteLines, PAGE_W / 2, y + 5, { align: "center" });

    y += 20;

    // ── Branding footer ──
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(22, 101, 52);
    pdf.text("TSIA · tsiforafrica.com", PAGE_W / 2, y, { align: "center" });

    const pdfBlob = pdf.output("blob");
    return { pdfBlob, filename: `TSIA-Receipt-${Date.now()}.pdf` };
  };

  // ── Save as PNG (download) ─────────────────────────────────────────────────
  const handleSaveImage = async () => {
    if (busy) return;
    setBusy("save-img");
    try {
      const dataUrl = await captureImage();
      const a = document.createElement("a");
      a.download = `TSIA-Receipt-${Date.now()}.png`;
      a.href = dataUrl;
      a.click();
    } catch { /* ignore */ } finally { setBusy(null); }
  };

  // ── Build plain-text receipt summary for text-only share fallback ──────────
  const buildReceiptText = () => {
    const lines = [
      `TSIA SWIFT WALLET — ${(title || "Transaction Receipt").toUpperCase()}`,
      `Amount: ${amount}${amountLabel ? ` (${amountLabel})` : ""}`,
      `Date: ${now}`,
      "─────────────────────",
      ...rows.map(r => `${r.label}: ${r.value}`),
      "─────────────────────",
      "tsiforafrica.com",
    ];
    return lines.join("\n");
  };

  // ── Share as PNG — native share sheet, no download required ───────────────
  const handleShareImage = async () => {
    if (busy) return;
    setBusy("share-img");
    try {
      const dataUrl = await captureImage();
      const filename = `TSIA-Receipt-${Date.now()}.png`;

      // 1. Try native Web Share API with file (iOS Safari, Android Chrome)
      if (navigator.canShare && navigator.share) {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], filename, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "TSIA Transaction Receipt" });
          return;
        }
      }

      // 2. Fallback: share as text summary via Web Share API
      if (navigator.share) {
        await navigator.share({ title: "TSIA Transaction Receipt", text: buildReceiptText() });
        return;
      }

      // 3. Last resort: copy to clipboard
      await navigator.clipboard.writeText(buildReceiptText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* ignore */ } finally { setBusy(null); }
  };

  // ── Save as PDF (download) ─────────────────────────────────────────────────
  const handleSavePDF = () => {
    if (busy) return;
    setBusy("save-pdf");
    try {
      const { pdfBlob, filename } = buildTextPdf();
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5_000);
    } catch { /* ignore */ } finally { setBusy(null); }
  };

  // ── Share as PDF — native share sheet, no download required ───────────────
  const handleSharePDF = async () => {
    if (busy) return;
    setBusy("share-pdf");
    try {
      const { pdfBlob, filename } = buildTextPdf();

      // 1. Try native Web Share API with PDF file (Android Chrome, iOS Safari)
      if (navigator.canShare && navigator.share) {
        const file = new File([pdfBlob], filename, { type: "application/pdf" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "TSIA Transaction Receipt" });
          return;
        }
      }

      // 2. Fallback: share as text summary via Web Share API
      if (navigator.share) {
        await navigator.share({ title: "TSIA Transaction Receipt", text: buildReceiptText() });
        return;
      }

      // 3. Last resort: copy to clipboard
      await navigator.clipboard.writeText(buildReceiptText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* ignore */ } finally { setBusy(null); }
  };

  const isBusy = busy !== null;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      {/* Full-screen dialog overlay */}
      <DialogContent className="fixed inset-0 w-screen h-[100dvh] max-w-none max-h-none translate-x-0 translate-y-0 top-0 left-0 p-0 m-0 rounded-none border-0 shadow-none bg-background dark:bg-slate-900 flex flex-col">

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Logo variant="badge" height={24} />
            <span className="text-sm font-bold text-foreground">Receipt</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors"
            data-testid="btn-receipt-close-top"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Scrollable receipt area ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-sm mx-auto py-4 px-4">

            {/* ── Capturable receipt card ── */}
            <div ref={receiptRef} className="bg-background dark:bg-slate-900 rounded-3xl overflow-hidden border border-border/50 shadow-xl">

              {/* ── Header green banner ── */}
              <div className="bg-gradient-to-br from-tsia-green via-emerald-700 to-[#0f3d25] px-5 pt-7 pb-8 relative overflow-hidden">
                <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5" />
                <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/5" />
                <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-tsia-gold/10" />

                <div className="flex items-center justify-between mb-6 relative z-10">
                  <div>
                    <p className="text-white/50 text-[9px] font-bold uppercase tracking-widest">Powered by</p>
                    <p className="text-white font-black text-xs tracking-wide">TSIA SWIFT WALLET</p>
                  </div>
                  <Logo variant="badge" forceDark height={38} className="opacity-90" />
                </div>

                <div className="relative z-10 flex items-center gap-1.5 mb-3">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusConfig.cls}`}>
                    {statusConfig.icon}
                    {statusConfig.label}
                  </span>
                </div>

                <p className="relative z-10 text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">{title}</p>

                <div className="relative z-10">
                  <p className="text-white font-black text-4xl leading-none">{amount}</p>
                  {amountLabel && <p className="text-white/60 text-[11px] mt-0.5">{amountLabel}</p>}
                  {words && <p className="text-tsia-gold/80 text-[11px] mt-1 font-medium italic">{words}</p>}
                </div>

                <p className="relative z-10 text-white/50 text-[10px] mt-3 font-mono">{now}</p>
              </div>

              {/* ── Perforated edge ── */}
              <div className="bg-background dark:bg-slate-900 px-4">
                <PerforationDivider />
              </div>

              {/* ── Receipt body ── */}
              <div className="relative bg-background dark:bg-slate-900 px-4 pb-5">
                <Watermark />

                {subtitle && (
                  <p className="text-center text-xs text-muted-foreground font-medium pt-2 pb-1">{subtitle}</p>
                )}

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

                <div className="relative z-10 mt-4 rounded-xl bg-muted/60 border border-border/60 px-3 py-2.5">
                  <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                    {footerNote ?? "Keep this receipt for your records. For disputes or enquiries, contact support@tsiforafrica.com or visit tsiforafrica.com. Powered by TSIA Swift Wallet."}
                  </p>
                </div>

                <div className="relative z-10 flex items-center justify-center gap-1.5 mt-3">
                  <Logo variant="badge" height={16} />
                  <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">TSIA · tsiforafrica.com</span>
                </div>
              </div>
            </div>
            {/* end capturable card */}

          </div>
        </div>

        {/* ── Bottom actions ── */}
        <div className="shrink-0 border-t border-border bg-background dark:bg-slate-900 px-4 py-3 space-y-2">

          {/* Copy ref row (optional) */}
          {referenceRow && (
            <button
              onClick={() => copy(referenceRow)}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              data-testid="btn-receipt-copy-ref"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-tsia-green" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Reference copied!" : `Copy reference: ${referenceRow}`}
            </button>
          )}

          {/* Save row */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-11 rounded-2xl text-xs font-semibold gap-1.5"
              onClick={handleSaveImage}
              disabled={isBusy}
              data-testid="btn-receipt-save-image"
            >
              {busy === "save-img"
                ? <RefreshCw className="w-4 h-4 animate-spin" />
                : <ImageDown className="w-4 h-4" />}
              Save Image
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-11 rounded-2xl text-xs font-semibold gap-1.5"
              onClick={handleSavePDF}
              disabled={isBusy}
              data-testid="btn-receipt-save-pdf"
            >
              {busy === "save-pdf"
                ? <RefreshCw className="w-4 h-4 animate-spin" />
                : <FileDown className="w-4 h-4" />}
              Save PDF
            </Button>
          </div>

          {/* Share row */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-11 rounded-2xl text-xs font-semibold gap-1.5 border-tsia-green/30 text-tsia-green hover:bg-tsia-green/5"
              onClick={handleShareImage}
              disabled={isBusy}
              data-testid="btn-receipt-share-image"
            >
              {busy === "share-img"
                ? <RefreshCw className="w-4 h-4 animate-spin" />
                : <Share2 className="w-4 h-4" />}
              Share Image
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-11 rounded-2xl text-xs font-semibold gap-1.5 border-tsia-green/30 text-tsia-green hover:bg-tsia-green/5"
              onClick={handleSharePDF}
              disabled={isBusy}
              data-testid="btn-receipt-share-pdf"
            >
              {busy === "share-pdf"
                ? <RefreshCw className="w-4 h-4 animate-spin" />
                : <Share2 className="w-4 h-4" />}
              Share PDF
            </Button>
          </div>

          {/* Done / New Tx row */}
          <div className="grid grid-cols-2 gap-2">
            {onNewTx ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 rounded-2xl text-xs font-semibold"
                  onClick={onNewTx}
                  data-testid="btn-receipt-new-tx"
                >
                  {newTxLabel}
                </Button>
                <Button
                  size="sm"
                  className="h-11 bg-tsia-green hover:bg-tsia-green/90 text-white font-bold rounded-2xl text-xs"
                  onClick={onClose}
                  data-testid="btn-receipt-done"
                >
                  <Check className="w-4 h-4 mr-1" /> Done
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                className="col-span-2 h-11 bg-tsia-green hover:bg-tsia-green/90 text-white font-bold rounded-2xl text-xs"
                onClick={onClose}
                data-testid="btn-receipt-done"
              >
                <Check className="w-4 h-4 mr-1" /> Done
              </Button>
            )}
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
