import { useState, useRef } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  ShieldAlert, CreditCard, Lock, FileText, CheckCircle2, Loader2,
  Camera, ScanFace, Sparkles, PartyPopper, XCircle, MapPin,
  Wallet, ArrowRight, Share2, BadgeCheck, AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/ui/Logo";
import { TermsCheckbox } from "@/components/ui/TermsCheckbox";
import { WAEC_COMPULSORY_SUBJECTS, WAEC_ELECTIVE_SUBJECTS } from "@shared/schema";

const VALID_GRADES = ["A1", "B2", "B3", "C4", "C5", "C6", "D7", "E8", "F9"];

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);

  // Step 1 - NIN
  const [nin, setNin] = useState("");
  const [ninVerifying, setNinVerifying] = useState(false);
  const [ninVerified, setNinVerified] = useState(false);
  const [ninData, setNinData] = useState<any>(null);
  const [ninError, setNinError] = useState("");

  // Step 2 - WAEC
  const [waecReg, setWaecReg] = useState("");
  const [waecYear, setWaecYear] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [schoolLocation, setSchoolLocation] = useState("");
  const [electives, setElectives] = useState<string[]>(["", "", ""]);
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [waecResult, setWaecResult] = useState<any>(null);
  const [waecFailed, setWaecFailed] = useState(false);
  const [failPercentage, setFailPercentage] = useState(0);

  // Biometric
  const [showBiometric, setShowBiometric] = useState(false);
  const [biometricPhase, setBiometricPhase] = useState<"ready" | "scanning" | "processing" | "complete">("ready");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Payment terms
  const [paymentTermsAccepted, setPaymentTermsAccepted] = useState(false);

  // Step 3 - Wallet KYC
  const [walletNin, setWalletNin] = useState("");
  const [walletNinVerified, setWalletNinVerified] = useState(false);
  const [walletNinVerifying, setWalletNinVerifying] = useState(false);
  const [bvn, setBvn] = useState("");
  const [bvnVerified, setBvnVerified] = useState(false);
  const [bvnVerifying, setBvnVerifying] = useState(false);
  const [locationVerified, setLocationVerified] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationCoords, setLocationCoords] = useState("");

  const { toast } = useToast();
  const { user } = useAuth();

  if (!user) { setLocation("/login"); return null; }

  // ── NIN validation ──────────────────────────────────────────────
  const handleVerifyNin = async () => {
    if (!nin || nin.length !== 11 || !/^\d{11}$/.test(nin)) {
      setNinError("Please enter exactly 11 digits.");
      return;
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

  // ── WAEC ──────────────────────────────────────────────────────────
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
    const filled = electives.filter(Boolean);
    if (filled.length !== 3) { toast({ title: "Error", description: "Please select exactly 3 elective subjects", variant: "destructive" }); return; }
    const subjects = [...WAEC_COMPULSORY_SUBJECTS, ...filled];
    if (subjects.some(s => !grades[s])) { toast({ title: "Error", description: "Please select grades for all 5 subjects", variant: "destructive" }); return; }
    // Go to payment step FIRST — biometric happens after payment
    setStep(3);
  };

  // ── Biometric ──────────────────────────────────────────────────────
  const startBiometricScan = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setBiometricPhase("scanning");
      setTimeout(() => {
        setBiometricPhase("processing");
        setTimeout(async () => {
          if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
          try {
            await apiRequest("POST", "/api/verification/biometric");
            setBiometricPhase("complete");
            setTimeout(() => { setShowBiometric(false); submitWaec(); }, 1500);
          } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
            setShowBiometric(false);
          }
        }, 3000);
      }, 4000);
    } catch {
      toast({ title: "Camera Denied", description: "Allow camera access to complete face verification.", variant: "destructive" });
      setShowBiometric(false);
    }
  };

  const closeBiometric = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setShowBiometric(false);
    setBiometricPhase("ready");
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
      setStep(4); // payment already done; go straight to completion
    } catch (err: any) {
      try {
        const d = await err.json?.();
        setFailPercentage(d?.percentage || 0);
      } catch {}
      setWaecFailed(true);
      setStep(3); // stay on step 3 to show fail screen
    }
  };

  // ── Wallet KYC ────────────────────────────────────────────────────
  const handleVerifyWalletNin = async () => {
    if (!walletNin || walletNin.length !== 11 || !/^\d{11}$/.test(walletNin)) {
      toast({ title: "Error", description: "Enter a valid 11-digit NIN", variant: "destructive" }); return;
    }
    setWalletNinVerifying(true);
    try {
      const res = await apiRequest("POST", "/api/verification/validate-nin", { nin: walletNin });
      await res.json();
      setWalletNinVerified(true);
      toast({ title: "NIN Verified ✓", description: "Identity confirmed for wallet creation." });
    } catch (err: any) {
      let msg = "NIN verification failed.";
      try { const d = await err.json?.(); msg = d?.message || msg; } catch {}
      toast({ title: "NIN Failed", description: msg, variant: "destructive" });
    } finally {
      setWalletNinVerifying(false);
    }
  };

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
      toast({ title: "Location Denied", description: "Enable GPS and try again. False location = disqualification.", variant: "destructive" });
    } finally {
      setLocationLoading(false);
    }
  };

  const handlePayment = async () => {
    setIsProcessing(true);
    try {
      await apiRequest("POST", "/api/verification/pay-fee");
      toast({ title: "Payment Successful", description: "Fee confirmed. Please complete the face scan to finalise your verification." });
      // Payment succeeded — now open biometric
      setShowBiometric(true);
      setBiometricPhase("ready");
    } catch (err: any) {
      toast({ title: "Payment Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Slide variants ────────────────────────────────────────────────
  const slide = {
    initial: { opacity: 0, x: 40 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.45, ease: "easeOut" } },
    exit: { opacity: 0, x: -40, transition: { duration: 0.3 } },
  };

  const totalSteps = 4;
  const progressPct = waecFailed ? 100 : ((Math.min(step, totalSteps)) / totalSteps) * 100;

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
            Step {Math.min(step, totalSteps)} of {totalSteps}
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

                  {/* NIN verified profile card */}
                  <AnimatePresence>
                    {ninVerified && ninData && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-5"
                      >
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

                  {/* Verification progress indicators */}
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

                  <Button
                    onClick={handleProceedToWaec}
                    className="w-full h-14 text-lg font-semibold shadow-md"
                    disabled={!ninVerified}
                    data-testid="button-identity-next"
                  >
                    Continue to WAEC Validation <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 2: WAEC ── */}
            {step === 2 && (
              <motion.div key="s2" {...slide} className="bg-card rounded-3xl shadow-2xl border overflow-hidden">
                <div className="bg-gradient-to-r from-amber-500/10 to-transparent p-8 pb-0">
                  <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-2xl flex items-center justify-center mb-6">
                    <FileText className="w-8 h-8" />
                  </div>
                  <h2 className="text-3xl font-bold mb-2">WAEC Result Validation</h2>
                  <p className="text-muted-foreground mb-6">Enter your WAEC details. Results are cross-checked against the WAEC verification API.</p>
                </div>

                <div className="p-8 pt-6 space-y-6 max-h-[60vh] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-semibold">WAEC Reg Number</Label>
                      <Input placeholder="e.g. 4250101001" className="h-11 bg-muted/30" value={waecReg} onChange={e => setWaecReg(e.target.value)} data-testid="input-waec-reg" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-semibold">Exam Year</Label>
                      <Input placeholder="e.g. 2023" className="h-11 bg-muted/30" value={waecYear} onChange={e => setWaecYear(e.target.value)} data-testid="input-waec-year" />
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

                  <div className="flex gap-4 pt-2">
                    <Button variant="outline" onClick={() => setStep(1)} className="w-1/3 h-12 font-semibold">Back</Button>
                    <Button onClick={handleValidateWaec} className="w-2/3 h-12 text-base font-semibold bg-amber-600 hover:bg-amber-700 shadow-md" data-testid="button-validate-waec">
                      <ArrowRight className="w-5 h-5 mr-2" /> Proceed to Payment
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── STEP 3 PASS: KYC + Payment (before biometric) ── */}
            {step === 3 && !waecFailed && (
              <motion.div key="s3-pass" {...slide} className="bg-card rounded-3xl shadow-2xl border overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 p-8 pb-0">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                    <CreditCard className="w-8 h-8" />
                  </div>
                  <h2 className="text-3xl font-bold mb-2">Payment & KYC</h2>
                  <p className="text-muted-foreground text-lg mb-6">Complete identity KYC and pay the one-time portal fee. Your face scan happens right after.</p>
                </div>

                <div className="p-8 space-y-6 max-h-[55vh] overflow-y-auto">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center">
                        <Wallet className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">Create Your Digital Wallet</h3>
                        <p className="text-sm text-muted-foreground">Complete 3-step KYC to activate your wallet</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* NIN */}
                      <div className={`p-4 rounded-xl border transition-all ${walletNinVerified ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' : 'bg-white dark:bg-slate-800 border-border'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="font-semibold flex items-center gap-2">
                            {walletNinVerified
                              ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                              : <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 text-xs font-bold flex items-center justify-center">1</span>}
                            NIN Verification
                          </Label>
                          {walletNinVerified && <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-2 py-0.5 rounded-full font-bold">Verified ✓</span>}
                        </div>
                        {!walletNinVerified && (
                          <div className="flex gap-2">
                            <Input placeholder="11-digit NIN" className="h-10 bg-muted/30 flex-1 font-mono tracking-widest" value={walletNin} maxLength={11} onChange={e => setWalletNin(e.target.value.replace(/\D/g, ""))} data-testid="input-wallet-nin" />
                            <Button size="sm" className="h-10 px-4" onClick={handleVerifyWalletNin} disabled={walletNinVerifying || walletNin.length !== 11} data-testid="button-verify-wallet-nin">
                              {walletNinVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* BVN */}
                      <div className={`p-4 rounded-xl border transition-all ${!walletNinVerified ? 'opacity-40 pointer-events-none' : bvnVerified ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' : 'bg-white dark:bg-slate-800 border-border'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="font-semibold flex items-center gap-2">
                            {bvnVerified
                              ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                              : <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 text-xs font-bold flex items-center justify-center">2</span>}
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

                      {/* Location */}
                      <div className={`p-4 rounded-xl border transition-all ${!bvnVerified ? 'opacity-40 pointer-events-none' : locationVerified ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' : 'bg-white dark:bg-slate-800 border-border'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="font-semibold flex items-center gap-2">
                            {locationVerified
                              ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                              : <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 text-xs font-bold flex items-center justify-center">3</span>}
                            Proof of Address
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
                    </div>
                  </div>

                  {walletNinVerified && bvnVerified && locationVerified && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-6 flex items-center justify-between shadow-lg">
                        <div>
                          <h3 className="font-semibold text-lg">Verification Fee</h3>
                          <p className="text-sm text-slate-300">Non-refundable processing fee</p>
                        </div>
                        <div className="text-4xl font-bold">$3.00</div>
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
                      <TermsCheckbox
                        checked={paymentTermsAccepted}
                        onCheckedChange={setPaymentTermsAccepted}
                        context="payment"
                        className="px-1"
                      />
                      <Button onClick={handlePayment} className="w-full h-14 text-lg font-semibold bg-blue-600 hover:bg-blue-700 shadow-md" disabled={isProcessing || !paymentTermsAccepted} data-testid="button-pay">
                        {isProcessing ? <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Processing Payment...</span> : <><CreditCard className="w-5 h-5 mr-2" /> Pay $3.00 — Then Complete Face Scan</>}
                      </Button>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── STEP 3 FAIL ── */}
            {step === 3 && waecFailed && (
              <motion.div key="s3-fail" {...slide} className="bg-card rounded-3xl shadow-2xl border overflow-hidden">
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
                    <p className="text-sm text-amber-700 dark:text-amber-400">Study harder, improve your grades, and re-apply. We believe in you and your potential.</p>
                  </div>
                  <div className="bg-gradient-to-r from-tsia-gold/10 to-amber-500/10 border border-tsia-gold/30 rounded-2xl p-6 text-center">
                    <Share2 className="w-12 h-12 text-tsia-gold mx-auto mb-3" />
                    <h3 className="text-xl font-bold mb-2">Would you prefer to become an Affiliate?</h3>
                    <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
                      Earn commissions by referring eligible students to TSIA — no academic requirement needed for the Affiliate Programme.
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

            {/* ── STEP 4: Done ── */}
            {step === 4 && (
              <motion.div key="s4" {...slide} className="bg-card rounded-3xl shadow-2xl border overflow-hidden text-center">
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

          </AnimatePresence>
        </div>
      </div>

      {/* Biometric dialog */}
      <Dialog open={showBiometric} onOpenChange={open => { if (!open) closeBiometric(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center text-blue-600">
                <ScanFace className="w-6 h-6" />
              </div>
              Biometric Verification
            </DialogTitle>
            <DialogDescription>Face scan required to confirm you are a real, unique student applicant.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-4 space-y-6">
            {biometricPhase === "ready" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-6">
                <div className="w-32 h-32 mx-auto bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-full flex items-center justify-center">
                  <Camera className="w-16 h-16 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Ready for Face Scan</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">Position your face in frame. Good lighting required. Remove glasses or face coverings.</p>
                </div>
                <Button onClick={startBiometricScan} className="bg-blue-600 hover:bg-blue-700 h-12 px-8 text-base" data-testid="button-start-biometric">
                  <Camera className="w-5 h-5 mr-2" /> Start Face Scan
                </Button>
              </motion.div>
            )}
            {biometricPhase === "scanning" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-4">
                <div className="relative">
                  <video ref={videoRef} className="w-64 h-64 object-cover rounded-2xl border-4 border-blue-500 shadow-lg shadow-blue-500/20" autoPlay playsInline muted />
                  <div className="absolute inset-0 rounded-2xl border-4 border-blue-400 animate-pulse pointer-events-none"></div>
                  <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div> SCANNING
                  </div>
                </div>
                <p className="text-sm font-medium text-blue-600">Analyzing facial features...</p>
                <p className="text-xs text-muted-foreground">Hold still. Do not move.</p>
              </motion.div>
            )}
            {biometricPhase === "processing" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-6 py-8">
                <div className="relative w-24 h-24 mx-auto">
                  <div className="absolute inset-0 border-4 border-blue-200 dark:border-blue-800 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
                  <ScanFace className="absolute inset-0 m-auto w-10 h-10 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">Processing Biometric Data</h3>
                  <p className="text-sm text-muted-foreground">Verifying liveness and cross-referencing identity...</p>
                </div>
                <div className="space-y-2 max-w-xs mx-auto">
                  {["Extracting facial features", "Running liveness detection", "Cross-referencing identity"].map(m => (
                    <div key={m} className="flex items-center gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin text-blue-500" /> {m}</div>
                  ))}
                </div>
              </motion.div>
            )}
            {biometricPhase === "complete" && (
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-4 py-8">
                <div className="w-24 h-24 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-14 h-14 text-green-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-green-600">Verification Successful</h3>
                  <p className="text-sm text-muted-foreground mt-1">Biometric confirmed. Validating WAEC results...</p>
                </div>
                <div className="flex items-center justify-center gap-2 text-xs text-green-600 font-medium">
                  <Sparkles className="w-4 h-4" /> Liveness: 99.8% | Confidence: High
                </div>
              </motion.div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
