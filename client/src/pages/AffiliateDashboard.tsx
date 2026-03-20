import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Copy, Users, Share2, LogOut, Sun, Moon, Monitor, TrendingUp, Link2,
  Banknote, Clock, Crown, Sparkles, CheckCircle2, AlertCircle, Loader2,
  ChevronRight, Target, BarChart3, Infinity, Star
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/ui/Logo";
import { CO_AFFILIATE_PROGRAM } from "@shared/schema";

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } };

const CATEGORY_COLORS: Record<number, { bg: string; border: string; text: string; badge: string; icon: string }> = {
  100: { bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200 dark:border-blue-800", text: "text-blue-700 dark:text-blue-300", badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300", icon: "🥉" },
  200: { bg: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-200 dark:border-purple-800", text: "text-purple-700 dark:text-purple-300", badge: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300", icon: "🥈" },
  500: { bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-300", badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300", icon: "🥇" },
};

const CATEGORY_NAMES: Record<number, string> = { 100: "Starter", 200: "Growth", 500: "Elite" };

export default function AffiliateDashboard() {
  const [, setLocation] = useLocation();
  const { user, logout, isLoading: authLoading } = useAuth();
  const { mode, setMode } = useTheme();
  const { toast } = useToast();

  const [loanOpen, setLoanOpen] = useState(false);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  const { data: affiliateInfo } = useQuery({ queryKey: ["/api/affiliate/info"] });
  const { data: programData } = useQuery({ queryKey: ["/api/co-affiliate/program"] });
  const { data: myCoAff, refetch: refetchMyCoAff } = useQuery({ queryKey: ["/api/co-affiliate/my-info"] });

  const subscribeMutation = useMutation({
    mutationFn: async (category: number) => {
      const res = await apiRequest("POST", "/api/co-affiliate/subscribe", { category });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Enrolled! 🎉", description: data.message });
      setSubscribeOpen(false);
      setSelectedCategory(null);
      refetchMyCoAff();
      queryClient.invalidateQueries({ queryKey: ["/api/co-affiliate/program"] });
    },
    onError: (err: any) => {
      toast({ title: "Enrollment Failed", description: err.message, variant: "destructive" });
    },
  });

  const themeOpts = [{ v: "light" as const, icon: Sun }, { v: "dark" as const, icon: Moon }, { v: "system" as const, icon: Monitor }];

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (!user) { setLocation("/login"); return null; }

  const affiliateCode = affiliateInfo?.affiliateCode || user?.affiliateCode || "";
  const referralCount = affiliateInfo?.referralCount || 0;
  const referrals = affiliateInfo?.referrals || [];
  const referralLink = `${window.location.origin}/signup?ref=${affiliateCode}`;

  const totalEnrolled: number = programData?.totalEnrolled ?? 0;
  const spotsRemaining: number = programData?.spotsRemaining ?? CO_AFFILIATE_PROGRAM.TARGET;
  const pricing = programData?.pricing ?? [];
  const progress = programData?.progress ?? { overallPct: 0, pctToNext: 0, nextMilestone: 150000, milestones: 0 };

  const copyCode = () => { navigator.clipboard.writeText(affiliateCode); toast({ title: "Copied!", description: "Referral code copied." }); };
  const copyLink = () => { navigator.clipboard.writeText(referralLink); toast({ title: "Copied!", description: "Referral link copied." }); };
  const handleLogout = async () => { await logout(); setLocation("/"); };

  const isEnrolled = !!myCoAff;
  const myCategory = myCoAff ? Number(myCoAff.investmentCategory) : null;
  const mySharePct = myCoAff ? parseFloat(myCoAff.sharePercentage) : null;

  return (
    <div className="min-h-screen bg-background font-sans pb-20">
      <nav className="bg-card border-b sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/"><a className="flex items-center gap-3"><Logo variant="badge" height={32} /><span className="text-xl font-bold tracking-tight">Affiliate Portal</span></a></Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-muted rounded-full p-1 gap-0.5">
              {themeOpts.map(o => (
                <button key={o.v} onClick={() => setMode(o.v)} className={`p-1.5 rounded-full transition-all ${mode === o.v ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  <o.icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-aff-logout">
              <LogOut className="w-4 h-4 mr-1" /> Logout
            </Button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 pt-8">
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8 max-w-5xl mx-auto">

          {/* Hero banner */}
          <motion.div variants={itemVariants} className="bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-500 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl opacity-10 -mr-20 -mt-20 pointer-events-none"></div>
            <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold mb-1">Welcome back, {user.firstName}!</h2>
                <p className="text-amber-100 text-sm">Your affiliate account is active. Share your code and start earning.</p>
              </div>
              <Button
                onClick={() => setLoanOpen(true)}
                className="bg-white/20 hover:bg-white/30 text-white border border-white/30 h-11 px-5 font-semibold backdrop-blur-sm shrink-0"
                data-testid="button-take-loan"
              >
                <Banknote className="w-4 h-4 mr-2" /> Take a Loan
              </Button>
            </div>
          </motion.div>

          {/* Stats row */}
          <div className="grid md:grid-cols-3 gap-5">
            <motion.div variants={itemVariants}>
              <Card className="shadow-md border-0 h-full">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-amber-100 dark:bg-amber-900/40 p-3 rounded-xl"><Share2 className="w-6 h-6 text-amber-600" /></div>
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Your Referral Code</p>
                      <p className="text-xl font-bold font-mono tracking-wider" data-testid="text-aff-code">{affiliateCode || "—"}</p>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full" onClick={copyCode} data-testid="button-copy-aff-code">
                    <Copy className="w-4 h-4 mr-2" /> Copy Code
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div variants={itemVariants}>
              <Card className="shadow-md border-0 h-full">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-blue-100 dark:bg-blue-900/40 p-3 rounded-xl"><Users className="w-6 h-6 text-blue-600" /></div>
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Total Referrals</p>
                      <p className="text-3xl font-bold" data-testid="text-aff-referral-count">{referralCount}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Students who signed up using your code</p>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div variants={itemVariants}>
              <Card className="shadow-md border-0 h-full">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-3 rounded-xl ${isEnrolled ? 'bg-green-100 dark:bg-green-900/40' : 'bg-muted'}`}>
                      <TrendingUp className={`w-6 h-6 ${isEnrolled ? 'text-green-600' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Co-Affiliate Status</p>
                      <Badge className={`text-sm mt-1 ${isEnrolled ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                        {isEnrolled ? `${CATEGORY_NAMES[myCategory!]} Member ✓` : "Not Enrolled"}
                      </Badge>
                    </div>
                  </div>
                  {isEnrolled && mySharePct !== null ? (
                    <p className="text-xs text-green-600 dark:text-green-400 font-semibold">Lifetime share: {(mySharePct * 100).toFixed(6)}% of TSIA profits</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Join the Co-Affiliate programme below</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Referral link */}
          <motion.div variants={itemVariants}>
            <Card className="shadow-md border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Link2 className="w-5 h-5 text-primary" /> Your Referral Link</CardTitle>
                <CardDescription>Referral code is automatically applied when students sign up through this link.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-muted rounded-xl px-4 py-3 font-mono text-sm truncate" data-testid="text-aff-link">{referralLink}</div>
                  <Button onClick={copyLink} data-testid="button-copy-aff-link"><Copy className="w-4 h-4 mr-2" /> Copy</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* ── CO-AFFILIATE / INITIATOR PROGRAMME ── */}
          <motion.div variants={itemVariants}>
            <Card className="shadow-xl border-2 border-amber-200 dark:border-amber-800 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-900 p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-tsia-gold/20 rounded-full blur-3xl -mr-10 -mt-10"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-tsia-gold/20 rounded-xl flex items-center justify-center border border-tsia-gold/30">
                      <Crown className="w-7 h-7 text-tsia-gold" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">Co-Affiliate / Initiator Programme</h3>
                      <p className="text-amber-200 text-sm">Lifetime profit sharing — exclusively for affiliate accounts</p>
                    </div>
                  </div>
                  <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
                    Invest once to become a Co-Affiliate/Initiator and earn a <strong className="text-white">lifetime 5% profit share</strong> distributed across all 1,000,000 Co-Affiliates — proportional to your investment category. As more people join, investment prices increase by 20% every 150,000 enrollments.
                  </p>
                </div>
              </div>

              <CardContent className="p-6 space-y-6">

                {/* Programme progress */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold flex items-center gap-1.5"><Target className="w-4 h-4 text-primary" /> Programme Progress</span>
                    <span className="text-muted-foreground font-mono">{totalEnrolled.toLocaleString()} / {CO_AFFILIATE_PROGRAM.TARGET.toLocaleString()}</span>
                  </div>
                  <Progress value={progress.overallPct} className="h-3" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{spotsRemaining.toLocaleString()} spots remaining</span>
                    <span>{progress.overallPct.toFixed(2)}% filled</span>
                  </div>
                </div>

                {/* Next milestone */}
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <BarChart3 className="w-4 h-4" /> Next Price Increase at {progress.nextMilestone.toLocaleString()} Co-Affiliates
                    </span>
                    <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">+20% price</span>
                  </div>
                  <Progress value={progress.pctToNext} className="h-2 bg-amber-100 dark:bg-amber-900/40" />
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    {progress.milestones === 0 ? "Join now at the lowest founding price before the first milestone!" : `Price has increased ${progress.milestones}× since launch (${(progress.milestones * 20)}% total increase).`}
                  </p>
                </div>

                {/* Investment tiers */}
                <div>
                  <h4 className="font-bold text-base mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-tsia-gold" /> Current Investment Categories</h4>
                  <div className="grid sm:grid-cols-3 gap-4">
                    {pricing.map((tier: any) => {
                      const col = CATEGORY_COLORS[tier.category] || CATEGORY_COLORS[100];
                      const name = CATEGORY_NAMES[tier.category] || "Plan";
                      const isMyTier = myCategory === tier.category;
                      return (
                        <motion.div
                          key={tier.category}
                          whileHover={{ scale: isEnrolled ? 1 : 1.02 }}
                          className={`relative rounded-2xl p-5 border-2 transition-all ${isMyTier ? 'border-tsia-gold bg-amber-50 dark:bg-amber-900/20 shadow-lg' : `${col.bg} ${col.border}`}`}
                        >
                          {isMyTier && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-tsia-gold text-slate-900 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                              Your Plan ✓
                            </div>
                          )}
                          <div className="text-3xl mb-2">{col.icon}</div>
                          <h5 className={`font-bold text-lg ${col.text}`}>{name}</h5>
                          <p className="text-xs text-muted-foreground mb-3">Base category: ${tier.category}</p>
                          <div className="text-3xl font-bold mb-1">${tier.currentPrice}</div>
                          <p className="text-xs text-muted-foreground mb-4">One-time investment</p>
                          <div className={`text-xs font-semibold px-2 py-1 rounded-lg inline-block mb-4 ${col.badge}`}>
                            Share: {tier.shareLabel} lifetime
                          </div>
                          <div className="space-y-1.5 text-xs text-muted-foreground mb-4">
                            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-500" /> Lifetime profit participation</div>
                            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-500" /> 5% TSIA profits shared across 1M</div>
                            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-500" /> Proportional to investment tier</div>
                            <div className="flex items-center gap-1.5"><Infinity className="w-3 h-3 text-primary" /> No expiry — forever</div>
                          </div>
                          {!isEnrolled ? (
                            <Button
                              className="w-full h-10 text-sm font-semibold"
                              onClick={() => { setSelectedCategory(tier.category); setSubscribeOpen(true); }}
                              data-testid={`button-subscribe-${tier.category}`}
                            >
                              Join for ${tier.currentPrice}
                            </Button>
                          ) : (
                            <Button variant="outline" className="w-full h-10 text-sm" disabled>{isMyTier ? "Enrolled ✓" : "Already Enrolled"}</Button>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Profit share explanation */}
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 border space-y-3">
                  <h4 className="font-bold flex items-center gap-2 text-sm"><BarChart3 className="w-4 h-4 text-primary" /> How Profit Sharing Works</h4>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>TSIA allocates <strong className="text-foreground">5%</strong> of all profits to be shared among 1,000,000 Co-Affiliates for life.</p>
                    <p>Your personal share is calculated as:</p>
                    <div className="bg-card rounded-lg p-3 border font-mono text-xs space-y-1">
                      <div className="text-primary font-bold">Share = 0.000005 × (your base category ÷ 100)</div>
                      <div className="text-muted-foreground">$100 investor → 0.000005 × 1 = <strong>0.0005%</strong> of profits</div>
                      <div className="text-muted-foreground">$200 investor → 0.000005 × 2 = <strong>0.0010%</strong> of profits</div>
                      <div className="text-muted-foreground">$500 investor → 0.000005 × 5 = <strong>0.0025%</strong> of profits</div>
                    </div>
                    <p className="text-xs">The higher your investment category, the greater your share of TSIA's profits — forever.</p>
                  </div>
                </div>

                {/* Price increase schedule */}
                <div className="border rounded-xl overflow-hidden">
                  <div className="bg-muted/50 px-4 py-2 border-b">
                    <h4 className="text-sm font-semibold">Price Increase Schedule (every 150,000 enrollments)</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left px-4 py-2 font-semibold">Co-Affiliates Enrolled</th>
                          <th className="text-center px-4 py-2 font-semibold">Starter ($100)</th>
                          <th className="text-center px-4 py-2 font-semibold">Growth ($200)</th>
                          <th className="text-center px-4 py-2 font-semibold">Elite ($500)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[0, 150000, 300000, 450000, 600000, 750000, 900000].map((milestone, i) => {
                          const mult = Math.pow(1.20, i);
                          const isCurrent = totalEnrolled >= milestone && totalEnrolled < (milestone + CO_AFFILIATE_PROGRAM.MILESTONE_INTERVAL);
                          const isPast = totalEnrolled >= (milestone + CO_AFFILIATE_PROGRAM.MILESTONE_INTERVAL);
                          return (
                            <tr key={milestone} className={`border-b transition-colors ${isCurrent ? 'bg-tsia-gold/10 font-bold' : isPast ? 'opacity-50' : ''}`}>
                              <td className="px-4 py-2">
                                {milestone === 0 ? "0 – 149,999" : `${milestone.toLocaleString()} – ${(milestone + 149999).toLocaleString()}`}
                                {isCurrent && <span className="ml-2 text-[10px] bg-tsia-gold text-slate-900 px-1.5 py-0.5 rounded-full font-bold">NOW</span>}
                              </td>
                              <td className="px-4 py-2 text-center">${Math.round(100 * mult)}</td>
                              <td className="px-4 py-2 text-center">${Math.round(200 * mult)}</td>
                              <td className="px-4 py-2 text-center">${Math.round(500 * mult)}</td>
                            </tr>
                          );
                        })}
                        <tr className="bg-slate-900 dark:bg-slate-700 text-white text-[11px]">
                          <td className="px-4 py-2 font-bold">1,000,000 (Complete)</td>
                          <td className="px-4 py-2 text-center font-bold">${Math.round(100 * Math.pow(1.20, 6))}</td>
                          <td className="px-4 py-2 text-center font-bold">${Math.round(200 * Math.pow(1.20, 6))}</td>
                          <td className="px-4 py-2 text-center font-bold">${Math.round(500 * Math.pow(1.20, 6))}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

              </CardContent>
            </Card>
          </motion.div>

          {/* Referrals list */}
          <motion.div variants={itemVariants}>
            <Card className="shadow-md border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> Your Referrals</CardTitle>
                <CardDescription>Students who signed up using your referral code</CardDescription>
              </CardHeader>
              <CardContent>
                {referrals.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <h4 className="font-semibold text-muted-foreground mb-2">No referrals yet</h4>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">Share your link to start earning commissions.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {referrals.map((r: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border" data-testid={`row-referral-${i}`}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <span className="text-sm font-bold text-primary">{r.name?.charAt(0) || "?"}</span>
                          </div>
                          <div>
                            <p className="font-medium text-sm">{r.name}</p>
                            <p className="text-xs text-muted-foreground">Joined {new Date(r.joinedAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">Referred</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Tips */}
          <motion.div variants={itemVariants}>
            <Card className="shadow-md border-0 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-amber-200 dark:border-amber-800">
              <CardContent className="pt-6">
                <h3 className="text-xl font-bold text-center mb-6">Maximize Your Earnings</h3>
                <div className="grid sm:grid-cols-3 gap-5">
                  {[
                    { title: "Social Media", desc: "Post your referral link on Twitter/X, Instagram, Facebook, and LinkedIn to reach more students." },
                    { title: "WhatsApp Groups", desc: "Share in student WhatsApp groups, school communities, and education-focused channels." },
                    { title: "Word of Mouth", desc: "Talk to friends, family, and community members about the TSIA tuition support program." },
                  ].map((tip, i) => (
                    <div key={i} className="p-4 bg-white dark:bg-slate-800 rounded-xl border">
                      <h4 className="font-semibold text-sm mb-1">{tip.title}</h4>
                      <p className="text-xs text-muted-foreground">{tip.desc}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

        </motion.div>
      </main>

      {/* Loan - Coming Soon dialog */}
      <Dialog open={loanOpen} onOpenChange={setLoanOpen}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-10 h-10 text-amber-500" />
            </div>
            <DialogTitle className="text-2xl">Coming Soon</DialogTitle>
            <DialogDescription className="text-base">
              The Affiliate Loan feature is currently under development. It will allow eligible affiliates to access short-term financing based on their referral performance.
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">We'll notify you as soon as this feature launches!</p>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={() => setLoanOpen(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subscribe confirmation dialog */}
      <Dialog open={subscribeOpen} onOpenChange={setSubscribeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Star className="w-6 h-6 text-tsia-gold" /> Confirm Co-Affiliate Enrolment
            </DialogTitle>
            <DialogDescription>
              You are about to join the Co-Affiliate/Initiator Programme. This is a one-time, lifetime investment.
            </DialogDescription>
          </DialogHeader>
          {selectedCategory && (
            <div className="space-y-4 py-2">
              {(() => {
                const tier = pricing.find((p: any) => p.category === selectedCategory);
                if (!tier) return null;
                const col = CATEGORY_COLORS[selectedCategory] || CATEGORY_COLORS[100];
                return (
                  <div className={`rounded-xl p-5 border-2 ${col.bg} ${col.border}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Investment Category</p>
                        <h4 className={`text-2xl font-bold ${col.text}`}>{CATEGORY_NAMES[selectedCategory]}</h4>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">One-time amount</p>
                        <p className="text-2xl font-bold">${tier.currentPrice}</p>
                      </div>
                    </div>
                    <div className={`text-sm font-semibold px-3 py-2 rounded-lg ${col.badge}`}>
                      Lifetime share: {tier.shareLabel} of TSIA profits
                    </div>
                    <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-500" /> Immediate activation upon payment</div>
                      <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-500" /> Lifetime profit participation — no renewal</div>
                      <div className="flex items-center gap-1.5"><AlertCircle className="w-3 h-3 text-amber-500" /> Investment is non-refundable</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setSubscribeOpen(false)}>Cancel</Button>
            <Button
              onClick={() => selectedCategory && subscribeMutation.mutate(selectedCategory)}
              disabled={subscribeMutation.isPending}
              className="bg-tsia-gold hover:bg-tsia-gold/90 text-slate-900 font-bold"
              data-testid="button-confirm-subscribe"
            >
              {subscribeMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...</> : "Confirm & Enrol"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
