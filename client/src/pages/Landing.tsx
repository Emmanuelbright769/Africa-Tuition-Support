import { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { CheckCircle2, ShieldCheck, Wallet, Trophy, ArrowRight, Users, Share2, DollarSign, GraduationCap, Lock, Mail, Phone, MapPin, Globe, Sparkles, Building2, Home, Clock, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo, logoBadgeColor } from "@/components/ui/Logo";

const slides = [
  {
    id: 1,
    title: "Secure Your Academic Future",
    subtitle: "Opening doors for African Students",
    description: "The Tuition Support Initiative for Africa provides up to 70%+ coverage on tuition for verified students. Apply today, verify your identity, and get matched with sponsors.",
    image: "/slide1.jpeg",
    primaryButton: { text: "Apply for Support", link: "/signup" },
    secondaryButton: { text: "Learn More", link: "#how-it-works" }
  },
  {
    id: 2,
    title: "Merit-Based Sponsorship",
    subtitle: "Your Hard Work Pays Off",
    description: "Based on your Academic Performance Matrix (WAEC), you can unlock Platinum, Gold, or Silver tiers, giving you up to $230 in tuition coverage.",
    image: "/slide2.jpeg",
    primaryButton: { text: "Create an Account", link: "/signup" },
    secondaryButton: { text: "Log in", link: "/login" }
  },
  {
    id: 3,
    title: "Earn by Referring Students",
    subtitle: "Affiliate Program",
    description: "Share your unique referral code with fellow students. Earn commission for every verified student you refer to the TSIA platform.",
    image: "/slide3.jpeg",
    primaryButton: { text: "Join as Affiliate", link: "/affiliate-signup" },
    secondaryButton: { text: "Learn More", link: "#affiliate" }
  }
];

export default function Landing() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [openHowSteps, setOpenHowSteps] = useState<Set<number>>(new Set());
  const [openAffSteps, setOpenAffSteps] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const toggleHow = (i: number) => setOpenHowSteps(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });
  const toggleAff = (i: number) => setOpenAffSteps(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen flex flex-col font-sans">
      <Navbar />
      
      <main className="flex-1">
        <section className="relative h-[85vh] overflow-hidden bg-slate-900 flex items-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 1, ease: "easeInOut" }}
              className="absolute inset-0"
            >
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${slides[currentSlide].image})` }}></div>
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]"></div>
            </motion.div>
          </AnimatePresence>

          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl mx-auto text-center space-y-8">
              <AnimatePresence mode="wait">
                <motion.div key={currentSlide} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.5, delay: 0.2 }}>
                  <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 backdrop-blur-md px-3 py-1 text-xs font-semibold text-white mb-6">
                    {slides[currentSlide].subtitle}
                  </div>
                  <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white leading-tight mb-6 drop-shadow-sm">
                    {slides[currentSlide].title}
                  </h1>
                  <p className="text-xl text-slate-200 leading-relaxed max-w-2xl mx-auto mb-10 drop-shadow-sm">
                    {slides[currentSlide].description}
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link href={slides[currentSlide].primaryButton.link}>
                      <Button size="lg" className="bg-tsia-green hover:bg-tsia-green/90 text-white w-full sm:w-auto h-14 px-8 text-base shadow-lg shadow-tsia-green/20 border-0">
                        {slides[currentSlide].primaryButton.text} <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                    </Link>
                    {slides[currentSlide].secondaryButton.link.startsWith('#') ? (
                      <a href={slides[currentSlide].secondaryButton.link}>
                        <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-base border-white text-slate-900 bg-white hover:bg-white/90">
                          {slides[currentSlide].secondaryButton.text}
                        </Button>
                      </a>
                    ) : (
                      <Link href={slides[currentSlide].secondaryButton.link}>
                        <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-base border-white text-slate-900 bg-white hover:bg-white/90">
                          {slides[currentSlide].secondaryButton.text}
                        </Button>
                      </Link>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-3 z-20">
            {slides.map((_, index) => (
              <button key={index} onClick={() => setCurrentSlide(index)}
                className={`w-12 h-1.5 rounded-full transition-all duration-300 ${currentSlide === index ? "bg-tsia-green w-20" : "bg-white/30 hover:bg-white/50"}`}
              />
            ))}
          </div>
        </section>

        {/* ── Explore Dropdown Toggle ───────────────────────────── */}
        <div className="bg-gradient-to-r from-tsia-green/5 via-tsia-gold/5 to-tsia-green/5 border-y border-border">
          <button
            onClick={() => setShowAll(p => !p)}
            data-testid="btn-explore-platform"
            className="w-full py-5 px-6 flex items-center justify-center gap-3 hover:bg-tsia-green/5 transition-colors group"
          >
            <div className="flex flex-col items-center gap-1">
              <span className="text-lg font-bold text-foreground group-hover:text-tsia-green transition-colors">
                {showAll ? "Hide Platform Details" : "Explore the TSIA Platform"}
              </span>
              <span className="text-xs text-muted-foreground">
                {showAll ? "Collapse this section" : "How it works · Affiliate · Plans · MSc · Tenancy · About"}
              </span>
            </div>
            <ChevronDown className={`w-6 h-6 text-tsia-green transition-transform duration-300 ${showAll ? "rotate-180" : ""}`} />
          </button>
        </div>

        <AnimatePresence>
          {showAll && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="overflow-hidden"
            >

        <section id="how-it-works" className="py-24 bg-card">
          <div className="container mx-auto px-4">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4">The Path to Sponsorship</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">A transparent, merit-based system designed to support dedicated students across Africa.</p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                { icon: ShieldCheck, title: "1. Verify Identity", desc: "Register with your NIN, complete biometric face verification, and upload your government-issued ID.", color: "text-tsia-green", bg: "bg-tsia-green/10" },
                { icon: Trophy, title: "2. WAEC Validation", desc: "Submit your WAEC grades verified via the WAEC API. 75%+ = Platinum ($225–$230), 60–74% = Gold ($160–$180), 50–59% = Silver ($110–$130).", color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30" },
                { icon: Wallet, title: "3. Get Funded", desc: "Pay a $3 verification fee, choose your plan, and funds arrive in your digital wallet within 24–48 hours.", color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30" }
              ].map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.2 }}
                  className="relative flex flex-col items-center text-center p-6 rounded-2xl border border-border bg-card hover:bg-accent/40 transition-colors"
                >
                  <div className={`w-16 h-16 rounded-2xl ${s.bg} ${s.color} flex items-center justify-center mb-3`}>
                    <s.icon className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">{s.title}</h3>
                  <button
                    onClick={() => toggleHow(i)}
                    className={`flex items-center gap-1 text-xs font-medium mt-1 transition-colors ${openHowSteps.has(i) ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {openHowSteps.has(i) ? "Hide details" : "Show details"}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openHowSteps.has(i) ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {openHowSteps.has(i) && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="text-muted-foreground text-sm leading-relaxed mt-3 overflow-hidden"
                      >
                        {s.desc}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="affiliate" className="py-24 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyNTI1MjUiIGZpbGwtb3BhY2l0eT0iMC4wNCI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTRWMjhIMjR2Mmh' + 'xMnptMC00VjI0SDI0djJoMTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30"></div>
          <div className="container mx-auto px-4 relative z-10">
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
              <div className="inline-flex items-center rounded-full border border-tsia-gold/30 bg-tsia-gold/10 px-4 py-1.5 text-sm font-bold text-tsia-gold mb-6">
                <Sparkles className="w-4 h-4 mr-2" /> Earn While You Refer
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-4">Affiliate Program</h2>
              <p className="text-xl text-slate-300 max-w-2xl mx-auto">Turn your network into income. Refer students to TSIA and earn commission on every verified referral.</p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16">
              {[
                { icon: Share2, title: "Share Your Code", desc: "Get your unique referral code when you sign up. Share it on social media, WhatsApp, or directly with friends.", amount: "Step 1" },
                { icon: Users, title: "Friends Sign Up", desc: "When someone uses your code to register and complete their verification, they are linked to your account.", amount: "Step 2" },
                { icon: DollarSign, title: "Earn Commission", desc: "For every verified referral, you earn a commission paid directly into your TSIA digital wallet.", amount: "Step 3" },
              ].map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all hover:border-tsia-gold/30 group"
                >
                  <div className="flex items-center gap-4 mb-2">
                    <div className="w-12 h-12 bg-tsia-gold/20 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <item.icon className="w-6 h-6 text-tsia-gold" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-tsia-gold uppercase tracking-widest">{item.amount}</div>
                      <h3 className="text-base font-bold text-white leading-tight">{item.title}</h3>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleAff(i)}
                    className={`flex items-center gap-1 text-xs font-medium mt-2 transition-colors ${openAffSteps.has(i) ? 'text-tsia-gold' : 'text-slate-400 hover:text-tsia-gold'}`}
                  >
                    {openAffSteps.has(i) ? "Hide details" : "Show details"}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openAffSteps.has(i) ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {openAffSteps.has(i) && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="text-slate-400 text-sm leading-relaxed mt-3 overflow-hidden"
                      >
                        {item.desc}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="max-w-2xl mx-auto bg-gradient-to-r from-tsia-gold/20 to-amber-600/20 border border-tsia-gold/30 rounded-2xl p-8 text-center"
            >
              <h3 className="text-2xl font-bold mb-3">Ready to Start Earning?</h3>
              <p className="text-slate-300 mb-6">Sign up for free and get your affiliate code instantly. No minimum requirements to start referring.</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/affiliate-signup">
                  <Button size="lg" className="bg-tsia-gold hover:bg-tsia-gold/90 text-slate-900 h-12 px-8 font-bold">
                    Join Affiliate Program <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 h-12 px-8">
                    Already a Member? Log In
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="plans" className="py-24 bg-background">
          <div className="container mx-auto px-4">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4">Swift-Pay Plans</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Choose the commitment that fits your academic journey. We cover 70%+ of typical tuition costs.</p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {[
                { years: 1, price: 35, payout: 230, coverage: "~85%", desc: "Ideal for final-year students or those needing focused short-term support.", features: ["Up to $230 payout/year", "Digital Wallet access", "Standard support", "~85% academic cost covered"] },
                { years: 2, price: 45, payout: 460, coverage: "~90%", desc: "Designed for mid-degree students seeking stable, ongoing academic funding.", features: ["Up to $460 total payout", "Digital Wallet access", "Priority review", "~90% academic cost covered"], popular: true },
                { years: 3, price: 50, payout: 690, coverage: "~92%", desc: "Maximum coverage for students entering full degree programmes.", features: ["Up to $690 total payout", "Digital Wallet access", "Dedicated academic advisor", "~92% academic cost covered"] },
              ].map((p, i) => (
                <motion.div key={i} whileHover={{ y: -5 }}
                  className={`bg-card rounded-3xl p-8 flex flex-col hover:shadow-xl transition-all ${p.popular ? 'shadow-2xl border-2 border-primary relative md:-translate-y-4' : 'shadow-sm border'}`}
                >
                  {p.popular && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-tsia-green text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-sm">
                      Most popular
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-2xl font-semibold">{p.years}-Year Commitment</h3>
                    <span className="text-xs font-bold bg-tsia-green/10 text-tsia-green border border-tsia-green/20 rounded-full px-2.5 py-1">{p.coverage} sponsored</span>
                  </div>
                  <div className="mb-1">
                    <span className="text-4xl font-bold">${p.price}</span>
                    <span className="text-muted-foreground">/year</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-6">₦{(p.price * 1460).toLocaleString()}/year</p>
                  <p className="text-muted-foreground mb-8 flex-1">{p.desc}</p>
                  <div className="space-y-4 mb-8">
                    {p.features.map((f, j) => (
                      <div key={j} className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-tsia-green" />
                        <span className={p.popular && j === 0 ? "font-semibold" : ""}>{f}</span>
                      </div>
                    ))}
                  </div>
                  <Link href="/signup">
                    <Button className={`w-full h-12 text-base ${p.popular ? 'bg-tsia-green text-white hover:bg-tsia-green/90' : ''}`} variant={p.popular ? 'default' : 'outline'}>Select plan</Button>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="msc" className="py-24 bg-card border-y">
          <div className="container mx-auto px-4">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center rounded-full border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/30 px-4 py-1.5 text-sm font-bold text-purple-700 dark:text-purple-300 mb-6">
                <GraduationCap className="w-4 h-4 mr-2" /> Postgraduate Program
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-4">Masters (MSc) Sponsorship</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
                Continuing your education to the postgraduate level? TSIA is expanding to support Masters degree students across Africa.
              </p>

              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 rounded-3xl p-12 relative overflow-hidden">
                <div className="absolute top-4 right-4 bg-purple-600 text-white text-xs font-bold uppercase tracking-wider px-4 py-1.5 rounded-full shadow-md">
                  Coming Soon
                </div>
                <GraduationCap className="w-20 h-20 text-purple-500 mx-auto mb-6" />
                <h3 className="text-3xl font-bold mb-4 text-purple-900 dark:text-purple-200">MSc Support Program</h3>
                <p className="text-purple-700 dark:text-purple-300 max-w-lg mx-auto mb-8 leading-relaxed">
                  We are developing a comprehensive sponsorship pathway for postgraduate students pursuing their Masters degrees at accredited African and international universities.
                </p>
                <div className="grid sm:grid-cols-3 gap-6 max-w-lg mx-auto mb-8">
                  {[
                    { label: "Research Grants", value: "Available" },
                    { label: "Tuition Coverage", value: "Up to 80%" },
                    { label: "Duration", value: "2 Years" },
                  ].map((item, i) => (
                    <div key={i} className="text-center">
                      <div className="text-xl font-bold text-purple-600 dark:text-purple-400">{item.value}</div>
                      <div className="text-xs text-purple-500 dark:text-purple-400 font-medium uppercase tracking-wider">{item.label}</div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <div className="relative">
                    <Input placeholder="Enter your email for early access" className="h-12 w-64 sm:w-80 pr-4 bg-white dark:bg-slate-800 border-purple-200 dark:border-purple-700" disabled data-testid="input-msc-email" />
                  </div>
                  <Button className="bg-purple-600 hover:bg-purple-700 text-white h-12 px-6 cursor-not-allowed opacity-70" disabled>
                    <Lock className="w-4 h-4 mr-2" /> Notify Me When Available
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Tenancy Section */}
        <section id="tenancy" className="py-24 bg-background">
          <div className="container mx-auto px-4">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
              <div className="inline-flex items-center gap-2 bg-tsia-green/10 text-tsia-green px-4 py-1.5 rounded-full text-sm font-bold mb-4">
                <Home className="w-4 h-4" /> TSIA Tenancy Programme
              </div>
              <h2 className="text-4xl font-bold mb-4">Housing Made Affordable</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">No more massive annual rent payments. TSIA pays your landlord upfront so you pay in small monthly installments.</p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-12">
              {[
                { icon: Building2, color: "text-tsia-green", bg: "bg-tsia-green/10", title: "Landlords: Get Paid Upfront", desc: "List your property and receive a lump-sum payment covering years of rent. TSIA handles all tenant management." },
                { icon: Clock, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30", title: "Tenants: Pay Monthly", desc: "Rent a quality home and pay in small monthly installments instead of one huge annual payment. Just 5% interest." },
                { icon: CheckCircle2, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30", title: "TSIA Guarantees Everyone", desc: "Landlords are guaranteed their money. Tenants are guaranteed a home. TSIA manages the trust layer between both parties." },
              ].map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}
                  className="flex flex-col items-center text-center space-y-4 p-6 rounded-2xl hover:bg-accent/50 transition-colors">
                  <div className={`w-20 h-20 rounded-2xl ${item.bg} ${item.color} flex items-center justify-center`}>
                    <item.icon className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-semibold">{item.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center">
              <Link href="/tenancy">
                <Button size="lg" className="bg-tsia-green hover:bg-tsia-green/90 text-white h-14 px-8 text-base font-semibold rounded-xl" data-testid="button-explore-tenancy">
                  Explore Tenancy Programme <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        <section id="about-preview" className="py-24 bg-card border-t">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
              <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                <h2 className="text-4xl font-bold mb-6">About TSIA</h2>
                <p className="text-lg text-muted-foreground leading-relaxed mb-4">
                  The Tuition Support Initiative for Africa (TSIA) is a sophisticated financial ecosystem built on the principle of <em>Educational Audacity</em> — the belief that knowledge should be the only requirement for success, not capital.
                </p>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  A primary subsidiary of <strong>SMAKEMGGOLD Ltd</strong> (RC: 1359954), an established brand in credit, loans, and investments since 2016, TSIA leverages a <strong>$150 Million international fund</strong> provided by partners in the United Kingdom and Turkey to sponsor verified students across Africa.
                </p>
                <p className="text-muted-foreground leading-relaxed mb-8">
                  Our circular economy model connects student sponsorship, affiliate participation, and global crypto trading — ensuring long-term sustainability and accountability through quarterly Reserve Fund reporting.
                </p>
                <div className="grid grid-cols-2 gap-6 mb-8">
                  {[
                    { value: "1,000+", label: "Students Supported" },
                    { value: "$150M", label: "Partner Fund" },
                    { value: "15+", label: "African Countries" },
                    { value: "24-48hrs", label: "Payout Speed" },
                  ].map((stat, i) => (
                    <div key={i}>
                      <div className="text-2xl font-bold text-primary">{stat.value}</div>
                      <div className="text-sm text-muted-foreground">{stat.label}</div>
                    </div>
                  ))}
                </div>
                <Link href="/about">
                  <Button variant="outline" size="lg" className="h-12 px-8">
                    Learn More About Us <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
              </motion.div>
              <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                className="relative"
              >
                <div className="bg-gradient-to-br from-primary/10 via-tsia-gold/10 to-primary/5 rounded-3xl p-8 border">
                  <img src={logoBadgeColor} alt="TSIA Badge" className="w-48 h-48 mx-auto mb-6 drop-shadow-lg" />
                  <div className="text-center space-y-3">
                    <h3 className="text-xl font-bold">Our Mission</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      To empower every academically qualified African student with the financial support they need to achieve their educational dreams, regardless of economic background.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

            </motion.div>
          )}
        </AnimatePresence>

        <section id="contact-preview" className="py-24 bg-card border-t">
          <div className="container mx-auto px-4 text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="text-4xl font-bold mb-4">Get in Touch</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-12">Have questions about TSIA? Our team is ready to assist you on your sponsorship journey.</p>
              <div className="grid sm:grid-cols-3 gap-8 max-w-3xl mx-auto mb-12">
                {[
                  { icon: Mail, title: "Email Us", detail: "support@tsia.africa", sub: "Response within 24hrs" },
                  { icon: Phone, title: "Call / WhatsApp", detail: "+447552647146", sub: "Mon - Fri, 9am - 5pm GMT" },
                  { icon: MapPin, title: "Visit Us", detail: "London, United Kingdom", sub: "Head Office" },
                ].map((item, i) => (
                  <div key={i} className="p-6 rounded-2xl bg-background border hover:shadow-lg transition-shadow">
                    <item.icon className="w-8 h-8 text-primary mx-auto mb-4" />
                    <h4 className="font-bold mb-1">{item.title}</h4>
                    <p className="text-sm font-medium text-primary">{item.detail}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.sub}</p>
                  </div>
                ))}
              </div>
              <Link href="/contact">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-8">
                  Send Us a Message <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </motion.div>
  );
}
