import { Logo } from "@/components/ui/Logo";
import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-200 py-12 border-t border-slate-800">
      <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-4">
          <Logo variant="horizontal" forceDark={true} height={32} />
          <p className="text-sm text-slate-400 leading-relaxed">
            Tuition Support Initiative for Africa. Empowering the next generation of African leaders through sustainable academic funding.
          </p>
          <p className="text-xs text-slate-500 leading-relaxed">
            A primary subsidiary of{" "}
            <span className="text-slate-400 font-medium">SMAKEMGGOLD Ltd</span>{" "}
            (RC: 1359954), established 2016.
          </p>
        </div>

        <div>
          <h4 className="font-semibold text-white mb-4">Platform</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><Link href="/#how-it-works" className="hover:text-tsia-gold transition-colors">How it works</Link></li>
            <li><Link href="/#plans" className="hover:text-tsia-gold transition-colors">Pricing &amp; plans</Link></li>
            <li><Link href="/leadership" className="hover:text-tsia-gold transition-colors">Leadership cohorts</Link></li>
            <li><Link href="/affiliate-signup" className="hover:text-tsia-gold transition-colors">Affiliate programme</Link></li>
            <li><Link href="/tenancy" className="hover:text-tsia-gold transition-colors">Tenancy portal</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-white mb-4">Company</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><Link href="/about" className="hover:text-tsia-gold transition-colors">About TSIA</Link></li>
            <li><Link href="/contact" className="hover:text-tsia-gold transition-colors">Contact us</Link></li>
            <li><Link href="/leadership" className="hover:text-tsia-gold transition-colors">Partners</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-white mb-4">Legal</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><Link href="/terms" className="hover:text-tsia-gold transition-colors">Terms &amp; Conditions</Link></li>
            <li><Link href="/terms#privacy" className="hover:text-tsia-gold transition-colors">Privacy Policy</Link></li>
            <li><Link href="/terms#verification" className="hover:text-tsia-gold transition-colors">Verification Policy</Link></li>
          </ul>
          <div className="mt-5 inline-flex items-center gap-1.5 bg-tsia-green/10 border border-tsia-green/20 rounded-full px-3 py-1.5 text-xs font-medium text-tsia-green">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
            </svg>
            NDPR & UK GDPR Compliant
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 mt-10 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <span>&copy; {new Date().getFullYear()} Tuition Support Initiative for Africa. All rights reserved.</span>
        <span>Backed by a $150M international fund &middot; UK &amp; Turkey partners &middot; NDPR & UK GDPR compliant &middot; London, United Kingdom</span>
      </div>
    </footer>
  );
}
