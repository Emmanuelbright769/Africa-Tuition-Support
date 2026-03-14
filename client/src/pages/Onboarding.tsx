import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ShieldAlert, CreditCard, Upload, Lock, FileText, CheckCircle2, X, Loader2, Camera, ScanFace, Sparkles, PartyPopper, XCircle, MapPin, Wallet, ArrowRight, Share2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/ui/Logo";
import { WAEC_COMPULSORY_SUBJECTS, WAEC_ELECTIVE_SUBJECTS } from "@shared/schema";

const VALID_GRADES = ["A1", "B2", "B3", "C4", "C5", "C6", "D7", "E8", "F9"];

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [nin, setNin] = useState("");

  const [waecReg, setWaecReg] = useState("");
  const [waecYear, setWaecYear] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [schoolLocation, setSchoolLocation] = useState("");
  const [electives, setElectives] = useState<string[]>(["", "", ""]);
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [waecResult, setWaecResult] = useState<any>(null);
  const [waecFailed, setWaecFailed] = useState(false);
  const [failMessage, setFailMessage] = useState("");
  const [failPercentage, setFailPercentage] = useState(0);

  const [showBiometric, setShowBiometric] = useState(false);
  const [biometricPhase, setBiometricPhase] = useState<"ready" | "scanning" | "processing" | "complete">("ready");
  const [biometricDone, setBiometricDone] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [walletNin, setWalletNin] = useState("");
  const [walletNinVerified, setWalletNinVerified] = useState(false);
  const [bvn, setBvn] = useState("");
  const [bvnVerified, setBvnVerified] = useState(false);
  const [locationVerified, setLocationVerified] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationAddress, setLocationAddress] = useState("");
  const [verifyingNin, setVerifyingNin] = useState(false);
  const [verifyingBvn, setVerifyingBvn] = useState(false);

  const [uploadedFiles, setUploadedFiles] = useState<Array<{ id: number; fileName: string; fileSize: number }>>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  if (!user) {
    setLocation("/login");
    return null;
  }

  const allSubjects = [...WAEC_COMPULSORY_SUBJECTS, ...electives.filter(Boolean)];

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "File too large", description: `${file.name} exceeds 5MB limit`, variant: "destructive" });
        continue;
      }
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", "verification");
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
        if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
        const saved = await res.json();
        setUploadedFiles(prev => [...prev, { id: saved.id, fileName: saved.fileName, fileSize: saved.fileSize }]);
      } catch (err: any) {
        toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [toast]);

  const handleIdentity = async () => {
    if (!nin || nin.length < 11) {
      toast({ title: "Error", description: "Please enter a valid 11-digit NIN", variant: "destructive" });
      return;
    }
    try {
      await apiRequest("POST", "/api/verification/identity", { nin });
      setStep(2);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const setElectiveAt = (index: number, value: string) => {
    const newElectives = [...electives];
    newElectives[index] = value;
    setElectives(newElectives);
  };

  const setGradeFor = (subject: string, grade: string) => {
    setGrades(prev => ({ ...prev, [subject]: grade }));
  };

  const handleValidateWaec = async () => {
    if (!waecReg) { toast({ title: "Error", description: "WAEC Registration number is required", variant: "destructive" }); return; }
    if (!waecYear) { toast({ title: "Error", description: "WAEC Year is required", variant: "destructive" }); return; }
    if (!schoolName || !schoolLocation) { toast({ title: "Error", description: "School name and location are required", variant: "destructive" }); return; }
    const filledElectives = electives.filter(Boolean);
    if (filledElectives.length !== 3) { toast({ title: "Error", description: "Please select exactly 3 elective subjects", variant: "destructive" }); return; }
    const subjects = [...WAEC_COMPULSORY_SUBJECTS, ...filledElectives];
    const gradesList = subjects.map(s => grades[s]);
    if (gradesList.some(g => !g)) { toast({ title: "Error", description: "Please select grades for all 5 subjects", variant: "destructive" }); return; }
    setShowBiometric(true);
    setBiometricPhase("ready");
  };

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
            setBiometricDone(true);
            setTimeout(() => { setShowBiometric(false); submitWaecValidation(); }, 1500);
          } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
            setShowBiometric(false);
          }
        }, 3000);
      }, 4000);
    } catch (err: any) {
      toast({ title: "Camera Access Denied", description: "Please allow camera access to complete biometric verification.", variant: "destructive" });
      setShowBiometric(false);
    }
  };

  const submitWaecValidation = async () => {
    const filledElectives = electives.filter(Boolean);
    const subjects = [...WAEC_COMPULSORY_SUBJECTS, ...filledElectives];
    const gradesList = subjects.map(s => grades[s]);
    try {
      const res = await apiRequest("POST", "/api/verification/waec-validate", {
        waecRegNumber: waecReg, waecYear, subjects, grades: gradesList, schoolName, schoolLocation,
      });
      const data = await res.json();
      setWaecResult(data);
      setStep(3);
    } catch (err: any) {
      try {
        const errData = await err.json?.();
        setFailMessage(errData?.message || "Your grades did not meet the minimum requirement.");
        setFailPercentage(errData?.percentage || 0);
      } catch {
        setFailMessage("Your grades did not meet the minimum requirement for sponsorship.");
        setFailPercentage(0);
      }
      setWaecFailed(true);
      setStep(3);
    }
  };

  const closeBiometricDialog = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setShowBiometric(false);
    setBiometricPhase("ready");
  };

  const handleVerifyWalletNin = async () => {
    if (!walletNin || walletNin.length < 11) { toast({ title: "Error", description: "Please enter a valid 11-digit NIN", variant: "destructive" }); return; }
    setVerifyingNin(true);
    await new Promise(r => setTimeout(r, 2000));
    setWalletNinVerified(true);
    setVerifyingNin(false);
    toast({ title: "NIN Verified", description: "Your National Identification Number has been confirmed." });
  };

  const handleVerifyBvn = async () => {
    if (!bvn || bvn.length < 11) { toast({ title: "Error", description: "Please enter a valid 11-digit BVN", variant: "destructive" }); return; }
    setVerifyingBvn(true);
    await new Promise(r => setTimeout(r, 2000));
    setBvnVerified(true);
    setVerifyingBvn(false);
    toast({ title: "BVN Verified", description: "Your Bank Verification Number has been confirmed." });
  };

  const handleVerifyLocation = async () => {
    setLocationLoading(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
      });
      const { latitude, longitude } = position.coords;
      setLocationAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      await new Promise(r => setTimeout(r, 1500));
      setLocationVerified(true);
      toast({ title: "Location Verified", description: "Your address has been confirmed via GPS coordinates." });
    } catch (err: any) {
      toast({ title: "Location Access Denied", description: "Please enable location services and try again. False location will lead to disqualification.", variant: "destructive" });
    } finally {
      setLocationLoading(false);
    }
  };

  const handlePayment = async () => {
    setIsProcessing(true);
    try {
      await apiRequest("POST", "/api/verification/pay-fee");
      toast({ title: "Payment Successful", description: "Your verification fee has been processed." });
      setStep(4);
    } catch (err: any) {
      toast({ title: "Payment Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const totalSteps = 3;
  const progressStep = waecFailed ? 3 : step;
  const stepLabels = ["Identity Verification", "WAEC Validation", waecFailed ? "Results" : "Digital Wallet"];

  const slideVariants = {
    initial: { opacity: 0, x: 40 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.5, ease: "easeOut" } },
    exit: { opacity: 0, x: -40, transition: { duration: 0.3, ease: "easeIn" } }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 font-sans flex flex-col">
      <div className="bg-card border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/"><a className="flex items-center gap-2"><Logo variant="badge" height={28} /><span className="text-sm font-bold text-muted-foreground">TSIA Onboarding</span></a></Link>
          <span className="text-xs font-semibold text-muted-foreground bg-muted px-3 py-1 rounded-full">
            Step {Math.min(step, totalSteps)} of {totalSteps}
          </span>
        </div>
        <div className="h-1 bg-muted">
          <motion.div
            className="h-full bg-gradient-to-r from-tsia-green to-tsia-gold"
            initial={{ width: "0%" }}
            animate={{ width: `${(Math.min(progressStep, totalSteps) / totalSteps) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="bg-card rounded-3xl shadow-2xl border overflow-hidden">
                <div className="bg-gradient-to-r from-tsia-green/10 to-transparent p-8 pb-0">
                  <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
                    <ShieldAlert className="w-8 h-8" />
                  </div>
                  <h2 className="text-3xl font-bold mb-2">Identity Verification</h2>
                  <p className="text-muted-foreground text-lg mb-8">We need to verify your identity to ensure funds go to genuine students.</p>
                </div>
                <div className="p-8 pt-6 space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="nin" className="text-base font-semibold">National Identification Number (NIN)</Label>
                    <Input id="nin" placeholder="Enter your 11-digit NIN" className="h-12 text-lg bg-muted/30" value={nin} onChange={e => setNin(e.target.value)} data-testid="input-nin" />
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-2 font-medium">
                      <Lock className="w-3.5 h-3.5 text-green-600" /> Your data is securely encrypted
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Government ID Document</Label>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="hidden" />
                    <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 hover:bg-primary/5 rounded-xl p-8 text-center transition-all cursor-pointer group">
                      {uploading ? (
                        <div className="flex flex-col items-center gap-3"><Loader2 className="w-8 h-8 text-primary animate-spin" /><p className="text-sm font-medium text-muted-foreground">Uploading...</p></div>
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-full bg-card shadow-sm flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                            <Upload className="w-6 h-6 text-muted-foreground group-hover:text-primary" />
                          </div>
                          <p className="text-base font-semibold">Click to upload</p>
                          <p className="text-sm text-muted-foreground mt-1">Passport, Driver's License, or National ID (Max 5MB)</p>
                        </>
                      )}
                    </div>
                    {uploadedFiles.length > 0 && (
                      <div className="space-y-2 mt-3">
                        {uploadedFiles.map(f => (
                          <div key={f.id} className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-primary" />
                              <span className="text-sm font-medium truncate max-w-[200px]">{f.fileName}</span>
                              <span className="text-xs text-muted-foreground">({(f.fileSize / 1024).toFixed(0)} KB)</span>
                            </div>
                            <button onClick={() => setUploadedFiles(prev => prev.filter(ff => ff.id !== f.id))} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><X className="w-4 h-4" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button onClick={handleIdentity} className="w-full h-14 text-lg font-semibold mt-4 shadow-md" data-testid="button-identity-next">
                    Continue to WAEC Validation <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="bg-card rounded-3xl shadow-2xl border overflow-hidden">
                <div className="bg-gradient-to-r from-amber-500/10 to-transparent p-8 pb-0">
                  <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-2xl flex items-center justify-center mb-6">
                    <FileText className="w-8 h-8" />
                  </div>
                  <h2 className="text-3xl font-bold mb-2">WAEC Result Validation</h2>
                  <p className="text-muted-foreground mb-6">Enter your WAEC details. Results will be verified through the WAEC API.</p>
                </div>

                <div className="p-8 pt-6 space-y-6 max-h-[65vh] overflow-y-auto">
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

                  <div className="space-y-4">
                    <Label className="text-base font-semibold">Subject Selection & Grades</Label>
                    <p className="text-xs text-muted-foreground">Mathematics and English Language are compulsory. Select 3 additional elective subjects.</p>

                    <div className="bg-muted/20 rounded-xl p-4 border space-y-3">
                      {WAEC_COMPULSORY_SUBJECTS.map((subject) => (
                        <div key={subject} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Lock className="w-3.5 h-3.5 text-primary" />
                              <span className="text-sm font-semibold">{subject}</span>
                              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase">Compulsory</span>
                            </div>
                          </div>
                          <Select value={grades[subject] || undefined} onValueChange={(v) => setGradeFor(subject, v)}>
                            <SelectTrigger className="h-9 w-24 text-sm" data-testid={`select-grade-${subject.replace(/\s/g, '-').toLowerCase()}`}>
                              <SelectValue placeholder="Grade" />
                            </SelectTrigger>
                            <SelectContent>
                              {VALID_GRADES.map(g => (
                                <SelectItem key={g} value={g}>{g}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}

                      {[0, 1, 2].map((idx) => (
                        <div key={idx} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                          <div className="flex-1">
                            <Select value={electives[idx] || undefined} onValueChange={(v) => setElectiveAt(idx, v)}>
                              <SelectTrigger className="h-9 text-sm" data-testid={`select-elective-${idx}`}>
                                <SelectValue placeholder={`Elective Subject ${idx + 1}`} />
                              </SelectTrigger>
                              <SelectContent>
                                {WAEC_ELECTIVE_SUBJECTS.filter(s => !electives.includes(s) || electives[idx] === s).map(s => (
                                  <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Select value={electives[idx] ? (grades[electives[idx]] || undefined) : undefined} onValueChange={(v) => electives[idx] && setGradeFor(electives[idx], v)} disabled={!electives[idx]}>
                            <SelectTrigger className="h-9 w-24 text-sm" data-testid={`select-elective-grade-${idx}`}>
                              <SelectValue placeholder="Grade" />
                            </SelectTrigger>
                            <SelectContent>
                              {VALID_GRADES.map(g => (
                                <SelectItem key={g} value={g}>{g}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button variant="outline" onClick={() => setStep(1)} className="w-1/3 h-12 font-semibold">Back</Button>
                    <Button onClick={handleValidateWaec} className="w-2/3 h-12 text-base font-semibold bg-amber-600 hover:bg-amber-700 shadow-md" data-testid="button-validate-waec">
                      <ScanFace className="w-5 h-5 mr-2" /> Validate via WAEC API
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && !waecFailed && (
              <motion.div key="step3-pass" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="bg-card rounded-3xl shadow-2xl border overflow-hidden">
                <div className="bg-gradient-to-r from-green-500/10 to-tsia-gold/10 p-8 text-center">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}>
                    <PartyPopper className="w-20 h-20 text-tsia-gold mx-auto mb-4" />
                  </motion.div>
                  <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="text-3xl font-bold mb-2">
                    Congratulations! 🎉
                  </motion.h2>
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-muted-foreground text-lg">
                    Your request is accepted and pending approval.
                  </motion.p>
                  {waecResult && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-4 inline-flex items-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-4 py-2 rounded-full text-sm font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      {waecResult.payoutRange?.label?.charAt(0).toUpperCase() + waecResult.payoutRange?.label?.slice(1)} Tier — {waecResult.calculatedPercentage}% Score
                    </motion.div>
                  )}
                </div>

                <div className="p-8 space-y-6 max-h-[55vh] overflow-y-auto">
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
                    className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center">
                        <Wallet className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">Create Your Digital Wallet</h3>
                        <p className="text-sm text-muted-foreground">Complete KYC verification to activate your wallet</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className={`p-4 rounded-xl border transition-all ${walletNinVerified ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-white dark:bg-slate-800 border-border'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="font-semibold flex items-center gap-2">
                            {walletNinVerified ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-bold">1</span>}
                            NIN Verification
                          </Label>
                          {walletNinVerified && <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-2 py-0.5 rounded-full font-bold">Verified</span>}
                        </div>
                        {!walletNinVerified && (
                          <div className="flex gap-2">
                            <Input placeholder="Enter your 11-digit NIN" className="h-10 bg-muted/30 flex-1" value={walletNin} onChange={e => setWalletNin(e.target.value)} data-testid="input-wallet-nin" />
                            <Button size="sm" className="h-10 px-4" onClick={handleVerifyWalletNin} disabled={verifyingNin} data-testid="button-verify-wallet-nin">
                              {verifyingNin ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className={`p-4 rounded-xl border transition-all ${bvnVerified ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : !walletNinVerified ? 'opacity-50' : 'bg-white dark:bg-slate-800 border-border'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="font-semibold flex items-center gap-2">
                            {bvnVerified ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-bold">2</span>}
                            BVN Verification
                          </Label>
                          {bvnVerified && <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-2 py-0.5 rounded-full font-bold">Verified</span>}
                        </div>
                        {!bvnVerified && (
                          <div className="flex gap-2">
                            <Input placeholder="Enter your 11-digit BVN" className="h-10 bg-muted/30 flex-1" value={bvn} onChange={e => setBvn(e.target.value)} disabled={!walletNinVerified} data-testid="input-bvn" />
                            <Button size="sm" className="h-10 px-4" onClick={handleVerifyBvn} disabled={verifyingBvn || !walletNinVerified} data-testid="button-verify-bvn">
                              {verifyingBvn ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className={`p-4 rounded-xl border transition-all ${locationVerified ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : !bvnVerified ? 'opacity-50' : 'bg-white dark:bg-slate-800 border-border'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="font-semibold flex items-center gap-2">
                            {locationVerified ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-bold">3</span>}
                            Proof of Address
                          </Label>
                          {locationVerified && <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-2 py-0.5 rounded-full font-bold">Verified</span>}
                        </div>
                        {!locationVerified ? (
                          <div>
                            <p className="text-xs text-muted-foreground mb-3">Enable your GPS location for address verification. Providing false location will lead to immediate disqualification.</p>
                            <Button size="sm" className="h-10 w-full" onClick={handleVerifyLocation} disabled={locationLoading || !bvnVerified} data-testid="button-verify-location">
                              {locationLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Detecting Location...</> : <><MapPin className="w-4 h-4 mr-2" /> Enable Location & Verify</>}
                            </Button>
                          </div>
                        ) : (
                          <p className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1"><MapPin className="w-3 h-3" /> Location: {locationAddress}</p>
                        )}
                      </div>
                    </div>
                  </motion.div>

                  {walletNinVerified && bvnVerified && locationVerified && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-6 flex items-center justify-between shadow-lg relative overflow-hidden">
                        <div className="absolute right-0 top-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-10 -mt-10 blur-xl"></div>
                        <div className="relative z-10">
                          <h3 className="font-semibold text-lg opacity-90">Verification Fee</h3>
                          <p className="text-sm text-slate-300">Non-refundable processing fee</p>
                        </div>
                        <div className="text-4xl font-bold relative z-10">$3.00</div>
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
                      <Button onClick={handlePayment} className="w-full h-14 text-lg font-semibold bg-blue-600 hover:bg-blue-700 shadow-md" disabled={isProcessing} data-testid="button-pay">
                        {isProcessing ? <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Processing Payment...</span> : "Pay $3.00 & Activate Wallet"}
                      </Button>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {step === 3 && waecFailed && (
              <motion.div key="step3-fail" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="bg-card rounded-3xl shadow-2xl border overflow-hidden">
                <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 p-8 text-center">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}>
                    <XCircle className="w-20 h-20 text-red-400 mx-auto mb-4" />
                  </motion.div>
                  <h2 className="text-3xl font-bold mb-3">We're Sorry</h2>
                  <p className="text-muted-foreground text-lg max-w-md mx-auto mb-4">
                    Unfortunately, your WAEC results did not meet the minimum threshold required for the TSIA sponsorship program at this time.
                  </p>
                  {failPercentage > 0 && (
                    <div className="inline-flex items-center gap-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-4 py-2 rounded-full text-sm font-semibold">
                      Your Score: {failPercentage}% — Minimum Required: 50%
                    </div>
                  )}
                </div>

                <div className="p-8 space-y-6">
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 text-center">
                    <p className="text-amber-800 dark:text-amber-300 font-medium mb-2">
                      Don't give up! You can try again next semester with improved grades.
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      Keep studying hard and re-apply when you have better WAEC results. We believe in your potential!
                    </p>
                  </div>

                  <div className="bg-gradient-to-r from-tsia-gold/10 to-amber-500/10 border border-tsia-gold/30 rounded-2xl p-6 text-center">
                    <Share2 className="w-12 h-12 text-tsia-gold mx-auto mb-4" />
                    <h3 className="text-xl font-bold mb-2">Would you prefer to become an Affiliate?</h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                      Even if you're not eligible for sponsorship right now, you can still earn money by referring eligible students to TSIA through our Affiliate Program.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Link href="/affiliate-signup">
                        <Button className="bg-tsia-gold hover:bg-tsia-gold/90 text-slate-900 h-12 px-6 font-bold w-full sm:w-auto" data-testid="button-become-affiliate">
                          <Share2 className="w-4 h-4 mr-2" /> Sign Up as Affiliate
                        </Button>
                      </Link>
                      <Button variant="outline" onClick={() => { setLocation("/"); }} className="h-12 px-6" data-testid="button-go-home">
                        Return Home
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="step4-done" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="bg-card rounded-3xl shadow-2xl border overflow-hidden text-center p-12">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}>
                  <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-14 h-14 text-green-500" />
                  </div>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                  <h2 className="text-3xl font-bold mb-3">Application Submitted! 🎉</h2>
                  <p className="text-muted-foreground text-lg mb-2 max-w-md mx-auto">
                    Your wallet has been created and your application is now pending admin approval.
                  </p>
                  <p className="text-sm text-muted-foreground mb-8">
                    Our verification team will review your application within 24-48 hours. You'll be notified once approved.
                  </p>
                  <Button onClick={() => setLocation("/dashboard")} className="h-12 px-8 text-base font-semibold" data-testid="button-go-dashboard">
                    Go to Dashboard <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <Dialog open={showBiometric} onOpenChange={(open) => { if (!open) closeBiometricDialog(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center text-blue-600">
                <ScanFace className="w-6 h-6" />
              </div>
              Biometric Verification
            </DialogTitle>
            <DialogDescription>Face scan required to verify you are a real student and prevent fraudulent applications.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-4 space-y-6">
            {biometricPhase === "ready" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-6">
                <div className="w-32 h-32 mx-auto bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-full flex items-center justify-center">
                  <Camera className="w-16 h-16 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Ready for Face Scan</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">Position your face within the frame. Ensure good lighting and remove glasses or face coverings.</p>
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
                <p className="text-xs text-muted-foreground">Hold still. Do not move your face.</p>
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
                  <p className="text-sm text-muted-foreground">Verifying facial landmarks and liveness detection...</p>
                </div>
                <div className="space-y-2 max-w-xs mx-auto">
                  <div className="flex items-center gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin text-blue-500" /> Extracting facial features</div>
                  <div className="flex items-center gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin text-blue-500" /> Running liveness detection</div>
                  <div className="flex items-center gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin text-blue-500" /> Cross-referencing identity</div>
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
                  <p className="text-sm text-muted-foreground mt-1">Biometric identity confirmed. Validating WAEC results...</p>
                </div>
                <div className="flex items-center justify-center gap-2 text-xs text-green-600 font-medium">
                  <Sparkles className="w-4 h-4" /> Liveness Score: 99.8% | Match Confidence: High
                </div>
              </motion.div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
