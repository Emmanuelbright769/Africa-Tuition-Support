import { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Phone, MapPin, Clock, Send, MessageSquare, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const SUBJECT_OPTIONS = [
  { value: "General Inquiry", label: "General Inquiry" },
  { value: "Verification Help", label: "Verification Help" },
  { value: "Sponsorship Questions", label: "Sponsorship Questions" },
  { value: "Affiliate Program", label: "Affiliate Program" },
  { value: "Corporate Partnership", label: "Corporate Partnership" },
  { value: "Technical Support", label: "Technical Support" },
  { value: "Wallet / Payment Issue", label: "Wallet / Payment Issue" },
  { value: "Trade Market Support", label: "Trade Market Support" },
];

export default function ContactUs() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [subject, setSubject] = useState("General Inquiry");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const data = new FormData(form);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:    (data.get("name") as string)?.trim(),
          email:   (data.get("email") as string)?.trim(),
          phone:   (data.get("phone") as string)?.trim() || "",
          subject,
          message: (data.get("message") as string)?.trim(),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || "Failed to send.");
      setSent(true);
      form.reset();
      setSubject("General Inquiry");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Could not send message. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
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
                { icon: Mail, title: "Email", detail: "support@tsiforafrica.com", sub: "General inquiries & support", color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" },
                { icon: Phone, title: "Phone / WhatsApp", detail: "+4407916395474", sub: "Mon - Fri, 9am - 5pm GMT", color: "text-green-600 bg-green-100 dark:bg-green-900/30" },
                { icon: MapPin, title: "Office", detail: "Canary Wharf, London", sub: "United Kingdom", color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30" },
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

              {sent ? (
                <div className="p-12 text-center space-y-4">
                  <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-xl font-bold text-green-700 dark:text-green-400">Message Sent!</h3>
                  <p className="text-muted-foreground text-sm max-w-md mx-auto">
                    Thank you for reaching out. A confirmation has been sent to your email. Our team will respond within 24 hours (Mon–Fri, 9 AM–5 PM GMT).
                  </p>
                  <Button variant="outline" className="mt-4" onClick={() => setSent(false)} data-testid="button-contact-again">
                    Send Another Message
                  </Button>
                </div>
              ) : (
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
                      <Input id="phone" name="phone" type="tel" placeholder="+44 20 0000 0000" className="h-11" data-testid="input-contact-phone" />
                    </div>
                    <div className="space-y-2">
                      <Label>Subject</Label>
                      <Select value={subject} onValueChange={setSubject}>
                        <SelectTrigger data-testid="select-contact-subject"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SUBJECT_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
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
              )}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="max-w-3xl mx-auto mt-12 bg-muted/50 rounded-2xl p-6 border flex items-center gap-4 text-center sm:text-left"
            >
              <Clock className="w-10 h-10 text-tsia-gold shrink-0 hidden sm:block" />
              <div>
                <h4 className="font-bold mb-1">Support Hours</h4>
                <p className="text-sm text-muted-foreground">Monday to Friday: 9:00 AM - 5:00 PM (GMT). Weekend inquiries will be addressed on the next business day. For urgent verification issues, please include your WAEC registration number in the message.</p>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
