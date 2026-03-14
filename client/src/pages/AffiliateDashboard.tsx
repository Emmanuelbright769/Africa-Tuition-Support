import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Users, DollarSign, Share2, LogOut, Sun, Moon, Monitor, TrendingUp, Link2, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/ui/Logo";

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

export default function AffiliateDashboard() {
  const [, setLocation] = useLocation();
  const { user, logout, isLoading: authLoading } = useAuth();
  const { mode, setMode } = useTheme();
  const { toast } = useToast();

  const { data: affiliateInfo } = useQuery({ queryKey: ["/api/affiliate/info"] });

  const themeOpts = [
    { v: "light" as const, icon: Sun },
    { v: "dark" as const, icon: Moon },
    { v: "system" as const, icon: Monitor },
  ];

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  if (!user) {
    setLocation("/login");
    return null;
  }

  const affiliateCode = affiliateInfo?.affiliateCode || user?.affiliateCode || "";
  const referralCount = affiliateInfo?.referralCount || 0;
  const referrals = affiliateInfo?.referrals || [];
  const referralLink = `${window.location.origin}/signup?ref=${affiliateCode}`;

  const copyCode = () => {
    if (affiliateCode) {
      navigator.clipboard.writeText(affiliateCode);
      toast({ title: "Copied!", description: "Referral code copied to clipboard." });
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast({ title: "Copied!", description: "Referral link copied to clipboard." });
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-background font-sans pb-20">
      <nav className="bg-card border-b sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <a className="flex items-center gap-3">
              <Logo variant="badge" height={32} />
              <span className="text-xl font-bold tracking-tight">Affiliate Portal</span>
            </a>
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-muted rounded-full p-1 gap-0.5">
              {themeOpts.map(o => (
                <button key={o.v} onClick={() => setMode(o.v)} className={`p-1.5 rounded-full transition-all ${mode === o.v ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  <o.icon className="w-4 h-4" />
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-aff-logout">
              <LogOut className="w-4 h-4 mr-2" /> Logout
            </Button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 pt-8">
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8 max-w-5xl mx-auto">

          <motion.div variants={itemVariants} className="bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-500 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl opacity-10 -mr-20 -mt-20 pointer-events-none"></div>
            <div className="relative z-10">
              <h2 className="text-2xl font-bold mb-1">Welcome back, {user.firstName}!</h2>
              <p className="text-amber-100 text-sm">Your affiliate account is active. Share your code and start earning.</p>
            </div>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            <motion.div variants={itemVariants}>
              <Card className="shadow-md border-0 h-full">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-amber-100 dark:bg-amber-900/40 p-3 rounded-xl"><Share2 className="w-6 h-6 text-amber-600" /></div>
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Your Referral Code</p>
                      <p className="text-2xl font-bold font-mono tracking-wider" data-testid="text-aff-code">{affiliateCode || "Loading..."}</p>
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
                    <div className="bg-green-100 dark:bg-green-900/40 p-3 rounded-xl"><TrendingUp className="w-6 h-6 text-green-600" /></div>
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Status</p>
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 text-sm mt-1">Active</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Your affiliate account is in good standing</p>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <motion.div variants={itemVariants}>
            <Card className="shadow-md border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-primary" /> Your Referral Link
                </CardTitle>
                <CardDescription>Share this link directly — the referral code is automatically applied when students sign up through it.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-muted rounded-xl px-4 py-3 font-mono text-sm truncate" data-testid="text-aff-link">
                    {referralLink}
                  </div>
                  <Button onClick={copyLink} data-testid="button-copy-aff-link">
                    <Copy className="w-4 h-4 mr-2" /> Copy Link
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="shadow-md border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" /> Your Referrals
                </CardTitle>
                <CardDescription>Students who signed up using your referral code</CardDescription>
              </CardHeader>
              <CardContent>
                {referrals.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <h4 className="font-semibold text-muted-foreground mb-2">No referrals yet</h4>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">Share your referral code or link with eligible students to start earning commission.</p>
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

          <motion.div variants={itemVariants}>
            <Card className="shadow-md border-0 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-amber-200 dark:border-amber-800">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <h3 className="text-xl font-bold">How to Maximize Your Earnings</h3>
                  <div className="grid sm:grid-cols-3 gap-6 text-left max-w-3xl mx-auto mt-6">
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
                </div>
              </CardContent>
            </Card>
          </motion.div>

        </motion.div>
      </main>
    </div>
  );
}
