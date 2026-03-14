import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, KeyRound } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/ui/Logo";

export default function Login() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [otpHint, setOtpHint] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { requestOtp, verifyOtp } = useAuth();
  const { toast } = useToast();

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await requestOtp({ email });
      setOtpHint(result.hint || "");
      setStep(2);
      toast({ title: "OTP Sent", description: "Check your email for the 6-digit code." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    if (value && !/^\d$/.test(value)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpDigits.join("");
    if (code.length !== 6) return;
    setLoading(true);
    try {
      const user = await verifyOtp(email, code);
      if (user.role === "admin") setLocation("/admin");
      else if (user.role === "affiliate") setLocation("/affiliate-dashboard");
      else setLocation("/dashboard");
    } catch (err: any) {
      toast({ title: "Invalid Code", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    try {
      const result = await requestOtp({ email });
      setOtpHint(result.hint || "");
      setOtpDigits(["", "", "", "", "", ""]);
      toast({ title: "OTP Resent", description: "A new code has been sent." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans overflow-hidden">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="sm:mx-auto sm:w-full sm:max-w-md mb-8 flex justify-center">
        <Link href="/">
          <a className="cursor-pointer">
            <Logo variant="badge" height={64} />
          </a>
        </Link>
      </motion.div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
            <Card className="shadow-xl border-0 overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-tsia-green to-tsia-gold"></div>
              <CardHeader className="space-y-2 pt-8">
                <CardTitle className="text-2xl text-center font-bold">
                  {step === 1 ? "Welcome back" : "Enter Your Code"}
                </CardTitle>
                <CardDescription className="text-center text-base">
                  {step === 1 ? "Enter your email to receive a one-time login code" : "We sent a 6-digit code to your email"}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-8">
                {step === 1 ? (
                  <form onSubmit={handleRequestOtp} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email address</Label>
                      <div className="relative">
                        <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input id="email" type="email" placeholder="student@example.com" required className="h-12 pl-10 bg-muted/30" value={email} onChange={e => setEmail(e.target.value)} data-testid="input-login-email" />
                      </div>
                    </div>
                    <Button type="submit" className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 shadow-md" disabled={loading} data-testid="button-request-otp">
                      {loading ? "Sending code..." : "Send Login Code"}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-2">
                        <KeyRound className="w-4 h-4" />
                        <span>Code sent to <strong className="text-foreground">{email}</strong></span>
                      </div>
                      {otpHint && (
                        <div className="text-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                          <span className="text-xs text-muted-foreground">Demo OTP: </span>
                          <span className="font-mono font-bold text-primary tracking-widest">{otpHint}</span>
                        </div>
                      )}
                      <div className="flex justify-center gap-3 mb-6">
                        {otpDigits.map((digit, i) => (
                          <Input
                            key={i}
                            ref={el => { inputRefs.current[i] = el; }}
                            className="w-12 h-14 text-center text-xl font-bold bg-muted/30 focus:bg-background transition-colors"
                            maxLength={1}
                            value={digit}
                            onChange={e => handleOtpChange(i, e.target.value)}
                            onKeyDown={e => handleOtpKeyDown(i, e)}
                            data-testid={`input-otp-${i}`}
                          />
                        ))}
                      </div>
                    </div>
                    <Button type="submit" className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 shadow-md" disabled={loading || otpDigits.join("").length !== 6} data-testid="button-verify-otp">
                      {loading ? "Verifying..." : "Verify & Access Portal"}
                    </Button>
                    <div className="flex items-center justify-between text-sm">
                      <button type="button" className="text-muted-foreground hover:text-foreground transition-colors" onClick={() => { setStep(1); setOtpDigits(["", "", "", "", "", ""]); }}>
                        Change email
                      </button>
                      <button type="button" className="text-primary font-medium hover:underline" onClick={handleResend} disabled={loading}>
                        Resend code
                      </button>
                    </div>
                  </form>
                )}
              </CardContent>
              {step === 1 && (
                <CardFooter className="flex justify-center border-t py-6 bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    Don't have an account?{' '}
                    <Link href="/signup"><span className="font-semibold text-primary hover:text-primary/80 cursor-pointer transition-colors">Apply now</span></Link>
                  </p>
                </CardFooter>
              )}
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
