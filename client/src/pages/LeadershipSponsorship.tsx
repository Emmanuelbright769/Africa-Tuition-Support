import { useState, useCallback } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2, Users, Briefcase, ChevronRight, CheckCircle2,
  ArrowLeft, CreditCard, Mail, Loader2, Copy, PartyPopper,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

declare global {
  interface Window { squad: any; }
}

const PRICE_PER_STUDENT = 3.3; // USD

type Step = "form" | "pay" | "success";

interface FormData {
  firstName: string;
  lastName: string;
  orgName: string;
  email: string;
  phone: string;
  numStudents: string;
}

const emptyForm: FormData = { firstName: "", lastName: "", orgName: "", email: "", phone: "", numStudents: "30" };

export default function LeadershipSponsorship() {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState<FormData>(emptyForm);
  const [paying, setPaying] = useState(false);
  const [masterCode, setMasterCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const slots = Math.max(30, parseInt(form.numStudents, 10) || 30);
  const totalUsd = (slots * PRICE_PER_STUDENT).toFixed(2);
  const totalNgn = (slots * PRICE_PER_STUDENT * 1480).toLocaleString("en-NG");

  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const formValid =
    form.firstName.trim() && form.lastName.trim() && form.email.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) && slots >= 30;

  const loadSquadScript = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.squad) return resolve();
      const existing = document.getElementById("squad-widget-js");
      if (existing) { existing.addEventListener("load", () => resolve()); return; }
      const s = document.createElement("script");
      s.id = "squad-widget-js";
      s.src = "https://checkout.squadco.com/widget/squad.min.js";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Could not load payment widget. Please check your connection."));
      document.head.appendChild(s);
    });
  }, []);

  const handlePay = useCallback(async () => {
    setPaying(true);
    try {
      await loadSquadScript();
      const res = await apiRequest("POST", "/api/sponsor/payment/initiate", {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        orgName: form.orgName.trim(),
        phone: form.phone.trim(),
        numStudents: slots,
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? "Could not start payment");
      const { transactionRef, amountKobo, publicKey, email, firstName, lastName } = d as {
        transactionRef: string; amountKobo: number; publicKey: string;
        email: string; firstName: string; lastName: string;
      };

      const squadInstance = new window.squad({
        key: publicKey,
        email,
        amount: amountKobo,
        currency_code: "NGN",
        transaction_ref: transactionRef,
        payment_channels: ["card", "bank", "ussd", "transfer"],
        metadata: { customer_name: `${firstName} ${lastName}`, platform: "TSIA", students: slots },
        onLoad: () => setPaying(false),
        onClose: () => setPaying(false),
        onSuccess: async (data: any) => {
          const ref = data?.transaction_ref ?? transactionRef;
          setPaying(true);
          try {
            const vRes = await apiRequest("POST", "/api/sponsor/payment/verify", {
              transactionRef: ref,
              firstName: form.firstName.trim(),
              lastName: form.lastName.trim(),
              email: form.email.trim(),
              orgName: form.orgName.trim(),
              phone: form.phone.trim(),
              numStudents: slots,
            });
            const vd = await vRes.json();
            if (!vRes.ok) throw new Error(vd.message);
            setMasterCode(vd.masterCode);
            setStep("success");
          } catch (ve: any) {
            toast({ title: "Verification issue", description: ve.message ?? "Your code will be emailed shortly.", variant: "destructive" });
          } finally {
            setPaying(false);
          }
        },
      });
      squadInstance.setup();
      squadInstance.open();
    } catch (e: any) {
      setPaying(false);
      toast({ title: "Payment error", description: e.message, variant: "destructive" });
    }
  }, [form, slots, loadSquadScript, toast]);

  const copyCode = () => {
    if (masterCode) {
      navigator.clipboard.writeText(masterCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-slate-950 text-white py-20 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-tsia-green/20 to-transparent" />
          <div className="container mx-auto px-4 relative z-10 grid md:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }} className="space-y-6">
              <div className="inline-flex items-center rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1 text-sm font-medium text-slate-300">
                Corporate Social Responsibility
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
                Sponsor a Cohort.<br />Shape the Future.
              </h1>
              <p className="text-lg text-slate-400 max-w-lg">
                Organizations and individuals can sponsor cohorts of 30+ students for just <strong className="text-white">$3.30 per student</strong>. Make measurable, scalable impact on African education today.
              </p>
              <div className="grid grid-cols-3 gap-4 pt-2">
                {[["$3.30", "per student"], ["30+", "min. students"], ["Instant", "code delivery"]].map(([v, l]) => (
                  <div key={l} className="text-center p-3 rounded-xl bg-slate-800/60 border border-slate-700">
                    <p className="text-xl font-bold text-tsia-gold">{v}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{l}</p>
                  </div>
                ))}
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="hidden md:block">
              <div className="w-full h-72 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-900 border border-slate-700 shadow-2xl relative overflow-hidden flex items-center justify-center">
                <div className="grid grid-cols-5 gap-2 opacity-20">
                  {Array.from({ length: 25 }).map((_, i) => <div key={i} className="w-12 h-12 rounded bg-tsia-green" />)}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent" />
                <h3 className="absolute bottom-8 left-8 text-2xl font-bold">30+ Students<br /><span className="text-tsia-green">Per Cohort</span></h3>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-16 bg-card border-b">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: Users, title: "Scale Your Impact", desc: "Sponsor a minimum of 30 students for a dedicated 3-year term — all with one payment." },
                { icon: Briefcase, title: "One Reusable Code", desc: "Receive a single master sponsor code by email. Share it with all your sponsored students to activate their accounts." },
                { icon: Building2, title: "Detailed Reporting", desc: "Track fund utilization and student progress via the admin dashboard." }
              ].map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }}
                  className="p-6 rounded-2xl bg-background border hover:shadow-lg transition-shadow"
                >
                  <item.icon className="w-9 h-9 text-tsia-green mb-3" />
                  <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground text-sm">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Main Form / Payment / Success */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4 max-w-2xl">
            <AnimatePresence mode="wait">
              {/* ── STEP 1: FORM ── */}
              {step === "form" && (
                <motion.div key="form" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }} transition={{ duration: 0.35 }}>
                  <div className="text-center mb-10">
                    <h2 className="text-3xl font-bold mb-2">Sponsor Students Today</h2>
                    <p className="text-muted-foreground">Fill in your details and the number of students you wish to sponsor.</p>
                  </div>
                  <div className="bg-card border rounded-3xl shadow-xl p-8 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="firstName">First Name <span className="text-red-500">*</span></Label>
                        <Input id="firstName" value={form.firstName} onChange={set("firstName")} placeholder="Jane" data-testid="input-sponsor-firstName" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="lastName">Last Name <span className="text-red-500">*</span></Label>
                        <Input id="lastName" value={form.lastName} onChange={set("lastName")} placeholder="Doe" data-testid="input-sponsor-lastName" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="orgName">Organization / Company <span className="text-muted-foreground text-xs">(optional)</span></Label>
                      <Input id="orgName" value={form.orgName} onChange={set("orgName")} placeholder="Acme Corp" data-testid="input-sponsor-org" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="email">Email Address <span className="text-red-500">*</span></Label>
                        <Input id="email" type="email" value={form.email} onChange={set("email")} placeholder="jane@acme.com" data-testid="input-sponsor-email" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="phone">Phone <span className="text-muted-foreground text-xs">(optional)</span></Label>
                        <Input id="phone" type="tel" value={form.phone} onChange={set("phone")} placeholder="+234 800 000 0000" data-testid="input-sponsor-phone" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="numStudents">Number of Students <span className="text-red-500">*</span></Label>
                      <Input id="numStudents" type="number" min={30} value={form.numStudents}
                        onChange={set("numStudents")}
                        placeholder="30" data-testid="input-sponsor-students"
                      />
                      {parseInt(form.numStudents, 10) < 30 && form.numStudents !== "" && (
                        <p className="text-xs text-red-500">Minimum is 30 students.</p>
                      )}
                    </div>

                    {/* Price calculator */}
                    <div className="rounded-2xl bg-tsia-green/5 border border-tsia-green/20 p-5">
                      <div className="flex justify-between items-center text-sm text-muted-foreground mb-1">
                        <span>$3.30 × {slots.toLocaleString()} students</span>
                        <span className="font-medium text-foreground">${totalUsd}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm text-muted-foreground">
                        <span>Naira equivalent (~₦1,480/$)</span>
                        <span className="font-medium text-foreground">₦{totalNgn}</span>
                      </div>
                      <div className="mt-3 pt-3 border-t border-tsia-green/20 flex justify-between items-center">
                        <span className="font-semibold text-foreground">Total Due</span>
                        <span className="text-xl font-bold text-tsia-green">${totalUsd}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">Payment is processed in Nigerian Naira via card, bank transfer, or USSD.</p>
                    </div>

                    <Button
                      className="w-full h-12 text-base bg-tsia-green hover:bg-tsia-green/90 text-white"
                      disabled={!formValid}
                      onClick={() => setStep("pay")}
                      data-testid="button-sponsor-proceed"
                    >
                      Proceed to Payment <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 2: PAY ── */}
              {step === "pay" && (
                <motion.div key="pay" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }} transition={{ duration: 0.35 }}>
                  <div className="text-center mb-10">
                    <h2 className="text-3xl font-bold mb-2">Confirm & Pay</h2>
                    <p className="text-muted-foreground">Review your sponsorship details before making payment.</p>
                  </div>
                  <div className="bg-card border rounded-3xl shadow-xl p-8 space-y-6">
                    {/* Summary */}
                    <div className="rounded-2xl bg-muted/40 border p-5 space-y-3 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Sponsor</span><span className="font-medium">{form.firstName} {form.lastName}{form.orgName ? ` (${form.orgName})` : ""}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium">{form.email}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Students</span><span className="font-medium">{slots.toLocaleString()} students</span></div>
                      <div className="border-t pt-3 flex justify-between items-center">
                        <span className="font-semibold">Total</span>
                        <span className="text-xl font-bold text-tsia-green">${totalUsd} <span className="text-sm font-normal text-muted-foreground">(≈₦{totalNgn})</span></span>
                      </div>
                    </div>

                    {/* What happens next */}
                    <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-4 text-sm text-amber-800 dark:text-amber-200 flex gap-3">
                      <Mail className="w-5 h-5 shrink-0 mt-0.5" />
                      <p>After payment, your unique <strong>sponsor master code</strong> will be emailed to <strong>{form.email}</strong>. Share it with your {slots.toLocaleString()} students — each student enters it once during TSIA enrolment to activate their account for free.</p>
                    </div>

                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1 h-12" onClick={() => setStep("form")} data-testid="button-sponsor-back">
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                      </Button>
                      <Button
                        className="flex-[2] h-12 text-base bg-tsia-green hover:bg-tsia-green/90 text-white"
                        disabled={paying}
                        onClick={handlePay}
                        data-testid="button-sponsor-pay"
                      >
                        {paying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</> : <><CreditCard className="w-4 h-4 mr-2" />Pay ${totalUsd}</>}
                      </Button>
                    </div>
                    <p className="text-xs text-center text-muted-foreground">Secured by Squad · Bank, card, USSD &amp; transfer accepted</p>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 3: SUCCESS ── */}
              {step === "success" && (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
                  <div className="bg-card border rounded-3xl shadow-xl overflow-hidden text-center">
                    <div className="bg-tsia-green p-10 text-white">
                      <PartyPopper className="w-14 h-14 mx-auto mb-4 opacity-90" />
                      <h2 className="text-3xl font-bold mb-2">Payment Confirmed!</h2>
                      <p className="opacity-90 text-base max-w-sm mx-auto">Thank you, {form.firstName}! Your sponsorship for <strong>{slots.toLocaleString()} students</strong> is now active.</p>
                    </div>
                    <div className="p-8 space-y-6">
                      {masterCode && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-3">Your master sponsor code — share this with all your students:</p>
                          <div className="inline-flex items-center gap-3 bg-muted border-2 border-tsia-green rounded-xl px-6 py-4">
                            <span className="font-mono text-2xl font-bold tracking-widest text-tsia-green" data-testid="text-master-code">{masterCode}</span>
                            <button onClick={copyCode} className="text-muted-foreground hover:text-tsia-green transition-colors" title="Copy code" data-testid="button-copy-code">
                              {copied ? <CheckCircle2 className="w-5 h-5 text-tsia-green" /> : <Copy className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="rounded-xl bg-muted/40 border p-4 text-sm text-left space-y-2 text-muted-foreground">
                        <p className="font-semibold text-foreground">What happens next:</p>
                        <div className="flex gap-2"><CheckCircle2 className="w-4 h-4 shrink-0 text-tsia-green mt-0.5" /><span>A copy of this code has been emailed to <strong>{form.email}</strong></span></div>
                        <div className="flex gap-2"><CheckCircle2 className="w-4 h-4 shrink-0 text-tsia-green mt-0.5" /><span>Share the code with your students. Each student enters it during TSIA enrollment to activate their account.</span></div>
                        <div className="flex gap-2"><CheckCircle2 className="w-4 h-4 shrink-0 text-tsia-green mt-0.5" /><span>The code covers all {slots.toLocaleString()} slots. Once filled, it will be automatically deactivated.</span></div>
                      </div>
                      <Button variant="outline" className="w-full h-11" onClick={() => { setForm(emptyForm); setMasterCode(null); setStep("form"); }} data-testid="button-sponsor-again">
                        Sponsor another cohort
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
