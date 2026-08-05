import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck, CheckCircle2, Loader2, AlertCircle, Fingerprint, Lock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/ui/Logo";

const ID_OPTIONS = [
  { value: "nin",             label: "National Identity Number (NIN)",       hint: "11-digit NIN",                       numeric: true,  len: [11, 11] },
  { value: "bvn",             label: "Bank Verification Number (BVN)",       hint: "11-digit BVN",                       numeric: true,  len: [11, 11] },
  { value: "passport",        label: "International Passport",               hint: "Passport number (e.g. A12345678)",   numeric: false, len: [6,  15] },
  { value: "voters_card",     label: "Voter's Card / PVC (VIN)",             hint: "Voter Identification Number",        numeric: false, len: [10, 25] },
  { value: "drivers_license", label: "Driver's License",                     hint: "e.g. ABC00000AA00",                  numeric: false, len: [8,  20] },
  { value: "national_id",     label: "National ID / Residence Permit",       hint: "National ID or residence card",      numeric: false, len: [5,  30] },
];

export default function KycPromptModal() {
  const { toast } = useToast();

  const [idType,       setIdType]       = useState("nin");
  const [idNumber,     setIdNumber]     = useState("");
  const [idLastName,   setIdLastName]   = useState("");  // required for passport
  const [verifying,    setVerifying]    = useState(false);
  const [verified,     setVerified]     = useState(false);
  const [verifiedData, setVerifiedData] = useState<any>(null);
  const [idError,      setIdError]      = useState("");
  const [saving,       setSaving]       = useState(false);

  const opt = ID_OPTIONS.find(o => o.value === idType) || ID_OPTIONS[0];
  const isReady =
    idNumber.length >= opt.len[0] &&
    idNumber.length <= opt.len[1] &&
    (!opt.numeric || /^\d+$/.test(idNumber)) &&
    (idType !== "passport" || idLastName.trim().length >= 2);

  const handleVerify = async () => {
    if (!isReady) { setIdError(`Please enter a valid ${opt.label}.`); return; }
    setIdError("");
    setVerifying(true);
    setVerified(false);
    try {
      const res = await apiRequest("POST", "/api/verification/validate-id", {
        idType, idNumber: idNumber.trim(), lastName: idLastName.trim(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Verification failed");
      setVerifiedData(data);
      setVerified(true);
      toast({ title: `${opt.label} Verified ✓`, description: "Identity confirmed successfully." });
    } catch (err: any) {
      setIdError(err.message || "Verification failed. Please check your details.");
    } finally {
      setVerifying(false);
    }
  };

  const handleComplete = async () => {
    if (!verified) return;
    setSaving(true);
    try {
      const res = await apiRequest("POST", "/api/verification/identity", {
        idType, idNumber: idNumber.trim(),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Failed to save"); }
      // Refresh auth so kycCompleted flips to true and this modal closes
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      // Wait a tick for React Query to refetch
      await queryClient.refetchQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Identity Verified ✓", description: "Your KYC is complete. Welcome to Tsifor Africa!" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-md bg-card rounded-2xl shadow-2xl border overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b px-6 py-5">
          <div className="flex items-center gap-3 mb-3">
            <Logo size={28} />
            <Badge variant="outline" className="text-xs font-medium border-primary/40 text-primary">
              One-Time Verification
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Fingerprint className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">Identity Verification Required</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tsifor Africa is required to verify the identity of all users.
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Why */}
          <div className="flex gap-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl p-3 border border-amber-200 dark:border-amber-800/50">
            <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              This one-time check protects your account and ensures the security of all platform
              transactions. You won't be asked again after completing this.
            </p>
          </div>

          {/* ID Type */}
          <div className="space-y-1.5">
            <Label htmlFor="kyc-id-type" className="text-sm font-medium">Identity Document Type</Label>
            <select
              id="kyc-id-type"
              value={idType}
              onChange={e => { setIdType(e.target.value); setIdNumber(""); setIdLastName(""); setVerified(false); setIdError(""); }}
              className="w-full h-11 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {ID_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* ID Number */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{opt.label}</Label>
            <Input
              value={idNumber}
              onChange={e => { setIdNumber(e.target.value); setVerified(false); setIdError(""); }}
              placeholder={opt.hint}
              inputMode={opt.numeric ? "numeric" : "text"}
              className="h-11 bg-muted/30 font-mono text-sm"
            />
          </div>

          {/* Last name — passport only */}
          <AnimatePresence>
            {idType === "passport" && (
              <motion.div
                key="lastname"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1.5 overflow-hidden"
              >
                <Label className="text-sm font-medium">Surname (as on passport)</Label>
                <Input
                  value={idLastName}
                  onChange={e => { setIdLastName(e.target.value); setVerified(false); }}
                  placeholder="Last name"
                  className="h-11 bg-muted/30"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error */}
          <AnimatePresence>
            {idError && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex gap-2 items-start bg-destructive/10 border border-destructive/30 rounded-xl p-3"
              >
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive leading-relaxed">{idError}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Verified badge */}
          <AnimatePresence>
            {verified && (
              <motion.div
                key="verified"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex gap-2 items-center bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-3"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    {opt.label} verified ✓
                  </p>
                  {verifiedData?.firstName && (
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 truncate">
                      {verifiedData.firstName} {verifiedData.lastName || verifiedData.middleName || ""}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="space-y-2.5 pt-1">
            {!verified ? (
              <Button
                className="w-full h-11 font-semibold"
                onClick={handleVerify}
                disabled={!isReady || verifying}
              >
                {verifying ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying…</>
                ) : (
                  <><ShieldCheck className="w-4 h-4 mr-2" /> Verify Identity</>
                )}
              </Button>
            ) : (
              <Button
                className="w-full h-11 font-semibold bg-emerald-600 hover:bg-emerald-700"
                onClick={handleComplete}
                disabled={saving}
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4 mr-2" /> Complete Verification</>
                )}
              </Button>
            )}
          </div>

          {/* Footer note */}
          <div className="flex gap-2 items-start pt-1">
            <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Your data is encrypted and stored securely. It will only be used to verify your identity
              and protect your account. See our{" "}
              <a href="/terms" className="underline hover:text-primary" target="_blank" rel="noopener noreferrer">
                privacy policy
              </a>
              .
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
