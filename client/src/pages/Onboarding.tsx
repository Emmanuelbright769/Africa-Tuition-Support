import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ShieldAlert, CreditCard, Lock, FileText, CheckCircle2, Loader2,
  PartyPopper, XCircle, Wallet, ArrowRight, Share2, TrendingUp,
  Gift, Tag, ChevronDown, ChevronUp, AlertTriangle, BadgeCheck
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Logo } from "@/components/ui/Logo";
import { TermsCheckbox } from "@/components/ui/TermsCheckbox";
import { WAEC_COMPULSORY_SUBJECTS, WAEC_ELECTIVE_SUBJECTS, calculateWaecPercentage, getPayoutTier } from "@shared/schema";

const VALID_GRADES = ["A1", "B2", "B3", "C4", "C5", "C6", "D7", "E8", "F9"];

const PORTAL_FEE = 3.00;
const SERVICE_CHARGE = 0.30;
const TOTAL_FEE = +(PORTAL_FEE + SERVICE_CHARGE).toFixed(2);

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);

  // Step 1 — Identity document (multi-type)
  const [idType, setIdType] = useState("nin");
  const [idNumber, setIdNumber] = useState("");
  const [idLastName, setIdLastName] = useState(""); // required for passport
  const [idVerifying, setIdVerifying] = useState(false);
  const [idVerified, setIdVerified] = useState(false);
  const [idData, setIdData] = useState<any>(null);
  const [idError, setIdError] = useState("");

  // legacy aliases kept for non-Step-1 code that still references `nin`/`ninVerified`
  const nin = idNumber;
  const ninVerified = idVerified;

  // Step 2 — WAEC
  const [waecReg, setWaecReg] = useState("");
  const [waecYear, setWaecYear] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [schoolLocation, setSchoolLocation] = useState("");
  const [electives, setElectives] = useState<string[]>(["", "", ""]);
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [waecResult, setWaecResult] = useState<any>(null);
  const [waecFailed, setWaecFailed] = useState(false);
  const [failPercentage, setFailPercentage] = useState(0);

  // Sponsorship reason
  const [sponsorshipReason, setSponsorshipReason] = useState("");

  // Step 3 — Payment
  const [paymentTermsAccepted, setPaymentTermsAccepted] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);
  // Sponsor code
  const [showSponsorCode, setShowSponsorCode] = useState(false);
  const [sponsorCodeInput, setSponsorCodeInput] = useState("");
  const [sponsorCodeValidating, setSponsorCodeValidating] = useState(false);
  const [sponsorCodeResult, setSponsorCodeResult] = useState<{ valid: boolean; cohortName?: string; reason?: string } | null>(null);
  const [usedSponsorCode, setUsedSponsorCode] = useState(false);


  const { toast } = useToast();
  const { user } = useAuth();
  const { data: walletData } = useQuery<any>({ queryKey: ["/api/wallet"] });

  if (!user) { setLocation("/login"); return null; }
  const walletActivated = walletData?.activated === true;
  const requireWalletActivation = () => {
    if (walletActivated) return true;
    toast({
      title: "Activate Wallet First",
      description: "Fund your TSIA SwiftWallet with at least $5 before starting sponsorship verification.",
      variant: "destructive",
    });
    setLocation("/wallet");
    return false;
  };

  // ── Live score computation ──────────────────────────────────────────
  const allSubjectsSelected = [...WAEC_COMPULSORY_SUBJECTS, ...electives.filter(Boolean)];
  const gradedSubjects = allSubjectsSelected.filter(s => grades[s]);
  const gradeValues = gradedSubjects.map(s => grades[s]);
  const livePercentage = gradeValues.length > 0 ? calculateWaecPercentage(gradeValues) : null;
  const liveTier = livePercentage !== null ? getPayoutTier(livePercentage) : null;
  const allGradesFilled = allSubjectsSelected.length === 5 && allSubjectsSelected.every(s => grades[s]);
  const allElectivesSelected = electives.filter(Boolean).length === 3;

  // ── ID type config ──────────────────────────────────────────────────────
  const ID_OPTIONS = [
    { value: "nin",             label: "National Identity Number (NIN)",      hint: "11-digit NIN",                    numeric: true,  len: [11, 11] },
    { value: "bvn",             label: "Bank Verification Number (BVN)",      hint: "11-digit BVN",                    numeric: true,  len: [11, 11] },
    { value: "voters_card",     label: "Voter's Card / PVC (VIN)",            hint: "Voter Identification Number",     numeric: false, len: [10, 25] },
    { value: "drivers_license", label: "Driver's License",                    hint: "e.g. ABC00000AA00",               numeric: false, len: [8,  20] },
    { value: "passport",        label: "International Passport",              hint: "Passport number (e.g. A12345678)", numeric: false, len: [6,  15] },
    { value: "national_id",     label: "National ID / Residence Permit",      hint: "National ID or residence card number", numeric: false, len: [5, 30] },
  ];
  const currentIdOpt = ID_OPTIONS.find(o => o.value === idType) || ID_OPTIONS[0];
  const isIdReady = idNumber.length >= currentIdOpt.len[0] && idNumber.length <= currentIdOpt.len[1] &&
    (!currentIdOpt.numeric || /^\d+$/.test(idNumber)) &&
    (idType !== "passport" || idLastName.trim().length >= 2);

  // ── Verify identity document ────────────────────────────────────────────
  const handleVerifyId = async () => {
    if (!requireWalletActivation()) return;
    if (!isIdReady) { setIdError(`Please enter a valid ${currentIdOpt.label}.`); return; }
    setIdError("");
    setIdVerifying(true);
    try {
      const res = await apiRequest("POST", "/api/verification/validate-id", {
        idType, idNumber: idNumber.trim(), lastName: idLastName.trim(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Verification failed");
      setIdData(data);
      setIdVerified(true);
      toast({ title: `${currentIdOpt.label} Verified ✓`, description: data.demo ? "Format validated — live database check active." : `Confirmed via ${currentIdOpt.label} database.` });
    } catch (err: any) {
      setIdError(err.message || "Verification failed. Please check your details.");
    } finally {
      setIdVerifying(false);
    }
  };

  const handleProceedToWaec = async () => {
    if (!requireWalletActivation()) return;
    if (!idVerified) { toast({ title: "Error", description: "Please verify your identity document first.", variant: "destructive" }); return; }
    try {
      await apiRequest("POST", "/api/verification/identity", { idType, idNumber: idNumber.trim() });
      setStep(2);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // ── WAEC ─────────────────────────────────────────────────────────
  const setElectiveAt = (index: number, value: string) => {
    const updated = [...electives]; updated[index] = value; setElectives(updated);
  };
  const setGradeFor = (subject: string, grade: string) => {
    setGrades(prev => ({ ...prev, [subject]: grade }));
  };

  const handleValidateWaec = () => {
    if (!requireWalletActivation()) return;
    if (!waecReg) { toast({ title: "Error", description: "WAEC Registration number is required", variant: "destructive" }); return; }
    if (!waecYear) { toast({ title: "Error", description: "WAEC Year is required", variant: "destructive" }); return; }
    if (!schoolName || !schoolLocation) { toast({ title: "Error", description: "School name and location are required", variant: "destructive" }); return; }
    if (electives.filter(Boolean).length !== 3) { toast({ title: "Error", description: "Please select exactly 3 elective subjects", variant: "destructive" }); return; }
    const subjects = [...WAEC_COMPULSORY_SUBJECTS, ...electives.filter(Boolean)];
    if (subjects.some(s => !grades[s])) { toast({ title: "Error", description: "Please select grades for all 5 subjects", variant: "destructive" }); return; }
    setStep(3);
  };

  // ── Payment (Step 3) ──────────────────────────────────────────────
  const handlePayment = async () => {
    if (!requireWalletActivation()) return;
    setIsProcessing(true);
    try {
      await apiRequest("POST", "/api/verification/pay-fee");
      setPaymentDone(true);
      toast({ title: "Payment Successful ✓", description: `$${TOTAL_FEE.toFixed(2)} confirmed. Submitting your application…` });
      await submitWaec();
    } catch (err: any) {
      toast({ title: "Payment Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Sponsor Code (Step 3 alternative) ────────────────────────────
  const handleValidateSponsorCode = async () => {
    if (!requireWalletActivation()) return;
    if (!sponsorCodeInput.trim()) { toast({ title: "Error", description: "Please enter a sponsor code", variant: "destructive" }); return; }
    setSponsorCodeValidating(true);
    setSponsorCodeResult(null);
    try {
      const res = await apiRequest("POST", "/api/verification/validate-sponsor-code", { code: sponsorCodeInput.trim() });
      const data = await res.json();
      setSponsorCodeResult({ valid: true, cohortName: data.cohortName });
    } catch (err: any) {
      let msg = "Invalid code";
      try { const d = await err.json?.(); msg = d?.message || msg; } catch {}
      setSponsorCodeResult({ valid: false, reason: msg });
    } finally {
      setSponsorCodeValidating(false);
    }
  };

  const handleApplySponsorCode = async () => {
    if (!requireWalletActivation()) return;
    if (!sponsorCodeResult?.valid) return;
    setIsProcessing(true);
    try {
      await apiRequest("POST", "/api/verification/use-sponsor-code", { code: sponsorCodeInput.trim() });
      setUsedSponsorCode(true);
      setPaymentDone(true);
      toast({ title: "Sponsor Code Applied ✓", description: `Access granted by ${sponsorCodeResult.cohortName}. Submitting your application…` });
      await submitWaec();
    } catch (err: any) {
      toast({ title: "Failed to Apply Code", description: err.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const submitWaec = async () => {
    const filled = electives.filter(Boolean);
    const subjects = [...WAEC_COMPULSORY_SUBJECTS, ...filled];
    const gradesList = subjects.map(s => grades[s]);
    try {
      const res = await apiRequest("POST", "/api/verification/waec-validate", {
        waecRegNumber: waecReg, waecYear, subjects, grades: gradesList, schoolName, schoolLocation,
        sponsorshipReason: sponsorshipReason.trim() || undefined,
      });
      const data = await res.json();
      setWaecResult(data);
      setStep(5);
    } catch (err: any) {
      try {
        const d = await err.json?.();
        setFailPercentage(d?.percentage || 0);
      } catch {}
      setWaecFailed(true);
      setStep(5);
    }
  };

  // ── Slide animation ───────────────────────────────────────────────
  const slide = {
    initial: { opacity: 0, x: 40 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.45, ease: "easeOut" } },
    exit: { opacity: 0, x: -40, transition: { duration: 0.3 } },
  };

  const totalSteps = 3;
  const displayStep = Math.min(step, totalSteps);
  const progressPct = (displayStep / totalSteps) * 100;

  // ── Tier badge helper ─────────────────────────────────────────────
  const TierBadge = ({ tier, pct }: { tier: ReturnType<typeof getPayoutTier>; pct: number }) => {
    if (tier.label === "platinum") return (
      <div className="flex flex-col items-end">
        <span className="text-xs font-bold uppercase tracking-wide text-purple-600 dark:text-purple-300">Platinum</span>
        <span className="text-lg font-bold text-purple-700 dark:text-purple-200">${tier.min}–${tier.max}</span>
        <span className="text-[11px] text-purple-500 dark:text-purple-400">{pct.toFixed(1)}% score</span>
      </div>
    );
    if (tier.label === "gold") return (
      <div className="flex flex-col items-end">
        <span className="text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-300">Gold</span>
        <span className="text-lg font-bold text-amber-700 dark:text-amber-200">${tier.min}–${tier.max}</span>
        <span className="text-[11px] text-amber-500 dark:text-amber-400">{pct.toFixed(1)}% score</span>
      </div>
    );
    if (tier.label === "silver") return (
      <div className="flex flex-col items-end">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-300">Silver</span>
        <span className="text-lg font-bold text-slate-600 dark:text-slate-200">${tier.min}–${tier.max}</span>
        <span className="text-[11px] text-slate-400">{pct.toFixed(1)}% score</span>
      </div>
    );
    return (
      <div className="flex flex-col items-end">
        <span className="text-xs font-bold uppercase tracking-wide text-red-500">Below Threshold</span>
        <span className="text-lg font-bold text-red-600">{pct.toFixed(1)}%</span>
        <span className="text-[11px] text-red-400">Min 51% required</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 font-sans flex flex-col">

      {/* Top bar */}
      <div className="bg-card/80 backdrop-blur border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/dashboard")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowRight className="w-4 h-4 rotate-180" /> Dashboard
            </button>
            <span className="text-muted-foreground/40">|</span>
            <Logo variant="badge" height={26} />
            <span className="text-sm font-bold text-muted-foreground hidden sm:block">Verification</span>
          </div>
          <span className="text-xs font-semibold text-muted-foreground bg-muted px-3 py-1 rounded-full">
            {step <= 4 ? `Step ${displayStep} of ${totalSteps}` : "Complete"}
          </span>
        </div>
        <div className="h-1 bg-muted">
          <motion.div className="h-full bg-gradient-to-r from-tsia-green to-tsia-gold"
            initial={{ width: "0%" }} animate={{ width: `${progressPct}%` }} transition={{ duration: 0.5 }} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">

            {/* ── STEP 1: Identity Document ── */}
            {step === 1 && (
              <motion.div key="s1" {...slide} className="bg-card rounded-3xl shadow-2xl border overflow-hidden">
                <div className="bg-gradient-to-r from-tsia-green/10 to-transparent p-8 pb-0">
                  <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
                    <ShieldAlert className="w-8 h-8" />
                  </div>
                  <h2 className="text-3xl font-bold mb-2">Identity Verification</h2>
                  <p className="text-muted-foreground text-lg mb-8">Select your ID type and enter your details. We'll verify instantly.</p>
                </div>
                <div className="p-8 pt-6 space-y-5">

                  {/* ID type dropdown */}
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Document Type</Label>
                    <Select value={idType} onValueChange={v => { setIdType(v); setIdNumber(""); setIdLastName(""); setIdVerified(false); setIdData(null); setIdError(""); }} disabled={idVerified} data-testid="select-id-type">
                      <SelectTrigger className="h-12 bg-muted/30 text-base" data-testid="trigger-id-type">
                        <SelectValue placeholder="Select document type" />
                      </SelectTrigger>
                      <SelectContent>
                        {ID_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value} data-testid={`option-id-${opt.value}`}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(idType === "passport" || idType === "national_id" || idType === "drivers_license") && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mt-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        Supported for all nationalities — including Nigerians living abroad.
                      </p>
                    )}
                  </div>

                  {/* Passport: last name field */}
                  {idType === "passport" && (
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Last Name (as on passport)</Label>
                      <Input
                        placeholder="Enter your surname"
                        className="h-12 bg-muted/30"
                        value={idLastName}
                        onChange={e => { setIdLastName(e.target.value); setIdVerified(false); setIdData(null); }}
                        disabled={idVerified}
                        data-testid="input-id-lastname"
                      />
                    </div>
                  )}

                  {/* ID number input */}
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">{currentIdOpt.label}</Label>
                    <div className="flex gap-3">
                      <div className="flex-1 relative">
                        <Input
                          placeholder={currentIdOpt.hint}
                          className={`h-12 text-base pr-10 bg-muted/30 tracking-wider font-mono ${idVerified ? 'border-green-500 bg-green-50/50 dark:bg-green-900/10' : idError ? 'border-destructive' : ''}`}
                          value={idNumber}
                          maxLength={currentIdOpt.len[1]}
                          onChange={e => {
                            const v = currentIdOpt.numeric ? e.target.value.replace(/\D/g, "") : e.target.value.toUpperCase();
                            setIdNumber(v); setIdError(""); setIdVerified(false); setIdData(null);
                          }}
                          disabled={idVerified}
                          data-testid="input-id-number"
                        />
                        {idVerified && <CheckCircle2 className="w-5 h-5 text-green-500 absolute right-3 top-1/2 -translate-y-1/2" />}
                      </div>
                      <Button
                        onClick={handleVerifyId}
                        disabled={idVerifying || idVerified || !isIdReady}
                        className={`h-12 px-5 font-semibold ${idVerified ? 'bg-green-600 hover:bg-green-700' : ''}`}
                        data-testid="button-verify-id"
                      >
                        {idVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : idVerified ? "Verified ✓" : "Verify"}
                      </Button>
                    </div>
                    {idError && (
                      <p className="text-sm text-destructive flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" /> {idError}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                      <Lock className="w-3.5 h-3.5 text-green-600" /> Verified securely via Prembly IdentityPass • Data encrypted end-to-end
                    </p>
                  </div>

                  <AnimatePresence>
                    {idVerified && idData && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/40 rounded-xl flex items-center justify-center">
                            <BadgeCheck className="w-6 h-6 text-green-600" />
                          </div>
                          <div>
                            <p className="font-bold text-green-800 dark:text-green-300">Identity Confirmed</p>
                            <p className="text-xs text-green-700 dark:text-green-400">{idData.demo ? "Format verified — live lookup active" : `Matched against ${currentIdOpt.label} database`}</p>
                          </div>
                        </div>
                        {idData.data?.firstName && (
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div><span className="text-muted-foreground">Name:</span> <span className="font-semibold">{idData.data.firstName} {idData.data.lastName}</span></div>
                            {idData.data.gender && <div><span className="text-muted-foreground">Gender:</span> <span className="font-semibold capitalize">{idData.data.gender}</span></div>}
                            {idData.data.dateOfBirth && <div><span className="text-muted-foreground">DOB:</span> <span className="font-semibold">{idData.data.dateOfBirth}</span></div>}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {idVerifying && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                      <div className="space-y-2">
                        {[`Connecting to ${currentIdOpt.label} database...`, "Validating document number...", "Retrieving identity record..."].map((msg, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> {msg}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  <Button onClick={handleProceedToWaec} className="w-full h-14 text-lg font-semibold shadow-md" disabled={!idVerified} data-testid="button-identity-next">
                    Continue to WAEC Validation <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 2: WAEC + Live Score ── */}
            {step === 2 && (
              <motion.div key="s2" {...slide} className="bg-card rounded-3xl shadow-2xl border overflow-hidden">
                <div className="bg-gradient-to-r from-amber-500/10 to-transparent p-8 pb-0">
                  <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-2xl flex items-center justify-center mb-6">
                    <FileText className="w-8 h-8" />
                  </div>
                  <h2 className="text-3xl font-bold mb-2">WAEC Result Validation</h2>
                  <p className="text-muted-foreground mb-6">Enter your WAEC details. Your live score appears as you fill in your grades.</p>
                </div>

                <div className="p-8 pt-6 space-y-6 max-h-[65vh] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-semibold">WAEC Reg Number</Label>
                      <Input placeholder="e.g. 4250101001" className="h-11 bg-muted/30" value={waecReg} onChange={e => setWaecReg(e.target.value)} data-testid="input-waec-reg" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-semibold">Exam Year</Label>
                      <Input placeholder="e.g. 2022" className="h-11 bg-muted/30" value={waecYear} onChange={e => setWaecYear(e.target.value.replace(/\D/g, "").slice(0, 4))} maxLength={4} data-testid="input-waec-year" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-semibold">School Name</Label>
                      <Input placeholder="e.g. Federal Government College" className="h-11 bg-muted/30" value={schoolName} onChange={e => setSchoolName(e.target.value)} data-testid="input-school-name" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-semibold">School Location (State)</Label>
                      <Input placeholder="e.g. Lagos, Nigeria" className="h-11 bg-muted/30" value={schoolLocation} onChange={e => setSchoolLocation(e.target.value)} data-testid="input-school-location" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Subject Selection & Grades</Label>
                    <p className="text-xs text-muted-foreground">Mathematics and English Language are compulsory. Select exactly 3 elective subjects.</p>

                    <div className="bg-muted/20 rounded-xl p-4 border space-y-3">
                      {WAEC_COMPULSORY_SUBJECTS.map(subject => (
                        <div key={subject} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                          <div className="flex-1 flex items-center gap-2">
                            <Lock className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="text-sm font-semibold">{subject}</span>
                            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase hidden sm:inline">Compulsory</span>
                          </div>
                          <Select value={grades[subject] || undefined} onValueChange={v => setGradeFor(subject, v)}>
                            <SelectTrigger className="h-9 w-24 text-sm" data-testid={`select-grade-${subject.replace(/\s/g, '-').toLowerCase()}`}>
                              <SelectValue placeholder="Grade" />
                            </SelectTrigger>
                            <SelectContent>
                              {VALID_GRADES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                      {[0, 1, 2].map(idx => (
                        <div key={idx} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                          <div className="flex-1">
                            <Select value={electives[idx] || undefined} onValueChange={v => setElectiveAt(idx, v)}>
                              <SelectTrigger className="h-9 text-sm" data-testid={`select-elective-${idx}`}>
                                <SelectValue placeholder={`Elective Subject ${idx + 1}`} />
                              </SelectTrigger>
                              <SelectContent position="popper" className="max-h-64 overflow-y-auto">
                                {WAEC_ELECTIVE_SUBJECTS.filter(s => !electives.includes(s) || electives[idx] === s).map(s =>
                                  <SelectItem key={s} value={s}>{s}</SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          <Select value={electives[idx] ? (grades[electives[idx]] || undefined) : undefined} onValueChange={v => electives[idx] && setGradeFor(electives[idx], v)} disabled={!electives[idx]}>
                            <SelectTrigger className="h-9 w-24 text-sm" data-testid={`select-elective-grade-${idx}`}>
                              <SelectValue placeholder="Grade" />
                            </SelectTrigger>
                            <SelectContent>
                              {VALID_GRADES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Live Score Preview */}
                  <AnimatePresence>
                    {livePercentage !== null && (
                      <motion.div
                        key="live-score"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className={`rounded-2xl border p-5 flex items-center justify-between gap-4 ${
                          liveTier && liveTier.label === "platinum" ? "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800" :
                          liveTier && liveTier.label === "gold" ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800" :
                          liveTier && liveTier.label === "silver" ? "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700" :
                          "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                        }`}
                        data-testid="live-score-preview"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            liveTier && liveTier.label !== "none" ? "bg-tsia-green/10 text-tsia-green" : "bg-red-100 dark:bg-red-900/40 text-red-500"
                          }`}>
                            <TrendingUp className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Live Score Preview</p>
                            <p className="text-2xl font-bold">{livePercentage.toFixed(1)}%</p>
                            <p className="text-xs text-muted-foreground">{gradeValues.length} of {allSubjectsSelected.length > 0 ? allSubjectsSelected.length : 5} subjects graded</p>
                          </div>
                        </div>
                        {liveTier && <TierBadge tier={liveTier} pct={livePercentage} />}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-2 pt-2">
                    <Label className="text-base font-semibold">Reason for Sponsorship <span className="text-red-500">*</span></Label>
                    <Select value={sponsorshipReason} onValueChange={setSponsorshipReason}>
                      <SelectTrigger className="h-12 bg-muted/30 text-sm" data-testid="select-sponsorship-reason">
                        <SelectValue placeholder="Select reason for sponsorship…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Tuition fees">Tuition fees</SelectItem>
                        <SelectItem value="Career/Trade sponsorship">Career/Trade sponsorship</SelectItem>
                        <SelectItem value="Student Accommodation">Student Accommodation</SelectItem>
                        <SelectItem value="Transport Allowances">Transport Allowances</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-4 pt-2">
                    <Button variant="outline" onClick={() => setStep(1)} className="w-1/3 h-12 font-semibold">Back</Button>
                    <Button
                      onClick={handleValidateWaec}
                      className="w-2/3 h-12 text-base font-semibold bg-amber-600 hover:bg-amber-700 shadow-md"
                      data-testid="button-validate-waec"
                      disabled={!allElectivesSelected || !allGradesFilled || !waecReg || !waecYear || !schoolName || !schoolLocation || !sponsorshipReason}
                    >
                      <CreditCard className="w-5 h-5 mr-2" /> Proceed to Payment
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── STEP 3: Payment ── */}
            {step === 3 && (
              <motion.div key="s3-pay" {...slide} className="bg-card rounded-3xl shadow-2xl border overflow-hidden">
                <div className="bg-gradient-to-r from-tsia-green/10 to-tsia-gold/10 p-8 pb-0">
                  <div className="w-16 h-16 bg-tsia-green/10 text-tsia-green rounded-2xl flex items-center justify-center mb-6">
                    <CreditCard className="w-8 h-8" />
                  </div>
                  <h2 className="text-3xl font-bold mb-2">Portal Fee Payment</h2>
                  <p className="text-muted-foreground text-lg mb-6">Pay the one-time portal fee to activate your application. BVN and GPS verification can be completed afterwards in your wallet.</p>
                </div>

                <div className="p-8 space-y-6">
                  {/* Fee breakdown card */}
                  <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-lg">
                    <div className="space-y-3 mb-4">
                      <div className="flex justify-between text-slate-300 text-sm">
                        <span>Portal verification fee</span>
                        <span>${PORTAL_FEE.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-300 text-sm">
                        <span>Service & processing charge</span>
                        <span>${SERVICE_CHARGE.toFixed(2)}</span>
                      </div>
                      <div className="border-t border-slate-600 pt-3 flex justify-between items-center">
                        <span className="font-semibold text-lg">Total Due</span>
                        <span className="text-3xl font-bold text-tsia-gold">${TOTAL_FEE.toFixed(2)}</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" /> Secured and encrypted • Non-refundable
                    </p>
                  </div>

                  {/* WAEC score reminder */}
                  {livePercentage !== null && liveTier && liveTier.label !== "none" && (
                    <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                      liveTier.label === "platinum" ? "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800" :
                      liveTier.label === "gold" ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800" :
                      "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700"
                    }`}>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Your WAEC score</p>
                        <p className="font-bold text-lg">{livePercentage.toFixed(1)}%</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground font-medium capitalize">{liveTier.label} tier</p>
                        <p className="font-bold">${liveTier.min}–${liveTier.max} payout</p>
                      </div>
                    </div>
                  )}

                  {/* Sponsor Code Toggle */}
                  <button
                    type="button"
                    onClick={() => { setShowSponsorCode(p => !p); setSponsorCodeResult(null); setSponsorCodeInput(""); }}
                    className="w-full flex items-center justify-between p-4 rounded-xl border border-dashed border-tsia-gold/60 bg-amber-50/50 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors text-left"
                    data-testid="button-toggle-sponsor-code"
                  >
                    <span className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-lg bg-tsia-gold/15 text-tsia-gold flex items-center justify-center shrink-0">
                        <Gift className="w-5 h-5" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">Have a Sponsor Code?</span>
                        <span className="block text-xs text-muted-foreground">Enter your cohort code to skip the portal fee</span>
                      </span>
                    </span>
                    {showSponsorCode ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                  </button>

                  <AnimatePresence>
                    {showSponsorCode && (
                      <motion.div
                        key="sponsor-code-panel"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-5 rounded-xl border bg-muted/20 space-y-4">
                          <div className="space-y-2">
                            <Label className="font-semibold flex items-center gap-2"><Tag className="w-4 h-4 text-tsia-gold" /> Sponsor Code</Label>
                            <div className="flex gap-2">
                              <Input
                                placeholder="e.g. TSP-001-A4B9C2"
                                className={`h-11 font-mono tracking-wider text-sm uppercase bg-background ${sponsorCodeResult?.valid ? "border-green-500" : sponsorCodeResult?.valid === false ? "border-destructive" : ""}`}
                                value={sponsorCodeInput}
                                onChange={e => { setSponsorCodeInput(e.target.value.toUpperCase()); setSponsorCodeResult(null); }}
                                disabled={sponsorCodeValidating || sponsorCodeResult?.valid}
                                data-testid="input-sponsor-code"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleValidateSponsorCode}
                                disabled={sponsorCodeValidating || !sponsorCodeInput.trim() || !!sponsorCodeResult?.valid}
                                className="h-11 px-4 shrink-0"
                                data-testid="button-validate-sponsor-code"
                              >
                                {sponsorCodeValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : sponsorCodeResult?.valid ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : "Verify"}
                              </Button>
                            </div>
                          </div>

                          <AnimatePresence>
                            {sponsorCodeResult && (
                              <motion.div
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                              >
                                {sponsorCodeResult.valid ? (
                                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-4">
                                    <div className="flex items-start gap-3">
                                      <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                                      <div>
                                        <p className="font-bold text-green-800 dark:text-green-300 text-sm">Valid Sponsor Code!</p>
                                        <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">Sponsored by: <strong>{sponsorCodeResult.cohortName}</strong></p>
                                        <p className="text-xs text-green-600 dark:text-green-500 mt-1">This code will cover your $3.30 portal fee. Click "Apply & Continue" below.</p>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                                    <div className="flex items-center gap-3">
                                      <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                                      <div>
                                        <p className="font-bold text-red-700 dark:text-red-400 text-sm">Invalid Code</p>
                                        <p className="text-xs text-red-600 dark:text-red-500">{sponsorCodeResult.reason}</p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {sponsorCodeResult?.valid && (
                            <Button
                              onClick={handleApplySponsorCode}
                              className="w-full h-12 font-semibold bg-tsia-green hover:bg-tsia-green/90 text-white"
                              disabled={isProcessing}
                              data-testid="button-apply-sponsor-code"
                            >
                              {isProcessing
                                ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Applying Code...</span>
                                : <><Gift className="w-4 h-4 mr-2" /> Apply Code & Continue</>}
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Card fields (shown only when NOT using sponsor code) */}
                  {!sponsorCodeResult?.valid && (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-muted-foreground font-medium">OR PAY WITH CARD</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-sm text-muted-foreground">Card Number</Label>
                          <div className="relative">
                            <Input placeholder="0000 0000 0000 0000" className="h-12 pl-10 bg-muted/30" data-testid="input-card" />
                            <CreditCard className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm text-muted-foreground">Expiry Date</Label>
                            <Input placeholder="MM/YY" className="h-12 bg-muted/30 text-center" data-testid="input-expiry" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm text-muted-foreground">CVV</Label>
                            <Input placeholder="123" className="h-12 bg-muted/30 text-center" type="password" maxLength={4} data-testid="input-cvv" />
                          </div>
                        </div>
                      </div>

                      <TermsCheckbox checked={paymentTermsAccepted} onCheckedChange={setPaymentTermsAccepted} context="payment" className="px-1" />

                      <Button
                        onClick={handlePayment}
                        className="w-full h-14 text-lg font-semibold shadow-md"
                        disabled={isProcessing || !paymentTermsAccepted}
                        data-testid="button-pay"
                      >
                        {isProcessing
                          ? <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Processing Payment...</span>
                          : <><CreditCard className="w-5 h-5 mr-2" /> Pay ${TOTAL_FEE.toFixed(2)} Now</>}
                      </Button>
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── STEP 4 / Done ── */}
            {step === 5 && !waecFailed && (
              <motion.div key="s5-done" {...slide} className="bg-card rounded-3xl shadow-2xl border overflow-hidden text-center">
                <div className="bg-gradient-to-r from-green-500/10 to-tsia-gold/10 p-10">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}>
                    <PartyPopper className="w-20 h-20 text-tsia-gold mx-auto mb-4" />
                  </motion.div>
                  <h2 className="text-3xl font-bold mb-2">Congratulations! 🎉</h2>
                  <p className="text-muted-foreground text-lg">Your application is submitted and pending admin approval.</p>
                  {waecResult && (
                    <div className="mt-4 inline-flex items-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-4 py-2 rounded-full text-sm font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      {(waecResult.payoutRange?.label || "").charAt(0).toUpperCase() + (waecResult.payoutRange?.label || "").slice(1)} Tier — {waecResult.calculatedPercentage}% Score
                    </div>
                  )}
                </div>
                <div className="p-8 space-y-4">
                  <p className="text-sm text-muted-foreground">Our team will review within 24–48 hours. You'll receive a notification once approved and your wallet is funded.</p>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-left">
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">Next step: Activate your Wallet</p>
                    <p className="text-xs text-blue-700 dark:text-blue-400">Head to the <strong>Wallet</strong> section in your dashboard to complete BVN verification and GPS location — required to fund and transact.</p>
                  </div>
                  <Button onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/verification/status"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
                    setLocation("/dashboard");
                  }} className="h-12 px-8 text-base font-semibold w-full" data-testid="button-go-dashboard">
                    Go to Dashboard <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 5 FAIL: Below threshold ── */}
            {step === 5 && waecFailed && (
              <motion.div key="s5-fail" {...slide} className="bg-card rounded-3xl shadow-2xl border overflow-hidden">
                <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 p-8 text-center">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}>
                    <XCircle className="w-20 h-20 text-red-400 mx-auto mb-4" />
                  </motion.div>
                  <h2 className="text-3xl font-bold mb-3">We're Sorry</h2>
                  <p className="text-muted-foreground text-lg max-w-md mx-auto mb-4">
                    Your WAEC results did not meet the minimum threshold for the TSIA sponsorship programme this semester.
                  </p>
                  {failPercentage > 0 && (
                    <div className="inline-flex items-center gap-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-5 py-2 rounded-full text-sm font-semibold">
                      Your Score: {failPercentage}% &nbsp;·&nbsp; Minimum Required: 51%
                    </div>
                  )}
                </div>
                <div className="p-8 space-y-5">
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-5 text-center">
                    <p className="text-amber-800 dark:text-amber-300 font-semibold mb-1">Don't give up — try again next semester!</p>
                    <p className="text-sm text-amber-700 dark:text-amber-400">Study harder, improve your grades, and re-apply. We believe in your potential.</p>
                  </div>
                  <div className="bg-gradient-to-r from-tsia-gold/10 to-amber-500/10 border border-tsia-gold/30 rounded-2xl p-6 text-center">
                    <Share2 className="w-12 h-12 text-tsia-gold mx-auto mb-3" />
                    <h3 className="text-xl font-bold mb-2">Would you prefer to become an Affiliate?</h3>
                    <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
                      Earn commissions by referring eligible students to TSIA — no academic requirement needed.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Link href="/affiliate-signup">
                        <Button className="bg-tsia-gold hover:bg-tsia-gold/90 text-slate-900 h-12 px-6 font-bold w-full sm:w-auto" data-testid="button-become-affiliate">
                          <Share2 className="w-4 h-4 mr-2" /> Sign Up as Affiliate
                        </Button>
                      </Link>
                      <Button variant="outline" onClick={() => setLocation("/")} className="h-12 px-6" data-testid="button-go-home">
                        Return Home
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

    </div>
  );
}
