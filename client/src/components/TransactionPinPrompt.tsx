import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function TransactionPinPrompt({ open, onOpenChange, onSubmit, loading = false, onSetupRequired }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (pin: string) => Promise<void> | void;
  loading?: boolean;
  onSetupRequired?: () => void;
}) {
  const [pin, setPin] = useState("");
  useEffect(() => { if (!open) setPin(""); }, [open]);
  const submit = async () => {
    if (pin.length !== 4) return;
    try { await onSubmit(pin); setPin(""); }
    catch (error: any) {
      if (/PIN_REQUIRED/i.test(error?.message || "")) { onOpenChange(false); onSetupRequired?.(); }
    }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><Lock className="w-5 h-5 text-tsia-green" /> Enter transaction PIN</DialogTitle>
        <DialogDescription>Your 4-digit PIN authorizes this outgoing payment.</DialogDescription>
      </DialogHeader>
      <input autoFocus type="password" inputMode="numeric" maxLength={4} value={pin}
        onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
        onKeyDown={e => { if (e.key === "Enter") submit(); }}
        placeholder="• • • •" className="w-full text-center text-3xl font-black tracking-[.5em] border-2 border-border rounded-2xl px-4 py-4 bg-background focus:outline-none focus:border-tsia-green" />
      <Button className="w-full h-12 bg-tsia-green text-white font-bold rounded-2xl" disabled={loading || pin.length !== 4} onClick={submit}>
        {loading ? "Authorizing…" : "Confirm payment"}
      </Button>
    </DialogContent>
  </Dialog>;
}