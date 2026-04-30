import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, KeyRound, GraduationCap, Briefcase, ChevronRight, ArrowLeft, Lock, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/ui/Logo";

type Step = 0 | 1 | 2;
type LoginMode = "otp" | "password";

const ADMIN_EMAIL = "admin@tsiforafrica.com";

const ROLE_META = {
  student: {
    label: "Student Login",
    sub: "Student dashboard, wallet & sponsorship",
    icon: GraduationCap,
    border: "border-tsia-green",
    activeBg: "bg-tsia-green",
    pill: "bg-green-100 text-tsia-green dark:bg-green-900/30",
    activeCard: "border-2 border-tsia-green bg-green-50/60 dark:bg-green-900/20 shadow-lg shadow-tsia-green/10",
    inactiveCard: "border-2 border-border bg-card hover:border-tsia-green/40 hover:shadow-md",
  },
  affiliate: {
    label: "Affiliate Login",
    sub: "Business dashboard, trade market & tools",
    icon: Briefcase,
    border: "border-blue-500",
    activeBg: "bg-blue-600",
    pill: "bg-blue-100 text-blue-700 dark:bg-blue-900/30",
    activeCard: "border-2 border-blue-500 bg-blue-50/60 dark:bg-blue-900/20 shadow-lg shadow-blue-500/10",
    inactiveCard: "border-2 border-border bg-card hover:border-blue-400/40 hover:shadow-md",
  },
};

export default function Login() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>(0);
  const [loading, setLoading] = useState(false);
  const [loginRole, setLoginRole] = useState<"student" | "affiliate" | "">("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginMode, setLoginMode] = useState<LoginMode>("otp");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const { requestOtp, verifyOtp, adminLogin, loginWithPassword } = useAuth();
  const { toast } = useToast();

  const isAdminMode = email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();

  useEffect(() => {
    if (isAdminMode && step === 1) {
      setTimeout(() => passwordRef.current?.focus(), 80);
    }
  }, [isAdminMode, step]);

  const handlePickRole = (role: "student" | "affiliate") => {
    setLoginRole(role);
    setStep(1);
    setTimeout(() => emailRef.current?.focus(), 80);
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    try {
      const user = await adminLogin(email.trim(), password);
      if (user.role === "admin") setLocation("/admin");
    } catch (err: any) {
      toast({ title: "Login Failed", description: err.message || "Incorrect password.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginRole || !password) return;
    setLoading(true);
    try {
      const user = await loginWithPassword(email.trim(), password, loginRole);
      if (user.role === "affiliate") setLocation("/affiliate-dashboard");
      else setLocation("/dashboard");
    } catch (err: any) {
      toast({ title: "Login Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginRole) return;
    if (isAdminMode) return handleAdminLogin(e);
    setLoading(true);
    try {
      const result = await requestOtp({ email: email.trim(), loginRole });
      if (result.otpSent) {
        setStep(2);
        toast({ title: "OTP Sent", description: "Check your email for the 6-digit code." });
      } else {
        toast({ title: "Error", description: (result as any).message || "Could not send OTP.", variant: "destructive" });
      }
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
      const user = await verifyOtp(email.trim(), code, loginRole || undefined);
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
      await requestOtp({ email: email.trim(), loginRole: loginRole || undefined });
      setOtpDigits(["", "", "", "", "", ""]);
      toast({ title: "OTP Resent", description: "A new code has been sent to your email." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetToRole = () => {
    setStep(0); setLoginRole(""); setEmail(""); setPassword("");
    setOtpDigits(["", "", "", "", "", ""]); setLoginMode("otp");
  };

  const resetToEmail = () => {
    setStep(1); setOtpDigits(["", "", "", "", "", ""]);
  };

  const roleMeta = loginRole ? ROLE_META[loginRole] : null;

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans overflow-hidden">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="sm:mx-auto sm:w-full sm:max-w-md mb-8 flex justify-center">
        <Link href="/"><Logo variant="badge" height={64} /></Link>
      </motion.div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative px-4 sm:px-0">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
            <Card className="shadow-xl border-0 overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-tsia-green to-tsia-gold" />

              {/* ── Step 0: Role selector ── */}
              {step === 0 && (
                <>
                  <CardHeader className="space-y-2 pt-8 pb-4">
                    <CardTitle className="text-2xl text-center font-bold">Welcome to TSIA</CardTitle>
                    <CardDescription className="text-center text-base">Select how you'd like to sign in</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-8 space-y-4">
                    <p className="text-xs text-center text-muted-foreground mb-2">
                      One email can hold both a Student and an Affiliate account
                    </p>
                    {(["student", "affiliate"] as const).map(role => {
                      const m = ROLE_META[role];
                      const Icon = m.icon;
                      return (
                        <button
                          key={role}
                          onClick={() => handlePickRole(role)}
                          data-testid={`button-role-${role}`}
                          className={`w-full flex items-center gap-4 p-5 rounded-2xl transition-all text-left group ${m.inactiveCard}`}
                        >
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${m.pill}`}>
                            <Icon className="w-6 h-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-base text-foreground">{m.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{m.sub}</p>
                          </div>
                          <ChevronRight className="w-5 h-5 shrink-0 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      );
                    })}
                  </CardContent>
                  <CardFooter className="flex justify-center border-t py-6 bg-muted/30">
                    <p className="text-sm text-muted-foreground">
                      Don't have an account?{" "}
                      <Link href="/signup"><span className="font-semibold text-primary hover:text-primary/80 cursor-pointer transition-colors">Apply now</span></Link>
                    </p>
                  </CardFooter>
                </>
              )}

              {/* ── Step 1: Email + Login method ── */}
              {step === 1 && roleMeta && (
                <>
                  <CardHeader className="space-y-2 pt-8 pb-4">
                    <div className="flex justify-center mb-2">
                      {isAdminMode ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-900 text-white">
                          <ShieldCheck className="w-3.5 h-3.5" /> Admin Portal
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${roleMeta.pill}`}>
                          {loginRole === "student" ? <GraduationCap className="w-3.5 h-3.5" /> : <Briefcase className="w-3.5 h-3.5" />}
                          {roleMeta.label}
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-2xl text-center font-bold">
                      {isAdminMode ? "Admin Sign In" : "Sign In"}
                    </CardTitle>
                    {!isAdminMode && (
                      <CardDescription className="text-center text-sm">
                        Sign in with your email — use OTP or password
                      </CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="pb-8">
                    {/* Login method tabs — only for non-admin */}
                    {!isAdminMode && (
                      <div className="flex rounded-xl bg-muted/50 p-1 mb-5 gap-1">
                        <button
                          type="button"
                          onClick={() => setLoginMode("otp")}
                          data-testid="button-mode-otp"
                          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${loginMode === "otp" ? "bg-white dark:bg-slate-800 shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          <KeyRound className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />OTP Code
                        </button>
                        <button
                          type="button"
                          onClick={() => setLoginMode("password")}
                          data-testid="button-mode-password"
                          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${loginMode === "password" ? "bg-white dark:bg-slate-800 shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          <Lock className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />Password
                        </button>
                      </div>
                    )}

                    {/* OTP mode form */}
                    {(loginMode === "otp" || isAdminMode) && (
                      <form onSubmit={handleRequestOtp} className="space-y-5">
                        <div className="space-y-2">
                          <Label htmlFor="email">Email address</Label>
                          <div className="relative">
                            <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              id="email" ref={emailRef} type="email" placeholder="you@example.com" required
                              autoComplete="email" className="h-12 pl-10 bg-muted/30"
                              value={email} onChange={e => { setEmail(e.target.value); setPassword(""); }}
                              data-testid="input-login-email"
                            />
                          </div>
                        </div>

                        <AnimatePresence>
                          {isAdminMode && (
                            <motion.div key="admin-password" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}>
                              <div className="space-y-2">
                                <Label htmlFor="admin-password">Administrator Password</Label>
                                <div className="relative">
                                  <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                  <Input id="admin-password" ref={passwordRef} type="password" placeholder="Enter admin password"
                                    required autoComplete="current-password" className="h-12 pl-10 bg-muted/30"
                                    value={password} onChange={e => setPassword(e.target.value)} data-testid="input-admin-password"
                                  />
                                </div>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-2 text-center flex items-center justify-center gap-1">
                                <ShieldCheck className="w-3 h-3" /> Secure admin access — no OTP required
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <Button type="submit"
                          className={`w-full h-12 text-base font-semibold shadow-md ${isAdminMode ? "bg-slate-900 hover:bg-slate-800 text-white" : "bg-primary hover:bg-primary/90"}`}
                          disabled={loading || (isAdminMode && !password)} data-testid={isAdminMode ? "button-admin-login" : "button-request-otp"}
                        >
                          {loading ? (isAdminMode ? "Signing in..." : "Sending code...") : (isAdminMode ? "Sign In as Admin" : "Send Login Code")}
                        </Button>

                        <button type="button" onClick={resetToRole}
                          className="w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                          data-testid="button-back-to-role"
                        >
                          <ArrowLeft className="w-4 h-4" /> Choose a different account type
                        </button>
                      </form>
                    )}

                    {/* Password mode form */}
                    {loginMode === "password" && !isAdminMode && (
                      <form onSubmit={handlePasswordLogin} className="space-y-5">
                        <div className="space-y-2">
                          <Label htmlFor="email-pw">Email address</Label>
                          <div className="relative">
                            <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input id="email-pw" type="email" placeholder="you@example.com" required
                              autoComplete="email" className="h-12 pl-10 bg-muted/30"
                              value={email} onChange={e => setEmail(e.target.value)} data-testid="input-login-email-pw"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="user-password">Password</Label>
                          <div className="relative">
                            <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input id="user-password" ref={passwordRef} type={showPassword ? "text" : "password"}
                              placeholder="Enter your password" required autoComplete="current-password"
                              className="h-12 pl-10 pr-10 bg-muted/30" value={password}
                              onChange={e => setPassword(e.target.value)} data-testid="input-user-password"
                            />
                            <button type="button" tabIndex={-1} onClick={() => setShowPassword(v => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground -mt-2">
                          Don't have a password?{" "}
                          <button type="button" onClick={() => setLoginMode("otp")} className="text-primary underline">Sign in with OTP instead</button>
                          {" "}or set one from your profile after logging in.
                        </p>
                        <Button type="submit" className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 shadow-md"
                          disabled={loading || !password} data-testid="button-password-login">
                          {loading ? "Signing in..." : "Sign In"}
                        </Button>
                        <button type="button" onClick={resetToRole}
                          className="w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                          <ArrowLeft className="w-4 h-4" /> Choose a different account type
                        </button>
                      </form>
                    )}
                  </CardContent>

                  <CardFooter className="flex justify-center border-t py-6 bg-muted/30">
                    <p className="text-sm text-muted-foreground">
                      Don't have an account?{" "}
                      <Link href="/signup"><span className="font-semibold text-primary hover:text-primary/80 cursor-pointer transition-colors">Apply now</span></Link>
                    </p>
                  </CardFooter>
                </>
              )}

              {/* ── Step 2: Enter OTP ── */}
              {step === 2 && roleMeta && (
                <>
                  <CardHeader className="space-y-2 pt-8">
                    <div className="flex justify-center mb-2">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${roleMeta.pill}`}>
                        {loginRole === "student" ? <GraduationCap className="w-3.5 h-3.5" /> : <Briefcase className="w-3.5 h-3.5" />}
                        {roleMeta.label}
                      </span>
                    </div>
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
                        <div className="flex justify-center gap-3 mb-6">
                          {otpDigits.map((digit, i) => (
                            <Input key={i} ref={el => { inputRefs.current[i] = el; }}
                              className="w-12 h-14 text-center text-xl font-bold bg-muted/30 focus:bg-background transition-colors"
                              maxLength={1} value={digit}
                              onChange={e => handleOtpChange(i, e.target.value)}
                              onKeyDown={e => handleOtpKeyDown(i, e)}
                              data-testid={`input-otp-${i}`}
                            />
                          ))}
                        </div>
                      </div>
                      <Button type="submit" className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 shadow-md"
                        disabled={loading || otpDigits.join("").length !== 6} data-testid="button-verify-otp">
                        {loading ? "Verifying..." : "Verify & Sign In"}
                      </Button>
                      <div className="flex items-center justify-between text-sm">
                        <button type="button" className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors" onClick={resetToEmail}>
                          <ArrowLeft className="w-3.5 h-3.5" /> Change email
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
