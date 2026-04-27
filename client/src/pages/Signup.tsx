import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { TermsCheckbox } from "@/components/ui/TermsCheckbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  KeyRound, GraduationCap, Briefcase, Sparkles, ChevronRight, ArrowLeft,
  CheckCircle2, Wallet, Zap, Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/ui/Logo";

const AFRICAN_COUNTRIES = [
  { value: "ng", label: "Nigeria" },
  { value: "gh", label: "Ghana" },
  { value: "ke", label: "Kenya" },
  { value: "za", label: "South Africa" },
  { value: "et", label: "Ethiopia" },
  { value: "tz", label: "Tanzania" },
  { value: "ug", label: "Uganda" },
  { value: "eg", label: "Egypt" },
  { value: "cm", label: "Cameroon" },
  { value: "sn", label: "Senegal" },
  { value: "ci", label: "Côte d'Ivoire" },
  { value: "other_africa", label: "Other African Country" },
];

type RoleChoice = "student" | "affiliate" | "both";
type Step = 0 | 1 | 2;

const ROLE_CARDS: { id: RoleChoice; icon: any; label: string; sub: string; highlight?: boolean;
  card: string; pill: string; iconBg: string; badge?: string }[] = [
  {
    id: "student",
    icon: GraduationCap,
    label: "Student Account",
    sub: "Access student dashboard, sponsorship plans, personal wallet, and educational tools",
    card: "border-2 border-border bg-card hover:border-tsia-green/50 hover:shadow-md",
    pill: "bg-green-100 dark:bg-green-900/40",
    iconBg: "text-tsia-green",
  },
  {
    id: "affiliate",
    icon: Briefcase,
    label: "Business (Affiliate) Account",
    sub: "Access trade market, business dashboard, referral tools, trust fund, and tenancy programme",
    card: "border-2 border-border bg-card hover:border-blue-500/50 hover:shadow-md",
    pill: "bg-blue-100 dark:bg-blue-900/40",
    iconBg: "text-blue-600",
  },
  {
    id: "both",
    icon: Sparkles,
    label: "Both Accounts",
    sub: "Create a Student + Business account with one email — switch between dashboards any time",
    card: "border-2 border-amber-400 bg-amber-50/50 dark:bg-amber-900/10 hover:shadow-lg",
    pill: "bg-amber-100 dark:bg-amber-900/40",
    iconBg: "text-amber-600",
    badge: "Recommended",
    highlight: true,
  },
];

export default function Signup() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const [step, setStep] = useState<Step>(0);
  const [roleChoice, setRoleChoice] = useState<RoleChoice>("student");
  const [loading, setLoading] = useState(false);
  const [africanCountry, setAfricanCountry] = useState("ng");
  const [diaspora, setDiaspora] = useState(false);
  const [diasporaCountry, setDiasporaCountry] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [formData, setFormData] = useState({ firstName: "", lastName: "", email: "", phone: "", referralCode: "" });
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [pendingNav, setPendingNav] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { requestOtp, verifyOtp } = useAuth();
  const { toast } = useToast();

  // Pre-select role and referral code from query params
  useEffect(() => {
    const params = new URLSearchParams(search);
    const r = params.get("role");
    if (r === "affiliate" || r === "student" || r === "both") {
      setRoleChoice(r as RoleChoice);
      setStep(1);
    }
    const ref = params.get("ref");
    if (ref) {
      setFormData(f => ({ ...f, referralCode: ref }));
    }
  }, [search]);

  const getCountry = () => diaspora && diasporaCountry.trim() ? diasporaCountry.trim() : africanCountry;

  const handlePickRole = (r: RoleChoice) => { setRoleChoice(r); setStep(1); };

  const handleResendOtp = async () => {
    setLoading(true);
    try {
      await requestOtp({ ...formData, country: getCountry(), role: roleChoice });
      toast({ title: "Code Resent", description: "A new 6-digit code has been sent to your email. Check spam/junk if not in inbox." });
    } catch {
      toast({ title: "Resend failed", description: "Could not resend code. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (diaspora && !diasporaCountry.trim()) {
      toast({ title: "Country required", description: "Please specify the country you currently live in.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const result = await requestOtp({ ...formData, country: getCountry(), role: roleChoice });
      if (!result.otpSent) throw new Error(result as any);
      setStep(2);
      toast({ title: "OTP Sent", description: "Check your email for the 6-digit verification code." });
    } catch (err: any) {
      toast({ title: "Signup failed", description: err.message || "Could not create account", variant: "destructive" });
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
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpDigits.join("");
    if (code.length !== 6) return;
    setLoading(true);
    try {
      // For "both": log in as student first; user can switch to affiliate later
      const loginRole = roleChoice === "both" ? "student" : roleChoice;
      const userData = await verifyOtp(formData.email, code, loginRole) as any;
      if (roleChoice === "both") {
        toast({ title: "Both accounts created!", description: "You now have a Student + Affiliate account. Use the switch button in your dashboard to toggle between them." });
      }
      const dest = userData.role === "affiliate" ? "/affiliate-dashboard" : "/dashboard";
      if (userData.isNewUser) {
        setPendingNav(dest);
        setWelcomeOpen(true);
      } else {
        setLocation(dest);
      }
    } catch (err: any) {
      toast({ title: "Invalid Code", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const selectedMeta = ROLE_CARDS.find(r => r.id === roleChoice)!;

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans overflow-hidden">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="sm:mx-auto sm:w-full sm:max-w-md mb-8 flex justify-center">
        <Link href="/"><a className="cursor-pointer"><Logo variant="badge" height={64} /></a></Link>
      </motion.div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.22 }}>
            <Card className="shadow-xl border-0 overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-tsia-green to-tsia-gold" />

              {/* ── Step 0: Role picker ── */}
              {step === 0 && (
                <>
                  <CardHeader className="space-y-1 pt-8 pb-4">
                    <CardTitle className="text-2xl text-center font-bold">Create your TSIA account</CardTitle>
                    <CardDescription className="text-center text-sm">
                      Choose what kind of account you want — you can always create the other type later
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-6 space-y-3">
                    {ROLE_CARDS.map(r => {
                      const Icon = r.icon;
                      return (
                        <button
                          key={r.id}
                          onClick={() => handlePickRole(r.id)}
                          data-testid={`button-signup-role-${r.id}`}
                          className={`w-full flex items-start gap-4 p-4 rounded-2xl transition-all text-left group relative ${r.card}`}
                        >
                          {r.badge && (
                            <span className="absolute top-3 right-3 text-[10px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">
                              {r.badge}
                            </span>
                          )}
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${r.pill}`}>
                            <Icon className={`w-5 h-5 ${r.iconBg}`} />
                          </div>
                          <div className="flex-1 min-w-0 pr-6">
                            <p className="font-bold text-sm text-foreground">{r.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{r.sub}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground group-hover:translate-x-0.5 transition-transform mt-3" />
                        </button>
                      );
                    })}
                  </CardContent>
                  <CardFooter className="flex justify-center border-t py-5 bg-muted/30">
                    <p className="text-sm text-muted-foreground">
                      Already have an account?{" "}
                      <Link href="/login"><span className="font-semibold text-primary hover:text-primary/80 cursor-pointer">Sign in</span></Link>
                    </p>
                  </CardFooter>
                </>
              )}

              {/* ── Step 1: Details form ── */}
              {step === 1 && (
                <>
                  <CardHeader className="space-y-1 pt-8 pb-4">
                    <div className="flex justify-center mb-2">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${selectedMeta.pill} ${selectedMeta.iconBg}`}>
                        <selectedMeta.icon className="w-3.5 h-3.5" />
                        {selectedMeta.label}
                      </span>
                    </div>
                    <CardTitle className="text-2xl text-center font-bold">
                      {roleChoice === "both" ? "Create both accounts" : "Create your account"}
                    </CardTitle>
                    <CardDescription className="text-center text-sm">
                      {roleChoice === "both"
                        ? "One email, one OTP — we'll set up both your Student and Affiliate accounts"
                        : "Fill in your details to get started"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-6">
                    {roleChoice === "both" && (
                      <div className="mb-4 flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2.5">
                        <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                          We'll create a <strong>Student account</strong> and an <strong>Affiliate (Business) account</strong> with this email — both accessible from a single login.
                        </p>
                      </div>
                    )}
                    <form onSubmit={handleSubmitDetails} className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="firstName">First Name</Label>
                          <Input id="firstName" placeholder="John" required className="h-11 bg-muted/30" value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} data-testid="input-firstName" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="lastName">Last Name</Label>
                          <Input id="lastName" placeholder="Doe" required className="h-11 bg-muted/30" value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} data-testid="input-lastName" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="email">Email address</Label>
                        <Input id="email" type="email" placeholder="you@example.com" required className="h-11 bg-muted/30" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} data-testid="input-email" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input id="phone" type="tel" placeholder="+234 800 000 0000" required className="h-11 bg-muted/30" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} data-testid="input-phone" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Country of Origin (Africa)</Label>
                        <Select value={africanCountry} onValueChange={setAfricanCountry}>
                          <SelectTrigger data-testid="select-country"><SelectValue placeholder="Select Country" /></SelectTrigger>
                          <SelectContent>
                            {AFRICAN_COUNTRIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-xl border bg-muted/30">
                        <Checkbox id="diaspora" checked={diaspora} onCheckedChange={(v) => setDiaspora(!!v)} data-testid="checkbox-diaspora" className="mt-0.5" />
                        <div>
                          <label htmlFor="diaspora" className="text-sm font-medium cursor-pointer leading-snug">
                            I live outside Africa (Diaspora)
                          </label>
                          <p className="text-xs text-muted-foreground mt-0.5">Check this if you currently live outside the African continent</p>
                        </div>
                      </div>
                      {diaspora && (
                        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="space-y-1.5">
                          <Label htmlFor="diasporaCountry">Country you currently live in</Label>
                          <Input id="diasporaCountry" placeholder="e.g. United Kingdom, Canada..." className="h-11 bg-muted/30" value={diasporaCountry} onChange={e => setDiasporaCountry(e.target.value)} required={diaspora} data-testid="input-diaspora-country" />
                        </motion.div>
                      )}
                      <div className="space-y-1.5">
                        <Label htmlFor="referral">Referral Code (Optional)</Label>
                        <Input id="referral" placeholder="e.g. TSIA-JOH0001" className="h-11 bg-muted/30" value={formData.referralCode} onChange={e => setFormData({ ...formData, referralCode: e.target.value })} data-testid="input-referral" />
                      </div>
                      <TermsCheckbox
                        checked={termsAccepted}
                        onCheckedChange={setTermsAccepted}
                        context="signup"
                        className="p-3 bg-muted/30 border rounded-xl"
                      />
                      <Button type="submit" className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 shadow-md" disabled={loading || !termsAccepted} data-testid="button-signup">
                        {loading ? "Creating account..." : roleChoice === "both" ? "Create Both Accounts" : "Continue"}
                      </Button>
                      <button type="button" onClick={() => setStep(0)} className="w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="w-4 h-4" /> Choose a different account type
                      </button>
                    </form>
                  </CardContent>
                  <CardFooter className="flex justify-center border-t py-5 bg-muted/30">
                    <p className="text-sm text-muted-foreground">
                      Already have an account?{" "}
                      <Link href="/login"><span className="font-semibold text-primary hover:text-primary/80 cursor-pointer">Sign in</span></Link>
                    </p>
                  </CardFooter>
                </>
              )}

              {/* ── Step 2: OTP verification ── */}
              {step === 2 && (
                <>
                  <CardHeader className="space-y-1 pt-8 pb-4">
                    <div className="flex justify-center mb-3">
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <KeyRound className="w-7 h-7 text-primary" />
                      </div>
                    </div>
                    <CardTitle className="text-2xl text-center font-bold">Verify Your Email</CardTitle>
                    <CardDescription className="text-center text-sm">
                      Enter the 6-digit code sent to <strong className="text-foreground">{formData.email}</strong>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-6">
                    {roleChoice === "both" && (
                      <div className="mb-4 flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                        <p className="text-xs text-amber-700 dark:text-amber-300">Both accounts are set up — one code to verify both!</p>
                      </div>
                    )}
                    <form onSubmit={handleVerifyOtp} className="space-y-5">
                      <div className="flex justify-center gap-3">
                        {otpDigits.map((digit, i) => (
                          <Input key={i} ref={el => { inputRefs.current[i] = el; }}
                            className="w-12 h-14 text-center text-xl font-bold bg-muted/30 focus:bg-background transition-colors"
                            maxLength={1} value={digit}
                            onChange={e => handleOtpChange(i, e.target.value)}
                            onKeyDown={e => handleOtpKeyDown(i, e)}
                            data-testid={`input-signup-otp-${i}`} />
                        ))}
                      </div>
                      <Button type="submit" className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 shadow-md" disabled={loading || otpDigits.join("").length !== 6} data-testid="button-verify-signup-otp">
                        {loading ? "Verifying..." : "Verify & Access Dashboard"}
                      </Button>
                      <div className="flex items-center justify-between text-sm">
                        <button type="button" onClick={() => setStep(1)} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                          <ArrowLeft className="w-4 h-4" /> Go back
                        </button>
                        <button type="button" onClick={handleResendOtp} disabled={loading} className="text-primary font-medium hover:underline" data-testid="button-resend-signup-otp">
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

      {/* ── Welcome / Wallet Activation Popup ── */}
      <Dialog open={welcomeOpen} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-tsia-green to-emerald-600 flex items-center justify-center shadow-md">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg">Welcome to TSIA! 🎉</DialogTitle>
                <p className="text-xs text-muted-foreground">One last step to get started</p>
              </div>
            </div>
            <DialogDescription className="text-sm leading-relaxed pt-2">
              Your account is ready. To unlock all TSIA features — wallet transactions, QCE SwiftVault, loans, e-commerce and more — please <strong>fund your SwiftWallet with at least $5</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="bg-tsia-green/5 border border-tsia-green/20 rounded-xl p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-tsia-green/10 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-tsia-green" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Minimum Activation: $5</p>
                <p className="text-xs text-muted-foreground mt-0.5">Head to your SwiftWallet to make your first deposit via USDT (TRC20 or BEP20).</p>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-200">
                You can withdraw your money whenever you want. A check notification and email have been sent with full details on how to get started.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex items-start gap-2">
              <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-700 dark:text-slate-300">
                <strong>Minimum balance:</strong> A minimum of <strong>$2</strong> must always remain in your wallet to ensure seamless operations across the platform — payments, transfers, and platform features stay active.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              className="w-full bg-tsia-green hover:bg-tsia-green/90 text-white"
              onClick={() => { setWelcomeOpen(false); if (pendingNav) setLocation(pendingNav); }}
              data-testid="button-welcome-continue"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" /> Go to My Dashboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
