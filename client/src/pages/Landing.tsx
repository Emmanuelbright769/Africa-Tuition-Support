import { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { CheckCircle2, ShieldCheck, Wallet, Trophy, ArrowRight, Users, Share2, DollarSign, GraduationCap, Lock, Mail, Phone, MapPin, Globe, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo, logoBadgeColor } from "@/components/ui/Logo";

const slides = [
  {
    id: 1,
    title: "Secure Your Academic Future",
    subtitle: "Opening doors for African Students",
    description: "The Tuition Support Initiative for Africa provides up to 70%+ coverage on tuition for verified students. Apply today, verify your identity, and get matched with sponsors.",
    image: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=2070&auto=format&fit=crop",
    primaryButton: { text: "Apply for Support", link: "/signup" },
    secondaryButton: { text: "Learn More", link: "#how-it-works" }
  },
  {
    id: 2,
    title: "Merit-Based Sponsorship",
    subtitle: "Your Hard Work Pays Off",
    description: "Based on your Academic Performance Matrix (WAEC), you can unlock Platinum, Gold, or Silver tiers, giving you up to $230 in tuition coverage.",
    image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2071&auto=format&fit=crop",
    primaryButton: { text: "Create an Account", link: "/signup" },
    secondaryButton: { text: "Log in", link: "/login" }
  },
  {
    id: 3,
    title: "Earn by Referring Students",
    subtitle: "TSIA Affiliate Program",
    description: "Share your unique referral code with fellow students. Earn commission for every verified student you refer to the TSIA platform.",
    image: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=2070&auto=format&fit=crop",
    primaryButton: { text: "Join as Affiliate", link: "/affiliate-signup" },
    secondaryButton: { text: "Learn More", link: "#affiliate" }
  }
];

export default function Landing() {
  const [currentSlide, setCurrentSlide] = useState(0);

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

        <section id="how-it-works" className="py-24 bg-card">
          <div className="container mx-auto px-4">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4">The Path to Sponsorship</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">A transparent, merit-based system designed to support dedicated students across Africa.</p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-12 max-w-5xl mx-auto">
              {[
                { icon: ShieldCheck, title: "1. Verify Identity", desc: "Register with your NIN, complete biometric face verification, and upload your government-issued ID.", color: "text-tsia-green", bg: "bg-tsia-green/10" },
                { icon: Trophy, title: "2. WAEC Validation", desc: "Submit your WAEC grades verified via the WAEC API. 75%+ = Platinum ($225-$230), 60-74% = Gold ($160-$180), 50-59% = Silver ($110-$130).", color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30" },
                { icon: Wallet, title: "3. Get Funded", desc: "Pay a $3 verification fee, choose your plan, and funds arrive in your digital wallet within 24-48 hours.", color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30" }
              ].map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.2 }}
                  className="relative flex flex-col items-center text-center space-y-4 p-6 rounded-2xl hover:bg-accent/50 transition-colors"
                >
                  <div className={`w-20 h-20 rounded-2xl ${s.bg} ${s.color} flex items-center justify-center mb-2`}>
                    <s.icon className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-semibold">{s.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{s.desc}</p>
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
              <h2 className="text-4xl md:text-5xl font-bold mb-4">TSIA Affiliate Program</h2>
              <p className="text-xl text-slate-300 max-w-2xl mx-auto">Turn your network into income. Refer students to TSIA and earn commission on every verified referral.</p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
              {[
                { icon: Share2, title: "Share Your Code", desc: "Get your unique referral code when you sign up. Share it on social media, WhatsApp, or directly with friends.", amount: "Step 1" },
                { icon: Users, title: "Friends Sign Up", desc: "When someone uses your code to register and complete their verification, they are linked to your account.", amount: "Step 2" },
                { icon: DollarSign, title: "Earn Commission", desc: "For every verified referral, you earn a commission paid directly into your TSIA digital wallet.", amount: "Step 3" },
              ].map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-all hover:border-tsia-gold/30 group"
                >
                  <div className="w-14 h-14 bg-tsia-gold/20 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    <item.icon className="w-7 h-7 text-tsia-gold" />
                  </div>
                  <div className="text-xs font-bold text-tsia-gold uppercase tracking-widest mb-2">{item.amount}</div>
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{item.desc}</p>
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
              <h2 className="text-4xl font-bold mb-4">Sponsorship Plans</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Choose the commitment that fits your academic journey. We cover 70%+ of typical tuition costs.</p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {[
                { years: 1, price: 35, payout: 230, desc: "Perfect for final year students or those needing short-term support.", features: ["Up to $230 payout", "Digital Wallet access", "Standard support"] },
                { years: 2, price: 45, payout: 460, desc: "Ideal for mid-degree students looking for stable, ongoing funding.", features: ["Up to $460 payout", "Digital Wallet access", "Priority review"], popular: true },
                { years: 3, price: 50, payout: 690, desc: "Maximum coverage for new students entering their degree programs.", features: ["Up to $690 payout", "Digital Wallet access", "Dedicated academic advisor"] },
              ].map((p, i) => (
                <motion.div key={i} whileHover={{ y: -5 }}
                  className={`bg-card rounded-3xl p-8 flex flex-col hover:shadow-xl transition-all ${p.popular ? 'shadow-2xl border-2 border-primary relative md:-translate-y-4' : 'shadow-sm border'}`}
                >
                  {p.popular && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-tsia-green text-white px-4 py-1.5 rounded-full text-sm font-bold tracking-wide shadow-sm">
                      MOST POPULAR
                    </div>
                  )}
                  <h3 className="text-2xl font-semibold mb-2">{p.years} Year Commitment</h3>
                  <div className="mb-1">
                    <span className="text-4xl font-bold">${p.price}</span>
                    <span className="text-muted-foreground">/year</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-6">{'\u20A6'}{(p.price * 1460).toLocaleString()}/year</p>
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
                    <Button className={`w-full h-12 text-base ${p.popular ? 'bg-tsia-green text-white hover:bg-tsia-green/90' : ''}`} variant={p.popular ? 'default' : 'outline'}>Select Plan</Button>
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

        <section id="about-preview" className="py-24 bg-background">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
              <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                <h2 className="text-4xl font-bold mb-6">About TSIA</h2>
                <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                  The Tuition Support Initiative for Africa (TSIA) is a merit-based educational funding platform dedicated to bridging the financial gap for talented African students.
                </p>
                <p className="text-muted-foreground leading-relaxed mb-8">
                  We believe that academic excellence should be rewarded, not hindered by financial limitations. Through our transparent verification system, WAEC-based scoring, and digital wallet infrastructure, we connect deserving students with sponsors who share our vision.
                </p>
                <div className="grid grid-cols-2 gap-6 mb-8">
                  {[
                    { value: "1,000+", label: "Students Supported" },
                    { value: "$150K+", label: "Funds Disbursed" },
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

        <section id="contact-preview" className="py-24 bg-card border-t">
          <div className="container mx-auto px-4 text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="text-4xl font-bold mb-4">Get in Touch</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-12">Have questions about TSIA? Our team is ready to assist you on your sponsorship journey.</p>
              <div className="grid sm:grid-cols-3 gap-8 max-w-3xl mx-auto mb-12">
                {[
                  { icon: Mail, title: "Email Us", detail: "support@tsia.africa", sub: "Response within 24hrs" },
                  { icon: Phone, title: "Call Us", detail: "+234 800 TSIA 000", sub: "Mon - Fri, 9am - 5pm WAT" },
                  { icon: MapPin, title: "Visit Us", detail: "Lagos, Nigeria", sub: "Head Office" },
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
