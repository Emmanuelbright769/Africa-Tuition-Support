import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, Briefcase, ArrowLeftRight, Loader2, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface LinkedRoles {
  roles: string[];
  currentRole: string;
}

export function DashboardSwitcher() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [switching, setSwitching] = useState(false);

  const { data } = useQuery<LinkedRoles>({
    queryKey: ["/api/auth/linked-roles"],
    queryFn: () => apiRequest("GET", "/api/auth/linked-roles").then(r => r.json()),
    staleTime: 60_000,
    enabled: !!user,
  });

  const switchMutation = useMutation({
    mutationFn: (targetRole: string) =>
      apiRequest("POST", "/api/auth/switch-role", { targetRole }).then(r => {
        if (!r.ok) return r.json().then(e => Promise.reject(new Error(e.error || "Switch failed")));
        return r.json();
      }),
    onSuccess: (newUser) => {
      queryClient.setQueryData(["/api/auth/me"], newUser);
      queryClient.removeQueries({ predicate: q => (q.queryKey[0] as string) !== "/api/auth/me" });
      setSwitching(false);
      if (newUser.role === "affiliate") {
        setLocation("/affiliate-dashboard");
        toast({ title: "Switched to Business Dashboard", description: "Welcome to your affiliate dashboard." });
      } else {
        setLocation("/dashboard");
        toast({ title: "Switched to Student Dashboard", description: "Welcome back to your student dashboard." });
      }
    },
    onError: (e: any) => {
      setSwitching(false);
      toast({ title: "Could not switch", description: e.message, variant: "destructive" });
    },
  });

  if (!data || !user) return null;

  const currentRole = user.role;
  const hasOtherRole = data.roles.some(r => r !== currentRole && r !== "admin");
  const otherRole = data.roles.find(r => r !== currentRole && r !== "admin");

  return (
    <div className="relative">
      <AnimatePresence>
        {/* Switch button — icon + short label on larger screens */}
        {hasOtherRole && otherRole && (
          <motion.button
            key="switch-btn"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => { setSwitching(true); switchMutation.mutate(otherRole); }}
            disabled={switchMutation.isPending}
            data-testid="button-switch-dashboard"
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-muted hover:bg-muted/80 border border-border transition-all text-sm font-semibold text-foreground shadow-sm hover:shadow-md active:scale-95"
            title={`Switch to ${otherRole === "affiliate" ? "Business" : "Student"} Dashboard`}
          >
            {switchMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <ArrowLeftRight className="w-4 h-4 shrink-0 text-muted-foreground" />
            )}
            <span className="hidden sm:flex items-center gap-1">
              {otherRole === "affiliate" ? (
                <>
                  <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-blue-600 text-xs">Business</span>
                </>
              ) : (
                <>
                  <GraduationCap className="w-3.5 h-3.5 text-tsia-green" />
                  <span className="text-tsia-green text-xs">Student</span>
                </>
              )}
            </span>
          </motion.button>
        )}

        {/* Add account — compact "+" icon only */}
        {!hasOtherRole && (
          <motion.a
            key="add-account"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            href={`/signup?role=${currentRole === "student" ? "affiliate" : "student"}`}
            data-testid="link-add-account-type"
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-muted/60 hover:bg-muted border border-dashed border-border transition-colors text-muted-foreground hover:text-foreground"
            title={`Add a ${currentRole === "student" ? "Business (Affiliate)" : "Student"} account`}
          >
            <Plus className="w-4 h-4" />
          </motion.a>
        )}
      </AnimatePresence>
    </div>
  );
}
