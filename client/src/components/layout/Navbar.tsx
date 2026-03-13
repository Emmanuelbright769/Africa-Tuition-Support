import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const [location] = useLocation();

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/">
          <a className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">T</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-primary">TSIA</span>
          </a>
        </Link>

        <div className="hidden md:flex gap-6 items-center">
          <Link href="/">
            <a className={`text-sm font-medium transition-colors hover:text-primary ${location === '/' ? 'text-primary' : 'text-muted-foreground'}`}>Home</a>
          </Link>
          <Link href="/leadership">
            <a className={`text-sm font-medium transition-colors hover:text-primary ${location === '/leadership' ? 'text-primary' : 'text-muted-foreground'}`}>Leadership Sponsorship</a>
          </Link>
          <div className="w-px h-4 bg-border"></div>
          <Link href="/login">
            <Button variant="ghost" className="text-sm">Log in</Button>
          </Link>
          <Link href="/signup">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Apply for Support</Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}