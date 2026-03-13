import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff } from "lucide-react";

export default function Signup() {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would create the user and redirect to onboarding
    setLocation("/onboarding");
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
            <CardTitle className="text-2xl text-center">Apply for Support</CardTitle>
            <CardDescription className="text-center">
              Create your account to start the verification process.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" placeholder="John" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" placeholder="Doe" required />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input id="email" type="email" placeholder="student@example.com" required />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number (with Country Code)</Label>
                <Input id="phone" type="tel" placeholder="+234 800 000 0000" required />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="country">Country of Study</Label>
                <Select required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ng">Nigeria</SelectItem>
                    <SelectItem value="gh">Ghana</SelectItem>
                    <SelectItem value="ke">Kenya</SelectItem>
                    <SelectItem value="za">Kenya</SelectItem>
                    <SelectItem value="other">Other African Nation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input 
                    id="password" 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••" 
                    required 
                    className="pr-10" 
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

              <div className="text-sm text-slate-500 my-4">
                By applying, you agree to our Terms of Service and Verification Policy. 
                You will be required to pay a $3 portal fee for identity verification in the next step.
              </div>

              <Button type="submit" className="w-full h-11 text-base bg-primary hover:bg-primary/90">
                Continue to Verification
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center border-t py-6 mt-2">
            <p className="text-sm text-slate-600">
              Already have an account?{' '}
              <Link href="/login">
                <span className="font-semibold text-primary hover:text-primary/80 cursor-pointer">Log in</span>
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}