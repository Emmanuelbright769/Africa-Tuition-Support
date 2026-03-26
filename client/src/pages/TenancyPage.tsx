import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Home, Building2, MapPin, Bed, Bath, CalendarDays, TrendingDown, CheckCircle2,
  ArrowLeft, Menu, X, Sun, Moon, Monitor, DollarSign, Calculator, Clock, Shield, Users, Landmark,
} from "lucide-react";
import { calculateTenancyDeal } from "@shared/schema";

const container = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } } };

const AMENITY_OPTIONS = ["Air Conditioning", "Running Water", "Security", "Parking", "Generator/Power Backup", "Internet/WiFi", "Laundry", "Garden", "CCTV", "Swimming Pool"];

const PROPERTY_TYPES = ["Apartment", "Duplex", "Bungalow", "Terrace House", "Detached House", "Semi-Detached", "Room & Parlour", "Studio Flat"];

function formatNgn(val: number) {
  return `₦${val.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function TenancyPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { mode, setMode } = useTheme();
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [tab, setTab] = useState<"browse" | "landlord" | "how" | "calculator">("browse");
  const [listOpen, setListOpen] = useState(false);
  const [applyProp, setApplyProp] = useState<any>(null);

  // Calculator state
  const [calcAnnual, setCalcAnnual] = useState("500000");
  const [calcYears, setCalcYears] = useState("5");

  const calcResult = (() => {
    const annual = parseFloat(calcAnnual) || 0;
    const years = parseInt(calcYears) || 5;
    if (annual <= 0) return null;
    return calculateTenancyDeal(annual, years, 12, 5);
  })();

  // Landlord form state
  const [form, setForm] = useState({
    propertyName: "", address: "", city: "", state: "", country: "Nigeria",
    propertyType: "Apartment", bedrooms: "2", bathrooms: "1",
    annualRentNgn: "", leasePeriodYears: "5", description: "", amenities: [] as string[],
  });

  const { data: properties = [] } = useQuery<any[]>({ queryKey: ["/api/tenancy/properties"] });
  const { data: myProperties = [] } = useQuery<any[]>({ queryKey: ["/api/tenancy/my-properties"], enabled: !!user });
  const { data: myLeases = [] } = useQuery<any[]>({ queryKey: ["/api/tenancy/my-leases"], enabled: !!user });

  const listMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/tenancy/list-property", {
        ...form, bedrooms: parseInt(form.bedrooms), bathrooms: parseInt(form.bathrooms),
        leasePeriodYears: parseInt(form.leasePeriodYears), annualRentNgn: form.annualRentNgn,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Property Listed!", description: "We'll review your listing and get back to you within 24–48 hours." });
      queryClient.invalidateQueries({ queryKey: ["/api/tenancy/my-properties"] });
      setListOpen(false);
      setForm({ propertyName: "", address: "", city: "", state: "", country: "Nigeria", propertyType: "Apartment", bedrooms: "2", bathrooms: "1", annualRentNgn: "", leasePeriodYears: "5", description: "", amenities: [] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const applyMutation = useMutation({
    mutationFn: async (propertyId: number) => {
      const res = await apiRequest("POST", "/api/tenancy/apply", { propertyId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Application Submitted!", description: "Your lease application has been processed. Check My Leases to see your payment schedule." });
      queryClient.invalidateQueries({ queryKey: ["/api/tenancy/my-leases"] });
      setApplyProp(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleAmenity = (a: string) => {
    setForm(f => ({ ...f, amenities: f.amenities.includes(a) ? f.amenities.filter(x => x !== a) : [...f.amenities, a] }));
  };

  const themeOpts = [{ v: "light" as const, icon: Sun }, { v: "dark" as const, icon: Moon }, { v: "system" as const, icon: Monitor }];

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation(user?.role === "affiliate" ? "/affiliate-dashboard" : user?.role === "student" ? "/dashboard" : "/")} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Link href="/"><Logo variant="badge" height={36} /></Link>
            <div>
              <p className="font-bold text-sm leading-tight text-tsia-green">TSIA Tenancy</p>
              <p className="text-xs text-muted-foreground leading-tight">Housing made affordable</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2">
            {["browse", "landlord", "how", "calculator"].map((t) => (
              <button key={t} onClick={() => setTab(t as any)}
                className={`px-3 py-1.5 text-sm rounded-full font-medium transition-colors ${tab === t ? "bg-tsia-green text-white" : "text-muted-foreground hover:text-foreground"}`}>
                {t === "browse" ? "Browse Properties" : t === "landlord" ? "List Property" : t === "how" ? "How It Works" : "Calculator"}
              </button>
            ))}
            <div className="flex items-center bg-muted rounded-full p-1 ml-2">
              {themeOpts.map(({ v, icon: Icon }) => (
                <button key={v} onClick={() => setMode(v)} className={`p-1.5 rounded-full transition-all ${mode === v ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
          </div>
          <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        <AnimatePresence>
          {menuOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="md:hidden border-t border-border bg-background overflow-hidden">
              <div className="flex flex-col p-4 gap-2">
                {["browse", "landlord", "how", "calculator"].map((t) => (
                  <button key={t} onClick={() => { setTab(t as any); setMenuOpen(false); }}
                    className={`text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-tsia-green/10 text-tsia-green" : "hover:bg-muted"}`}>
                    {t === "browse" ? "Browse Properties" : t === "landlord" ? "List Property" : t === "how" ? "How It Works" : "Calculator"}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-br from-tsia-green/10 via-background to-tsia-gold/5 border-b border-border py-10 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 bg-tsia-green/10 text-tsia-green px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
              <Home className="w-4 h-4" /> TSIA Tenancy Programme
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3">Housing Made Affordable for Everyone</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Landlords get a <strong>lump-sum payment upfront</strong>. Tenants pay in <strong>easy monthly installments</strong>. TSIA bridges the gap — no more massive annual rent demands.
            </p>
            <div className="flex flex-wrap justify-center gap-3 mt-6">
              <Button className="bg-tsia-green hover:bg-tsia-green/90 text-white" onClick={() => setTab("browse")} data-testid="button-browse-properties">Browse Properties</Button>
              <Button variant="outline" onClick={() => user ? setListOpen(true) : setLocation("/login")} data-testid="button-list-property">List Your Property</Button>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <motion.div variants={container} initial="hidden" animate="visible" key={tab} className="space-y-6">

          {/* BROWSE TAB */}
          {tab === "browse" && (
            <>
              <motion.div variants={item}>
                <h2 className="text-xl font-bold mb-1">Available Properties</h2>
                <p className="text-muted-foreground text-sm">All properties include TSIA-managed installment payments for tenants.</p>
              </motion.div>

              {properties.length === 0 ? (
                <motion.div variants={item}>
                  <Card className="border-dashed">
                    <CardContent className="py-16 text-center">
                      <Building2 className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                      <p className="font-semibold text-muted-foreground">No properties available yet</p>
                      <p className="text-sm text-muted-foreground mt-1">Be the first to list your property or check back soon.</p>
                      <Button className="mt-4 bg-tsia-green hover:bg-tsia-green/90 text-white" onClick={() => user ? setListOpen(true) : setLocation("/login")}>List Your Property</Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {properties.map((prop: any) => {
                    const annual = parseFloat(prop.annualRentNgn);
                    const deal = calculateTenancyDeal(annual, prop.leasePeriodYears, parseFloat(prop.discountRate), parseFloat(prop.tenantInterestRate));
                    return (
                      <motion.div key={prop.id} variants={item}>
                        <Card className="hover:shadow-lg transition-shadow border-0 shadow-md overflow-hidden">
                          <div className="h-2 bg-gradient-to-r from-tsia-green to-tsia-gold" />
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h3 className="font-bold text-base leading-tight">{prop.propertyName}</h3>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                  <MapPin className="w-3 h-3" /> {prop.city}, {prop.state}
                                </div>
                              </div>
                              <Badge variant="outline" className="text-tsia-green border-tsia-green/30 bg-tsia-green/5">{prop.propertyType}</Badge>
                            </div>
                            <div className="flex gap-3 text-xs text-muted-foreground mb-3">
                              <span className="flex items-center gap-1"><Bed className="w-3 h-3" /> {prop.bedrooms} Bed</span>
                              <span className="flex items-center gap-1"><Bath className="w-3 h-3" /> {prop.bathrooms} Bath</span>
                              <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {prop.leasePeriodYears}yr lease</span>
                            </div>
                            {prop.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{prop.description}</p>}
                            <div className="bg-muted/50 rounded-xl p-3 space-y-1.5 text-sm mb-4">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Annual Rent</span>
                                <span className="font-semibold">{formatNgn(annual)}</span>
                              </div>
                              <div className="flex justify-between text-tsia-green">
                                <span>Monthly Installment</span>
                                <span className="font-bold">{formatNgn(deal.monthlyTenantPayment)}/mo</span>
                              </div>
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Total over {prop.leasePeriodYears} years (5% interest)</span>
                                <span>{formatNgn(deal.totalTenantPayable)}</span>
                              </div>
                            </div>
                            {prop.amenities?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-3">
                                {prop.amenities.slice(0, 4).map((a: string) => (
                                  <span key={a} className="text-xs bg-muted px-2 py-0.5 rounded-full">{a}</span>
                                ))}
                                {prop.amenities.length > 4 && <span className="text-xs text-muted-foreground">+{prop.amenities.length - 4} more</span>}
                              </div>
                            )}
                            <Button className="w-full bg-tsia-green hover:bg-tsia-green/90 text-white" onClick={() => user ? setApplyProp(prop) : setLocation("/login")} data-testid={`button-apply-lease-${prop.id}`}>
                              Apply for Lease
                            </Button>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* My Leases */}
              {user && myLeases.length > 0 && (
                <motion.div variants={item}>
                  <h3 className="font-bold text-lg mb-3 mt-6">My Active Leases</h3>
                  <div className="space-y-3">
                    {myLeases.map((lease: any) => (
                      <Card key={lease.id} className="border-0 shadow-sm">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold">{lease.property?.propertyName}</p>
                              <p className="text-sm text-muted-foreground">{lease.property?.city}, {lease.property?.state}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-tsia-green font-bold">{formatNgn(parseFloat(lease.monthlyPaymentNgn))}/mo</p>
                              <Badge variant="outline" className="text-xs">{lease.status}</Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </motion.div>
              )}
            </>
          )}

          {/* LANDLORD TAB */}
          {tab === "landlord" && (
            <>
              <motion.div variants={item}>
                <h2 className="text-xl font-bold mb-1">List Your Property</h2>
                <p className="text-muted-foreground text-sm">Receive a lump-sum payment from TSIA. We handle tenant management and monthly collections.</p>
              </motion.div>

              <motion.div variants={item}>
                <div className="grid sm:grid-cols-3 gap-4 mb-6">
                  {[
                    { icon: DollarSign, color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20", title: "Upfront Payment", desc: "Receive full multi-year rent in one lump sum, minus a 12% TSIA service discount." },
                    { icon: Shield, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20", title: "Zero Risk", desc: "TSIA guarantees your payment regardless of tenant issues. No more chasing rent." },
                    { icon: Clock, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20", title: "3–10 Year Terms", desc: "Choose your lease period. Longer lease = better deal for everyone." },
                  ].map((f, i) => (
                    <div key={i} className={`rounded-xl p-4 ${f.bg}`}>
                      <f.icon className={`w-6 h-6 mb-2 ${f.color}`} />
                      <p className="font-semibold text-sm mb-1">{f.title}</p>
                      <p className="text-xs text-muted-foreground">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div variants={item}>
                {!user ? (
                  <Card className="border-dashed">
                    <CardContent className="py-10 text-center">
                      <p className="font-semibold mb-2">You need to be logged in to list a property</p>
                      <Button className="bg-tsia-green hover:bg-tsia-green/90 text-white" onClick={() => setLocation("/login")}>Login to Continue</Button>
                    </CardContent>
                  </Card>
                ) : (
                  <Button className="bg-tsia-green hover:bg-tsia-green/90 text-white w-full md:w-auto h-12 px-8 text-base font-semibold" onClick={() => setListOpen(true)} data-testid="button-open-list-form">
                    <Home className="w-4 h-4 mr-2" /> List My Property Now
                  </Button>
                )}
              </motion.div>

              {/* My listed properties */}
              {user && myProperties.length > 0 && (
                <motion.div variants={item}>
                  <h3 className="font-bold text-lg mb-3">My Listed Properties</h3>
                  <div className="space-y-3">
                    {myProperties.map((prop: any) => (
                      <Card key={prop.id} className="border-0 shadow-sm">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{prop.propertyName}</p>
                            <p className="text-sm text-muted-foreground">{prop.city}, {prop.state} • {prop.bedrooms}bd {prop.bathrooms}ba</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-tsia-green">{formatNgn(parseFloat(prop.annualRentNgn))}/yr</p>
                            <Badge variant="outline" className={`text-xs ${prop.status === "available" ? "border-green-500 text-green-600" : prop.status === "pending_review" ? "border-yellow-500 text-yellow-600" : ""}`}>
                              {prop.status === "pending_review" ? "Under Review" : prop.status === "available" ? "Available" : prop.status === "leased" ? "Leased" : prop.status}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </motion.div>
              )}
            </>
          )}

          {/* HOW IT WORKS TAB */}
          {tab === "how" && (
            <>
              <motion.div variants={item}>
                <h2 className="text-xl font-bold mb-1">How TSIA Tenancy Works</h2>
                <p className="text-muted-foreground text-sm">A win-win for landlords and tenants — TSIA is the bridge.</p>
              </motion.div>

              <motion.div variants={item}>
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Landlord flow */}
                  <Card className="border-0 shadow-md overflow-hidden">
                    <div className="h-1.5 bg-gradient-to-r from-tsia-green to-emerald-400" />
                    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Landmark className="w-5 h-5 text-tsia-green" /> For Landlords</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      {[
                        { step: "1", text: "List your property on TSIA Tenancy with details about rent, location, and period (3–10 years)." },
                        { step: "2", text: "TSIA reviews your listing and calculates the lump-sum payment (annual rent × years × 88%)." },
                        { step: "3", text: "Upon agreement, TSIA transfers the full lump sum to your account within 48 hours." },
                        { step: "4", text: "TSIA manages all tenant sourcing, monthly collections, and property management on your behalf." },
                      ].map(({ step, text }) => (
                        <div key={step} className="flex gap-3">
                          <div className="w-7 h-7 rounded-full bg-tsia-green text-white text-sm font-bold flex items-center justify-center flex-shrink-0">{step}</div>
                          <p className="text-sm leading-relaxed">{text}</p>
                        </div>
                      ))}
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 mt-2">
                        <p className="text-xs text-green-700 dark:text-green-400 font-medium">Example: ₦1,000,000/yr × 5 years = ₦5,000,000 total → TSIA pays ₦4,400,000 upfront (12% discount = ₦600,000 TSIA fee)</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tenant flow */}
                  <Card className="border-0 shadow-md overflow-hidden">
                    <div className="h-1.5 bg-gradient-to-r from-tsia-gold to-yellow-400" />
                    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="w-5 h-5 text-tsia-gold" /> For Tenants</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      {[
                        { step: "1", text: "Browse available properties in your city and select one that fits your budget." },
                        { step: "2", text: "Apply for a lease through TSIA. Our team verifies your application within 24 hours." },
                        { step: "3", text: "Pay a small monthly installment instead of a large annual lump sum. 5% interest added." },
                        { step: "4", text: "Move in and enjoy your new home! TSIA handles all communication with the landlord." },
                      ].map(({ step, text }) => (
                        <div key={step} className="flex gap-3">
                          <div className="w-7 h-7 rounded-full bg-tsia-gold text-slate-900 text-sm font-bold flex items-center justify-center flex-shrink-0">{step}</div>
                          <p className="text-sm leading-relaxed">{text}</p>
                        </div>
                      ))}
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-3 mt-2">
                        <p className="text-xs text-yellow-700 dark:text-yellow-400 font-medium">Example: ₦1,000,000/yr → ₦1,050,000/yr with 5% interest → ₦87,500/month (vs ₦1M upfront!)</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>

              <motion.div variants={item}>
                <Card className="border-0 bg-gradient-to-br from-tsia-green/5 to-tsia-gold/5 shadow-md">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3 mb-4">
                      <TrendingDown className="w-6 h-6 text-tsia-green shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-base">TSIA Revenue Model</p>
                        <p className="text-sm text-muted-foreground mt-1">TSIA earns the difference between what tenants pay (with interest) and what we paid the landlord (with discount). This sustains the platform and funds our education programme.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      {[
                        { label: "Landlord gets", val: "88%", sub: "of total value" },
                        { label: "TSIA earns", val: "~17%", sub: "from interest spread" },
                        { label: "Tenant saves", val: "100%", sub: "upfront payment" },
                      ].map((s, i) => (
                        <div key={i} className="bg-background rounded-xl p-3 shadow-sm">
                          <p className="text-2xl font-bold text-tsia-green">{s.val}</p>
                          <p className="text-xs font-semibold mt-1">{s.label}</p>
                          <p className="text-xs text-muted-foreground">{s.sub}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </>
          )}

          {/* CALCULATOR TAB */}
          {tab === "calculator" && (
            <>
              <motion.div variants={item}>
                <h2 className="text-xl font-bold mb-1">Tenancy Calculator</h2>
                <p className="text-muted-foreground text-sm">See exactly how the deal works for your property.</p>
              </motion.div>

              <motion.div variants={item}>
                <Card className="border-0 shadow-md max-w-lg">
                  <CardContent className="p-6 space-y-5">
                    <div className="space-y-2">
                      <Label>Annual Rent (₦)</Label>
                      <Input type="number" value={calcAnnual} onChange={e => setCalcAnnual(e.target.value)} placeholder="e.g. 500000" data-testid="input-calc-annual-rent" />
                    </div>
                    <div className="space-y-2">
                      <Label>Lease Period (years)</Label>
                      <div className="flex gap-2">
                        {[3, 5, 7, 10].map(y => (
                          <button key={y} onClick={() => setCalcYears(y.toString())}
                            className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${calcYears === y.toString() ? "bg-tsia-green text-white border-tsia-green" : "border-border hover:border-tsia-green/50"}`}
                            data-testid={`button-calc-years-${y}`}>
                            {y} yr
                          </button>
                        ))}
                      </div>
                    </div>

                    {calcResult && (
                      <div className="space-y-3 pt-4 border-t border-border">
                        <p className="font-semibold text-sm text-muted-foreground">Results</p>
                        <div className="space-y-2.5">
                          {[
                            { label: "Total Gross Value", val: formatNgn(calcResult.totalGross), color: "text-foreground" },
                            { label: "TSIA pays landlord (12% disc)", val: formatNgn(calcResult.tsiaPayment), color: "text-tsia-green font-bold" },
                            { label: "Tenant pays monthly (5% interest)", val: `${formatNgn(calcResult.monthlyTenantPayment)}/mo`, color: "text-blue-600 dark:text-blue-400 font-bold" },
                            { label: "Tenant pays total", val: formatNgn(calcResult.totalTenantPayable), color: "text-foreground" },
                            { label: "TSIA net revenue", val: formatNgn(calcResult.tsiaRevenue), color: "text-tsia-gold font-bold" },
                          ].map(({ label, val, color }) => (
                            <div key={label} className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">{label}</span>
                              <span className={`text-sm ${color}`}>{val}</span>
                            </div>
                          ))}
                        </div>
                        <div className="bg-tsia-green/10 rounded-xl p-3 mt-2">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-tsia-green shrink-0 mt-0.5" />
                            <p className="text-xs text-tsia-green font-medium">
                              Landlord receives <strong>{formatNgn(calcResult.tsiaPayment)}</strong> upfront.
                              Tenant pays only <strong>{formatNgn(calcResult.monthlyTenantPayment)}/month</strong> instead of a full annual payment.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </>
          )}
        </motion.div>
      </div>

      {/* List Property Modal */}
      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Home className="w-5 h-5 text-tsia-green" /> List Your Property</DialogTitle>
            <DialogDescription>Fill in your property details. TSIA will review and contact you within 48 hours with a payment offer.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Property Name / Title *</Label>
                <Input value={form.propertyName} onChange={e => setForm(f => ({ ...f, propertyName: e.target.value }))} placeholder="e.g. 3-Bedroom Flat in GRA" data-testid="input-property-name" />
              </div>
              <div className="space-y-1.5">
                <Label>Property Type</Label>
                <select value={form.propertyType} onChange={e => setForm(f => ({ ...f, propertyType: e.target.value }))}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" data-testid="select-property-type">
                  {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Full Address *</Label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Street address" data-testid="input-address" />
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>City *</Label>
                <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="e.g. Port Harcourt" data-testid="input-city" />
              </div>
              <div className="space-y-1.5">
                <Label>State *</Label>
                <Input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} placeholder="e.g. Rivers" data-testid="input-state" />
              </div>
              <div className="space-y-1.5">
                <Label>Country</Label>
                <Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} data-testid="input-country" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Bedrooms</Label>
                <Input type="number" min="1" max="20" value={form.bedrooms} onChange={e => setForm(f => ({ ...f, bedrooms: e.target.value }))} data-testid="input-bedrooms" />
              </div>
              <div className="space-y-1.5">
                <Label>Bathrooms</Label>
                <Input type="number" min="1" max="20" value={form.bathrooms} onChange={e => setForm(f => ({ ...f, bathrooms: e.target.value }))} data-testid="input-bathrooms" />
              </div>
              <div className="space-y-1.5">
                <Label>Lease Period (yrs)</Label>
                <select value={form.leasePeriodYears} onChange={e => setForm(f => ({ ...f, leasePeriodYears: e.target.value }))}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" data-testid="select-lease-period">
                  {[3, 4, 5, 6, 7, 8, 10].map(y => <option key={y} value={y}>{y} years</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Annual Rent (₦) *</Label>
              <Input type="number" value={form.annualRentNgn} onChange={e => setForm(f => ({ ...f, annualRentNgn: e.target.value }))} placeholder="e.g. 600000" data-testid="input-annual-rent" />
              {form.annualRentNgn && parseFloat(form.annualRentNgn) > 0 && (
                <p className="text-xs text-tsia-green font-medium">
                  TSIA will pay you: {formatNgn(parseFloat(form.annualRentNgn) * parseInt(form.leasePeriodYears) * 0.88)} upfront
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                placeholder="Describe your property, neighborhood, and any special features..." data-testid="input-description" />
            </div>

            <div className="space-y-2">
              <Label>Amenities</Label>
              <div className="flex flex-wrap gap-2">
                {AMENITY_OPTIONS.map(a => (
                  <button key={a} type="button" onClick={() => toggleAmenity(a)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${form.amenities.includes(a) ? "bg-tsia-green text-white border-tsia-green" : "border-border hover:border-tsia-green/40"}`}
                    data-testid={`button-amenity-${a.replace(/\s/g, "-").toLowerCase()}`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setListOpen(false)}>Cancel</Button>
            <Button className="bg-tsia-green hover:bg-tsia-green/90 text-white" onClick={() => listMutation.mutate()}
              disabled={listMutation.isPending || !form.propertyName || !form.address || !form.city || !form.state || !form.annualRentNgn}
              data-testid="button-submit-property">
              {listMutation.isPending ? "Submitting..." : "Submit Property Listing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply for Lease Confirmation */}
      <Dialog open={!!applyProp} onOpenChange={(v) => !v && setApplyProp(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Apply for Lease</DialogTitle>
            <DialogDescription>Confirm your lease application for this property.</DialogDescription>
          </DialogHeader>
          {applyProp && (() => {
            const annual = parseFloat(applyProp.annualRentNgn);
            const deal = calculateTenancyDeal(annual, applyProp.leasePeriodYears, parseFloat(applyProp.discountRate), parseFloat(applyProp.tenantInterestRate));
            return (
              <div className="space-y-4 py-2">
                <div className="bg-muted/50 rounded-xl p-4 space-y-2">
                  <p className="font-bold">{applyProp.propertyName}</p>
                  <p className="text-sm text-muted-foreground">{applyProp.address}, {applyProp.city}, {applyProp.state}</p>
                  <div className="border-t border-border pt-3 space-y-1.5">
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Monthly Payment</span><span className="font-bold text-tsia-green">{formatNgn(deal.monthlyTenantPayment)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Lease Duration</span><span>{applyProp.leasePeriodYears} years</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total Payable</span><span>{formatNgn(deal.totalTenantPayable)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Interest Rate</span><span>5% per year</span></div>
                  </div>
                </div>
                <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
                  <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">By applying, you agree to make monthly payments of {formatNgn(deal.monthlyTenantPayment)} for {applyProp.leasePeriodYears} years. Missed payments may result in lease termination.</p>
                </div>
              </div>
            );
          })()}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setApplyProp(null)}>Cancel</Button>
            <Button className="bg-tsia-green hover:bg-tsia-green/90 text-white" onClick={() => applyMutation.mutate(applyProp.id)}
              disabled={applyMutation.isPending} data-testid="button-confirm-lease">
              {applyMutation.isPending ? "Processing..." : "Confirm Lease Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
