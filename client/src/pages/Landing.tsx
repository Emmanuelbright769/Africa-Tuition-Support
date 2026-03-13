import { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { CheckCircle2, ShieldCheck, Wallet, Trophy, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
    description: "Based on your Academic Performance Matrix (WAEC), you can unlock Platinum, Gold, or Silver tiers, giving you up to $690 in tuition coverage annually.",
    image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2071&auto=format&fit=crop",
    primaryButton: { text: "Create an Account", link: "/signup" },
    secondaryButton: { text: "Log in", link: "/login" }
  },
  {
    id: 3,
    title: "Instant Digital Wallet Payouts",
    subtitle: "Fast, Transparent Funding",
    description: "Once your sponsorship is approved, funds are deposited directly into your digital wallet within 24-48 hours. Withdraw straight to your local bank account.",
    image: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=2070&auto=format&fit=crop",
    primaryButton: { text: "Get Started", link: "/signup" },
    secondaryButton: { text: "Learn More", link: "#how-it-works" }
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
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex flex-col font-sans"
    >
      <Navbar />
      
      <main className="flex-1">
        {/* Full-screen Carousel Hero */}
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
              <div 
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${slides[currentSlide].image})` }}
              ></div>
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]"></div>
            </motion.div>
          </AnimatePresence>

          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl mx-auto text-center space-y-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSlide}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
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

          {/* Carousel Indicators */}
          <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-3 z-20">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-12 h-1.5 rounded-full transition-all duration-300 ${
                  currentSlide === index ? "bg-tsia-green w-20" : "bg-white/30 hover:bg-white/50"
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </section>

        {/* How it Works */}
        <section id="how-it-works" className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl font-bold text-slate-900 mb-4">The Path to Sponsorship</h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">A transparent, merit-based system designed to support dedicated students across Africa.</p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-12 max-w-5xl mx-auto">
              {[
                { icon: ShieldCheck, title: "1. Verify Identity", desc: "Register with your NIN, phone number, and WAEC details. A nominal $3 portal fee ensures commitment.", color: "text-tsia-green", bg: "bg-tsia-green/10" },
                { icon: Trophy, title: "2. Academic Tiering", desc: "Your WAEC scores determine your tier (Platinum, Gold, Silver), unlocking different funding limits.", color: "text-amber-600", bg: "bg-amber-100" },
                { icon: Wallet, title: "3. Get Funded", desc: "Choose a 1, 2, or 3-year plan. Once approved, funds arrive in your digital wallet within 24-48 hours.", color: "text-blue-600", bg: "bg-blue-100" }
              ].map((step, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.2 }}
                  className="relative flex flex-col items-center text-center space-y-4 p-6 rounded-2xl hover:bg-slate-50 transition-colors"
                >
                  <div className={`w-20 h-20 rounded-2xl ${step.bg} ${step.color} flex items-center justify-center mb-2`}>
                    <step.icon className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-semibold">{step.title}</h3>
                  <p className="text-slate-600 leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Subscription Plans */}
        <section className="py-24 bg-slate-50">
          <div className="container mx-auto px-4">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl font-bold text-slate-900 mb-4">Sponsorship Plans</h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">Choose the commitment that fits your academic journey. We cover 70%+ of typical tuition costs.</p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {/* 1 Year Plan */}
              <motion.div 
                whileHover={{ y: -5 }}
                className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col hover:shadow-xl transition-all"
              >
                <h3 className="text-2xl font-semibold mb-2">1 Year Commitment</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold">$35</span>
                  <span className="text-slate-500">/year</span>
                </div>
                <p className="text-slate-600 mb-8 flex-1">Perfect for final year students or those needing short-term support.</p>
                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-tsia-green" />
                    <span className="text-slate-700">Up to $230 payout</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-tsia-green" />
                    <span className="text-slate-700">Digital Wallet access</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-tsia-green" />
                    <span className="text-slate-700">Standard support</span>
                  </div>
                </div>
                <Link href="/signup">
                  <Button className="w-full bg-slate-900 text-white hover:bg-slate-800 h-12 text-base">Select Plan</Button>
                </Link>
              </motion.div>

              {/* 2 Year Plan */}
              <motion.div 
                whileHover={{ y: -5 }}
                className="bg-white rounded-3xl p-8 shadow-2xl border-2 border-tsia-green relative flex flex-col md:-translate-y-4"
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-tsia-green text-white px-4 py-1.5 rounded-full text-sm font-bold tracking-wide shadow-sm">
                  MOST POPULAR
                </div>
                <h3 className="text-2xl font-semibold mb-2 mt-2">2 Year Commitment</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold">$45</span>
                  <span className="text-slate-500">/year</span>
                </div>
                <p className="text-slate-600 mb-8 flex-1">Ideal for mid-degree students looking for stable, ongoing funding.</p>
                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-tsia-green" />
                    <span className="text-slate-900 font-semibold">Up to $460 payout</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-tsia-green" />
                    <span className="text-slate-700">Digital Wallet access</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-tsia-green" />
                    <span className="text-slate-700">Priority review</span>
                  </div>
                </div>
                <Link href="/signup">
                  <Button className="w-full bg-tsia-green text-white hover:bg-tsia-green/90 h-12 text-base">Select Plan</Button>
                </Link>
              </motion.div>

              {/* 3 Year Plan */}
              <motion.div 
                whileHover={{ y: -5 }}
                className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col hover:shadow-xl transition-all"
              >
                <h3 className="text-2xl font-semibold mb-2">3 Year Commitment</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold">$50</span>
                  <span className="text-slate-500">/year</span>
                </div>
                <p className="text-slate-600 mb-8 flex-1">Maximum coverage for new students entering their degree programs.</p>
                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-tsia-green" />
                    <span className="text-slate-700">Up to $690 payout</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-tsia-green" />
                    <span className="text-slate-700">Digital Wallet access</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-tsia-green" />
                    <span className="text-slate-700">Dedicated academic advisor</span>
                  </div>
                </div>
                <Link href="/signup">
                  <Button className="w-full bg-slate-900 text-white hover:bg-slate-800 h-12 text-base">Select Plan</Button>
                </Link>
              </motion.div>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </motion.div>
  );
}