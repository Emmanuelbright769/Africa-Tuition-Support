import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, CreditCard, Upload, Lock, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      setIsProcessing(true);
      setTimeout(() => {
        setLocation("/dashboard");
      }, 2000);
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
        
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-bold text-slate-400 tracking-widest uppercase">Step {step} of 3</span>
            <span className="text-sm font-medium text-slate-900 bg-white px-3 py-1 rounded-full shadow-sm border border-slate-100">
              {step === 1 ? "Identity" : step === 2 ? "Academic" : "Payment"}
            </span>
          </div>
          <Progress value={(step / 3) * 100} className="h-2.5 bg-slate-200 rounded-full overflow-hidden" indicatorColor="bg-primary" />
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
                    <Input id="nin" placeholder="Enter your 11-digit NIN" className="h-12 text-lg bg-slate-50/50" />
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
                
                <Button onClick={handleNext} className="w-full h-14 text-lg font-semibold mt-8 shadow-md">Continue</Button>
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
                  <div className="bg-amber-50/50 p-5 rounded-xl border border-amber-100 mb-2">
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
                      <Input id="waec" placeholder="Registration number" className="h-12 bg-slate-50/50" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="year">Year</Label>
                      <Input id="year" placeholder="YYYY" type="number" className="h-12 bg-slate-50/50" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Result Slip Upload</Label>
                    <div className="border-2 border-dashed border-slate-200 hover:border-amber-400/50 bg-slate-50 hover:bg-amber-50 rounded-xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center">
                      <Upload className="w-6 h-6 text-slate-400 mb-2" />
                      <p className="text-sm font-medium text-slate-700">Upload Certificate</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-4 mt-8">
                  <Button variant="outline" onClick={() => setStep(1)} className="w-1/3 h-14 font-semibold">Back</Button>
                  <Button onClick={handleNext} className="w-2/3 h-14 text-lg font-semibold bg-primary hover:bg-primary/90 shadow-md">Proceed to Payment</Button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="p-8 md:p-10 h-full flex flex-col">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                  <CreditCard className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Portal Verification</h2>
                <p className="text-slate-500 mb-8 text-lg">A one-time mandatory fee is required to verify documents and initiate the countdown.</p>
                
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
                      <Label htmlFor="card" className="text-sm text-slate-600">Card Number</Label>
                      <div className="relative">
                        <Input id="card" placeholder="0000 0000 0000 0000" className="h-12 pl-10 bg-slate-50/50" />
                        <CreditCard className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="expiry" className="text-sm text-slate-600">Expiry Date</Label>
                        <Input id="expiry" placeholder="MM/YY" className="h-12 bg-slate-50/50 text-center" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cvv" className="text-sm text-slate-600">CVV</Label>
                        <Input id="cvv" placeholder="123" className="h-12 bg-slate-50/50 text-center" type="password" maxLength={4} />
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
                  <Button 
                    onClick={handleNext} 
                    className="w-2/3 h-14 text-lg font-semibold bg-blue-600 hover:bg-blue-700 shadow-md" 
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <span className="flex items-center gap-2">
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                          <ShieldAlert className="w-5 h-5" />
                        </motion.div>
                        Processing...
                      </span>
                    ) : (
                      "Pay $3.00 & Finish"
                    )}
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