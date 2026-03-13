import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, Clock, Trophy, History, CreditCard, CheckCircle2, AlertCircle, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";

export default function StudentDashboard() {
  const [countdown] = useState(24);
  const [balance] = useState(230.00);
  const [tier] = useState("Gold");

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      {/* Dashboard Nav */}
      <nav className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-md">
              <span className="text-primary-foreground font-bold text-lg">T</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium text-slate-700 hidden sm:block">Hello, David</div>
            <div className="w-9 h-9 rounded-full bg-slate-200 border-2 border-white shadow-md overflow-hidden hover:ring-2 ring-primary ring-offset-2 transition-all cursor-pointer">
              <img src="https://i.pravatar.cc/150?u=a042581f4e29026704d" alt="Profile" />
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 pt-8">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-8 max-w-6xl mx-auto"
        >
          {/* Status Banner */}
          <motion.div variants={itemVariants} className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary rounded-full blur-3xl opacity-20 -mr-20 -mt-20 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-tsia-gold rounded-full blur-3xl opacity-10 -ml-10 -mb-10 pointer-events-none"></div>
            
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
              <div>
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">
                  <div className="bg-green-500/20 text-green-400 p-1.5 rounded-full">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  Account Verified
                </h2>
                <p className="text-slate-300 text-sm max-w-xl leading-relaxed">
                  Your identity and academic documents have been successfully approved. You are currently in the mandatory 30-day commitment window before accessing funds.
                </p>
              </div>
              <div className="bg-white/10 border border-white/20 px-8 py-4 rounded-xl text-center backdrop-blur-md min-w-[220px] shadow-inner">
                <div className="text-xs font-semibold text-slate-300 uppercase tracking-widest mb-2">Commitment Window</div>
                <div className="text-4xl font-bold font-mono tracking-tight flex items-center justify-center gap-3 text-white">
                  <Clock className="w-7 h-7 text-tsia-gold" /> {countdown} <span className="text-lg font-normal text-slate-400 font-sans tracking-normal">days left</span>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Wallet Card */}
            <motion.div variants={itemVariants} className="md:col-span-2">
              <Card className="h-full shadow-md border-0 bg-white hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg text-slate-800">
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><Wallet className="w-5 h-5" /></div> Digital Wallet
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-6 mb-8">
                    <div>
                      <div className="text-sm text-slate-500 font-medium mb-2 uppercase tracking-wide">Available Balance</div>
                      <div className="text-6xl font-bold tracking-tight text-slate-900">${balance.toFixed(2)}</div>
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                      <Button variant="outline" className="flex-1 sm:flex-none h-12 px-6 bg-slate-50 border-slate-200">History</Button>
                      <Button className="flex-1 sm:flex-none h-12 px-6 bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20">
                        Withdraw <ArrowUpRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                  <div className="bg-amber-50/50 border border-amber-100/50 rounded-xl p-4 flex items-start gap-3 text-sm text-amber-800/90">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
                    <p className="leading-relaxed">A mandatory <strong>7.5% VAT</strong> applies to all withdrawals to local bank accounts as per regional financial policy.</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Academic Tier Card */}
            <motion.div variants={itemVariants}>
              <Card className="h-full shadow-md border-0 bg-gradient-to-br from-white to-amber-50/30 overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-200/40 to-transparent rounded-bl-full pointer-events-none transition-transform group-hover:scale-110"></div>
                <CardHeader className="pb-2 relative z-10">
                  <CardTitle className="flex items-center gap-2 text-lg text-slate-800">
                    <div className="bg-amber-100 p-2 rounded-lg text-amber-600"><Trophy className="w-5 h-5" /></div> Academic Tier
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-8 relative z-10">
                  <motion.div 
                    initial={{ scale: 0.8, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", delay: 0.2 }}
                    className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-200 p-1 mb-6 shadow-xl shadow-amber-200/50"
                  >
                    <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                      <Trophy className="w-12 h-12 text-amber-500 drop-shadow-sm" />
                    </div>
                  </motion.div>
                  <h3 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">{tier} Tier</h3>
                  <p className="text-sm text-slate-500 text-center mb-5 font-medium">Based on verified WAEC results (4 A's)</p>
                  <Badge variant="secondary" className="bg-amber-100/80 text-amber-800 px-4 py-1.5 text-sm font-semibold hover:bg-amber-100/80">
                    Eligible for $460 max payout
                  </Badge>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Sponsorship Plans */}
            <motion.div variants={itemVariants} className="md:col-span-2">
              <Card className="h-full shadow-md border-0 bg-white">
                <CardHeader>
                  <CardTitle className="text-xl">Sponsorship Plan</CardTitle>
                  <CardDescription className="text-base">Select your commitment plan. Current window is locked.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-3 gap-4">
                    {[
                      { years: 1, price: 35, payout: 230 },
                      { years: 2, price: 45, payout: 460, popular: true },
                      { years: 3, price: 50, payout: 690 }
                    ].map((plan) => (
                      <div key={plan.years} className={`relative rounded-2xl p-6 transition-all ${plan.popular ? 'border-2 border-primary bg-primary/[0.02] shadow-md transform -translate-y-1' : 'border border-slate-200 hover:border-slate-300 bg-white'}`}>
                        {plan.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">Recommended</div>}
                        <h4 className="font-semibold text-lg mb-1 text-slate-800">{plan.years} Year Plan</h4>
                        <div className="text-3xl font-bold text-slate-900 mb-6">${plan.price}<span className="text-sm font-medium text-slate-400">/yr</span></div>
                        <ul className="space-y-3 mb-8 text-sm text-slate-600 font-medium">
                          <li className="flex items-center gap-2"><CheckCircle2 className={`w-4 h-4 ${plan.popular ? 'text-primary' : 'text-slate-400'}`} /> Up to ${plan.payout} payout</li>
                          <li className="flex items-center gap-2"><CheckCircle2 className={`w-4 h-4 ${plan.popular ? 'text-primary' : 'text-slate-400'}`} /> Wallet access</li>
                        </ul>
                        <Button variant={plan.popular ? 'default' : 'outline'} className="w-full h-11 font-semibold" disabled={countdown > 0}>
                          {countdown > 0 ? 'Locked' : 'Select Plan'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Recent Activity */}
            <motion.div variants={itemVariants}>
              <Card className="h-full shadow-md border-0 bg-white">
                <CardHeader>
                  <CardTitle className="text-xl">Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6 relative before:absolute before:inset-0 before:ml-[1.1rem] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                    {[
                      { title: "Verification Fee Paid", amount: "-$3.00", date: "Today, 10:42 AM", icon: CreditCard, color: "text-slate-600", bg: "bg-slate-100", border: "border-slate-200" },
                      { title: "Documents Verified", amount: "", date: "Today, 09:15 AM", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
                      { title: "Account Created", amount: "", date: "Yesterday, 04:30 PM", icon: History, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
                    ].map((item, i) => (
                      <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${item.border} ${item.bg} text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 ml-0 md:mx-auto`}>
                          <item.icon className={`w-4 h-4 ${item.color}`} />
                        </div>
                        <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-slate-900 text-sm mb-1">{item.title}</h4>
                            <p className="text-xs text-slate-500 font-medium">{item.date}</p>
                          </div>
                          {item.amount && <div className="font-bold text-slate-900 text-sm ml-2">{item.amount}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}