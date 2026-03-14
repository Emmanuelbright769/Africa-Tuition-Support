import { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Phone, MapPin, Clock, Send, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

export default function ContactUs() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      toast({ title: "Message Sent", description: "We've received your message and will respond within 24 hours." });
      setLoading(false);
      (e.target as HTMLFormElement).reset();
    }, 1500);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />
      <main className="flex-1">
        <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-20">
          <div className="container mx-auto px-4 text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <MessageSquare className="w-16 h-16 text-tsia-gold mx-auto mb-6" />
              <h1 className="text-5xl font-bold tracking-tight mb-4">Contact Us</h1>
              <p className="text-xl text-slate-300 max-w-2xl mx-auto">We'd love to hear from you. Reach out with questions, partnership inquiries, or feedback.</p>
            </motion.div>
          </div>
        </section>

        <section className="py-20 bg-background">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
              {[
                { icon: Mail, title: "Email", detail: "support@tsia.africa", sub: "General inquiries & support", color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" },
                { icon: Phone, title: "Phone", detail: "+234 800 TSIA 000", sub: "Mon - Fri, 9am - 5pm WAT", color: "text-green-600 bg-green-100 dark:bg-green-900/30" },
                { icon: MapPin, title: "Office", detail: "Victoria Island, Lagos", sub: "Nigeria, West Africa", color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30" },
              ].map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}
                  className="p-8 rounded-2xl bg-card border text-center hover:shadow-lg transition-shadow"
                >
                  <div className={`w-14 h-14 rounded-xl ${item.color} flex items-center justify-center mx-auto mb-4`}>
                    <item.icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-lg font-bold mb-1">{item.title}</h3>
                  <p className="text-sm font-medium text-primary">{item.detail}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.sub}</p>
                </motion.div>
              ))}
            </div>

            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="max-w-3xl mx-auto bg-card rounded-3xl shadow-xl overflow-hidden border"
            >
              <div className="bg-gradient-to-r from-primary to-tsia-green p-8 text-white">
                <h2 className="text-2xl font-bold mb-2">Send Us a Message</h2>
                <p className="text-sm opacity-90">Fill out the form below and our team will get back to you within 24 hours.</p>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" name="name" placeholder="John Doe" required className="h-11" data-testid="input-contact-name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" name="email" type="email" placeholder="john@example.com" required className="h-11" data-testid="input-contact-email" />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone (Optional)</Label>
                    <Input id="phone" name="phone" type="tel" placeholder="+234 800 000 0000" className="h-11" data-testid="input-contact-phone" />
                  </div>
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Select name="subject" defaultValue="general">
                      <SelectTrigger data-testid="select-contact-subject"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General Inquiry</SelectItem>
                        <SelectItem value="verification">Verification Help</SelectItem>
                        <SelectItem value="sponsorship">Sponsorship Questions</SelectItem>
                        <SelectItem value="affiliate">Affiliate Program</SelectItem>
                        <SelectItem value="partnership">Corporate Partnership</SelectItem>
                        <SelectItem value="technical">Technical Support</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea id="message" name="message" placeholder="How can we help you?" className="h-32 resize-none" required data-testid="textarea-contact-message" />
                </div>
                <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading} data-testid="button-contact-submit">
                  {loading ? "Sending..." : (<><Send className="w-4 h-4 mr-2" /> Send Message</>)}
                </Button>
              </form>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="max-w-3xl mx-auto mt-12 bg-muted/50 rounded-2xl p-6 border flex items-center gap-4 text-center sm:text-left"
            >
              <Clock className="w-10 h-10 text-tsia-gold shrink-0 hidden sm:block" />
              <div>
                <h4 className="font-bold mb-1">Support Hours</h4>
                <p className="text-sm text-muted-foreground">Monday to Friday: 9:00 AM - 5:00 PM (WAT). Weekend inquiries will be addressed on the next business day. For urgent verification issues, please include your WAEC registration number in the message.</p>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
