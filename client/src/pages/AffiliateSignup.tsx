import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { KeyRound, Share2, DollarSign, Users } from "lucide-react";
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

export default function AffiliateSignup() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [africanCountry, setAfricanCountry] = useState("ng");
  const [diaspora, setDiaspora] = useState(false);
  const [diasporaCountry, setDiasporaCountry] = useState("");
  const [formData, setFormData] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [otpHint, setOtpHint] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { requestOtp, verifyOtp } = useAuth();
  const { toast } = useToast();

  const getCountryValue = () => diaspora && diasporaCountry.trim() ? diasporaCountry.trim() : africanCountry;

  const handleSubmitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (diaspora && !diasporaCountry.trim()) {
      toast({ title: "Country required", description: "Please specify the country you currently live in.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const result = await requestOtp({ ...formData, country: getCountryValue(), role: "affiliate" });
      setOtpHint(result.hint || "");
      setStep(2);
      toast({ title: "OTP Sent", description: "Check your email for the 6-digit verification code." });
    } catch (err: any) {
      toast({ title: "Signup failed", description: err.message, variant: "destructive" });
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
      await verifyOtp(formData.email, code);
      setLocation("/affiliate-dashboard?welcome=1");
    } catch (err: any) {
      toast({ title: "Invalid Code", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-12">
        <div className="container mx-auto px-4 text-center">
          <Link href="/"><a className="cursor-pointer inline-block mb-6"><Logo variant="badge" height={56} /></a></Link>
          <h1 className="text-3xl font-bold mb-2">Join the TSIA Affiliate Program</h1>
          <p className="text-slate-300 max-w-lg mx-auto">Earn commission by referring students to TSIA. No age or eligibility requirements.</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start py-12 px-4">
        <div className="grid md:grid-cols-3 gap-6 max-w-3xl w-full mb-10">
          {[
            { icon: Share2, title: "Share Your Code", desc: "Get a unique referral code instantly when you sign up." },
            { icon: Users, title: "Refer Students", desc: "Share with eligible students who need tuition support." },
            { icon: DollarSign, title: "Earn Commission", desc: "Get paid for every verified student you refer." },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-card border">
              <div className="bg-tsia-gold/10 p-2 rounded-lg shrink-0"><item.icon className="w-5 h-5 text-tsia-gold" /></div>
              <div><h3 className="font-semibold text-sm">{item.title}</h3><p className="text-xs text-muted-foreground">{item.desc}</p></div>
            </div>
          ))}
        </div>

        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card className="shadow-xl border-0 overflow-hidden relative">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-tsia-gold to-amber-500"></div>
                <CardHeader className="space-y-2 pt-8">
                  <CardTitle className="text-2xl text-center font-bold">
                    {step === 1 ? "Create Affiliate Account" : "Verify Your Email"}
                  </CardTitle>
                  <CardDescription className="text-center text-base">
                    {step === 1 ? "Sign up to start earning through referrals." : "Enter the code sent to your email"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {step === 1 ? (
                    <form onSubmit={handleSubmitDetails} className="space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">First Name</Label>
                          <Input id="firstName" placeholder="John" required className="h-11 bg-muted/30" value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} data-testid="input-aff-firstName" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Last Name</Label>
                          <Input id="lastName" placeholder="Doe" required className="h-11 bg-muted/30" value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} data-testid="input-aff-lastName" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email address</Label>
                        <Input id="email" type="email" placeholder="you@example.com" required className="h-11 bg-muted/30" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} data-testid="input-aff-email" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input id="phone" type="tel" placeholder="+234 800 000 0000" required className="h-11 bg-muted/30" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} data-testid="input-aff-phone" />
                      </div>
                      <div className="space-y-2">
                        <Label>Country of Origin (Africa)</Label>
                        <Select value={africanCountry} onValueChange={setAfricanCountry}>
                          <SelectTrigger data-testid="select-aff-country"><SelectValue placeholder="Select Country" /></SelectTrigger>
                          <SelectContent>
                            {AFRICAN_COUNTRIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-xl border bg-muted/30">
                        <Checkbox id="diaspora" checked={diaspora} onCheckedChange={(v) => setDiaspora(!!v)} data-testid="checkbox-diaspora" className="mt-0.5" />
                        <div>
                          <label htmlFor="diaspora" className="text-sm font-medium cursor-pointer leading-snug">
                            I am from Africa but currently live outside Africa
                          </label>
                          <p className="text-xs text-muted-foreground mt-0.5">Check this if you live in the diaspora or any other part of the world</p>
                        </div>
                      </div>
                      {diaspora && (
                        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                          <Label htmlFor="diasporaCountry">Country you currently live in</Label>
                          <Input id="diasporaCountry" placeholder="e.g. United Kingdom, Canada, USA..." className="h-11 bg-muted/30"
                            value={diasporaCountry} onChange={e => setDiasporaCountry(e.target.value)} required={diaspora} data-testid="input-diaspora-country" />
                        </motion.div>
                      )}
                      <Button type="submit" className="w-full h-12 text-base font-semibold bg-tsia-gold hover:bg-tsia-gold/90 text-slate-900 shadow-md" disabled={loading} data-testid="button-aff-signup">
                        {loading ? "Creating Account..." : "Join Affiliate Program"}
                      </Button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyOtp} className="space-y-6">
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-2">
                        <KeyRound className="w-4 h-4" />
                        <span>Code sent to <strong className="text-foreground">{formData.email}</strong></span>
                      </div>
                      {otpHint && (
                        <div className="text-center p-3 bg-tsia-gold/10 rounded-lg border border-tsia-gold/20">
                          <span className="text-xs text-muted-foreground">Demo OTP: </span>
                          <span className="font-mono font-bold text-tsia-gold tracking-widest">{otpHint}</span>
                        </div>
                      )}
                      <div className="flex justify-center gap-3">
                        {otpDigits.map((digit, i) => (
                          <Input key={i} ref={el => { inputRefs.current[i] = el; }} className="w-12 h-14 text-center text-xl font-bold bg-muted/30 focus:bg-background transition-colors"
                            maxLength={1} value={digit} onChange={e => handleOtpChange(i, e.target.value)} onKeyDown={e => handleOtpKeyDown(i, e)} data-testid={`input-aff-otp-${i}`} />
                        ))}
                      </div>
                      <Button type="submit" className="w-full h-12 text-base font-semibold bg-tsia-gold hover:bg-tsia-gold/90 text-slate-900 shadow-md" disabled={loading || otpDigits.join("").length !== 6} data-testid="button-verify-aff-otp">
                        {loading ? "Verifying..." : "Verify & Start Earning"}
                      </Button>
                    </form>
                  )}
                </CardContent>
                {step === 1 && (
                  <CardFooter className="flex flex-col gap-2 border-t py-6 bg-muted/30">
                    <p className="text-sm text-muted-foreground">
                      Already an affiliate?{' '}
                      <Link href="/login"><span className="font-semibold text-primary hover:text-primary/80 cursor-pointer">Log in</span></Link>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Eligible student?{' '}
                      <Link href="/signup"><span className="font-semibold text-primary hover:text-primary/80 cursor-pointer">Apply for Support instead</span></Link>
                    </p>
                  </CardFooter>
                )}
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
