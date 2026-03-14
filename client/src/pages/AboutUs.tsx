import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Logo, logoBadgeColor } from "@/components/ui/Logo";
import { CheckCircle2, Globe, Heart, Shield, Users, Target, BookOpen } from "lucide-react";
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
                <h2 className="text-3xl font-bold mb-6">Our Story</h2>
                <div className="space-y-4 text-muted-foreground leading-relaxed">
                  <p>
                    TSIA was born from a simple but powerful observation: thousands of academically gifted students across Africa are unable to pursue higher education due to financial constraints.
                  </p>
                  <p>
                    Founded with a vision to create a transparent, merit-based system for educational funding, TSIA leverages technology to connect verified students with sponsors who believe in the transformative power of education.
                  </p>
                  <p>
                    Our platform uses the West African Examinations Council (WAEC) results as a standardized measure of academic merit, ensuring that every student is evaluated fairly and consistently.
                  </p>
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                <div className="grid grid-cols-2 gap-6">
                  {[
                    { value: "1,000+", label: "Students Funded", icon: Users },
                    { value: "$150K+", label: "Total Disbursed", icon: Target },
                    { value: "15+", label: "Countries Reached", icon: Globe },
                    { value: "99.8%", label: "Verification Rate", icon: Shield },
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
                { title: "WAEC API Verification", desc: "All student results are cross-referenced with the WAEC database to ensure authenticity." },
                { title: "Biometric Face Scan", desc: "Advanced facial recognition prevents fraudulent applications and ensures every applicant is a real student." },
                { title: "NIN Identity Check", desc: "National Identification Number verification confirms the identity of every applicant." },
                { title: "Admin Review (24-48hr SLA)", desc: "Every application undergoes manual review by our trained verification team within 24-48 hours." },
                { title: "Digital Wallet Security", desc: "Funds are secured in individual digital wallets with full transaction history and 7.5% VAT compliance." },
              ].map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
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
      </main>
      <Footer />
    </div>
  );
}
