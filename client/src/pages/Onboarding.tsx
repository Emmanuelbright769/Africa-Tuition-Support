import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ShieldAlert, CreditCard, Upload, Lock, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [nin, setNin] = useState("");
  const [waecReg, setWaecReg] = useState("");
  const [waecYear, setWaecYear] = useState("");
  const [waecGrades, setWaecGrades] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();

  if (!user) {
    setLocation("/login");
    return null;
  }

  const handleIdentity = async () => {
    try {
      await apiRequest("POST", "/api/verification/identity", { nin });
      setStep(2);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleAcademic = async () => {
    try {
      await apiRequest("POST", "/api/verification/academic", { waecRegNumber: waecReg, waecYear, waecGrades });
      setStep(3);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handlePayment = async () => {
    setIsProcessing(true);
    try {
      await apiRequest("POST", "/api/verification/pay-fee");
      toast({ title: "Payment successful", description: "Your 30-day commitment window has started." });
      setTimeout(() => setLocation("/dashboard"), 1500);
    } catch (err: any) {
      toast({ title: "Payment failed", description: err.message, variant: "destructive" });
      setIsProcessing(false);
    }
  };

  const slideVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.3, ease: "easeIn" } }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans flex flex-col justify-center">
      <div className="max-w-2xl mx-auto w-full">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-bold text-slate-400 tracking-widest uppercase">Step {step} of 3</span>
            <span className="text-sm font-medium text-slate-900 bg-white px-3 py-1 rounded-full shadow-sm border border-slate-100">
              {step === 1 ? "Identity" : step === 2 ? "Academic" : "Payment"}
            </span>
          </div>
          <Progress value={(step / 3) * 100} className="h-2.5 bg-slate-200 rounded-full overflow-hidden" />
        </motion.div>

        <div className="relative overflow-hidden rounded-2xl shadow-xl bg-white border border-slate-100 min-h-[500px]">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="p-8 md:p-10 h-full flex flex-col">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Identity Verification</h2>
                <p className="text-slate-500 mb-8 text-lg">We need to verify your identity to ensure funds go to genuine students.</p>
                <div className="space-y-6 flex-1">
                  <div className="space-y-2">
                    <Label htmlFor="nin" className="text-base">National Identification Number (NIN)</Label>
                    <Input id="nin" placeholder="Enter your 11-digit NIN" className="h-12 text-lg bg-slate-50/50" value={nin} onChange={e => setNin(e.target.value)} data-testid="input-nin" />
                    <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-2 font-medium">
                      <Lock className="w-3.5 h-3.5 text-green-600" /> Your data is securely encrypted
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base">Government ID Document</Label>
                    <div className="border-2 border-dashed border-slate-200 hover:border-primary/50 bg-slate-50 hover:bg-primary/5 rounded-xl p-8 text-center transition-all cursor-pointer group">
                      <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6 text-slate-400 group-hover:text-primary" />
                      </div>
                      <p className="text-base font-semibold text-slate-700">Click to upload or drag and drop</p>
                      <p className="text-sm text-slate-500 mt-1">Passport, Driver's License, or National ID (Max 5MB)</p>
                    </div>
                  </div>
                </div>
                <Button onClick={handleIdentity} className="w-full h-14 text-lg font-semibold mt-8 shadow-md" data-testid="button-identity-next">Continue</Button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="p-8 md:p-10 h-full flex flex-col">
                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-6">
                  <FileText className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Academic Details</h2>
                <p className="text-slate-500 mb-6 text-lg">Your WAEC scores determine your Academic Tier and funding limit.</p>
                <div className="space-y-6 flex-1">
                  <div className="bg-amber-50/50 p-5 rounded-xl border border-amber-100">
                    <h4 className="font-semibold text-sm mb-3 text-amber-900 uppercase tracking-wider">Performance Matrix Tiers</h4>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-white p-3 rounded-lg border border-slate-100 text-center">
                        <div className="font-bold text-slate-800 text-sm">Platinum</div>
                        <div className="text-xs text-slate-500">6+ A's</div>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-amber-200 ring-1 ring-amber-200 text-center">
                        <div className="font-bold text-amber-700 text-sm">Gold</div>
                        <div className="text-xs text-amber-600/70">4-5 A's</div>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-slate-100 text-center">
                        <div className="font-bold text-slate-600 text-sm">Silver</div>
                        <div className="text-xs text-slate-500">Pass</div>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="waec">WAEC Reg Number</Label>
                      <Input id="waec" placeholder="Registration number" className="h-12 bg-slate-50/50" value={waecReg} onChange={e => setWaecReg(e.target.value)} data-testid="input-waec" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="year">Year</Label>
                      <Input id="year" placeholder="YYYY" className="h-12 bg-slate-50/50" value={waecYear} onChange={e => setWaecYear(e.target.value)} data-testid="input-waec-year" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="grades">Grades Summary (e.g., "A1 A1 B2 A1 C4 A1 B3 A1 B2")</Label>
                    <Input id="grades" placeholder="Enter your grades separated by spaces" className="h-12 bg-slate-50/50" value={waecGrades} onChange={e => setWaecGrades(e.target.value)} data-testid="input-waec-grades" />
                  </div>
                </div>
                <div className="flex gap-4 mt-8">
                  <Button variant="outline" onClick={() => setStep(1)} className="w-1/3 h-14 font-semibold">Back</Button>
                  <Button onClick={handleAcademic} className="w-2/3 h-14 text-lg font-semibold bg-primary hover:bg-primary/90 shadow-md" data-testid="button-academic-next">Proceed to Payment</Button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="p-8 md:p-10 h-full flex flex-col">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                  <CreditCard className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Portal Verification</h2>
                <p className="text-slate-500 mb-8 text-lg">A one-time mandatory fee to verify documents and initiate the countdown.</p>
                <div className="space-y-6 flex-1">
                  <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-6 flex items-center justify-between shadow-lg relative overflow-hidden">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-10 -mt-10 blur-xl"></div>
                    <div className="relative z-10">
                      <h3 className="font-semibold text-lg opacity-90">Verification Fee</h3>
                      <p className="text-sm text-slate-300">Non-refundable processing</p>
                    </div>
                    <div className="text-4xl font-bold relative z-10">$3.00</div>
                  </div>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-600">Card Number</Label>
                      <div className="relative">
                        <Input placeholder="0000 0000 0000 0000" className="h-12 pl-10 bg-slate-50/50" data-testid="input-card" />
                        <CreditCard className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600">Expiry Date</Label>
                        <Input placeholder="MM/YY" className="h-12 bg-slate-50/50 text-center" data-testid="input-expiry" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600">CVV</Label>
                        <Input placeholder="123" className="h-12 bg-slate-50/50 text-center" type="password" maxLength={4} data-testid="input-cvv" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-blue-50/50 rounded-xl border border-blue-100 text-blue-800 mt-4 text-sm">
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-blue-500" />
                    <p>After payment, your profile enters the <strong>30-day commitment countdown</strong>. Once completed, you can select your plan.</p>
                  </div>
                </div>
                <div className="flex gap-4 mt-8">
                  <Button variant="outline" onClick={() => setStep(2)} className="w-1/3 h-14 font-semibold" disabled={isProcessing}>Back</Button>
                  <Button onClick={handlePayment} className="w-2/3 h-14 text-lg font-semibold bg-blue-600 hover:bg-blue-700 shadow-md" disabled={isProcessing} data-testid="button-pay">
                    {isProcessing ? (
                      <span className="flex items-center gap-2">
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                          <ShieldAlert className="w-5 h-5" />
                        </motion.div>
                        Processing...
                      </span>
                    ) : "Pay $3.00 & Finish"}
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
