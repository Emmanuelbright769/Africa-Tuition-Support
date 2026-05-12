import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { Menu, X, Sun, Moon, Monitor } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export function Navbar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { mode, setMode } = useTheme();
  const { user } = useAuth();

  const themeOptions = [
    { value: "light" as const, icon: Sun, label: "Light" },
    { value: "dark" as const, icon: Moon, label: "Dark" },
    { value: "system" as const, icon: Monitor, label: "Auto" },
  ];

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/about", label: "About Us" },
    { href: "/leadership", label: "Leadership Sponsorship" },
    { href: "/affiliate-signup", label: "Affiliate Program" },
    { href: "/contact", label: "Contact" },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Logo variant="horizontal" height={36} />
        </Link>

        <div className="hidden md:flex gap-6 items-center">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-primary ${location === link.href ? "text-primary" : "text-muted-foreground"}`}
            >
              {link.label}
            </Link>
          ))}

          <div className="w-px h-4 bg-border"></div>

          <div className="flex items-center bg-muted rounded-full p-1 gap-0.5" data-testid="theme-toggle">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setMode(opt.value)}
                className={`p-1.5 rounded-full transition-all ${mode === opt.value ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                title={opt.label}
                data-testid={`theme-${opt.value}`}
              >
                <opt.icon className="w-4 h-4" />
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-border"></div>

          {user ? (
            <Link href={user.role === "admin" ? "/admin" : user.role === "affiliate" ? "/affiliate-dashboard" : "/dashboard"}>
              <Button variant="ghost" className="text-sm">Dashboard</Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" className="text-sm">Log in</Button>
              </Link>
              <Link href="/signup">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Apply for Support</Button>
              </Link>
            </>
          )}
        </div>

        <div className="flex md:hidden items-center gap-2">
          <div className="flex items-center bg-muted rounded-full p-1 gap-0.5" data-testid="theme-toggle-mobile">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setMode(opt.value)}
                className={`p-1.5 rounded-full transition-all ${mode === opt.value ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                title={opt.label}
              >
                <opt.icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
            data-testid="hamburger-menu"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="md:hidden overflow-hidden border-t bg-background"
          >
            <div className="container mx-auto px-4 py-4 space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-4 py-3 rounded-xl text-sm font-medium transition-colors ${location === link.href ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"}`}
                  data-testid={`mobile-nav-${link.label.toLowerCase().replace(/\s/g, "-")}`}
                >
                  {link.label}
                </Link>
              ))}

              <div className="border-t my-2"></div>

              {user ? (
                <Link
                  href={user.role === "admin" ? "/admin" : user.role === "affiliate" ? "/affiliate-dashboard" : "/dashboard"}
                  onClick={() => setMobileOpen(false)}
                  className="block"
                >
                  <Button className="w-full" data-testid="mobile-nav-dashboard">Dashboard</Button>
                </Link>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="block">
                    <Button variant="outline" className="w-full" data-testid="mobile-nav-login">Log in</Button>
                  </Link>
                  <Link href="/signup" onClick={() => setMobileOpen(false)} className="block">
                    <Button className="w-full bg-primary text-primary-foreground" data-testid="mobile-nav-signup">Apply for Support</Button>
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
