import { Switch, Route, useLocation } from "wouter";
import { Component, ReactNode, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { LocalCurrencyProvider } from "@/contexts/LocalCurrencyContext";
import NotFound from "@/pages/not-found";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Onboarding from "@/pages/Onboarding";
import StudentDashboard from "@/pages/StudentDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import LeadershipSponsorship from "@/pages/LeadershipSponsorship";
import AboutUs from "@/pages/AboutUs";
import ContactUs from "@/pages/ContactUs";
import AffiliateSignup from "@/pages/AffiliateSignup";
import AffiliateDashboard from "@/pages/AffiliateDashboard";
import TourAfrica from "@/pages/TourAfrica";
import TenancyPage from "@/pages/TenancyPage";
import TermsAndConditions from "@/pages/TermsAndConditions";
import UserProfile from "@/pages/UserProfile";
import PromoLanding from "@/pages/PromoLanding";
import ScholarshipPortal from "@/pages/ScholarshipPortal";
import { AiAssistant } from "@/components/AiAssistant";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null; componentStack: string | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null, componentStack: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: { componentStack: string }) {
    this.setState({ componentStack: info.componentStack });
    console.error("[ErrorBoundary] Crash:", error.message, "\nComponent stack:", info.componentStack, "\nError stack:", error.stack);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: "monospace", background: "#1a1a2e", color: "#e94560", minHeight: "100vh" }}>
          <h2 style={{ fontSize: 22, marginBottom: 16, color: "#f5a623" }}>App Crashed — Runtime Error</h2>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", background: "#16213e", padding: 20, borderRadius: 8, color: "#e0e0e0", fontSize: 12 }}>
            {this.state.error.message}{"\n\n"}
            {this.state.componentStack ? `Component Stack:${this.state.componentStack}\n\n` : ""}
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => { this.setState({ error: null, componentStack: null }); window.location.reload(); }}
            style={{ marginTop: 24, padding: "10px 24px", background: "#f5a623", color: "#1a1a2e", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold", fontSize: 14 }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/register">{() => { window.location.replace("/signup" + window.location.search); return null; }}</Route>
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/dashboard" component={StudentDashboard} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/leadership" component={LeadershipSponsorship} />
      <Route path="/about" component={AboutUs} />
      <Route path="/contact" component={ContactUs} />
      <Route path="/affiliate-signup" component={AffiliateSignup} />
      <Route path="/affiliate-dashboard" component={AffiliateDashboard} />
      <Route path="/trade-market">{() => { window.location.replace("/affiliate-dashboard?section=trade"); return null; }}</Route>
      <Route path="/tour-africa" component={TourAfrica} />
      <Route path="/tenancy" component={TenancyPage} />
      <Route path="/terms" component={TermsAndConditions} />
      <Route path="/wallet">{() => { window.location.replace("/student-dashboard"); return null; }}</Route>
      <Route path="/profile" component={UserProfile} />
      <Route path="/promo" component={PromoLanding} />
      <Route path="/scholarship" component={ScholarshipPortal} />
      <Route component={NotFound} />
    </Switch>
  );
}

// ── Subdomain routing ─────────────────────────────────────────────────────────
// Maps known subdomain prefixes to the corresponding AffiliateDashboard section.
// Add entries here to support additional subdomains in the future.
const SUBDOMAIN_SECTIONS: Record<string, string> = {
  shop:       "ecommerce",
  ecommerce:  "ecommerce",
  store:      "ecommerce",
  tsmart:     "ecommerce",
  trade:      "trade",
  trading:    "trade",
  market:     "trade",
};

const SESSION_KEY = "tsia_subdomain_section";

function detectSubdomainSection(): string | null {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const sub = hostname.split(".")[0].toLowerCase();
  return SUBDOMAIN_SECTIONS[sub] ?? null;
}

function SubdomainRedirect() {
  useEffect(() => {
    const section = detectSubdomainSection();
    if (!section) return;

    // Persist so Login.tsx can restore it after a login redirect.
    sessionStorage.setItem(SESSION_KEY, section);

    const path = window.location.pathname;
    const hasSection = window.location.search.includes("section=");

    // Redirect at root or at the dashboard landing (no section yet).
    if (path === "/" || path === "" || (path === "/affiliate-dashboard" && !hasSection)) {
      window.location.replace(`/affiliate-dashboard?section=${section}`);
    }
  }, []);

  return null;
}

function ConditionalAiAssistant() {
  const [location] = useLocation();
  if (location === "/promo") return null;
  return <AiAssistant />;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <LocalCurrencyProvider>
            <AuthProvider>
              <TooltipProvider>
                <SubdomainRedirect />
                <Toaster />
                <Router />
                <ConditionalAiAssistant />
              </TooltipProvider>
            </AuthProvider>
          </LocalCurrencyProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
