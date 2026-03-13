import { createContext, useContext, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "./queryClient";
import { queryClient } from "./queryClient";

type AuthUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  phone?: string;
  country?: string;
};

type AuthContextType = {
  user: AuthUser | null | undefined;
  isLoading: boolean;
  requestOtp: (data: { email: string; firstName?: string; lastName?: string; phone?: string; country?: string }) => Promise<{ otpSent: boolean; hint?: string; isNewUser?: boolean }>;
  verifyOtp: (email: string, code: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>(null!);

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

  const requestOtp = async (data: { email: string; firstName?: string; lastName?: string; phone?: string; country?: string }) => {
    const res = await apiRequest("POST", "/api/auth/request-otp", data);
    return res.json();
  };

  const verifyOtp = async (email: string, code: string): Promise<AuthUser> => {
    const res = await apiRequest("POST", "/api/auth/verify-otp", { email, code });
    const userData = await res.json();
    queryClient.setQueryData(["/api/auth/me"], userData);
    return userData;
  };

  const logout = async () => {
    await apiRequest("POST", "/api/auth/logout");
    queryClient.setQueryData(["/api/auth/me"], null);
    queryClient.clear();
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
