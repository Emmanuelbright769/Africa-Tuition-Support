import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Lock, Mail } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function TransactionPinSettings({ onDone }: { onDone?: () => void }) {
  const { toast } = useToast();
  const [otpCode, setOtpCode] = useState("");
  const [pin, setPinValue] = useState("");
  const { data: status } = useQuery<{ hasPin: boolean; isLocked: boolean; announcementPending: boolean }>({
    queryKey: ["/api/security/transaction-pin/status"],
    queryFn: () => apiRequest("GET", "/api/security/transaction-pin/status").then(r => r.json()),
  });
  const requestOtp = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/security/transaction-pin/request-otp");
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "Could not send verification code");
    },
    onSuccess: () => toast({ title: "Verification code sent", description: "Check your email for the code." }),
    onError: (e: Error) => toast({ title: "Could not send code", description: e.message, variant: "destructive" }),
  });
  const setPinMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/security/transaction-pin/set", { pin, otpCode });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "Could not set PIN");
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/security/transaction-pin/status"] }); setOtpCode(""); setPinValue(""); toast({ title: "Transaction PIN saved" }); onDone?.(); },
    onError: (e: Error) => toast({ title: "Could not save PIN", description: e.message, variant: "destructive" }),
  });
  return <section className="space-y-4">
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex gap-3"><div className="w-9 h-9 rounded-xl bg-tsia-green/10 flex items-center justify-center"><Lock className="w-4 h-4 text-tsia-green" /></div>
        <div><p className="font-bold">Transaction PIN</p><p className="text-xs text-muted-foreground">{status?.hasPin ? "Protect outgoing payments with your PIN." : "Set a 4-digit PIN for outgoing payments."}</p></div></div>
      {status?.isLocked && <p className="mt-3 text-xs text-red-600">PIN entry is temporarily locked. Please try again later.</p>}
      <Button variant="outline" className="mt-4 w-full" onClick={() => requestOtp.mutate()} disabled={requestOtp.isPending || status?.isLocked}>
        <Mail className="w-4 h-4 mr-2" /> {status?.hasPin ? "Change or reset PIN" : "Email verification code"}
      </Button>
    </div>
    <div className="space-y-3">
      <input type="tel" inputMode="numeric" maxLength={6} value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Email verification code" className="w-full rounded-xl border px-4 py-3 bg-background" />
      <input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={e => setPinValue(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="New 4-digit PIN" className="w-full rounded-xl border px-4 py-3 bg-background" />
      <Button className="w-full bg-tsia-green text-white" disabled={setPinMutation.isPending || pin.length !== 4 || otpCode.length !== 6 || status?.isLocked} onClick={() => setPinMutation.mutate()}>
        {setPinMutation.isPending ? "Saving…" : "Save transaction PIN"}
      </Button>
    </div>
  </section>;
}