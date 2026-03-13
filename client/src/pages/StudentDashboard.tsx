import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Clock, Trophy, ArrowRight, ArrowUpRight, History, CreditCard, CheckCircle2, AlertCircle } from "lucide-react";

export default function StudentDashboard() {
  const [countdown] = useState(24); // Days remaining in 30-day window
  const [balance] = useState(230.00);
  const [tier] = useState("Gold");
  const [status] = useState("Verified"); // Pending, Verified, Funded

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      {/* Dashboard Nav */}
      <nav className="bg-white border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">T</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-slate-600 hidden sm:block">Hello, David</div>
            <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden">
              <img src="https://i.pravatar.cc/150?u=a042581f4e29026704d" alt="Profile" />
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 pt-8 space-y-8">
        {/* Status Banner */}
        <div className="bg-primary text-primary-foreground rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400" /> Account Verified
            </h2>
            <p className="text-primary-foreground/80 text-sm">
              Your documents have been approved. You are in the mandatory 30-day commitment window.
            </p>
          </div>
          <div className="bg-white/10 px-6 py-3 rounded-lg text-center backdrop-blur-sm min-w-[200px]">
            <div className="text-sm font-medium text-primary-foreground/80 uppercase tracking-wider mb-1">Commitment Window</div>
            <div className="text-3xl font-bold font-mono tracking-tight flex items-center justify-center gap-2">
              <Clock className="w-6 h-6" /> {countdown} <span className="text-lg font-normal">days left</span>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Wallet Card */}
          <Card className="md:col-span-2 shadow-sm border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wallet className="w-5 h-5 text-blue-600" /> Digital Wallet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row justify-between md:items-end gap-6 mb-8">
                <div>
                  <div className="text-sm text-slate-500 font-medium mb-1">Available Balance</div>
                  <div className="text-5xl font-bold tracking-tight text-slate-900">${balance.toFixed(2)}</div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="h-10 px-6 bg-slate-50">View History</Button>
                  <Button className="h-10 px-6 bg-blue-600 hover:bg-blue-700">Withdraw Funds</Button>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex items-start gap-3 text-sm text-amber-800">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>Note: A mandatory <strong>7.5% VAT</strong> applies to all withdrawals to local bank accounts as per policy.</p>
              </div>
            </CardContent>
          </Card>

          {/* Academic Tier Card */}
          <Card className="shadow-sm border-slate-200 bg-gradient-to-br from-white to-amber-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="w-5 h-5 text-amber-600" /> Academic Tier
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-200 p-1 mb-4 shadow-lg">
                <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                  <Trophy className="w-10 h-10 text-amber-500" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-1">{tier} Tier</h3>
              <p className="text-sm text-slate-600 text-center mb-4">Based on your WAEC results (4 A's)</p>
              <Badge variant="outline" className="bg-white px-3 py-1 text-sm border-amber-200 text-amber-700">
                Eligible for $460 max payout
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Sponsorship Plans / Active Plan */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle>Sponsorship Plan</CardTitle>
            <CardDescription>Select a plan after your commitment window closes.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { years: 1, price: 35, payout: 230 },
                { years: 2, price: 45, payout: 460, popular: true },
                { years: 3, price: 50, payout: 690 }
              ].map((plan) => (
                <div key={plan.years} className={`relative border rounded-xl p-5 ${plan.popular ? 'border-primary shadow-md bg-primary/5' : 'border-slate-200 hover:border-slate-300'} transition-all`}>
                  {plan.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">Recommended</div>}
                  <h4 className="font-semibold text-lg mb-1">{plan.years} Year Plan</h4>
                  <div className="text-2xl font-bold text-slate-900 mb-4">${plan.price}<span className="text-sm font-normal text-slate-500">/yr</span></div>
                  <ul className="space-y-2 mb-6 text-sm text-slate-600">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Up to ${plan.payout} payout</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Wallet access</li>
                  </ul>
                  <Button variant={plan.popular ? 'default' : 'outline'} className="w-full" disabled={countdown > 0}>
                    {countdown > 0 ? 'Locked' : 'Select Plan'}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { title: "Verification Fee Paid", amount: "-$3.00", date: "Today, 10:42 AM", icon: CreditCard, color: "text-slate-500", bg: "bg-slate-100" },
                { title: "Documents Verified", amount: "", date: "Today, 09:15 AM", icon: ShieldAlert, color: "text-green-600", bg: "bg-green-100" },
                { title: "Account Created", amount: "", date: "Yesterday, 04:30 PM", icon: CheckCircle2, color: "text-blue-600", bg: "bg-blue-100" },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${item.bg}`}>
                      <item.icon className={`w-5 h-5 ${item.color}`} />
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-900 text-sm">{item.title}</h4>
                      <p className="text-xs text-slate-500">{item.date}</p>
                    </div>
                  </div>
                  {item.amount && <div className="font-medium text-slate-900">{item.amount}</div>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </main>
    </div>
  );
}