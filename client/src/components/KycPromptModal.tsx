import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Loader2, Fingerprint, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/ui/Logo";

const DOCUMENT_TYPES = [
  { value: "nin", label: "National Identification Number (NIN)", placeholder: "11-digit NIN" },
  { value: "bvn", label: "Bank Verification Number (BVN)", placeholder: "11-digit BVN" },
  { value: "voters_card", label: "Voter's Card (VIN)", placeholder: "Voter identification number" },
  { value: "drivers_license", label: "Driver's Licence", placeholder: "Licence number" },
  { value: "passport", label: "International Passport", placeholder: "Passport number" },
  { value: "national_id", label: "National ID / Residence Permit", placeholder: "ID number" },
];

export default function KycPromptModal() {
  const { toast } = useToast();
  const [documentType, setDocumentType] = useState("nin");
  const [documentCountry, setDocumentCountry] = useState("NG");
  const [documentNumber, setDocumentNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const currentDocument = DOCUMENT_TYPES.find(type => type.value === documentType) || DOCUMENT_TYPES[0];

  const handleComplete = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^[A-Z]{2}$/.test(documentCountry) || !documentNumber.trim()) {
      setError("Choose the issuing country and enter your ID number.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await apiRequest("POST", "/api/identity-verifications/verify", {
        documentType,
        documentCountry,
        documentNumber: documentNumber.trim(),
      });
      const data = await response.json();
      if (!response.ok || data.verified !== true) throw new Error(data.message || "Identity verification could not be completed.");
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      await queryClient.refetchQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Identity verified", description: "Your one-time identity verification is complete." });
    } catch (err: any) {
      setError(err.message || "Identity verification failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }} className="w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-2xl">
        <div className="border-b bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 py-5">
          <div className="mb-3 flex items-center gap-3"><Logo /><Badge variant="outline" className="border-primary/40 text-xs font-medium text-primary">One-time verification</Badge></div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15"><Fingerprint className="h-5 w-5 text-primary" /></div>
            <div><h2 className="text-base font-bold leading-tight">Identity verification required</h2><p className="mt-0.5 text-xs text-muted-foreground">Enter a valid government-issued ID number to verify your identity.</p></div>
          </div>
        </div>
        <form onSubmit={handleComplete} className="space-y-4 px-6 py-5">
          <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/50 dark:bg-amber-950/30">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">Prembly checks the ID number directly with the issuing source. No document or selfie upload is required.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kyc-document-type">Identity document</Label>
              <select id="kyc-document-type" value={documentType} onChange={e => { setDocumentType(e.target.value); setDocumentNumber(""); setError(""); }} className="h-11 w-full rounded-md border border-input bg-muted/30 px-3 text-sm">
              {DOCUMENT_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kyc-document-country">Country issuing the document</Label>
            <Input id="kyc-document-country" value={documentCountry} maxLength={2} onChange={e => setDocumentCountry(e.target.value.toUpperCase())} placeholder="e.g. NG, GB, US" className="h-11 uppercase" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kyc-document-number">{currentDocument.label} number</Label>
            <Input id="kyc-document-number" value={documentNumber} onChange={e => { setDocumentNumber(e.target.value.toUpperCase()); setError(""); }} placeholder={currentDocument.placeholder || "Enter ID number"} className="h-11 uppercase" autoComplete="off" />
          </div>
          {error && <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
          <Button type="submit" disabled={saving} className="h-12 w-full font-semibold" data-testid="button-complete-kyc">
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying securely…</> : <><ShieldCheck className="mr-2 h-4 w-4" />Verify identity</>}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}