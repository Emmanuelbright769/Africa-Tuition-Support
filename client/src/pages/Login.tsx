import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useAuth();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.role === "admin") {
        setLocation("/admin");
      } else {
        setStep(2);
      }
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handle2FA = (e: React.FormEvent) => {
    e.preventDefault();
    setLocation("/dashboard");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans overflow-hidden">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="sm:mx-auto sm:w-full sm:max-w-md mb-8">
        <Link href="/">
          <div className="flex items-center justify-center gap-2 cursor-pointer group">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-md group-hover:shadow-lg transition-all">
              <span className="text-primary-foreground font-bold text-xl">T</span>
            </div>
            <span className="text-2xl font-bold tracking-tight text-slate-900">TSIA</span>
          </div>
        </Link>
      </motion.div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
            <Card className="shadow-xl border-0 overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-tsia-green to-tsia-gold"></div>
              <CardHeader className="space-y-2 pt-8">
                <CardTitle className="text-2xl text-center font-bold text-slate-900">
                  {step === 1 ? "Welcome back" : "Two-Factor Verification"}
                </CardTitle>
                <CardDescription className="text-center text-base">
                  {step === 1 ? "Enter your credentials to access your portal" : "Enter the 6-digit code sent to your email"}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-8">
                {step === 1 ? (
                  <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email address</Label>
                      <Input id="email" type="email" placeholder="student@example.com" required className="h-12 bg-slate-50/50" value={email} onChange={e => setEmail(e.target.value)} data-testid="input-login-email" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        <a href="#" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">Forgot password?</a>
                      </div>
                      <div className="relative">
                        <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" required className="h-12 pr-10 bg-slate-50/50" value={password} onChange={e => setPassword(e.target.value)} data-testid="input-login-password" />
                        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors" onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 shadow-md" disabled={loading} data-testid="button-login">
                      {loading ? "Signing in..." : "Sign in"}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handle2FA} className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-center block text-slate-600 mb-4">Authentication Code</Label>
                      <div className="flex justify-center gap-3 mb-6">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                          <Input key={i} className="w-12 h-14 text-center text-xl font-bold bg-slate-50/80 focus:bg-white transition-colors" maxLength={1} data-testid={`input-2fa-${i}`} />
                        ))}
                      </div>
                    </div>
                    <Button type="submit" className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 shadow-md" data-testid="button-verify-2fa">
                      Verify & Access Portal
                    </Button>
                    <p className="text-center text-sm text-slate-500">
                      Didn't receive a code? <button type="button" className="text-primary font-medium hover:underline">Resend</button>
                    </p>
                  </form>
                )}
              </CardContent>
              {step === 1 && (
                <CardFooter className="flex justify-center border-t border-slate-100 py-6 bg-slate-50/50">
                  <p className="text-sm text-slate-600">
                    Don't have an account?{' '}
                    <Link href="/signup"><span className="font-semibold text-primary hover:text-primary/80 cursor-pointer transition-colors">Apply now</span></Link>
                  </p>
                </CardFooter>
              )}
            </Card>
          </motion.div>
        </AnimatePresence>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-6 text-center text-xs text-slate-400">
          Demo admin: admin@tsia.org / admin123
        </motion.div>
      </div>
    </div>
  );
}
