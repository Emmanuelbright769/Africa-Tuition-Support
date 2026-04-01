import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  LogOut, Sun, Moon, Monitor, Menu, X, ChevronRight,
  MapPin, Car, Package, Clock, Star, Navigation,
  Truck, Globe, Phone, ArrowRight, LayoutDashboard,
  Hotel, Plane, CheckCircle2, Calendar, Users, Loader2,
  Wallet, AlertCircle, History, Tag,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/ui/Logo";
import { apiRequest } from "@/lib/queryClient";
import { useLocalCurrency } from "@/contexts/LocalCurrencyContext";

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.07 } } };
const itemVariants = { hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } };

type TourSection = "overview" | "dispatch" | "etaxi" | "hotel" | "car_hire" | "flight" | "bookings";

const TOUR_NAV: { id: TourSection; label: string; icon: any; badge?: string }[] = [
  { id: "overview",  label: "Overview",         icon: LayoutDashboard },
  { id: "hotel",     label: "Hotel Reservation", icon: Hotel },
  { id: "car_hire",  label: "Car Hire",          icon: Car },
  { id: "flight",    label: "Flight Booking",    icon: Plane },
  { id: "dispatch",  label: "Dispatch",          icon: Package,  badge: "Coming Soon" },
  { id: "etaxi",     label: "E-Taxi",            icon: Car,      badge: "Coming Soon" },
  { id: "bookings",  label: "My Bookings",       icon: History },
];

export default function TourAfrica() {
  const [, setLocation] = useLocation();
  const { user, logout, isLoading: authLoading } = useAuth();
  const { mode, setMode } = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { formatAmount } = useLocalCurrency();
  const [activeSection, setActiveSection] = useState<TourSection>("overview");
  const [menuOpen, setMenuOpen] = useState(false);

  // Hotel form state
  const [hotelForm, setHotelForm] = useState({ city: "", hotelName: "", checkIn: "", checkOut: "", guests: "1", rooms: "1", pricePerNight: "" });
  const [hotelConfirmOpen, setHotelConfirmOpen] = useState(false);

  // Car hire form state
  const [carForm, setCarForm] = useState({ pickupCity: "", dropoffCity: "", pickupDate: "", returnDate: "", carType: "Economy", driver: "self", pricePerDay: "" });
  const [carConfirmOpen, setCarConfirmOpen] = useState(false);

  // Flight form state
  const [flightForm, setFlightForm] = useState({ from: "", to: "", departDate: "", returnDate: "", passengers: "1", class: "Economy", ticketPrice: "" });
  const [flightConfirmOpen, setFlightConfirmOpen] = useState(false);

  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (authLoading) return;
    if (!user) { redirectTimerRef.current = setTimeout(() => setLocation("/login"), 200); }
    else if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    return () => { if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current); };
  }, [authLoading, user]);

  const { data: wallet } = useQuery({ queryKey: ["/api/wallet"] });
  const { data: bookings, refetch: refetchBookings } = useQuery({ queryKey: ["/api/tour/bookings"] });

  const bookMutation = useMutation({
    mutationFn: (data: { type: string; details: object; amount: number }) =>
      apiRequest("POST", "/api/tour/book", data),
    onSuccess: (data: any) => {
      toast({ title: "Booking Confirmed!", description: `Ref: ${data.reference}. $${data.totalAmount} charged from wallet.` });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tour/bookings"] });
      setHotelConfirmOpen(false);
      setCarConfirmOpen(false);
      setFlightConfirmOpen(false);
      setActiveSection("bookings");
    },
    onError: (e: any) => {
      const msg = e.message || "Booking failed";
      toast({ title: "Booking Failed", description: msg, variant: "destructive" });
    },
  });

  const handleLogout = async () => { await logout(); setLocation("/"); };
  const walletBalance = parseFloat((wallet as any)?.balance || "0");
  const COMMISSION_RATE = 0.10;

  // Hotel calculations
  const hotelNights = hotelForm.checkIn && hotelForm.checkOut
    ? Math.max(1, Math.ceil((new Date(hotelForm.checkOut).getTime() - new Date(hotelForm.checkIn).getTime()) / 86400000))
    : 1;
  const hotelTotal = parseFloat(hotelForm.pricePerNight || "0") * hotelNights * parseInt(hotelForm.rooms || "1");

  // Car hire calculations
  const carDays = carForm.pickupDate && carForm.returnDate
    ? Math.max(1, Math.ceil((new Date(carForm.returnDate).getTime() - new Date(carForm.pickupDate).getTime()) / 86400000))
    : 1;
  const carTotal = parseFloat(carForm.pricePerDay || "0") * carDays;

  // Flight calculations
  const flightTotal = parseFloat(flightForm.ticketPrice || "0") * parseInt(flightForm.passengers || "1");

  if (authLoading || (!user && !authLoading)) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  const themeOpts = [{ v: "light" as const, i: Sun }, { v: "dark" as const, i: Moon }, { v: "system" as const, i: Monitor }];
  const navigate = (s: TourSection) => { setActiveSection(s); setMenuOpen(false); };
  const currentNav = TOUR_NAV.find(n => n.id === activeSection)!;
  const backPath = user?.role === "affiliate" ? "/affiliate-dashboard" : "/dashboard";

  const BookingSummaryRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );

  const WalletBadge = () => (
    <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl text-xs font-semibold text-green-700 dark:text-green-400">
      <Wallet className="w-3.5 h-3.5" /> Wallet: ${walletBalance.toFixed(2)} <span className="font-normal opacity-70">({formatAmount(walletBalance)})</span>
    </div>
  );

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
            <div className="hidden sm:block"><WalletBadge /></div>
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
                    <p className="text-xs text-muted-foreground">Travel & Transport</p>
                  </div>
                </div>
                <button onClick={() => setMenuOpen(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-3 border-b"><WalletBadge /></div>
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
                          <p className="text-green-200 text-sm">Hotels · Car Hire · Flights · Dispatch · E-Taxi</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                <div className="grid sm:grid-cols-3 gap-5">
                  {[
                    { id: "hotel" as TourSection, icon: Hotel, title: "Hotel Reservation", desc: "Find and book hotels, lodges, and guesthouses across Africa.", color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-200 dark:border-purple-800", live: true },
                    { id: "car_hire" as TourSection, icon: Car, title: "Car Hire", desc: "Hire self-drive or chauffeured vehicles for local and inter-city trips.", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200 dark:border-blue-800", live: true },
                    { id: "flight" as TourSection, icon: Plane, title: "Flight Booking", desc: "Book direct and connecting flights to any African destination.", color: "text-sky-600", bg: "bg-sky-50 dark:bg-sky-900/20", border: "border-sky-200 dark:border-sky-800", live: true },
                    { id: "dispatch" as TourSection, icon: Package, title: "Dispatch", desc: "Send packages and parcels to any location across Africa.", color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200 dark:border-amber-800", live: false },
                    { id: "etaxi" as TourSection, icon: Car, title: "E-Taxi", desc: "Book verified, rated drivers for city rides and airport transfers.", color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20", border: "border-green-200 dark:border-green-800", live: false },
                  ].map(service => (
                    <motion.div key={service.id} variants={itemVariants}>
                      <Card className={`shadow-md border-2 ${service.border} h-full cursor-pointer hover:shadow-lg transition-shadow`} onClick={() => navigate(service.id)}>
                        <CardContent className="pt-6 pb-6">
                          <div className={`w-12 h-12 ${service.bg} rounded-xl flex items-center justify-center mb-4`}>
                            <service.icon className={`w-6 h-6 ${service.color}`} />
                          </div>
                          <div className="flex items-center gap-2 mb-3">
                            <h3 className="text-lg font-bold">{service.title}</h3>
                            {service.live
                              ? <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 text-xs">Live</Badge>
                              : <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-xs">Coming Soon</Badge>}
                          </div>
                          <p className="text-muted-foreground text-sm leading-relaxed mb-4">{service.desc}</p>
                          <Button className="w-full mt-auto h-10" variant={service.live ? "default" : "outline"} data-testid={`button-go-${service.id}`}>
                            {service.live ? "Book Now" : "Learn More"} <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                  <motion.div variants={itemVariants}>
                    <Card className="shadow-md h-full border-2 border-dashed border-green-300 dark:border-green-800 cursor-pointer hover:shadow-lg" onClick={() => navigate("bookings")}>
                      <CardContent className="pt-6 pb-6 flex flex-col items-center justify-center text-center h-full min-h-[180px] gap-3">
                        <History className="w-8 h-8 text-muted-foreground" />
                        <p className="font-semibold">My Bookings</p>
                        <p className="text-xs text-muted-foreground">View all your past and upcoming bookings</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>

                <motion.div variants={itemVariants}>
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-5 flex items-start gap-4">
                    <Tag className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">10% TSIA Service Commission</p>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">All Tour Africa bookings are paid directly from your TSIA Personal Wallet. TSIA retains 10% as a service commission. The net amount is forwarded to the service provider.</p>
                    </div>
                  </div>
                </motion.div>
              </>
            )}

            {/* ── HOTEL RESERVATION ── */}
            {activeSection === "hotel" && (
              <>
                <motion.div variants={itemVariants}>
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-2xl font-bold">Hotel Reservation</h2>
                    <WalletBadge />
                  </div>
                  <p className="text-muted-foreground text-sm mb-6">Book hotels across Africa. Payment deducted from your TSIA wallet.</p>
                </motion.div>
                <motion.div variants={itemVariants}>
                  <Card className="shadow-md border-0">
                    <CardHeader><CardTitle className="flex items-center gap-2"><Hotel className="w-5 h-5 text-purple-600" /> Book a Hotel</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>City / Destination *</Label>
                          <Input placeholder="e.g. Lagos, Nairobi, Accra" value={hotelForm.city} onChange={e => setHotelForm(f => ({ ...f, city: e.target.value }))} data-testid="input-hotel-city" />
                        </div>
                        <div className="space-y-2">
                          <Label>Hotel / Property Name *</Label>
                          <Input placeholder="e.g. Eko Hotel, Sarova Stanley" value={hotelForm.hotelName} onChange={e => setHotelForm(f => ({ ...f, hotelName: e.target.value }))} data-testid="input-hotel-name" />
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Check-in Date *</Label>
                          <Input type="date" value={hotelForm.checkIn} onChange={e => setHotelForm(f => ({ ...f, checkIn: e.target.value }))} data-testid="input-hotel-checkin" />
                        </div>
                        <div className="space-y-2">
                          <Label>Check-out Date *</Label>
                          <Input type="date" value={hotelForm.checkOut} onChange={e => setHotelForm(f => ({ ...f, checkOut: e.target.value }))} data-testid="input-hotel-checkout" />
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Guests</Label>
                          <Input type="number" min="1" max="20" value={hotelForm.guests} onChange={e => setHotelForm(f => ({ ...f, guests: e.target.value }))} data-testid="input-hotel-guests" />
                        </div>
                        <div className="space-y-2">
                          <Label>Rooms</Label>
                          <Input type="number" min="1" max="10" value={hotelForm.rooms} onChange={e => setHotelForm(f => ({ ...f, rooms: e.target.value }))} data-testid="input-hotel-rooms" />
                        </div>
                        <div className="space-y-2">
                          <Label>Price per Night (USD) *</Label>
                          <Input type="number" min="1" placeholder="0.00" value={hotelForm.pricePerNight} onChange={e => setHotelForm(f => ({ ...f, pricePerNight: e.target.value }))} data-testid="input-hotel-price" />
                          {parseFloat(hotelForm.pricePerNight) > 0 && (
                            <p className="text-xs text-muted-foreground">≈ {formatAmount(parseFloat(hotelForm.pricePerNight))} per night</p>
                          )}
                        </div>
                      </div>

                      {hotelTotal > 0 && (
                        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4 space-y-2 text-sm">
                          <BookingSummaryRow label="Stay duration" value={`${hotelNights} night(s) × ${hotelForm.rooms} room(s)`} />
                          <BookingSummaryRow label="Sub-total" value={`$${hotelTotal.toFixed(2)} (${formatAmount(hotelTotal)})`} />
                          <BookingSummaryRow label="TSIA commission (10%)" value={`$${(hotelTotal * COMMISSION_RATE).toFixed(2)}`} />
                          <div className="border-t pt-2 flex justify-between font-bold">
                            <span>Total charged to wallet</span>
                            <div className="text-right">
                              <span className="text-purple-700 dark:text-purple-400">${hotelTotal.toFixed(2)}</span>
                              <p className="text-[10px] font-normal text-muted-foreground">{formatAmount(hotelTotal)}</p>
                            </div>
                          </div>
                          {walletBalance < hotelTotal && (
                            <div className="flex items-center gap-2 text-red-600 text-xs pt-1">
                              <AlertCircle className="w-3.5 h-3.5" /> Insufficient wallet balance
                            </div>
                          )}
                        </div>
                      )}

                      <Button className="w-full h-11 font-semibold bg-purple-600 hover:bg-purple-700 text-white"
                        disabled={!hotelForm.city || !hotelForm.hotelName || !hotelForm.checkIn || !hotelForm.checkOut || !hotelForm.pricePerNight || hotelTotal <= 0}
                        onClick={() => setHotelConfirmOpen(true)}
                        data-testid="button-hotel-book">
                        <Hotel className="w-4 h-4 mr-2" /> Review & Book Hotel
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              </>
            )}

            {/* ── CAR HIRE ── */}
            {activeSection === "car_hire" && (
              <>
                <motion.div variants={itemVariants}>
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-2xl font-bold">Car Hire</h2>
                    <WalletBadge />
                  </div>
                  <p className="text-muted-foreground text-sm mb-6">Hire a vehicle for local or inter-city travel across Africa.</p>
                </motion.div>
                <motion.div variants={itemVariants}>
                  <Card className="shadow-md border-0">
                    <CardHeader><CardTitle className="flex items-center gap-2"><Car className="w-5 h-5 text-blue-600" /> Hire a Car</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Pick-up City *</Label>
                          <Input placeholder="e.g. Abuja, Kumasi, Dar es Salaam" value={carForm.pickupCity} onChange={e => setCarForm(f => ({ ...f, pickupCity: e.target.value }))} data-testid="input-car-pickup" />
                        </div>
                        <div className="space-y-2">
                          <Label>Drop-off City *</Label>
                          <Input placeholder="Same or different city" value={carForm.dropoffCity} onChange={e => setCarForm(f => ({ ...f, dropoffCity: e.target.value }))} data-testid="input-car-dropoff" />
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Pick-up Date *</Label>
                          <Input type="date" value={carForm.pickupDate} onChange={e => setCarForm(f => ({ ...f, pickupDate: e.target.value }))} data-testid="input-car-pickup-date" />
                        </div>
                        <div className="space-y-2">
                          <Label>Return Date *</Label>
                          <Input type="date" value={carForm.returnDate} onChange={e => setCarForm(f => ({ ...f, returnDate: e.target.value }))} data-testid="input-car-return-date" />
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Car Type</Label>
                          <select className="w-full h-10 px-3 border rounded-md bg-background text-sm" value={carForm.carType} onChange={e => setCarForm(f => ({ ...f, carType: e.target.value }))} data-testid="select-car-type">
                            {["Economy", "Compact", "Midsize", "SUV", "Luxury", "Van/Minibus"].map(t => <option key={t}>{t}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label>Driver</Label>
                          <select className="w-full h-10 px-3 border rounded-md bg-background text-sm" value={carForm.driver} onChange={e => setCarForm(f => ({ ...f, driver: e.target.value }))} data-testid="select-car-driver">
                            <option value="self">Self-drive</option>
                            <option value="chauffeured">With Chauffeur</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label>Price per Day (USD) *</Label>
                          <Input type="number" min="1" placeholder="0.00" value={carForm.pricePerDay} onChange={e => setCarForm(f => ({ ...f, pricePerDay: e.target.value }))} data-testid="input-car-price" />
                          {parseFloat(carForm.pricePerDay) > 0 && (
                            <p className="text-xs text-muted-foreground">≈ {formatAmount(parseFloat(carForm.pricePerDay))} per day</p>
                          )}
                        </div>
                      </div>

                      {carTotal > 0 && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-2 text-sm">
                          <BookingSummaryRow label="Rental duration" value={`${carDays} day(s) · ${carForm.carType} · ${carForm.driver === "self" ? "Self-drive" : "With Chauffeur"}`} />
                          <BookingSummaryRow label="Sub-total" value={`$${carTotal.toFixed(2)} (${formatAmount(carTotal)})`} />
                          <BookingSummaryRow label="TSIA commission (10%)" value={`$${(carTotal * COMMISSION_RATE).toFixed(2)}`} />
                          <div className="border-t pt-2 flex justify-between font-bold">
                            <span>Total charged to wallet</span>
                            <div className="text-right">
                              <span className="text-blue-700 dark:text-blue-400">${carTotal.toFixed(2)}</span>
                              <p className="text-[10px] font-normal text-muted-foreground">{formatAmount(carTotal)}</p>
                            </div>
                          </div>
                          {walletBalance < carTotal && (
                            <div className="flex items-center gap-2 text-red-600 text-xs pt-1">
                              <AlertCircle className="w-3.5 h-3.5" /> Insufficient wallet balance
                            </div>
                          )}
                        </div>
                      )}

                      <Button className="w-full h-11 font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                        disabled={!carForm.pickupCity || !carForm.dropoffCity || !carForm.pickupDate || !carForm.returnDate || !carForm.pricePerDay || carTotal <= 0}
                        onClick={() => setCarConfirmOpen(true)}
                        data-testid="button-car-book">
                        <Car className="w-4 h-4 mr-2" /> Review & Book Car
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              </>
            )}

            {/* ── FLIGHT BOOKING ── */}
            {activeSection === "flight" && (
              <>
                <motion.div variants={itemVariants}>
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-2xl font-bold">Flight Booking</h2>
                    <WalletBadge />
                  </div>
                  <p className="text-muted-foreground text-sm mb-6">Reserve flights to any African destination, paid from your TSIA wallet.</p>
                </motion.div>
                <motion.div variants={itemVariants}>
                  <Card className="shadow-md border-0">
                    <CardHeader><CardTitle className="flex items-center gap-2"><Plane className="w-5 h-5 text-sky-600" /> Book a Flight</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Flying From *</Label>
                          <Input placeholder="Departure city / airport code" value={flightForm.from} onChange={e => setFlightForm(f => ({ ...f, from: e.target.value }))} data-testid="input-flight-from" />
                        </div>
                        <div className="space-y-2">
                          <Label>Flying To *</Label>
                          <Input placeholder="Destination city / airport code" value={flightForm.to} onChange={e => setFlightForm(f => ({ ...f, to: e.target.value }))} data-testid="input-flight-to" />
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Departure Date *</Label>
                          <Input type="date" value={flightForm.departDate} onChange={e => setFlightForm(f => ({ ...f, departDate: e.target.value }))} data-testid="input-flight-depart" />
                        </div>
                        <div className="space-y-2">
                          <Label>Return Date (optional)</Label>
                          <Input type="date" value={flightForm.returnDate} onChange={e => setFlightForm(f => ({ ...f, returnDate: e.target.value }))} data-testid="input-flight-return" />
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Passengers *</Label>
                          <Input type="number" min="1" max="9" value={flightForm.passengers} onChange={e => setFlightForm(f => ({ ...f, passengers: e.target.value }))} data-testid="input-flight-passengers" />
                        </div>
                        <div className="space-y-2">
                          <Label>Class</Label>
                          <select className="w-full h-10 px-3 border rounded-md bg-background text-sm" value={flightForm.class} onChange={e => setFlightForm(f => ({ ...f, class: e.target.value }))} data-testid="select-flight-class">
                            {["Economy", "Premium Economy", "Business", "First Class"].map(c => <option key={c}>{c}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label>Ticket Price per Person (USD) *</Label>
                          <Input type="number" min="1" placeholder="0.00" value={flightForm.ticketPrice} onChange={e => setFlightForm(f => ({ ...f, ticketPrice: e.target.value }))} data-testid="input-flight-price" />
                          {parseFloat(flightForm.ticketPrice) > 0 && (
                            <p className="text-xs text-muted-foreground">≈ {formatAmount(parseFloat(flightForm.ticketPrice))} per person</p>
                          )}
                        </div>
                      </div>

                      {flightTotal > 0 && (
                        <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-xl p-4 space-y-2 text-sm">
                          <BookingSummaryRow label="Route" value={`${flightForm.from} → ${flightForm.to}${flightForm.returnDate ? " (Return)" : " (One-way)"}`} />
                          <BookingSummaryRow label="Passengers × Ticket" value={`${flightForm.passengers} × $${parseFloat(flightForm.ticketPrice || "0").toFixed(2)}`} />
                          <BookingSummaryRow label="TSIA commission (10%)" value={`$${(flightTotal * COMMISSION_RATE).toFixed(2)}`} />
                          <div className="border-t pt-2 flex justify-between font-bold">
                            <span>Total charged to wallet</span>
                            <span className="text-sky-700 dark:text-sky-400">${flightTotal.toFixed(2)}</span>
                          </div>
                          {walletBalance < flightTotal && (
                            <div className="flex items-center gap-2 text-red-600 text-xs pt-1">
                              <AlertCircle className="w-3.5 h-3.5" /> Insufficient wallet balance
                            </div>
                          )}
                        </div>
                      )}

                      <Button className="w-full h-11 font-semibold bg-sky-600 hover:bg-sky-700 text-white"
                        disabled={!flightForm.from || !flightForm.to || !flightForm.departDate || !flightForm.ticketPrice || flightTotal <= 0}
                        onClick={() => setFlightConfirmOpen(true)}
                        data-testid="button-flight-book">
                        <Plane className="w-4 h-4 mr-2" /> Review & Book Flight
                      </Button>
                    </CardContent>
                  </Card>
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
                      <div className="w-24 h-24 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Truck className="w-12 h-12 text-amber-400" />
                      </div>
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-sm px-4 py-1.5 mb-4">Coming Soon</Badge>
                      <h3 className="text-2xl font-bold mb-3">Dispatch Service Launching Soon</h3>
                      <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
                        Send packages, documents, and parcels anywhere across Africa with same-day and next-day options, real-time tracking, and insurance on every delivery.
                      </p>
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
                      <div className="w-24 h-24 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Car className="w-12 h-12 text-green-400" />
                      </div>
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-sm px-4 py-1.5 mb-4">Coming Soon</Badge>
                      <h3 className="text-2xl font-bold mb-3">E-Taxi Service Launching Soon</h3>
                      <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
                        Book verified, professional drivers for city trips, airport transfers, and inter-city travel at competitive rates with real-time tracking.
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              </>
            )}

            {/* ── MY BOOKINGS ── */}
            {activeSection === "bookings" && (
              <>
                <motion.div variants={itemVariants}>
                  <h2 className="text-2xl font-bold mb-1">My Bookings</h2>
                  <p className="text-muted-foreground text-sm mb-6">All your Tour Africa bookings and their status.</p>
                </motion.div>
                <motion.div variants={itemVariants}>
                  <Card className="shadow-md border-0">
                    <CardContent className="pt-6">
                      {!bookings || (bookings as any[]).length === 0 ? (
                        <div className="text-center py-16">
                          <History className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                          <p className="font-semibold mb-1">No bookings yet</p>
                          <p className="text-sm text-muted-foreground">Your confirmed bookings will appear here.</p>
                          <Button className="mt-4" onClick={() => navigate("overview")}>Browse Services</Button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {(bookings as any[]).map((b: any) => {
                            const typeIcon = b.type === "hotel" ? Hotel : b.type === "car_hire" ? Car : Plane;
                            const TypeIcon = typeIcon;
                            const typeLabel = b.type === "hotel" ? "Hotel" : b.type === "car_hire" ? "Car Hire" : "Flight";
                            const typeColor = b.type === "hotel" ? "text-purple-600 bg-purple-50 dark:bg-purple-900/20" : b.type === "car_hire" ? "text-blue-600 bg-blue-50 dark:bg-blue-900/20" : "text-sky-600 bg-sky-50 dark:bg-sky-900/20";
                            const details = b.details as any;
                            return (
                              <div key={b.id} className="flex items-start gap-4 p-4 rounded-xl border" data-testid={`booking-${b.id}`}>
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${typeColor}`}>
                                  <TypeIcon className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <p className="font-semibold text-sm">{typeLabel}</p>
                                    <Badge className={`text-xs ${b.status === "confirmed" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                                      {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">{b.reference}</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {b.type === "hotel" && `${details?.city} · ${details?.hotelName} · ${details?.nights || 1} night(s)`}
                                    {b.type === "car_hire" && `${details?.pickupCity} → ${details?.dropoffCity} · ${details?.carType} · ${details?.days || 1} day(s)`}
                                    {b.type === "flight" && `${details?.from} → ${details?.to} · ${details?.passengers} pax · ${details?.class}`}
                                  </p>
                                  <div className="flex items-center justify-between mt-2">
                                    <span className="text-xs text-muted-foreground">{new Date(b.createdAt).toLocaleDateString()}</span>
                                    <span className="text-sm font-bold">${parseFloat(b.totalAmount).toFixed(2)}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </>
            )}

          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── HOTEL CONFIRM DIALOG ── */}
      <Dialog open={hotelConfirmOpen} onOpenChange={setHotelConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Hotel className="w-5 h-5 text-purple-600" /> Confirm Hotel Booking</DialogTitle>
            <DialogDescription>Review your booking details before payment.</DialogDescription>
          </DialogHeader>
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4 space-y-2 text-sm">
            <BookingSummaryRow label="Hotel" value={hotelForm.hotelName} />
            <BookingSummaryRow label="City" value={hotelForm.city} />
            <BookingSummaryRow label="Check-in" value={hotelForm.checkIn} />
            <BookingSummaryRow label="Check-out" value={hotelForm.checkOut} />
            <BookingSummaryRow label="Guests / Rooms" value={`${hotelForm.guests} guest(s) · ${hotelForm.rooms} room(s)`} />
            <BookingSummaryRow label="Duration" value={`${hotelNights} night(s) × $${hotelForm.pricePerNight}`} />
            <div className="border-t pt-2">
              <BookingSummaryRow label="TSIA commission (10%)" value={`$${(hotelTotal * COMMISSION_RATE).toFixed(2)}`} />
              <div className="flex justify-between font-bold text-base mt-1">
                <span>Total</span><span className="text-purple-700 dark:text-purple-400">${hotelTotal.toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Wallet balance after: ${Math.max(0, walletBalance - hotelTotal).toFixed(2)}</p>
            </div>
          </div>
          {walletBalance < hotelTotal && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 shrink-0" /> Insufficient wallet balance. Top up your wallet first.
            </div>
          )}
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setHotelConfirmOpen(false)}>Cancel</Button>
            <Button disabled={bookMutation.isPending || walletBalance < hotelTotal}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
              onClick={() => bookMutation.mutate({
                type: "hotel",
                details: { city: hotelForm.city, hotelName: hotelForm.hotelName, checkIn: hotelForm.checkIn, checkOut: hotelForm.checkOut, guests: hotelForm.guests, rooms: hotelForm.rooms, nights: hotelNights },
                amount: hotelTotal,
              })}
              data-testid="button-confirm-hotel">
              {bookMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...</> : "Confirm & Pay"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CAR HIRE CONFIRM DIALOG ── */}
      <Dialog open={carConfirmOpen} onOpenChange={setCarConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Car className="w-5 h-5 text-blue-600" /> Confirm Car Hire</DialogTitle>
            <DialogDescription>Review your car hire details before payment.</DialogDescription>
          </DialogHeader>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-2 text-sm">
            <BookingSummaryRow label="Pick-up" value={carForm.pickupCity} />
            <BookingSummaryRow label="Drop-off" value={carForm.dropoffCity} />
            <BookingSummaryRow label="Dates" value={`${carForm.pickupDate} → ${carForm.returnDate}`} />
            <BookingSummaryRow label="Vehicle" value={`${carForm.carType} · ${carForm.driver === "self" ? "Self-drive" : "With Chauffeur"}`} />
            <BookingSummaryRow label="Duration" value={`${carDays} day(s) × $${carForm.pricePerDay}`} />
            <div className="border-t pt-2">
              <BookingSummaryRow label="TSIA commission (10%)" value={`$${(carTotal * COMMISSION_RATE).toFixed(2)}`} />
              <div className="flex justify-between font-bold text-base mt-1">
                <span>Total</span><span className="text-blue-700 dark:text-blue-400">${carTotal.toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Wallet balance after: ${Math.max(0, walletBalance - carTotal).toFixed(2)}</p>
            </div>
          </div>
          {walletBalance < carTotal && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 shrink-0" /> Insufficient wallet balance. Top up your wallet first.
            </div>
          )}
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setCarConfirmOpen(false)}>Cancel</Button>
            <Button disabled={bookMutation.isPending || walletBalance < carTotal}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
              onClick={() => bookMutation.mutate({
                type: "car_hire",
                details: { pickupCity: carForm.pickupCity, dropoffCity: carForm.dropoffCity, pickupDate: carForm.pickupDate, returnDate: carForm.returnDate, carType: carForm.carType, driver: carForm.driver, days: carDays },
                amount: carTotal,
              })}
              data-testid="button-confirm-car">
              {bookMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...</> : "Confirm & Pay"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── FLIGHT CONFIRM DIALOG ── */}
      <Dialog open={flightConfirmOpen} onOpenChange={setFlightConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plane className="w-5 h-5 text-sky-600" /> Confirm Flight Booking</DialogTitle>
            <DialogDescription>Review your flight details before payment.</DialogDescription>
          </DialogHeader>
          <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-xl p-4 space-y-2 text-sm">
            <BookingSummaryRow label="Route" value={`${flightForm.from} → ${flightForm.to}`} />
            <BookingSummaryRow label="Departure" value={flightForm.departDate} />
            {flightForm.returnDate && <BookingSummaryRow label="Return" value={flightForm.returnDate} />}
            <BookingSummaryRow label="Passengers" value={`${flightForm.passengers} × ${flightForm.class}`} />
            <BookingSummaryRow label="Ticket price" value={`$${parseFloat(flightForm.ticketPrice || "0").toFixed(2)} per person`} />
            <div className="border-t pt-2">
              <BookingSummaryRow label="TSIA commission (10%)" value={`$${(flightTotal * COMMISSION_RATE).toFixed(2)}`} />
              <div className="flex justify-between font-bold text-base mt-1">
                <span>Total</span><span className="text-sky-700 dark:text-sky-400">${flightTotal.toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Wallet balance after: ${Math.max(0, walletBalance - flightTotal).toFixed(2)}</p>
            </div>
          </div>
          {walletBalance < flightTotal && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 shrink-0" /> Insufficient wallet balance. Top up your wallet first.
            </div>
          )}
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setFlightConfirmOpen(false)}>Cancel</Button>
            <Button disabled={bookMutation.isPending || walletBalance < flightTotal}
              className="bg-sky-600 hover:bg-sky-700 text-white font-bold"
              onClick={() => bookMutation.mutate({
                type: "flight",
                details: { from: flightForm.from, to: flightForm.to, departDate: flightForm.departDate, returnDate: flightForm.returnDate || null, passengers: flightForm.passengers, class: flightForm.class },
                amount: flightTotal,
              })}
              data-testid="button-confirm-flight">
              {bookMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...</> : "Confirm & Pay"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
