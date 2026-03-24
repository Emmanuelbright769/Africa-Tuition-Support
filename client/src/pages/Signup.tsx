import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { KeyRound } from "lucide-react";
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

export default function Signup() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [africanCountry, setAfricanCountry] = useState("ng");
  const [diaspora, setDiaspora] = useState(false);
  const [diasporaCountry, setDiasporaCountry] = useState("");
  const [formData, setFormData] = useState({ firstName: "", lastName: "", email: "", phone: "", referralCode: "" });
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
      const result = await requestOtp({ ...formData, country: getCountryValue() });
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
      setLocation("/onboarding");
    } catch (err: any) {
      toast({ title: "Invalid Code", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="sm:mx-auto sm:w-full sm:max-w-md mb-8 flex justify-center">
        <Link href="/"><a className="cursor-pointer"><Logo variant="badge" height={64} /></a></Link>
      </motion.div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card className="shadow-xl border-0 overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-tsia-green to-tsia-gold"></div>
              <CardHeader className="space-y-2 pt-8">
                <CardTitle className="text-2xl text-center font-bold">
                  {step === 1 ? "Apply for Support" : "Verify Your Email"}
                </CardTitle>
                <CardDescription className="text-center text-base">
                  {step === 1 ? "Create your account to start the verification process." : "Enter the code sent to your email"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {step === 1 ? (
                  <form onSubmit={handleSubmitDetails} className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input id="firstName" placeholder="John" required className="h-11 bg-muted/30" value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} data-testid="input-firstName" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input id="lastName" placeholder="Doe" required className="h-11 bg-muted/30" value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} data-testid="input-lastName" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email address</Label>
                      <Input id="email" type="email" placeholder="student@example.com" required className="h-11 bg-muted/30" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} data-testid="input-email" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input id="phone" type="tel" placeholder="+234 800 000 0000" required className="h-11 bg-muted/30" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} data-testid="input-phone" />
                    </div>
                    <div className="space-y-2">
                      <Label>Country of Origin (Africa)</Label>
                      <Select value={africanCountry} onValueChange={setAfricanCountry}>
                        <SelectTrigger data-testid="select-country"><SelectValue placeholder="Select Country" /></SelectTrigger>
                        <SelectContent>
                          {AFRICAN_COUNTRIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-xl border bg-muted/30">
                      <Checkbox
                        id="diaspora"
                        checked={diaspora}
                        onCheckedChange={(v) => setDiaspora(!!v)}
                        data-testid="checkbox-diaspora"
                        className="mt-0.5"
                      />
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
                        <Input
                          id="diasporaCountry"
                          placeholder="e.g. United Kingdom, Canada, USA..."
                          className="h-11 bg-muted/30"
                          value={diasporaCountry}
                          onChange={e => setDiasporaCountry(e.target.value)}
                          required={diaspora}
                          data-testid="input-diaspora-country"
                        />
                      </motion.div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="referral">Referral Code (Optional)</Label>
                      <Input id="referral" placeholder="e.g. TSIA-JOH0001" className="h-11 bg-muted/30" value={formData.referralCode} onChange={e => setFormData({ ...formData, referralCode: e.target.value })} data-testid="input-referral" />
                    </div>
                    <div className="text-sm text-muted-foreground my-4">
                      By applying, you agree to our Terms of Service and Verification Policy. A $3 portal fee is required during onboarding.
                    </div>
                    <Button type="submit" className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 shadow-md" disabled={loading} data-testid="button-signup">
                      {loading ? "Creating Account..." : "Continue to Verification"}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-6">
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-2">
                      <KeyRound className="w-4 h-4" />
                      <span>Code sent to <strong className="text-foreground">{formData.email}</strong></span>
                    </div>
                    {otpHint && (
                      <div className="text-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                        <span className="text-xs text-muted-foreground">Demo OTP: </span>
                        <span className="font-mono font-bold text-primary tracking-widest">{otpHint}</span>
                      </div>
                    )}
                    <div className="flex justify-center gap-3">
                      {otpDigits.map((digit, i) => (
                        <Input key={i} ref={el => { inputRefs.current[i] = el; }} className="w-12 h-14 text-center text-xl font-bold bg-muted/30 focus:bg-background transition-colors"
                          maxLength={1} value={digit} onChange={e => handleOtpChange(i, e.target.value)} onKeyDown={e => handleOtpKeyDown(i, e)} data-testid={`input-signup-otp-${i}`} />
                      ))}
                    </div>
                    <Button type="submit" className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 shadow-md" disabled={loading || otpDigits.join("").length !== 6} data-testid="button-verify-signup-otp">
                      {loading ? "Verifying..." : "Verify & Continue"}
                    </Button>
                  </form>
                )}
              </CardContent>
              {step === 1 && (
                <CardFooter className="flex justify-center border-t py-6 bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    Already have an account?{' '}
                    <Link href="/login"><span className="font-semibold text-primary hover:text-primary/80 cursor-pointer">Log in</span></Link>
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
