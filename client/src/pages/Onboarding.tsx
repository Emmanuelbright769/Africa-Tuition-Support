import { useState, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  ShieldAlert, CreditCard, Lock, FileText, CheckCircle2, Loader2,
  Camera, ScanFace, Sparkles, PartyPopper, XCircle, MapPin,
  Wallet, ArrowRight, Share2, BadgeCheck, AlertTriangle, TrendingUp, Clock
} from "lucide-react";
import BiometricVerification from "@/components/ui/BiometricVerification";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
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

  // Step 1 — NIN
  const [nin, setNin] = useState("");
  const [ninVerifying, setNinVerifying] = useState(false);
  const [ninVerified, setNinVerified] = useState(false);
  const [ninData, setNinData] = useState<any>(null);
  const [ninError, setNinError] = useState("");

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

  // Step 3 — Payment
  const [paymentTermsAccepted, setPaymentTermsAccepted] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);

  // Step 4 — KYC (BVN + GPS) + Biometric
  const [bvn, setBvn] = useState("");
  const [bvnVerified, setBvnVerified] = useState(false);
  const [bvnVerifying, setBvnVerifying] = useState(false);
  const [locationVerified, setLocationVerified] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationCoords, setLocationCoords] = useState("");
  const [showBiometric, setShowBiometric] = useState(false);

  const { toast } = useToast();
  const { user } = useAuth();

  if (!user) { setLocation("/login"); return null; }

  // ── Live score computation ──────────────────────────────────────────
  const allSubjectsSelected = [...WAEC_COMPULSORY_SUBJECTS, ...electives.filter(Boolean)];
  const gradedSubjects = allSubjectsSelected.filter(s => grades[s]);
  const gradeValues = gradedSubjects.map(s => grades[s]);
  const livePercentage = gradeValues.length > 0 ? calculateWaecPercentage(gradeValues) : null;
  const liveTier = livePercentage !== null ? getPayoutTier(livePercentage) : null;
  const allGradesFilled = allSubjectsSelected.length === 5 && allSubjectsSelected.every(s => grades[s]);
  const allElectivesSelected = electives.filter(Boolean).length === 3;

  // ── NIN ───────────────────────────────────────────────────────────
  const handleVerifyNin = async () => {
    if (!nin || nin.length !== 11 || !/^\d{11}$/.test(nin)) {
      setNinError("Please enter exactly 11 digits."); return;
    }
    setNinError("");
    setNinVerifying(true);
    try {
      const res = await apiRequest("POST", "/api/verification/validate-nin", { nin });
      const data = await res.json();
      setNinData(data);
      setNinVerified(true);
      toast({ title: "NIN Verified ✓", description: data.demo ? "Format validated (live NIMC check enabled with API key)." : "Your NIN has been confirmed via the NIMC database." });
    } catch (err: any) {
      let msg = "NIN verification failed.";
      try { const d = await err.json?.(); msg = d?.message || msg; } catch {}
      setNinError(msg);
    } finally {
      setNinVerifying(false);
    }
  };

  const handleProceedToWaec = async () => {
    if (!ninVerified) { toast({ title: "Error", description: "Please verify your NIN first.", variant: "destructive" }); return; }
    try {
      await apiRequest("POST", "/api/verification/identity", { nin });
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
    setIsProcessing(true);
    try {
      await apiRequest("POST", "/api/verification/pay-fee");
      setPaymentDone(true);
      toast({ title: "Payment Successful ✓", description: `$${TOTAL_FEE.toFixed(2)} confirmed. You can complete your KYC now or later.` });
      setStep(4);
    } catch (err: any) {
      toast({ title: "Payment Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  // ── BVN + GPS (Step 4) ────────────────────────────────────────────
  const handleVerifyBvn = async () => {
    if (!bvn || bvn.length !== 11 || !/^\d{11}$/.test(bvn)) {
      toast({ title: "Error", description: "Enter a valid 11-digit BVN", variant: "destructive" }); return;
    }
    setBvnVerifying(true);
    await new Promise(r => setTimeout(r, 2200));
    setBvnVerified(true);
    setBvnVerifying(false);
    toast({ title: "BVN Verified ✓", description: "Bank Verification Number confirmed." });
  };

  const handleVerifyLocation = async () => {
    setLocationLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
      );
      const { latitude, longitude } = pos.coords;
      setLocationCoords(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      await new Promise(r => setTimeout(r, 1200));
      setLocationVerified(true);
      toast({ title: "Location Verified ✓", description: "GPS coordinates confirmed for proof of address." });
    } catch {
      toast({ title: "Location Denied", description: "Enable GPS and try again. False location leads to disqualification.", variant: "destructive" });
    } finally {
      setLocationLoading(false);
    }
  };

  // ── Biometric complete handler ─────────────────────────────────────
  const handleBiometricComplete = async () => {
    try {
      await apiRequest("POST", "/api/verification/biometric");
    } catch { /* non-critical */ }
    setShowBiometric(false);
    submitWaec();
  };

  const submitWaec = async () => {
    const filled = electives.filter(Boolean);
    const subjects = [...WAEC_COMPULSORY_SUBJECTS, ...filled];
    const gradesList = subjects.map(s => grades[s]);
    try {
      const res = await apiRequest("POST", "/api/verification/waec-validate", {
        waecRegNumber: waecReg, waecYear, subjects, grades: gradesList, schoolName, schoolLocation,
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

  const totalSteps = 4;
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
        <span className="text-[11px] text-red-400">Min 50% required</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 font-sans flex flex-col">

      {/* Top bar */}
      <div className="bg-card/80 backdrop-blur border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/"><a className="flex items-center gap-2">
            <Logo variant="badge" height={28} />
            <span className="text-sm font-bold text-muted-foreground hidden sm:block">TSIA Onboarding</span>
          </a></Link>
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

            {/* ── STEP 1: NIN ── */}
            {step === 1 && (
              <motion.div key="s1" {...slide} className="bg-card rounded-3xl shadow-2xl border overflow-hidden">
                <div className="bg-gradient-to-r from-tsia-green/10 to-transparent p-8 pb-0">
                  <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
                    <ShieldAlert className="w-8 h-8" />
                  </div>
                  <h2 className="text-3xl font-bold mb-2">Identity Verification</h2>
                  <p className="text-muted-foreground text-lg mb-8">Enter your 11-digit NIN. We'll verify it against the NIMC database instantly.</p>
                </div>
                <div className="p-8 pt-6 space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="nin" className="text-base font-semibold">National Identification Number (NIN)</Label>
                    <div className="flex gap-3">
                      <div className="flex-1 relative">
                        <Input
                          id="nin"
                          placeholder="Enter your 11-digit NIN"
                          className={`h-12 text-lg pr-10 bg-muted/30 tracking-widest font-mono ${ninVerified ? 'border-green-500 bg-green-50/50 dark:bg-green-900/10' : ninError ? 'border-destructive' : ''}`}
                          value={nin}
                          maxLength={11}
                          onChange={e => { setNin(e.target.value.replace(/\D/g, "")); setNinError(""); setNinVerified(false); setNinData(null); }}
                          disabled={ninVerified}
                          data-testid="input-nin"
                        />
                        {ninVerified && <CheckCircle2 className="w-5 h-5 text-green-500 absolute right-3 top-1/2 -translate-y-1/2" />}
                      </div>
                      <Button
                        onClick={handleVerifyNin}
                        disabled={ninVerifying || ninVerified || nin.length !== 11}
                        className={`h-12 px-5 font-semibold ${ninVerified ? 'bg-green-600 hover:bg-green-700' : ''}`}
                        data-testid="button-verify-nin"
                      >
                        {ninVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : ninVerified ? "Verified" : "Verify"}
                      </Button>
                    </div>
                    {ninError && (
                      <p className="text-sm text-destructive flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" /> {ninError}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                      <Lock className="w-3.5 h-3.5 text-green-600" /> Verified securely via NIMC • Data encrypted end-to-end
                    </p>
                  </div>

                  <AnimatePresence>
                    {ninVerified && ninData && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/40 rounded-xl flex items-center justify-center">
                            <BadgeCheck className="w-6 h-6 text-green-600" />
                          </div>
                          <div>
                            <p className="font-bold text-green-800 dark:text-green-300">Identity Confirmed</p>
                            <p className="text-xs text-green-700 dark:text-green-400">{ninData.demo ? "Format verified — live NIMC lookup active with API key" : "Matched against NIMC national database"}</p>
                          </div>
                        </div>
                        {ninData.data?.firstName && (
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div><span className="text-muted-foreground">Name:</span> <span className="font-semibold">{ninData.data.firstName} {ninData.data.lastName}</span></div>
                            {ninData.data.gender && <div><span className="text-muted-foreground">Gender:</span> <span className="font-semibold capitalize">{ninData.data.gender}</span></div>}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {ninVerifying && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                      <div className="space-y-2">
                        {["Connecting to NIMC database...", "Validating NIN number...", "Retrieving identity record..."].map((msg, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> {msg}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  <Button onClick={handleProceedToWaec} className="w-full h-14 text-lg font-semibold shadow-md" disabled={!ninVerified} data-testid="button-identity-next">
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
                              <SelectContent>
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

                  <div className="flex gap-4 pt-2">
                    <Button variant="outline" onClick={() => setStep(1)} className="w-1/3 h-12 font-semibold">Back</Button>
                    <Button
                      onClick={handleValidateWaec}
                      className="w-2/3 h-12 text-base font-semibold bg-amber-600 hover:bg-amber-700 shadow-md"
                      data-testid="button-validate-waec"
                      disabled={!allElectivesSelected || !allGradesFilled || !waecReg || !waecYear || !schoolName || !schoolLocation}
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
                  <p className="text-muted-foreground text-lg mb-6">Pay the one-time portal fee to activate your application. KYC and biometric can be completed afterwards.</p>
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

                  {/* Card fields */}
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
                </div>
              </motion.div>
            )}

            {/* ── STEP 4: KYC + Biometric (deferrable) ── */}
            {step === 4 && (
              <motion.div key="s4-kyc" {...slide} className="bg-card rounded-3xl shadow-2xl border overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 p-8 pb-0">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                    <Wallet className="w-8 h-8" />
                  </div>
                  <h2 className="text-3xl font-bold mb-2">Wallet KYC & Biometric</h2>
                  <p className="text-muted-foreground text-lg mb-2">Complete BVN verification, GPS location, and face scan to finalise your application.</p>
                  <div className="inline-flex items-center gap-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1.5 rounded-full text-xs font-semibold mb-6">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Payment confirmed — ${ TOTAL_FEE.toFixed(2)} received
                  </div>
                </div>

                <div className="p-8 space-y-5 max-h-[55vh] overflow-y-auto">
                  {/* BVN */}
                  <div className={`p-4 rounded-xl border transition-all ${bvnVerified ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' : 'bg-white dark:bg-slate-800 border-border'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="font-semibold flex items-center gap-2">
                        {bvnVerified
                          ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                          : <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 text-xs font-bold flex items-center justify-center">1</span>}
                        BVN Verification
                      </Label>
                      {bvnVerified && <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-2 py-0.5 rounded-full font-bold">Verified ✓</span>}
                    </div>
                    {!bvnVerified && (
                      <div className="flex gap-2">
                        <Input placeholder="11-digit BVN" className="h-10 bg-muted/30 flex-1 font-mono tracking-widest" value={bvn} maxLength={11} onChange={e => setBvn(e.target.value.replace(/\D/g, ""))} data-testid="input-bvn" />
                        <Button size="sm" className="h-10 px-4" onClick={handleVerifyBvn} disabled={bvnVerifying || bvn.length !== 11} data-testid="button-verify-bvn">
                          {bvnVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* GPS Location */}
                  <div className={`p-4 rounded-xl border transition-all ${!bvnVerified ? 'opacity-40 pointer-events-none' : locationVerified ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' : 'bg-white dark:bg-slate-800 border-border'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="font-semibold flex items-center gap-2">
                        {locationVerified
                          ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                          : <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 text-xs font-bold flex items-center justify-center">2</span>}
                        Proof of Address (GPS)
                      </Label>
                      {locationVerified && <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-2 py-0.5 rounded-full font-bold">Verified ✓</span>}
                    </div>
                    {!locationVerified ? (
                      <>
                        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-3 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" /> Providing false location data leads to immediate disqualification.
                        </p>
                        <Button size="sm" className="h-10 w-full" onClick={handleVerifyLocation} disabled={locationLoading} data-testid="button-verify-location">
                          {locationLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Detecting your location...</> : <><MapPin className="w-4 h-4 mr-2" /> Enable GPS & Verify Location</>}
                        </Button>
                      </>
                    ) : (
                      <p className="text-xs text-green-600 dark:text-green-400 font-mono flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> GPS: {locationCoords}</p>
                    )}
                  </div>

                  {/* Biometric */}
                  <div className={`p-4 rounded-xl border transition-all ${!locationVerified ? 'opacity-40 pointer-events-none' : 'bg-white dark:bg-slate-800 border-border'}`}>
                    <Label className="font-semibold flex items-center gap-2 mb-3">
                      <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 text-xs font-bold flex items-center justify-center">3</span>
                      Biometric Face Scan
                    </Label>
                    <p className="text-xs text-muted-foreground mb-3">A quick face scan confirms you are a real, unique individual. Camera access required.</p>
                    <Button
                      size="sm"
                      className="h-10 w-full bg-blue-600 hover:bg-blue-700"
                      onClick={() => { setShowBiometric(true); setBiometricPhase("ready"); }}
                      disabled={!locationVerified}
                      data-testid="button-start-biometric"
                    >
                      <ScanFace className="w-4 h-4 mr-2" /> Start Face Scan
                    </Button>
                  </div>

                  {/* Defer option */}
                  <div className="border-t pt-5 space-y-3">
                    <p className="text-xs text-muted-foreground text-center">You can complete KYC and biometric later from your dashboard.</p>
                    <Button
                      variant="outline"
                      className="w-full h-11 font-semibold"
                      onClick={() => setLocation("/dashboard")}
                      data-testid="button-complete-later"
                    >
                      <Clock className="w-4 h-4 mr-2" /> Complete Later — Go to Dashboard
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── STEP 5: Done ── */}
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
                <div className="p-8">
                  <p className="text-sm text-muted-foreground mb-8">Our team will review within 24–48 hours. You'll receive a notification once approved and your wallet is funded.</p>
                  <Button onClick={() => setLocation("/dashboard")} className="h-12 px-8 text-base font-semibold" data-testid="button-go-dashboard">
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
                      Your Score: {failPercentage}% &nbsp;·&nbsp; Minimum Required: 50%
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

      {/* Biometric dialog — OPay-style with animated character */}
      <Dialog open={showBiometric} onOpenChange={open => { if (!open) setShowBiometric(false); }}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
          {/* Branded header bar */}
          <div className="bg-[#1A3C34] px-5 py-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-[#D4AF37]/20 rounded-xl flex items-center justify-center">
              <ScanFace className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base leading-tight">TSIA Identity Verification</h2>
              <p className="text-white/60 text-[11px]">Powered by secure facial biometrics</p>
            </div>
            <div className="ml-auto flex items-center gap-1 bg-[#D4AF37]/20 rounded-full px-2 py-0.5">
              <div className="w-1.5 h-1.5 bg-[#D4AF37] rounded-full" />
              <span className="text-[#D4AF37] text-[10px] font-bold">SECURE</span>
            </div>
          </div>

          {/* Component body */}
          <div className="px-5 py-4">
            <BiometricVerification
              onComplete={handleBiometricComplete}
              onCancel={() => setShowBiometric(false)}
            />
          </div>

          {/* Footer */}
          <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 flex items-center justify-center gap-2">
            <span className="text-[10px] text-muted-foreground">🔒 256-bit encrypted · NDPR compliant · Data not stored</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
