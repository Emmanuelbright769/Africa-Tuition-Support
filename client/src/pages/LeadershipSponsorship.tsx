import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Users, Briefcase, ChevronRight, CheckCircle2 } from "lucide-react";

export default function LeadershipSponsorship() {
  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-slate-950 text-white py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-tsia-green/20 to-transparent"></div>
          <div className="container mx-auto px-4 relative z-10 grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1 text-sm font-medium text-slate-300">
                Corporate Social Responsibility
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
                Sponsor a Cohort.<br/>Shape the Future.
              </h1>
              <p className="text-lg text-slate-400 max-w-lg">
                Organizations can sponsor cohorts of 100+ students for a 3-year term. Partner with TSIA to make a measurable, scalable impact on African education.
              </p>
            </div>
            <div className="hidden md:block">
              {/* Abstract decorative element representing growth/cohorts */}
              <div className="w-full h-80 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-900 border border-slate-700 shadow-2xl relative overflow-hidden flex items-center justify-center">
                 <div className="grid grid-cols-5 gap-2 opacity-20">
                    {Array.from({length: 25}).map((_, i) => (
                      <div key={i} className="w-12 h-12 rounded bg-tsia-green"></div>
                    ))}
                 </div>
                 <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent"></div>
                 <h3 className="absolute bottom-8 left-8 text-2xl font-bold">100+ Students <br/><span className="text-tsia-green">Per Cohort</span></h3>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100">
                <Users className="w-10 h-10 text-tsia-green mb-4" />
                <h3 className="text-xl font-bold mb-2">Scale Your Impact</h3>
                <p className="text-slate-600">Sponsor a minimum of 100 students for a dedicated 3-year term, providing stability and ensuring graduation success.</p>
              </div>
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100">
                <Briefcase className="w-10 h-10 text-tsia-green mb-4" />
                <h3 className="text-xl font-bold mb-2">Concierge Liaison</h3>
                <p className="text-slate-600">Receive dedicated support from a TSIA liaison who manages your cohort, handles reporting, and ensures seamless execution.</p>
              </div>
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100">
                <Building2 className="w-10 h-10 text-tsia-green mb-4" />
                <h3 className="text-xl font-bold mb-2">Detailed Reporting</h3>
                <p className="text-slate-600">Track academic progress and fund utilization through our enterprise dashboard, perfectly formatted for your CSR reporting.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Inquiry Form */}
        <section className="py-24 bg-slate-50 border-t">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col md:flex-row">
              <div className="md:w-1/3 bg-tsia-green p-8 text-white flex flex-col justify-between">
                <div>
                  <h3 className="text-2xl font-bold mb-4">Start the Conversation</h3>
                  <p className="text-tsia-green-100 opacity-90 text-sm leading-relaxed mb-8">
                    Fill out the form to request information about Leadership Cohort Sponsorships. Our enterprise team will respond within 24 hours.
                  </p>
                </div>
                <div className="space-y-4 text-sm font-medium">
                  <div className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 opacity-80" /> Min. 100 Students</div>
                  <div className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 opacity-80" /> 3-Year Commitment</div>
                  <div className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 opacity-80" /> Dedicated Manager</div>
                </div>
              </div>
              
              <div className="md:w-2/3 p-8 md:p-12">
                <form className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input id="firstName" placeholder="Jane" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input id="lastName" placeholder="Doe" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="company">Organization / Company Name</Label>
                    <Input id="company" placeholder="Acme Corp" />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="email">Work Email</Label>
                      <Input id="email" type="email" placeholder="jane@acmecorp.com" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cohortSize">Expected Cohort Size</Label>
                      <select id="cohortSize" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm">
                        <option>100 - 250 Students</option>
                        <option>250 - 500 Students</option>
                        <option>500+ Students</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Additional Information</Label>
                    <Textarea id="message" placeholder="Tell us about your CSR goals..." className="h-24" />
                  </div>

                  <Button className="w-full h-12 text-base bg-slate-900 hover:bg-slate-800">
                    Request Cohort Proposal <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}