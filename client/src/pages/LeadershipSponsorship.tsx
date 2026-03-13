import { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Users, Briefcase, ChevronRight, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function LeadershipSponsorship() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const form = e.target as HTMLFormElement;
    const data = {
      firstName: (form.elements.namedItem("firstName") as HTMLInputElement).value,
      lastName: (form.elements.namedItem("lastName") as HTMLInputElement).value,
      company: (form.elements.namedItem("company") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      cohortSize: (form.elements.namedItem("cohortSize") as HTMLSelectElement).value,
      message: (form.elements.namedItem("message") as HTMLTextAreaElement).value,
    };
    try {
      await apiRequest("POST", "/api/leadership/inquiry", data);
      toast({ title: "Inquiry Submitted", description: "Our enterprise team will respond within 24 hours." });
      form.reset();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />
      <main className="flex-1">
        <section className="bg-slate-950 text-white py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-tsia-green/20 to-transparent"></div>
          <div className="container mx-auto px-4 relative z-10 grid md:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }} className="space-y-6">
              <div className="inline-flex items-center rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1 text-sm font-medium text-slate-300">
                Corporate Social Responsibility
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
                Sponsor a Cohort.<br/>Shape the Future.
              </h1>
              <p className="text-lg text-slate-400 max-w-lg">
                Organizations can sponsor cohorts of 100+ students for a 3-year term. Partner with TSIA for measurable, scalable impact on African education.
              </p>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="hidden md:block">
              <div className="w-full h-80 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-900 border border-slate-700 shadow-2xl relative overflow-hidden flex items-center justify-center">
                <div className="grid grid-cols-5 gap-2 opacity-20">
                  {Array.from({length: 25}).map((_, i) => (<div key={i} className="w-12 h-12 rounded bg-tsia-green"></div>))}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent"></div>
                <h3 className="absolute bottom-8 left-8 text-2xl font-bold">100+ Students <br/><span className="text-tsia-green">Per Cohort</span></h3>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="py-20 bg-card">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: Users, title: "Scale Your Impact", desc: "Sponsor a minimum of 100 students for a dedicated 3-year term." },
                { icon: Briefcase, title: "Concierge Liaison", desc: "Receive dedicated support from a TSIA liaison for your cohort." },
                { icon: Building2, title: "Detailed Reporting", desc: "Track academic progress and fund utilization through our dashboard." }
              ].map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}
                  className="p-6 rounded-2xl bg-background border hover:shadow-lg transition-shadow"
                >
                  <item.icon className="w-10 h-10 text-tsia-green mb-4" />
                  <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 bg-background border-t">
          <div className="container mx-auto px-4 max-w-4xl">
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-card rounded-3xl shadow-xl overflow-hidden flex flex-col md:flex-row border">
              <div className="md:w-1/3 bg-tsia-green p-8 text-white flex flex-col justify-between">
                <div>
                  <h3 className="text-2xl font-bold mb-4">Start the Conversation</h3>
                  <p className="opacity-90 text-sm leading-relaxed mb-8">Fill out the form to request information about Leadership Cohort Sponsorships.</p>
                </div>
                <div className="space-y-4 text-sm font-medium">
                  <div className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 opacity-80" /> Min. 100 Students</div>
                  <div className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 opacity-80" /> 3-Year Commitment</div>
                  <div className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 opacity-80" /> Dedicated Manager</div>
                </div>
              </div>
              <div className="md:w-2/3 p-8 md:p-12">
                <form className="space-y-6" onSubmit={handleSubmit}>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2"><Label htmlFor="firstName">First Name</Label><Input id="firstName" name="firstName" placeholder="Jane" required data-testid="input-leadership-firstName" /></div>
                    <div className="space-y-2"><Label htmlFor="lastName">Last Name</Label><Input id="lastName" name="lastName" placeholder="Doe" required data-testid="input-leadership-lastName" /></div>
                  </div>
                  <div className="space-y-2"><Label htmlFor="company">Organization</Label><Input id="company" name="company" placeholder="Acme Corp" required data-testid="input-leadership-company" /></div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2"><Label htmlFor="email">Work Email</Label><Input id="email" name="email" type="email" placeholder="jane@acmecorp.com" required data-testid="input-leadership-email" /></div>
                    <div className="space-y-2">
                      <Label htmlFor="cohortSize">Cohort Size</Label>
                      <select id="cohortSize" name="cohortSize" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm" data-testid="select-cohort-size">
                        <option>100 - 250 Students</option>
                        <option>250 - 500 Students</option>
                        <option>500+ Students</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2"><Label htmlFor="message">Additional Information</Label><Textarea id="message" name="message" placeholder="Tell us about your CSR goals..." className="h-24" data-testid="textarea-leadership-message" /></div>
                  <Button type="submit" className="w-full h-12 text-base bg-slate-900 hover:bg-slate-800 text-white dark:bg-primary dark:hover:bg-primary/90" disabled={loading} data-testid="button-leadership-submit">
                    {loading ? "Submitting..." : "Request Cohort Proposal"} <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </form>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
