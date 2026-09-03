import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, parseApiError } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, User, Mail, Phone, Globe, Shield, Lock, Eye, EyeOff,
  CheckCircle2, KeyRound, GraduationCap, Briefcase,
  Loader2, MessageSquare, ExternalLink, MapPin,
  FileText, LogOut, UserRoundX, ChevronRight, AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { queryClient } from "@/lib/queryClient";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

const COUNTRIES = [
  { code: "ng", name: "Nigeria" }, { code: "gh", name: "Ghana" }, { code: "ke", name: "Kenya" },
  { code: "za", name: "South Africa" }, { code: "ug", name: "Uganda" }, { code: "tz", name: "Tanzania" },
  { code: "rw", name: "Rwanda" }, { code: "et", name: "Ethiopia" }, { code: "ci", name: "Côte d'Ivoire" },
  { code: "sn", name: "Senegal" }, { code: "cm", name: "Cameroon" }, { code: "eg", name: "Egypt" },
  { code: "ma", name: "Morocco" }, { code: "tn", name: "Tunisia" }, { code: "dz", name: "Algeria" },
  { code: "zm", name: "Zambia" }, { code: "zw", name: "Zimbabwe" }, { code: "ao", name: "Angola" },
  { code: "gb", name: "United Kingdom" }, { code: "us", name: "United States" }, { code: "ca", name: "Canada" },
  { code: "de", name: "Germany" }, { code: "fr", name: "France" }, { code: "ae", name: "UAE" },
  { code: "other", name: "Other" },
];

type SecurityStep = "idle" | "sending" | "otp" | "newpass" | "saving";
type EmailStep = "idle" | "sending" | "otp" | "newemail" | "saving";

export default function UserProfile() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  /* ─── Edit personal info ─── */
  const [editMode, setEditMode] = useState(false);
  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);

  /* ─── Change email ─── */
  const [emailStep, setEmailStep] = useState<EmailStep>("idle");
  const [emailOtpDigits, setEmailOtpDigits] = useState(["", "", "", "", "", ""]);
  const [newEmail, setNewEmail] = useState("");

  /* ─── Security / change password ─── */
  const [secStep, setSecStep] = useState<SecurityStep>("idle");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  /* ─── My Location ─── */
  const [selectedCountry, setSelectedCountry] = useState("");
  const [locationSaved, setLocationSaved] = useState(false);
  const [closeAccountOpen, setCloseAccountOpen] = useState(false);
  const [closeConfirmation, setCloseConfirmation] = useState("");
  const [closingAccount, setClosingAccount] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const locationMutation = useMutation({
    mutationFn: async (country: string) => {
      const res = await apiRequest("PATCH", "/api/user/country", { country });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Failed to update"); }
    },
    onSuccess: () => {
      setLocationSaved(true);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setTimeout(() => setLocationSaved(false), 3000);
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    setLocation("/login");
  };

  const handleCloseAccount = async () => {
    if (closeConfirmation !== "CLOSE MY ACCOUNT") return;
    setClosingAccount(true);
    try {
      const res = await apiRequest("POST", "/api/account/close", {
        confirmation: "CLOSE MY ACCOUNT",
      });
      if (!res.ok) {
        let message = "We couldn't close your account. Please try again.";
        try {
          const body = await res.json();
          message = body.message || message;
        } catch {}
        throw new Error(message);
      }
      await logout();
      window.location.href = "/login?reason=closed";
    } catch (err: any) {
      toast({ title: "Account not closed", description: parseApiError(err), variant: "destructive" });
    } finally {
      setClosingAccount(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading profile…</p>
      </div>
    );
  }

  const dashPath = user.role === "affiliate" ? "/affiliate-dashboard" : "/dashboard";
  /* ─── Start editing personal info ─── */
  const startEdit = () => {
    setEditFirst(user.firstName);
    setEditLast(user.lastName);
    setEditPhone(user.phone ?? "");
    setEditMode(true);
  };

  const cancelEdit = () => setEditMode(false);

  const handleSaveInfo = async () => {
    if (!editFirst.trim() || !editLast.trim()) {
      toast({ title: "Required", description: "First and last name are required.", variant: "destructive" });
      return;
    }
    setSavingInfo(true);
    try {
      const res = await apiRequest("PATCH", "/api/user/profile", {
        firstName: editFirst.trim(),
        lastName: editLast.trim(),
        phone: editPhone.trim() || undefined,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Failed to save"); }
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Profile updated", description: "Your personal info has been saved." });
      setEditMode(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingInfo(false);
    }
  };

  /* ─── Email change handlers ─── */
  const handleRequestEmailOtp = async () => {
    setEmailStep("sending");
    try {
      const res = await apiRequest("POST", "/api/auth/request-email-change-otp", {});
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      setEmailOtpDigits(["", "", "", "", "", ""]);
      setEmailStep("otp");
      toast({ title: "Code sent", description: "Enter the 6-digit code sent to your current email." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setEmailStep("idle");
    }
  };

  const handleEmailOtpChange = (i: number, v: string) => {
    if (v.length > 1) v = v.slice(-1);
    if (v && !/^\d$/.test(v)) return;
    const d = [...emailOtpDigits]; d[i] = v; setEmailOtpDigits(d);
    if (v && i < 5) (document.getElementById(`email-otp-${i + 1}`) as HTMLInputElement)?.focus();
  };

  const handleEmailOtpKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !emailOtpDigits[i] && i > 0)
      (document.getElementById(`email-otp-${i - 1}`) as HTMLInputElement)?.focus();
  };

  const handleEmailOtpContinue = () => {
    if (emailOtpDigits.join("").length !== 6) return;
    setNewEmail("");
    setEmailStep("newemail");
  };

  const handleChangeEmail = async () => {
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(newEmail.trim())) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    setEmailStep("saving");
    try {
      const res = await apiRequest("POST", "/api/auth/change-email", {
        otpCode: emailOtpDigits.join(""),
        newEmail: newEmail.trim(),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Failed to change email"); }
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Email updated!", description: "Your email address has been changed." });
      setEmailStep("idle");
      setEmailOtpDigits(["", "", "", "", "", ""]); setNewEmail("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setEmailStep("newemail");
    }
  };

  const resetEmailFlow = () => {
    setEmailStep("idle");
    setEmailOtpDigits(["", "", "", "", "", ""]); setNewEmail("");
  };

  /* ─── Request OTP for password change ─── */
  const handleRequestPasswordOtp = async () => {
    setSecStep("sending");
    try {
      const res = await apiRequest("POST", "/api/auth/request-password-otp", { email: user.email });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      setOtpDigits(["", "", "", "", "", ""]);
      setSecStep("otp");
      toast({ title: "Code sent", description: "Check your email for the 6-digit verification code." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setSecStep("idle");
    }
  };

  const handleOtpChange = (i: number, v: string) => {
    if (v.length > 1) v = v.slice(-1);
    if (v && !/^\d$/.test(v)) return;
    const d = [...otpDigits]; d[i] = v; setOtpDigits(d);
    if (v && i < 5) (document.getElementById(`sec-otp-${i + 1}`) as HTMLInputElement)?.focus();
  };

  const handleOtpKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpDigits[i] && i > 0)
      (document.getElementById(`sec-otp-${i - 1}`) as HTMLInputElement)?.focus();
  };

  const handleOtpContinue = () => {
    if (otpDigits.join("").length !== 6) return;
    setNewPassword(""); setNewPasswordConfirm("");
    setSecStep("newpass");
  };

  const handleSetPassword = async () => {
    if (newPassword.length < 8) {
      toast({ title: "Too short", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      toast({ title: "Mismatch", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    setSecStep("saving");
    try {
      const res = await apiRequest("POST", "/api/auth/set-password", {
        email: user.email,
        otpCode: otpDigits.join(""),
        newPassword,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Failed to set password"); }
      toast({ title: "Password set!", description: "You can now sign in with your password." });
      setSecStep("idle");
      setOtpDigits(["", "", "", "", "", ""]); setNewPassword(""); setNewPasswordConfirm("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setSecStep("otp");
    }
  };

  const resetSecurity = () => {
    setSecStep("idle");
    setOtpDigits(["", "", "", "", "", ""]); setNewPassword(""); setNewPasswordConfirm("");
  };

  const roleColor = user.role === "affiliate"
    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
    : "bg-green-100 text-tsia-green dark:bg-green-900/30 dark:text-green-300";
  const RoleIcon = user.role === "affiliate" ? Briefcase : GraduationCap;

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation(dashPath)} data-testid="button-back-to-dashboard">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-base font-bold">My Profile</h1>
            <p className="text-xs text-muted-foreground">Manage your account details</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${roleColor}`}>
            <RoleIcon className="w-3 h-3" />
            {user.role === "affiliate" ? "Affiliate" : "Student"}
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* ── Personal Information Card ── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Personal Information</CardTitle>
                <CardDescription className="text-xs">Your name and contact details</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <InfoRow icon={User} label="Full Name" value={`${user.firstName} ${user.lastName}`} testId="text-full-name" />
              <Separator />
              <InfoRow icon={Mail} label="Email Address" value={user.email} testId="text-email" />
              <Separator />
              <InfoRow icon={Phone} label="Phone Number" value={user.phone || "Not set"} testId="text-phone" dimmed={!user.phone} />
              {user.country && (
                <>
                  <Separator />
                  <InfoRow icon={Globe} label="Country" value={user.country} testId="text-country" />
                </>
              )}
              {user.affiliateCode && (
                <>
                  <Separator />
                  <InfoRow icon={Briefcase} label="Affiliate Code" value={user.affiliateCode} testId="text-affiliate-code" mono />
                </>
              )}
            </div>
            {/* Support-only edit notice */}
            <div className="flex gap-3 items-start bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3.5 border border-blue-200 dark:border-blue-800/50 mt-2">
              <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-0.5">Need to update your info?</p>
                <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                  For security, all profile changes are handled by our support team and verified against your KYC credentials.
                </p>
                <a
                  href="mailto:support@tsiforafrica.com?subject=Profile%20Update%20Request&body=Full%20Name%3A%0AKYCId%3A%0AChanges%20requested%3A"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline mt-2"
                >
                  <ExternalLink className="w-3 h-3" />
                  Email support@tsiforafrica.com
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Change Email Card ── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-base">Email Address</CardTitle>
                <CardDescription className="text-xs">Your sign-in email</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border">
              <Mail className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" data-testid="text-current-email">{user.email}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Current email — used for sign-in and notifications</p>
              </div>
            </div>
            {/* Email change goes via support */}
            <div className="flex gap-3 items-start bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3.5 border border-blue-200 dark:border-blue-800/50">
              <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-0.5">Need to change your email?</p>
                <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                  Email changes are handled by our support team and must match the name on your KYC document.
                </p>
                <a
                  href={`mailto:support@tsiforafrica.com?subject=Email%20Change%20Request&body=Current%20email%3A%20${encodeURIComponent(user.email)}%0ANew%20email%3A%0AKYC%20ID%20number%3A%0AFull%20Name%3A`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline mt-2"
                >
                  <ExternalLink className="w-3 h-3" />
                  Email support@tsiforafrica.com
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Security Card ── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-base">Security</CardTitle>
                <CardDescription className="text-xs">Manage your sign-in password</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border">
              <Lock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Password Login</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  You can sign in using a one-time code (OTP) sent to your email. Optionally, set a password for faster access.
                </p>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {secStep === "idle" && (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Button variant="outline" onClick={handleRequestPasswordOtp} data-testid="button-set-password"
                    className="w-full h-10">
                    <KeyRound className="w-4 h-4 mr-2" /> Set / Change Password
                  </Button>
                </motion.div>
              )}

              {secStep === "sending" && (
                <motion.div key="sending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-4">
                  <p className="text-sm text-muted-foreground">Sending verification code…</p>
                </motion.div>
              )}

              {secStep === "otp" && (
                <motion.div key="otp" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-1">Enter the code sent to your email</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="flex justify-center gap-2">
                    {otpDigits.map((d, i) => (
                      <Input key={i} id={`sec-otp-${i}`}
                        className="w-11 h-13 text-center text-lg font-bold bg-muted/30 focus:bg-background"
                        maxLength={1} value={d}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(i, e)}
                        data-testid={`input-sec-otp-${i}`} />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={resetSecurity} data-testid="button-cancel-otp">Cancel</Button>
                    <Button size="sm" onClick={handleOtpContinue} disabled={otpDigits.join("").length !== 6}
                      className="flex-1 bg-primary hover:bg-primary/90" data-testid="button-otp-continue">
                      Continue
                    </Button>
                  </div>
                  <button type="button" className="text-xs text-primary hover:underline w-full text-center"
                    onClick={handleRequestPasswordOtp}>Resend code</button>
                </motion.div>
              )}

              {secStep === "newpass" && (
                <motion.div key="newpass" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password">New Password</Label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input id="new-password" type={showNew ? "text" : "password"} value={newPassword}
                        onChange={e => setNewPassword(e.target.value)} placeholder="At least 8 characters"
                        className="h-10 pl-9 pr-9 bg-muted/30" data-testid="input-new-password" />
                      <button type="button" tabIndex={-1} onClick={() => setShowNew(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input id="confirm-password" type={showConfirm ? "text" : "password"} value={newPasswordConfirm}
                        onChange={e => setNewPasswordConfirm(e.target.value)} placeholder="Repeat password"
                        className="h-10 pl-9 pr-9 bg-muted/30" data-testid="input-confirm-password" />
                      <button type="button" tabIndex={-1} onClick={() => setShowConfirm(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {newPassword.length > 0 && newPassword === newPasswordConfirm && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1.5 text-xs text-tsia-green font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Passwords match
                    </motion.p>
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={resetSecurity} data-testid="button-cancel-newpass">Cancel</Button>
                    <Button size="sm" onClick={handleSetPassword}
                      disabled={newPassword.length < 8 || newPassword !== newPasswordConfirm}
                      className="flex-1 bg-primary hover:bg-primary/90" data-testid="button-save-password">
                      Set Password
                    </Button>
                  </div>
                </motion.div>
              )}

              {secStep === "saving" && (
                <motion.div key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-4">
                  <p className="text-sm text-muted-foreground">Saving your password…</p>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* ── My Location ── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-tsia-green" />
              </div>
              <div>
                <CardTitle className="text-base">My Location</CardTitle>
                <CardDescription className="text-xs">Update your country for accurate regional services</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border">
              <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Current country</p>
                <p className="text-sm font-medium" data-testid="text-current-country">
                  {COUNTRIES.find(c => c.code === (user.country || "ng"))?.name || user.country || "Not set"}
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-country-select">Select your country</Label>
              <select
                id="profile-country-select"
                data-testid="select-profile-country"
                value={selectedCountry || user.country || "ng"}
                onChange={e => setSelectedCountry(e.target.value)}
                className="w-full border border-input bg-background rounded-md px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>
            <Button
              data-testid="button-save-location"
              className="w-full bg-tsia-green hover:bg-tsia-green/90 text-white"
              onClick={() => locationMutation.mutate(selectedCountry || user.country || "ng")}
              disabled={locationMutation.isPending || (!selectedCountry && !user.country) || (selectedCountry || user.country || "ng") === (user.country || "ng")}
            >
              {locationMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
                : locationSaved
                  ? <><CheckCircle2 className="w-4 h-4 mr-2" /> Saved!</>
                  : "Save Location"}
            </Button>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-0.5">Why does location matter?</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                Your location is used for referral matching, regional pricing, currency display, and access to country-specific TSIA services.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── Account & legal ── */}
        <Card className="shadow-sm overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <FileText className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <CardTitle className="text-base">Account &amp; legal</CardTitle>
                <CardDescription className="text-xs">Your access, policies, and account controls</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/terms" className="group flex items-center gap-3 rounded-xl border p-3.5 transition-colors hover:bg-muted/50">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Terms of Service</p>
                <p className="text-xs text-muted-foreground">How TSIA services and accounts work</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/terms#privacy" className="group flex items-center gap-3 rounded-xl border p-3.5 transition-colors hover:bg-muted/50">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Privacy Policy</p>
                <p className="text-xs text-muted-foreground">How your information is handled</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
            <div className="my-3 border-t" />
            <Button variant="outline" className="h-auto min-h-11 w-full justify-start gap-3 px-3.5 text-left" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4 text-muted-foreground" />}
              <span className="flex-1">{loggingOut ? "Logging out…" : "Log out"}</span>
              {!loggingOut && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </Button>
            <Button variant="ghost" className="h-auto min-h-11 w-full justify-start gap-3 px-3.5 text-left text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => { setCloseConfirmation(""); setCloseAccountOpen(true); }}>
              <UserRoundX className="h-4 w-4" />
              <span className="flex-1">Close account</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* ── Back to dashboard ── */}
        <div className="pb-6">
          <Button variant="outline" className="w-full" onClick={() => setLocation(dashPath)} data-testid="button-back-dash">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Button>
        </div>
      </div>
      <AlertDialog open={closeAccountOpen} onOpenChange={setCloseAccountOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle>Close your TSIA account?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-left leading-relaxed">
              <span className="block">This permanently closes your access. Your financial records are retained as required for legal, regulatory, and audit purposes.</span>
              <span className="block font-medium text-foreground">Before continuing, resolve any funds, open positions, or pending obligations on your account.</span>
              <span className="block">Type <strong className="font-mono text-foreground">CLOSE MY ACCOUNT</strong> below to confirm.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={closeConfirmation}
            onChange={e => setCloseConfirmation(e.target.value)}
            placeholder="CLOSE MY ACCOUNT"
            autoComplete="off"
            aria-label="Type CLOSE MY ACCOUNT to confirm"
            data-testid="input-close-account-confirmation"
            className="font-mono"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closingAccount}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleCloseAccount}
              disabled={closeConfirmation !== "CLOSE MY ACCOUNT" || closingAccount}
              data-testid="button-confirm-close-account"
            >
              {closingAccount && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {closingAccount ? "Closing account…" : "Close account"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, testId, dimmed, mono }: {
  icon: any; label: string; value: string; testId: string; dimmed?: boolean; mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-0.5">
      <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm font-medium truncate ${dimmed ? "text-muted-foreground italic" : "text-foreground"} ${mono ? "font-mono" : ""}`}
          data-testid={testId}>{value}</p>
      </div>
    </div>
  );
}
