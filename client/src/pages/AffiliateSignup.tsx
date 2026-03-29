import { useEffect } from "react";
import { useLocation } from "wouter";

// Redirect to the unified signup page with the affiliate role pre-selected
export default function AffiliateSignup() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/signup?role=affiliate"); }, []);
  return null;
}
