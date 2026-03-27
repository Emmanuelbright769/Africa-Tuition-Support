import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Logo, logoBadgeColor } from "@/components/ui/Logo";
import { CheckCircle2, Globe, Heart, Shield, Users, Target, BookOpen, Building2, TrendingUp, Award } from "lucide-react";
import { motion } from "framer-motion";

export default function AboutUs() {
  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />
      <main className="flex-1">
        <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-tsia-green/10 to-transparent"></div>
          <div className="container mx-auto px-4 relative z-10 text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <img src={logoBadgeColor} alt="TSIA" className="w-24 h-24 mx-auto mb-8 drop-shadow-2xl" />
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">About TSIA</h1>
              <p className="text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
                The Tuition Support Initiative for Africa is a revolutionary merit-based funding platform built to empower the next generation of African leaders through education.
              </p>
            </motion.div>
          </div>
        </section>

        <section className="py-20 bg-background">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="grid md:grid-cols-2 gap-16 items-center">
              <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                <h2 className="text-3xl font-bold mb-6">Our story</h2>
                <div className="space-y-4 text-muted-foreground leading-relaxed">
                  <p>
                    TSIA was born from a simple but powerful observation: thousands of academically gifted students across Africa are unable to pursue higher education due to financial constraints.
                  </p>
                  <p>
                    A primary subsidiary of <strong className="text-foreground">SMAKEMGGOLD Ltd</strong> (RC: 1359954) — an established brand in credit, loans, and investments since 2016 — TSIA was built to operate on the principle of <em>Educational Audacity</em>: the belief that knowledge should be the only requirement for success, not capital.
                  </p>
                  <p>
                    Backed by a <strong className="text-foreground">$150 Million international fund</strong> from strategic partners in the <strong className="text-foreground">United Kingdom and Turkey</strong>, TSIA operates a circular financial ecosystem that funds student education through global trading, affiliate participation, and a structured co-funding model.
                  </p>
                  <p>
                    Our platform uses West African Examinations Council (WAEC) results as a standardised measure of academic merit, ensuring every student is evaluated fairly and consistently — with no bias, no favouritism, and full transparency.
                  </p>
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                <div className="grid grid-cols-2 gap-6">
                  {[
                    { value: "1,000+", label: "Students Funded", icon: Users },
                    { value: "$150M", label: "Partner Fund", icon: Target },
                    { value: "15+", label: "Countries Reached", icon: Globe },
                    { value: "Since 2016", label: "Parent Company Est.", icon: Building2 },
                  ].map((stat, i) => (
                    <div key={i} className="bg-card rounded-2xl p-6 border text-center hover:shadow-lg transition-shadow">
                      <stat.icon className="w-8 h-8 text-primary mx-auto mb-3" />
                      <div className="text-3xl font-bold text-primary mb-1">{stat.value}</div>
                      <div className="text-sm text-muted-foreground font-medium">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <section className="py-20 bg-card border-y">
          <div className="container mx-auto px-4 max-w-5xl">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">Our Core Values</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Everything we do is guided by these fundamental principles.</p>
            </motion.div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: Shield, title: "Transparency", desc: "Every transaction, verification, and disbursement is fully transparent. Students and sponsors can track funds in real-time through our digital wallet system." },
                { icon: Heart, title: "Merit-Based", desc: "Our WAEC-based scoring ensures that funding goes to students who have demonstrated academic commitment. No bias, no favoritism, just verified results." },
                { icon: BookOpen, title: "Empowerment", desc: "We don't just fund education, we empower students with digital financial tools, affiliate earning opportunities, and a supportive community." },
              ].map((value, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}
                  className="p-8 rounded-2xl bg-background border hover:shadow-lg transition-shadow text-center"
                >
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <value.icon className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{value.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{value.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 bg-background">
          <div className="container mx-auto px-4 max-w-5xl">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">How We Ensure Quality</h2>
            </motion.div>
            <div className="space-y-6 max-w-3xl mx-auto">
              {[
                { title: "WAEC API verification", desc: "All student results are cross-referenced with the WAEC database to ensure authenticity and prevent fraud." },
                { title: "Biometric face scan", desc: "Facial recognition prevents fraudulent applications and confirms every applicant is a real, enrolled student." },
                { title: "NIN identity check", desc: "National Identification Number verification confirms the identity of every applicant before processing." },
                { title: "Admin review — 24–48hr SLA", desc: "Every application undergoes manual review by our trained verification team within 24 to 48 working hours." },
                { title: "Digital wallet security", desc: "Funds are secured in individual digital wallets with full transaction history and 7.5% VAT compliance on withdrawals." },
                { title: "NDPR compliant", desc: "TSIA operates in full compliance with the Nigeria Data Protection Regulation (NDPR), safeguarding all student and affiliate data." },
                { title: "Quarterly reserve fund reporting", desc: "Our 20% Reserve Fund is reported quarterly to all stakeholders, providing full visibility into the safety net protecting the ecosystem." },
              ].map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                  className="flex items-start gap-4 p-6 rounded-xl bg-card border hover:shadow-md transition-shadow"
                >
                  <CheckCircle2 className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold mb-1">{item.title}</h4>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Strategic Development Reserve */}
        <section className="py-20 bg-gradient-to-br from-tsia-green/5 to-tsia-gold/5 border-t">
          <div className="container mx-auto px-4 max-w-4xl">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
              <div className="inline-flex items-center gap-2 bg-tsia-gold/10 border border-tsia-gold/30 text-tsia-gold rounded-full px-4 py-1.5 text-sm font-semibold mb-5">
                <Award className="w-4 h-4" /> For Top Scholars
              </div>
              <h2 className="text-3xl font-bold mb-4">$150,000 Strategic Development Reserve</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Beyond standard tuition sponsorship, TSIA maintains a shared credit pool of <strong>$150,000.00</strong> exclusively accessible to our most engaged scholars — those who maintain high academic performance, actively use the digital wallet, and participate in the affiliate network.
              </p>
            </motion.div>
            <div className="grid sm:grid-cols-3 gap-6">
              {[
                { icon: BookOpen, title: "Postgraduate research", desc: "Fund doctoral studies or post-graduate academic research at accredited institutions." },
                { icon: TrendingUp, title: "Entrepreneurial ventures", desc: "Access seed capital for startups built by top-performing graduates within the TSIA ecosystem." },
                { icon: Globe, title: "International programmes", desc: "Pursue doctoral studies or fellowships at universities in the UK, Turkey, and beyond." },
              ].map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className="bg-card rounded-2xl p-6 border hover:shadow-lg transition-shadow text-center"
                >
                  <div className="w-12 h-12 bg-tsia-green/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <item.icon className="w-6 h-6 text-tsia-green" />
                  </div>
                  <h4 className="font-bold mb-2">{item.title}</h4>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Legal & Governance */}
        <section className="py-16 bg-slate-950 text-slate-200">
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="text-2xl font-bold mb-3 text-white">Regulatory &amp; legal governance</h2>
              <p className="text-slate-400 mb-8 max-w-2xl mx-auto">TSIA operates under established Nigerian corporate law and international financial compliance frameworks.</p>
              <div className="grid sm:grid-cols-3 gap-6 text-sm">
                {[
                  { label: "Parent company", value: "SMAKEMGGOLD Ltd", sub: "RC: 1359954 · Est. 2016" },
                  { label: "Data compliance", value: "NDPR Compliant", sub: "Nigeria Data Protection Regulation" },
                  { label: "International partners", value: "UK & Turkey", sub: "$150M strategic fund" },
                ].map((g, i) => (
                  <div key={i} className="bg-slate-900 rounded-xl p-5 border border-slate-800">
                    <p className="text-slate-400 text-xs mb-1">{g.label}</p>
                    <p className="font-bold text-white">{g.value}</p>
                    <p className="text-slate-500 text-xs mt-1">{g.sub}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
