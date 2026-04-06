import { Switch, Route } from "wouter";
import { Component, ReactNode } from "react";
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
import WalletPage from "@/pages/WalletPage";
import { AiAssistant } from "@/components/AiAssistant";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: "monospace", background: "#1a1a2e", color: "#e94560", minHeight: "100vh" }}>
          <h2 style={{ fontSize: 22, marginBottom: 16, color: "#f5a623" }}>App Crashed — Runtime Error</h2>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", background: "#16213e", padding: 20, borderRadius: 8, color: "#e0e0e0" }}>
            {this.state.error.message}{"\n\n"}{this.state.error.stack}
          </pre>
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
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/dashboard" component={StudentDashboard} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/leadership" component={LeadershipSponsorship} />
      <Route path="/about" component={AboutUs} />
      <Route path="/contact" component={ContactUs} />
      <Route path="/affiliate-signup" component={AffiliateSignup} />
      <Route path="/affiliate-dashboard" component={AffiliateDashboard} />
      <Route path="/tour-africa" component={TourAfrica} />
      <Route path="/tenancy" component={TenancyPage} />
      <Route path="/terms" component={TermsAndConditions} />
      <Route path="/wallet" component={WalletPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <LocalCurrencyProvider>
            <AuthProvider>
              <TooltipProvider>
                <Toaster />
                <Router />
                <AiAssistant />
              </TooltipProvider>
            </AuthProvider>
          </LocalCurrencyProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
