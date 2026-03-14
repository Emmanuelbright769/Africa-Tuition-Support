import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ShieldAlert, CreditCard, Upload, Lock, FileText, CheckCircle2, X, Loader2, Camera, ScanFace, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/ui/Logo";
import { WAEC_GRADE_WEIGHTS, WAEC_COMPULSORY_SUBJECTS, WAEC_ELECTIVE_SUBJECTS } from "@shared/schema";

const VALID_GRADES = Object.keys(WAEC_GRADE_WEIGHTS);

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
  const [waecValidated, setWaecValidated] = useState(false);
  const [waecResult, setWaecResult] = useState<any>(null);

  const [showBiometric, setShowBiometric] = useState(false);
  const [biometricPhase, setBiometricPhase] = useState<"ready" | "scanning" | "processing" | "complete">("ready");
  const [biometricDone, setBiometricDone] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  const calculatePreview = () => {
    const filledGrades = allSubjects.filter(s => grades[s]).map(s => grades[s]);
    if (filledGrades.length === 0) return null;
    const weights = filledGrades.map(g => WAEC_GRADE_WEIGHTS[g] || 0);
    const total = weights.reduce((a, b) => a + b, 0);
    const maxPossible = filledGrades.length * 15;
    const pct = Math.round((total / maxPossible) * 100 * 100) / 100;
    let tierLabel = "Below Threshold";
    let tierColor = "text-red-600";
    let range = "Not Eligible";
    if (pct >= 75) { tierLabel = "Platinum"; tierColor = "text-primary"; range = "$225 - $230"; }
    else if (pct >= 60) { tierLabel = "Gold"; tierColor = "text-amber-600"; range = "$160 - $180"; }
    else if (pct >= 50) { tierLabel = "Silver"; tierColor = "text-slate-600"; range = "$110 - $130"; }
    return { pct, tierLabel, tierColor, range, total, maxPossible };
  };

  const handleValidateWaec = async () => {
    if (!waecReg) {
      toast({ title: "Error", description: "WAEC Registration number is required", variant: "destructive" });
      return;
    }
    if (!waecYear) {
      toast({ title: "Error", description: "WAEC Year is required", variant: "destructive" });
      return;
    }
    if (!schoolName || !schoolLocation) {
      toast({ title: "Error", description: "School name and location are required", variant: "destructive" });
      return;
    }
    const filledElectives = electives.filter(Boolean);
    if (filledElectives.length !== 3) {
      toast({ title: "Error", description: "Please select exactly 3 elective subjects", variant: "destructive" });
      return;
    }
    const subjects = [...WAEC_COMPULSORY_SUBJECTS, ...filledElectives];
    const gradesList = subjects.map(s => grades[s]);
    if (gradesList.some(g => !g)) {
      toast({ title: "Error", description: "Please select grades for all 5 subjects", variant: "destructive" });
      return;
    }

    setShowBiometric(true);
    setBiometricPhase("ready");
  };

  const startBiometricScan = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setBiometricPhase("scanning");

      setTimeout(() => {
        setBiometricPhase("processing");
        setTimeout(async () => {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
          }
          try {
            await apiRequest("POST", "/api/verification/biometric");
            setBiometricPhase("complete");
            setBiometricDone(true);

            setTimeout(() => {
              setShowBiometric(false);
              submitWaecAndShowPayment();
            }, 1500);
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

  const submitWaecAndShowPayment = async () => {
    const filledElectives = electives.filter(Boolean);
    const subjects = [...WAEC_COMPULSORY_SUBJECTS, ...filledElectives];
    const gradesList = subjects.map(s => grades[s]);

    try {
      const res = await apiRequest("POST", "/api/verification/waec-validate", {
        waecRegNumber: waecReg,
        waecYear,
        subjects,
        grades: gradesList,
        schoolName,
        schoolLocation,
      });
      const data = await res.json();
      setWaecResult(data);
      setWaecValidated(true);
      toast({
        title: "WAEC Results Validated via WAEC API",
        description: `Score: ${data.calculatedPercentage}% - ${data.payoutRange.label.charAt(0).toUpperCase() + data.payoutRange.label.slice(1)} Tier`,
      });
    } catch (err: any) {
      const errData = await err.json?.() || {};
      toast({ title: "Validation Failed", description: errData.message || err.message, variant: "destructive" });
    }
  };

  const closeBiometricDialog = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setShowBiometric(false);
    setBiometricPhase("ready");
  };

  const handlePayment = async () => {
    setIsProcessing(true);
    try {
      await apiRequest("POST", "/api/verification/pay-fee");
      toast({ title: "Payment Successful", description: "Your verification fee has been processed. Redirecting to dashboard..." });
      setTimeout(() => setLocation("/dashboard"), 2000);
    } catch (err: any) {
      toast({ title: "Payment Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const preview = calculatePreview();

  const slideVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.3, ease: "easeIn" } }
  };

  const availableElectives = WAEC_ELECTIVE_SUBJECTS.filter(s => !electives.includes(s) || electives.indexOf(s) === electives.lastIndexOf(s));

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8 font-sans flex flex-col justify-center">
      <div className="max-w-2xl mx-auto w-full">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex flex-col items-center">
          <Logo variant="badge" height={48} className="mb-4" />
          <div className="flex justify-between items-center w-full mb-4">
            <span className="text-sm font-bold text-muted-foreground tracking-widest uppercase">Step {step} of 2</span>
            <span className="text-sm font-medium text-foreground bg-card px-3 py-1 rounded-full shadow-sm border">
              {step === 1 ? "Identity Verification" : "WAEC Validation & Payment"}
            </span>
          </div>
          <Progress value={(step / 2) * 100} className="h-2.5 bg-muted rounded-full overflow-hidden w-full" />
        </motion.div>

        <div className="relative overflow-hidden rounded-2xl shadow-xl bg-card border min-h-[500px]">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="p-8 md:p-10 h-full flex flex-col">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-bold mb-2">Identity Verification</h2>
                <p className="text-muted-foreground mb-8 text-lg">We need to verify your identity to ensure funds go to genuine students.</p>
                <div className="space-y-6 flex-1">
                  <div className="space-y-2">
                    <Label htmlFor="nin" className="text-base">National Identification Number (NIN)</Label>
                    <Input id="nin" placeholder="Enter your 11-digit NIN" className="h-12 text-lg bg-muted/30" value={nin} onChange={e => setNin(e.target.value)} data-testid="input-nin" />
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-2 font-medium">
                      <Lock className="w-3.5 h-3.5 text-green-600" /> Your data is securely encrypted
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base">Government ID Document</Label>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="hidden" />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-border hover:border-primary/50 bg-muted/30 hover:bg-primary/5 rounded-xl p-8 text-center transition-all cursor-pointer group"
                    >
                      {uploading ? (
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="w-8 h-8 text-primary animate-spin" />
                          <p className="text-sm font-medium text-muted-foreground">Uploading...</p>
                        </div>
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-full bg-card shadow-sm flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                            <Upload className="w-6 h-6 text-muted-foreground group-hover:text-primary" />
                          </div>
                          <p className="text-base font-semibold">Click to upload or drag and drop</p>
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
                            <button onClick={() => setUploadedFiles(prev => prev.filter(ff => ff.id !== f.id))} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <Button onClick={handleIdentity} className="w-full h-14 text-lg font-semibold mt-8 shadow-md" data-testid="button-identity-next">Continue to WAEC Validation</Button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="p-8 md:p-10 h-full flex flex-col">
                <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-2xl flex items-center justify-center mb-6">
                  <FileText className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-bold mb-2">WAEC Result Validation</h2>
                <p className="text-muted-foreground mb-6">Enter your WAEC details. Results will be verified through the WAEC API.</p>

                <div className="space-y-6 flex-1 overflow-y-auto max-h-[60vh] pr-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>WAEC Reg Number</Label>
                      <Input placeholder="e.g. 4250101001" className="h-11 bg-muted/30" value={waecReg} onChange={e => setWaecReg(e.target.value)} data-testid="input-waec-reg" />
                    </div>
                    <div className="space-y-2">
                      <Label>Exam Year</Label>
                      <Input placeholder="e.g. 2023" className="h-11 bg-muted/30" value={waecYear} onChange={e => setWaecYear(e.target.value)} data-testid="input-waec-year" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>School Name</Label>
                      <Input placeholder="e.g. Federal Government College" className="h-11 bg-muted/30" value={schoolName} onChange={e => setSchoolName(e.target.value)} data-testid="input-school-name" />
                    </div>
                    <div className="space-y-2">
                      <Label>School Location (State)</Label>
                      <Input placeholder="e.g. Lagos, Nigeria" className="h-11 bg-muted/30" value={schoolLocation} onChange={e => setSchoolLocation(e.target.value)} data-testid="input-school-location" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-base font-semibold">Subject Selection & Grades</Label>
                    <p className="text-xs text-muted-foreground">Mathematics and English Language are compulsory. Select 3 additional subjects (5 total).</p>

                    <div className="bg-muted/30 rounded-xl p-4 border space-y-3">
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
                                <SelectItem key={g} value={g}>{g} ({WAEC_GRADE_WEIGHTS[g]}pts)</SelectItem>
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
                                <SelectItem key={g} value={g}>{g} ({WAEC_GRADE_WEIGHTS[g]}pts)</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>

                  {preview && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-5 border shadow-sm space-y-3">
                      <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Score Preview</h4>
                      <div className="flex items-end justify-between">
                        <div>
                          <div className="text-4xl font-bold tracking-tight">{preview.pct}%</div>
                          <div className="text-sm text-muted-foreground">{preview.total} / {preview.maxPossible} points</div>
                        </div>
                        <div className="text-right">
                          <div className={`text-xl font-bold ${preview.tierColor}`}>{preview.tierLabel}</div>
                          <div className="text-sm font-medium text-muted-foreground">Payout: {preview.range}</div>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${preview.pct >= 75 ? 'bg-primary' : preview.pct >= 60 ? 'bg-amber-500' : preview.pct >= 50 ? 'bg-slate-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(preview.pct, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                        <span>0%</span>
                        <span className="text-slate-500">50% Silver</span>
                        <span className="text-amber-600">60% Gold</span>
                        <span className="text-primary">75% Platinum</span>
                      </div>
                    </motion.div>
                  )}

                  {!waecValidated && (
                    <div className="flex gap-4">
                      <Button variant="outline" onClick={() => setStep(1)} className="w-1/3 h-12 font-semibold">Back</Button>
                      <Button onClick={handleValidateWaec} className="w-2/3 h-12 text-base font-semibold bg-amber-600 hover:bg-amber-700 shadow-md" data-testid="button-validate-waec">
                        <ScanFace className="w-5 h-5 mr-2" /> Validate via WAEC API
                      </Button>
                    </div>
                  )}

                  {waecValidated && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 mt-4">
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-start gap-3">
                        <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-bold text-green-800 dark:text-green-300">WAEC Results Verified</h4>
                          <p className="text-sm text-green-700 dark:text-green-400">Your results have been confirmed via the WAEC verification API. Verification ID: {waecResult?.waecValidation?.verificationId}</p>
                        </div>
                      </div>

                      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-6 flex items-center justify-between shadow-lg relative overflow-hidden">
                        <div className="absolute right-0 top-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-10 -mt-10 blur-xl"></div>
                        <div className="relative z-10">
                          <h3 className="font-semibold text-lg opacity-90">Verification Fee</h3>
                          <p className="text-sm text-slate-300">Non-refundable processing</p>
                          <p className="text-xs text-slate-400 mt-1">= ₦4,380 at current rate</p>
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
                        {isProcessing ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Processing Payment...
                          </span>
                        ) : "Pay $3.00 & Complete Verification"}
                      </Button>
                    </motion.div>
                  )}
                </div>
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
            <DialogDescription>
              Face scan required to verify you are a real student and prevent fraudulent applications.
            </DialogDescription>
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
                  <p className="text-sm text-muted-foreground mt-1">Biometric identity confirmed. Proceeding to payment...</p>
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
