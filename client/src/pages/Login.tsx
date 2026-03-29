import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, KeyRound, GraduationCap, Briefcase, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/ui/Logo";

// step 1 = enter email · step "pick" = choose account · step 2 = enter OTP
type Step = 1 | "pick" | 2;

const ROLE_META: Record<string, { label: string; desc: string; icon: any; color: string }> = {
  student:   { label: "Student Account",   desc: "Access your student dashboard, wallet & sponsorship plans", icon: GraduationCap, color: "border-tsia-green bg-green-50 dark:bg-green-900/20 text-tsia-green" },
  affiliate: { label: "Affiliate Account", desc: "Access the business dashboard, trade market & affiliate tools", icon: Briefcase,     color: "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600" },
};

export default function Login() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [otpHint, setOtpHint] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [loginRole, setLoginRole] = useState<string>("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { requestOtp, verifyOtp } = useAuth();
  const { toast } = useToast();

  // ── Step 1: request OTP (or detect dual accounts) ─────────────────────
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await requestOtp({ email });

      if (result.multipleRoles && result.roles && result.roles.length > 1) {
        // Dual-account email — show role picker
        setAvailableRoles(result.roles);
        setStep("pick");
        return;
      }

      if (result.otpSent) {
        setOtpHint(result.hint || "");
        setStep(2);
        toast({ title: "OTP Sent", description: "Check your email for the 6-digit code." });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ── Step "pick": user selected a role — now send OTP for that account ──
  const handleRolePick = async (role: string) => {
    setLoginRole(role);
    setLoading(true);
    try {
      const result = await requestOtp({ email, loginRole: role });
      if (result.otpSent) {
        setOtpHint(result.hint || "");
        setStep(2);
        toast({ title: "OTP Sent", description: "Check your email for the 6-digit code." });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ── OTP digit input handling ────────────────────────────────────────────
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

  // ── Step 2: verify OTP ──────────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpDigits.join("");
    if (code.length !== 6) return;
    setLoading(true);
    try {
      const user = await verifyOtp(email, code, loginRole || undefined);
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
      const result = await requestOtp({ email, ...(loginRole ? { loginRole } : {}) });
      setOtpHint(result.hint || "");
      setOtpDigits(["", "", "", "", "", ""]);
      toast({ title: "OTP Resent", description: "A new code has been sent." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetToEmail = () => {
    setStep(1);
    setOtpDigits(["", "", "", "", "", ""]);
    setLoginRole("");
    setAvailableRoles([]);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans overflow-hidden">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="sm:mx-auto sm:w-full sm:max-w-md mb-8 flex justify-center">
        <Link href="/">
          <a className="cursor-pointer"><Logo variant="badge" height={64} /></a>
        </Link>
      </motion.div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
            <Card className="shadow-xl border-0 overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-tsia-green to-tsia-gold" />

              {/* ── Step 1: Enter email ──────────────────────────────── */}
              {step === 1 && (
                <>
                  <CardHeader className="space-y-2 pt-8">
                    <CardTitle className="text-2xl text-center font-bold">Welcome back</CardTitle>
                    <CardDescription className="text-center text-base">Enter your email to receive a one-time login code</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-8">
                    <form onSubmit={handleRequestOtp} className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email address</Label>
                        <div className="relative">
                          <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input id="email" type="email" placeholder="you@example.com" required className="h-12 pl-10 bg-muted/30" value={email} onChange={e => setEmail(e.target.value)} data-testid="input-login-email" />
                        </div>
                      </div>
                      <Button type="submit" className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 shadow-md" disabled={loading} data-testid="button-request-otp">
                        {loading ? "Checking..." : "Continue"}
                      </Button>
                    </form>
                  </CardContent>
                  <CardFooter className="flex justify-center border-t py-6 bg-muted/30">
                    <p className="text-sm text-muted-foreground">
                      Don't have an account?{" "}
                      <Link href="/signup"><span className="font-semibold text-primary hover:text-primary/80 cursor-pointer transition-colors">Apply now</span></Link>
                    </p>
                  </CardFooter>
                </>
              )}

              {/* ── Step "pick": dual-account role selector ──────────── */}
              {step === "pick" && (
                <>
                  <CardHeader className="space-y-2 pt-8">
                    <CardTitle className="text-2xl text-center font-bold">Choose an Account</CardTitle>
                    <CardDescription className="text-center text-base">
                      We found multiple accounts linked to <strong className="text-foreground">{email}</strong>. Which one would you like to sign in to?
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-8 space-y-3">
                    {availableRoles.map(role => {
                      const meta = ROLE_META[role] ?? { label: role, desc: "", icon: Briefcase, color: "border-border" };
                      const Icon = meta.icon;
                      return (
                        <button
                          key={role}
                          onClick={() => handleRolePick(role)}
                          disabled={loading}
                          data-testid={`button-pick-role-${role}`}
                          className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all hover:shadow-md disabled:opacity-50 ${meta.color}`}
                        >
                          <div className="w-12 h-12 rounded-xl bg-white/70 dark:bg-black/20 flex items-center justify-center shrink-0">
                            <Icon className="w-6 h-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm">{meta.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{meta.desc}</p>
                          </div>
                          <ChevronRight className="w-5 h-5 shrink-0 text-muted-foreground" />
                        </button>
                      );
                    })}
                    <button type="button" className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors pt-1" onClick={resetToEmail}>
                      ← Use a different email
                    </button>
                  </CardContent>
                </>
              )}

              {/* ── Step 2: Enter OTP ────────────────────────────────── */}
              {step === 2 && (
                <>
                  <CardHeader className="space-y-2 pt-8">
                    <CardTitle className="text-2xl text-center font-bold">Enter Your Code</CardTitle>
                    <CardDescription className="text-center text-base">We sent a 6-digit code to your email</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-8">
                    <form onSubmit={handleVerifyOtp} className="space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-2">
                          <KeyRound className="w-4 h-4" />
                          <span>Code sent to <strong className="text-foreground">{email}</strong></span>
                        </div>
                        {loginRole && (
                          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold">
                            {loginRole === "student"
                              ? <><GraduationCap className="w-3.5 h-3.5 text-tsia-green" /><span className="text-tsia-green">Student Account</span></>
                              : <><Briefcase className="w-3.5 h-3.5 text-blue-600" /><span className="text-blue-600">Affiliate Account</span></>}
                          </div>
                        )}
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
                        <button type="button" className="text-muted-foreground hover:text-foreground transition-colors" onClick={resetToEmail}>
                          Change email
                        </button>
                        <button type="button" className="text-primary font-medium hover:underline" onClick={handleResend} disabled={loading}>
                          Resend code
                        </button>
                      </div>
                    </form>
                  </CardContent>
                </>
              )}
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
