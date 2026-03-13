import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, CheckCircle2 } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<1 | 2>(1); // 1: Credentials, 2: 2FA

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const handle2FA = (e: React.FormEvent) => {
    e.preventDefault();
    setLocation("/dashboard");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md mb-8">
        <Link href="/">
          <div className="flex items-center justify-center gap-2 cursor-pointer">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-primary-foreground font-bold text-xl">T</span>
            </div>
            <span className="text-2xl font-bold tracking-tight text-slate-900">TSIA</span>
          </div>
        </Link>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="shadow-lg border-0">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl text-center">
              {step === 1 ? "Welcome back" : "Two-Factor Verification"}
            </CardTitle>
            <CardDescription className="text-center">
              {step === 1 ? "Enter your credentials to access your portal" : "Enter the 6-digit code sent to your email"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 1 ? (
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input id="email" type="email" placeholder="student@example.com" required className="h-11" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <a href="#" className="text-sm font-medium text-primary hover:text-primary/80">
                      Forgot password?
                    </a>
                  </div>
                  <div className="relative">
                    <Input 
                      id="password" 
                      type={showPassword ? "text" : "password"} 
                      placeholder="••••••••" 
                      required 
                      className="h-11 pr-10" 
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full h-11 text-base bg-primary hover:bg-primary/90">
                  Sign in
                </Button>
              </form>
            ) : (
              <form onSubmit={handle2FA} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="code" className="text-center block">Authentication Code</Label>
                  <div className="flex justify-center gap-2 mb-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <Input key={i} className="w-12 h-14 text-center text-xl font-bold" maxLength={1} required />
                    ))}
                  </div>
                </div>
                
                <Button type="submit" className="w-full h-11 text-base bg-primary hover:bg-primary/90">
                  Verify & Access Portal
                </Button>
                
                <p className="text-center text-sm text-slate-500">
                  Didn't receive a code? <button className="text-primary font-medium hover:underline">Resend</button>
                </p>
              </form>
            )}
          </CardContent>
          {step === 1 && (
            <CardFooter className="flex justify-center border-t py-6 mt-2">
              <p className="text-sm text-slate-600">
                Don't have an account?{' '}
                <Link href="/signup">
                  <span className="font-semibold text-primary hover:text-primary/80 cursor-pointer">Apply now</span>
                </Link>
              </p>
            </CardFooter>
          )}
        </Card>
        
        {/* Admin Login shortcut for testing */}
        <div className="mt-8 text-center">
          <Link href="/admin">
            <span className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer">Admin Login (Demo)</span>
          </Link>
        </div>
      </div>
    </div>
  );
}