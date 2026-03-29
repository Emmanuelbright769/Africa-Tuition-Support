import { createContext, useContext, useEffect, useRef, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "./queryClient";
import { queryClient } from "./queryClient";

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

type AuthUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  phone?: string;
  country?: string;
  affiliateCode?: string;
};

type AuthContextType = {
  user: AuthUser | null | undefined;
  isLoading: boolean;
  requestOtp: (data: { email: string; firstName?: string; lastName?: string; phone?: string; country?: string; role?: string; referralCode?: string; loginRole?: string }) => Promise<{ otpSent?: boolean; hint?: string; isNewUser?: boolean; multipleRoles?: boolean; roles?: string[] }>;
  verifyOtp: (email: string, code: string, loginRole?: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>(null!);

function clearSessionCache() {
  queryClient.setQueryData(["/api/auth/me"], null);
  queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "/api/auth/me" });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.status === 401) return null;
        if (!res.ok) return null;
        return res.json();
      } catch {
        return null;
      }
    },
    staleTime: Infinity,
    retry: false,
  });

  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const doAutoLogout = async () => {
    if (!userRef.current) return;
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch {}
    clearSessionCache();
    window.location.href = "/login?reason=inactivity";
  };

  const resetTimer = () => {
    if (!userRef.current) return;
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(doAutoLogout, INACTIVITY_TIMEOUT_MS);
  };

  useEffect(() => {
    if (!user) {
      if (inactivityTimer.current) { clearTimeout(inactivityTimer.current); inactivityTimer.current = null; }
      return;
    }
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    const handler = () => resetTimer();
    events.forEach(e => window.addEventListener(e, handler, { passive: true }));
    resetTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [user]);

  const requestOtp = async (data: { email: string; firstName?: string; lastName?: string; phone?: string; country?: string; role?: string; referralCode?: string; loginRole?: string }) => {
    const res = await apiRequest("POST", "/api/auth/request-otp", data);
    return res.json();
  };

  const verifyOtp = async (email: string, code: string, loginRole?: string): Promise<AuthUser> => {
    const res = await apiRequest("POST", "/api/auth/verify-otp", { email, code, ...(loginRole ? { loginRole } : {}) });
    const userData = await res.json();
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "/api/auth/me" });
    queryClient.setQueryData(["/api/auth/me"], userData);
    return userData;
  };

  const logout = async () => {
    if (inactivityTimer.current) { clearTimeout(inactivityTimer.current); inactivityTimer.current = null; }
    try { await apiRequest("POST", "/api/auth/logout"); } catch {}
    clearSessionCache();
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, requestOtp, verifyOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
