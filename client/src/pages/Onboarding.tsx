import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, CreditCard, Upload, CheckCircle2, Lock, FileText, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

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

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Progress value={(step / 3) * 100} className="h-2 bg-slate-200" indicatorColor="bg-primary" />
          <div className="flex justify-between mt-2 text-sm font-medium text-slate-500">
            <span className={step >= 1 ? "text-primary" : ""}>Identity</span>
            <span className={step >= 2 ? "text-primary" : ""}>Academic</span>
            <span className={step >= 3 ? "text-primary" : ""}>Verification Fee</span>
          </div>
        </div>

        <Card className="shadow-lg border-0">
          {step === 1 && (
            <>
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <CardTitle className="text-2xl">Identity Verification</CardTitle>
                <CardDescription>
                  We need to verify your identity to ensure funds go to genuine students.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nin">National Identification Number (NIN)</Label>
                    <Input id="nin" placeholder="Enter your 11-digit NIN" />
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Your data is securely encrypted
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Upload Government ID</Label>
                    <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer">
                      <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                      <p className="text-sm font-medium text-slate-700">Click to upload or drag and drop</p>
                      <p className="text-xs text-slate-500 mt-1">Passport, Driver's License, or National ID (Max 5MB)</p>
                    </div>
                  </div>
                </div>
                <Button onClick={handleNext} className="w-full h-11 text-base">Continue to Academic Info</Button>
              </CardContent>
            </>
          )}

          {step === 2 && (
            <>
              <CardHeader>
                <div className="w-12 h-12 bg-tsia-gold/20 text-yellow-700 rounded-full flex items-center justify-center mb-4">
                  <FileText className="w-6 h-6" />
                </div>
                <CardTitle className="text-2xl">Academic Details</CardTitle>
                <CardDescription>
                  Your WAEC scores determine your Academic Tier and funding eligibility limits.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
                  <h4 className="font-semibold text-sm mb-2 text-slate-900">Academic Performance Matrix</h4>
                  <ul className="text-sm space-y-2 text-slate-600">
                    <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-400"></span> <strong>Platinum Tier:</strong> 6+ A's - Highest funding tier</li>
                    <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> <strong>Gold Tier:</strong> 4-5 A's - Medium funding tier</li>
                    <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-300"></span> <strong>Silver Tier:</strong> Pass - Standard funding tier</li>
                  </ul>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="waec">WAEC Registration Number</Label>
                    <Input id="waec" placeholder="Enter your WAEC reg number" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="year">Examination Year</Label>
                    <Input id="year" placeholder="YYYY" type="number" />
                  </div>

                  <div className="space-y-2">
                    <Label>Upload WAEC Certificate / Result Slip</Label>
                    <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer">
                      <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-600">Upload document</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-4">
                  <Button variant="outline" onClick={() => setStep(1)} className="w-1/3 h-11">Back</Button>
                  <Button onClick={handleNext} className="w-2/3 h-11">Proceed to Payment</Button>
                </div>
              </CardContent>
            </>
          )}

          {step === 3 && (
            <>
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center mb-4">
                  <CreditCard className="w-6 h-6" />
                </div>
                <CardTitle className="text-2xl">Portal Verification Fee</CardTitle>
                <CardDescription>
                  A one-time mandatory $3 fee is required to verify your documents and initiate the 30-day commitment countdown.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">Verification Fee</h3>
                    <p className="text-sm text-slate-600">Non-refundable processing fee</p>
                  </div>
                  <div className="text-3xl font-bold text-slate-900">$3.00</div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-amber-50 text-amber-800 rounded-lg border border-amber-200">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold">What happens next?</p>
                    <p className="mt-1">After payment, your profile enters a <strong>30-day commitment countdown</strong>. Once verified and the countdown completes, you can select a sponsorship plan and receive funds.</p>
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="card">Card Number</Label>
                    <Input id="card" placeholder="0000 0000 0000 0000" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="expiry">Expiry Date</Label>
                      <Input id="expiry" placeholder="MM/YY" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cvv">CVV</Label>
                      <Input id="cvv" placeholder="123" />
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <Button variant="outline" onClick={() => setStep(2)} className="w-1/3 h-11" disabled={isProcessing}>Back</Button>
                  <Button onClick={handleNext} className="w-2/3 h-11 bg-slate-900 text-white hover:bg-slate-800" disabled={isProcessing}>
                    {isProcessing ? "Processing..." : "Pay $3.00 & Complete"}
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}