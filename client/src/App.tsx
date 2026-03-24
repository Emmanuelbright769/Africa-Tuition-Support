import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
