import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LogOut, Sun, Moon, Monitor, Menu, X, ChevronRight,
  MapPin, Car, Package, Clock, Star, Navigation,
  Truck, Globe, Phone, ArrowRight, LayoutDashboard
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/ui/Logo";

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.07 } } };
const itemVariants = { hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } };

type TourSection = "overview" | "dispatch" | "etaxi";

const TOUR_NAV: { id: TourSection; label: string; icon: any; badge?: string }[] = [
  { id: "overview",  label: "Overview",    icon: LayoutDashboard },
  { id: "dispatch",  label: "Dispatch",    icon: Package,    badge: "Coming Soon" },
  { id: "etaxi",     label: "E-Taxi",      icon: Car,        badge: "Coming Soon" },
];

export default function TourAfrica() {
  const [, setLocation] = useLocation();
  const { user, logout, isLoading: authLoading } = useAuth();
  const { mode, setMode } = useTheme();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<TourSection>("overview");
  const [menuOpen, setMenuOpen] = useState(false);

  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (authLoading) return;
    if (!user) { redirectTimerRef.current = setTimeout(() => setLocation("/login"), 200); }
    else if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    return () => { if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current); };
  }, [authLoading, user]);

  const handleLogout = async () => { await logout(); setLocation("/"); };

  if (authLoading || (!user && !authLoading)) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  const themeOpts = [{ v: "light" as const, i: Sun }, { v: "dark" as const, i: Moon }, { v: "system" as const, i: Monitor }];
  const navigate = (s: TourSection) => { setActiveSection(s); setMenuOpen(false); };
  const currentNav = TOUR_NAV.find(n => n.id === activeSection)!;

  const backPath = user?.role === "affiliate" ? "/affiliate-dashboard" : "/dashboard";

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Navbar */}
      <nav className="bg-card border-b sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setMenuOpen(o => !o)} className="p-2 rounded-xl hover:bg-muted transition-colors" data-testid="button-tour-menu" aria-label="Open Tour Africa menu">
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Logo variant="badge" height={32} />
            <span className="text-xl font-bold tracking-tight hidden sm:block text-primary">TOUR AFRICA</span>
            <span className="text-sm text-muted-foreground hidden sm:flex items-center gap-1">
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="font-medium text-foreground">{currentNav.label}</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-muted rounded-full p-1 gap-0.5">
              {themeOpts.map(o => (
                <button key={o.v} onClick={() => setMode(o.v)} className={`p-1.5 rounded-full transition-all ${mode === o.v ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  <o.i className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setLocation(backPath)}>
              <ArrowRight className="w-4 h-4 mr-1 rotate-180" /><span className="hidden sm:inline">Back</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-tour-logout">
              <LogOut className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </nav>

      {/* Slide-in menu */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-30 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
            <motion.aside initial={{ x: -300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed top-0 left-0 h-full w-72 bg-card border-r shadow-2xl z-40 flex flex-col">
              <div className="p-5 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
                    <Globe className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-green-700 dark:text-green-400">TOUR AFRICA</p>
                    <p className="text-xs text-muted-foreground">Transport & Logistics</p>
                  </div>
                </div>
                <button onClick={() => setMenuOpen(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
              </div>
              <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {TOUR_NAV.map(item => {
                  const isActive = activeSection === item.id;
                  return (
                    <button key={item.id} onClick={() => navigate(item.id)} data-testid={`tour-nav-${item.id}`}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-green-600 text-white shadow-sm' : 'hover:bg-muted text-foreground'}`}>
                      <div className="flex items-center gap-3">
                        <item.icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && <Badge className="text-[10px] py-0 px-2 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">{item.badge}</Badge>}
                    </button>
                  );
                })}
              </nav>
              <div className="p-4 border-t">
                <Button variant="outline" className="w-full" onClick={() => setLocation(backPath)}>
                  <ArrowRight className="w-4 h-4 mr-2 rotate-180" /> Back to Dashboard
                </Button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="container mx-auto px-4 pt-8 pb-20 max-w-5xl">
        <AnimatePresence mode="wait">
          <motion.div key={activeSection} variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">

            {/* ── OVERVIEW ── */}
            {activeSection === "overview" && (
              <>
                <motion.div variants={itemVariants} className="relative overflow-hidden rounded-2xl shadow-xl">
                  <div className="bg-gradient-to-br from-green-800 via-green-700 to-emerald-600 text-white p-8">
                    <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none"></div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center border border-white/30">
                          <Globe className="w-9 h-9 text-white" />
                        </div>
                        <div>
                          <h1 className="text-3xl font-bold tracking-tight">TOUR AFRICA</h1>
                          <p className="text-green-200 text-sm">Your all-in-one African transport & logistics platform</p>
                        </div>
                      </div>
                      <p className="text-green-100 max-w-xl leading-relaxed text-sm">
                        From package dispatch across cities to on-demand e-taxi booking — TOUR AFRICA connects you to fast, reliable, and affordable transport services across the continent.
                      </p>
                    </div>
                  </div>
                </motion.div>

                <div className="grid sm:grid-cols-2 gap-5">
                  {[
                    {
                      id: "dispatch" as TourSection,
                      icon: Package,
                      title: "Dispatch",
                      desc: "Send packages, parcels, and documents to any location across Africa. Real-time tracking, same-day delivery options, and transparent pricing.",
                      color: "text-blue-600",
                      bg: "bg-blue-50 dark:bg-blue-900/20",
                      border: "border-blue-200 dark:border-blue-800",
                      features: ["Same-day delivery", "Package tracking", "Nationwide coverage", "Secure handling"],
                    },
                    {
                      id: "etaxi" as TourSection,
                      icon: Car,
                      title: "E-Taxi",
                      desc: "Book verified, safe rides on demand. Airport transfers, city trips, and inter-city travel — all at competitive rates with rated drivers.",
                      color: "text-amber-600",
                      bg: "bg-amber-50 dark:bg-amber-900/20",
                      border: "border-amber-200 dark:border-amber-800",
                      features: ["Rated drivers", "Real-time tracking", "Airport transfers", "Scheduled bookings"],
                    },
                  ].map(service => (
                    <motion.div key={service.id} variants={itemVariants}>
                      <Card className={`shadow-md border-2 ${service.border} h-full`}>
                        <CardContent className="pt-6 pb-6">
                          <div className={`w-12 h-12 ${service.bg} rounded-xl flex items-center justify-center mb-4`}>
                            <service.icon className={`w-6 h-6 ${service.color}`} />
                          </div>
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="text-xl font-bold">{service.title}</h3>
                            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-xs">Coming Soon</Badge>
                          </div>
                          <p className="text-muted-foreground text-sm leading-relaxed mb-4">{service.desc}</p>
                          <div className="space-y-2">
                            {service.features.map(f => (
                              <div key={f} className="flex items-center gap-2 text-sm">
                                <div className={`w-1.5 h-1.5 rounded-full ${service.color.replace("text-", "bg-")}`}></div>
                                <span>{f}</span>
                              </div>
                            ))}
                          </div>
                          <Button className="w-full mt-5 h-10" variant="outline" onClick={() => navigate(service.id)} data-testid={`button-go-${service.id}`}>
                            Learn More <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                <motion.div variants={itemVariants}>
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-6 text-center">
                    <Star className="w-8 h-8 text-green-600 mx-auto mb-3" />
                    <h3 className="font-bold text-lg mb-2">Launching Across Africa</h3>
                    <p className="text-muted-foreground text-sm max-w-md mx-auto">
                      TOUR AFRICA is being built to serve every corner of the continent. Be among the first to experience it — we'll notify you the moment it goes live in your area.
                    </p>
                  </div>
                </motion.div>
              </>
            )}

            {/* ── DISPATCH ── */}
            {activeSection === "dispatch" && (
              <>
                <motion.div variants={itemVariants}>
                  <h2 className="text-2xl font-bold mb-1">Dispatch</h2>
                  <p className="text-muted-foreground text-sm mb-6">Fast, reliable package and parcel delivery across Africa.</p>
                </motion.div>
                <motion.div variants={itemVariants}>
                  <Card className="shadow-md border-2 border-dashed border-muted-foreground/20">
                    <CardContent className="pt-12 pb-14 text-center">
                      <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Truck className="w-12 h-12 text-blue-400" />
                      </div>
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-sm px-4 py-1.5 mb-4">Coming Soon</Badge>
                      <h3 className="text-2xl font-bold mb-3">Dispatch Service Launching Soon</h3>
                      <p className="text-muted-foreground max-w-md mx-auto leading-relaxed mb-8">
                        Send packages, documents, and parcels anywhere across Africa. Same-day and next-day options with real-time tracking and insurance on every delivery.
                      </p>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-2xl mx-auto text-sm">
                        {[
                          { label: "Same-Day", desc: "Delivery within 24hrs", icon: Clock },
                          { label: "Nationwide", desc: "All major African cities", icon: MapPin },
                          { label: "Live Tracking", desc: "Know where your parcel is", icon: Navigation },
                          { label: "Insured", desc: "All deliveries covered", icon: Package },
                        ].map(f => (
                          <div key={f.label} className="bg-muted/50 rounded-xl p-4 border flex flex-col items-center gap-2">
                            <f.icon className="w-5 h-5 text-blue-500" />
                            <p className="font-semibold">{f.label}</p>
                            <p className="text-xs text-muted-foreground text-center">{f.desc}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </>
            )}

            {/* ── E-TAXI ── */}
            {activeSection === "etaxi" && (
              <>
                <motion.div variants={itemVariants}>
                  <h2 className="text-2xl font-bold mb-1">E-Taxi</h2>
                  <p className="text-muted-foreground text-sm mb-6">Book safe, affordable rides on demand across Africa.</p>
                </motion.div>
                <motion.div variants={itemVariants}>
                  <Card className="shadow-md border-2 border-dashed border-muted-foreground/20">
                    <CardContent className="pt-12 pb-14 text-center">
                      <div className="w-24 h-24 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Car className="w-12 h-12 text-amber-400" />
                      </div>
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-sm px-4 py-1.5 mb-4">Coming Soon</Badge>
                      <h3 className="text-2xl font-bold mb-3">E-Taxi Service Launching Soon</h3>
                      <p className="text-muted-foreground max-w-md mx-auto leading-relaxed mb-8">
                        Book verified, professional drivers for city trips, airport transfers, and inter-city travel — at transparent, competitive rates with real-time tracking and in-app communication.
                      </p>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-2xl mx-auto text-sm">
                        {[
                          { label: "Rated Drivers", desc: "Verified & professional", icon: Star },
                          { label: "Live Tracking", desc: "Know your driver's location", icon: Navigation },
                          { label: "Airport Transfer", desc: "Punctual airport pickups", icon: MapPin },
                          { label: "24/7 Support", desc: "Always available", icon: Phone },
                        ].map(f => (
                          <div key={f.label} className="bg-muted/50 rounded-xl p-4 border flex flex-col items-center gap-2">
                            <f.icon className="w-5 h-5 text-amber-500" />
                            <p className="font-semibold">{f.label}</p>
                            <p className="text-xs text-muted-foreground text-center">{f.desc}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </>
            )}

          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
