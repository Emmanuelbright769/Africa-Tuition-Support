import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { CheckCircle2, GraduationCap, ArrowRight, ShieldCheck, Wallet, Trophy } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-slate-50 pt-20 pb-32">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-5"></div>
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl mx-auto text-center space-y-8">
              <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                Opening doors for African Students
              </div>
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-slate-900 leading-tight">
                Secure Your Academic Future with <span className="text-tsia-green">TSIA</span>
              </h1>
              <p className="text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
                The Tuition Support Initiative for Africa provides up to 70%+ coverage on tuition for verified students. Apply today, verify your identity, and get matched with sponsors.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <Link href="/signup">
                  <Button size="lg" className="bg-tsia-green hover:bg-tsia-green/90 text-white w-full sm:w-auto h-14 px-8 text-base">
                    Apply for Support <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/leadership">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-base border-slate-300 text-slate-700">
                    Become a Sponsor
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">The Path to Sponsorship</h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">A transparent, merit-based system designed to support dedicated students across Africa.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-12 max-w-5xl mx-auto">
              {/* Step 1 */}
              <div className="relative flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-tsia-green/10 text-tsia-green flex items-center justify-center mb-2">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-semibold">1. Verify Identity</h3>
                <p className="text-slate-600">Register with your NIN, phone number, and WAEC details. A nominal $3 portal fee ensures commitment.</p>
              </div>

              {/* Step 2 */}
              <div className="relative flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-tsia-gold/20 text-yellow-700 flex items-center justify-center mb-2">
                  <Trophy className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-semibold">2. Academic Tiering</h3>
                <p className="text-slate-600">Your WAEC scores determine your tier (Platinum, Gold, Silver), unlocking different funding limits.</p>
              </div>

              {/* Step 3 */}
              <div className="relative flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center mb-2">
                  <Wallet className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-semibold">3. Get Funded</h3>
                <p className="text-slate-600">Choose a 1, 2, or 3-year plan. Once approved, funds arrive in your digital wallet within 24-48 hours.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Subscription Plans */}
        <section className="py-24 bg-slate-50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Sponsorship Plans</h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">Choose the commitment that fits your academic journey. We cover 70%+ of typical tuition costs.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {/* 1 Year Plan */}
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col">
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
                  <Button className="w-full bg-slate-900 text-white hover:bg-slate-800">Select Plan</Button>
                </Link>
              </div>

              {/* 2 Year Plan */}
              <div className="bg-white rounded-3xl p-8 shadow-xl border-2 border-tsia-green relative flex flex-col transform md:-translate-y-4">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-tsia-green text-white px-4 py-1 rounded-full text-sm font-medium">
                  Most Popular
                </div>
                <h3 className="text-2xl font-semibold mb-2">2 Year Commitment</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold">$45</span>
                  <span className="text-slate-500">/year</span>
                </div>
                <p className="text-slate-600 mb-8 flex-1">Ideal for mid-degree students looking for stable, ongoing funding.</p>
                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-tsia-green" />
                    <span className="text-slate-700 font-medium">Up to $460 payout</span>
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
                  <Button className="w-full bg-tsia-green text-white hover:bg-tsia-green/90">Select Plan</Button>
                </Link>
              </div>

              {/* 3 Year Plan */}
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col">
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
                  <Button className="w-full bg-slate-900 text-white hover:bg-slate-800">Select Plan</Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}