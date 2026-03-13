import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, CreditCard, Upload, Lock, FileText, AlertCircle, CheckCircle2, X, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { WAEC_GRADE_WEIGHTS } from "@shared/schema";

const VALID_GRADES = Object.keys(WAEC_GRADE_WEIGHTS);
const NUM_SUBJECTS = 9;

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [nin, setNin] = useState("");
  const [waecReg, setWaecReg] = useState("");
  const [waecYear, setWaecYear] = useState("");
  const [grades, setGrades] = useState<string[]>(Array(NUM_SUBJECTS).fill(""));
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ id: number; fileName: string; fileSize: number }>>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  if (!user) {
    setLocation("/login");
    return null;
  }

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
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message);
        }
        const saved = await res.json();
        setUploadedFiles(prev => [...prev, { id: saved.id, fileName: saved.fileName, fileSize: saved.fileSize }]);
        toast({ title: "File Uploaded", description: `${saved.fileName} uploaded successfully.` });
      } catch (err: any) {
        toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [toast]);

  const removeFile = (id: number) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

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

  const handlePayment = async () => {
    setIsProcessing(true);
    try {
      await apiRequest("POST", "/api/verification/pay-fee");
      toast({ title: "Payment successful", description: "You can now submit your WAEC results for validation." });
      setStep(3);
    } catch (err: any) {
      toast({ title: "Payment failed", description: err.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const setGradeAt = (index: number, value: string) => {
    const newGrades = [...grades];
    newGrades[index] = value;
    setGrades(newGrades);
  };

  const calculatePreview = () => {
    const filled = grades.filter(Boolean);
    if (filled.length === 0) return null;
    const weights = filled.map(g => WAEC_GRADE_WEIGHTS[g] || 0);
    const total = weights.reduce((a, b) => a + b, 0);
    const maxPossible = filled.length * 15;
    const pct = Math.round((total / maxPossible) * 100 * 100) / 100;
    let tierLabel = "Below Threshold";
    let tierColor = "text-red-600";
    let range = "$0";
    if (pct >= 75) { tierLabel = "Platinum"; tierColor = "text-primary"; range = "$225 - $230"; }
    else if (pct >= 60) { tierLabel = "Gold"; tierColor = "text-amber-600"; range = "$160 - $180"; }
    else if (pct >= 50) { tierLabel = "Silver"; tierColor = "text-slate-600"; range = "$110 - $130"; }
    return { pct, tierLabel, tierColor, range, total, maxPossible };
  };

  const handleAcademic = async () => {
    const filled = grades.filter(Boolean);
    if (filled.length < 5) {
      toast({ title: "Error", description: "Please enter at least 5 subject grades", variant: "destructive" });
      return;
    }
    try {
      const gradesStr = filled.join(" ");
      const res = await apiRequest("POST", "/api/verification/academic", { waecRegNumber: waecReg, waecYear, waecGrades: gradesStr });
      const data = await res.json();
      toast({
        title: "WAEC Results Validated",
        description: `Score: ${data.calculatedPercentage}% — ${data.payoutRange.label.charAt(0).toUpperCase() + data.payoutRange.label.slice(1)} Tier ($${data.payoutRange.min}-$${data.payoutRange.max})`,
      });
      setTimeout(() => setLocation("/dashboard"), 2000);
    } catch (err: any) {
      toast({ title: "Validation Error", description: err.message, variant: "destructive" });
    }
  };

  const preview = calculatePreview();

  const slideVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.3, ease: "easeIn" } }
  };

  const subjectNames = ["Mathematics", "English Language", "Physics", "Chemistry", "Biology", "Economics", "Geography", "Civic Education", "Agricultural Science"];

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8 font-sans flex flex-col justify-center">
      <div className="max-w-2xl mx-auto w-full">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-bold text-muted-foreground tracking-widest uppercase">Step {step} of 3</span>
            <span className="text-sm font-medium text-foreground bg-card px-3 py-1 rounded-full shadow-sm border">
              {step === 1 ? "Identity" : step === 2 ? "Payment" : "WAEC Validation"}
            </span>
          </div>
          <Progress value={(step / 3) * 100} className="h-2.5 bg-muted rounded-full overflow-hidden" />
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
                            <button onClick={() => removeFile(f.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <Button onClick={handleIdentity} className="w-full h-14 text-lg font-semibold mt-8 shadow-md" data-testid="button-identity-next">Continue</Button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="p-8 md:p-10 h-full flex flex-col">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                  <CreditCard className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-bold mb-2">Verification Fee</h2>
                <p className="text-muted-foreground mb-8 text-lg">Pay a one-time $3 fee to unlock WAEC results validation.</p>
                <div className="space-y-6 flex-1">
                  <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-6 flex items-center justify-between shadow-lg relative overflow-hidden">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-10 -mt-10 blur-xl"></div>
                    <div className="relative z-10">
                      <h3 className="font-semibold text-lg opacity-90">Verification Fee</h3>
                      <p className="text-sm text-slate-300">Non-refundable processing</p>
                      <p className="text-xs text-slate-400 mt-1">= ₦4,380 at current rate</p>
                    </div>
                    <div className="text-4xl font-bold relative z-10">$3.00</div>
                  </div>
                  <div className="space-y-4 pt-2">
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
                  <div className="flex items-start gap-3 p-4 bg-blue-50/50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 text-blue-800 dark:text-blue-300 mt-4 text-sm">
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-blue-500" />
                    <p>After payment, you can submit your WAEC grades for validation and tier classification.</p>
                  </div>
                </div>
                <div className="flex gap-4 mt-8">
                  <Button variant="outline" onClick={() => setStep(1)} className="w-1/3 h-14 font-semibold" disabled={isProcessing}>Back</Button>
                  <Button onClick={handlePayment} className="w-2/3 h-14 text-lg font-semibold bg-blue-600 hover:bg-blue-700 shadow-md" disabled={isProcessing} data-testid="button-pay">
                    {isProcessing ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </span>
                    ) : "Pay $3.00 & Continue"}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="p-8 md:p-10 h-full flex flex-col">
                <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-2xl flex items-center justify-center mb-6">
                  <FileText className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-bold mb-2">WAEC Result Validation</h2>
                <p className="text-muted-foreground mb-6 text-lg">Enter your WAEC grades to calculate your score and payout tier.</p>
                <div className="space-y-6 flex-1 overflow-y-auto">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="waec">WAEC Reg Number</Label>
                      <Input id="waec" placeholder="Registration number" className="h-11 bg-muted/30" value={waecReg} onChange={e => setWaecReg(e.target.value)} data-testid="input-waec" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="year">Year</Label>
                      <Input id="year" placeholder="YYYY" className="h-11 bg-muted/30" value={waecYear} onChange={e => setWaecYear(e.target.value)} data-testid="input-waec-year" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Subject Grades</Label>
                    <div className="bg-muted/30 rounded-xl p-4 border space-y-2">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {subjectNames.map((name, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground w-28 truncate">{name}</span>
                            <Select value={grades[i] || undefined} onValueChange={(v) => setGradeAt(i, v)}>
                              <SelectTrigger className="h-9 w-20 text-sm" data-testid={`select-grade-${i}`}>
                                <SelectValue placeholder="--" />
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
                          style={{ width: `${preview.pct}%` }}
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

                  <div className="space-y-2">
                    <Label className="text-base">WAEC Result Slip (Optional)</Label>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-border hover:border-primary/50 bg-muted/30 hover:bg-primary/5 rounded-xl p-4 text-center transition-all cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                      <Upload className="w-5 h-5 mx-auto mb-2" />
                      Upload WAEC slip for verification
                    </button>
                  </div>
                </div>
                <div className="flex gap-4 mt-8">
                  <Button variant="outline" onClick={() => setStep(2)} className="w-1/3 h-14 font-semibold">Back</Button>
                  <Button onClick={handleAcademic} className="w-2/3 h-14 text-lg font-semibold bg-primary hover:bg-primary/90 shadow-md" data-testid="button-academic-submit">
                    Validate & Submit
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
