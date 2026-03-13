export function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-200 py-12 border-t border-slate-800">
      <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-tsia-green rounded-md flex items-center justify-center">
              <span className="text-white font-bold text-lg">T</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-white">TSIA</span>
          </div>
          <p className="text-sm text-slate-400">
            Tuition Support Initiative for Africa. Empowering the next generation of African leaders through sustainable academic funding.
          </p>
        </div>
        
        <div>
          <h4 className="font-semibold text-white mb-4">Platform</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><a href="#" className="hover:text-tsia-gold transition-colors">How it works</a></li>
            <li><a href="#" className="hover:text-tsia-gold transition-colors">Pricing & Plans</a></li>
            <li><a href="/leadership" className="hover:text-tsia-gold transition-colors">Leadership Cohorts</a></li>
            <li><a href="#" className="hover:text-tsia-gold transition-colors">Academic Matrix</a></li>
          </ul>
        </div>
        
        <div>
          <h4 className="font-semibold text-white mb-4">Company</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><a href="#" className="hover:text-tsia-gold transition-colors">About Us</a></li>
            <li><a href="#" className="hover:text-tsia-gold transition-colors">Careers</a></li>
            <li><a href="#" className="hover:text-tsia-gold transition-colors">Contact</a></li>
            <li><a href="#" className="hover:text-tsia-gold transition-colors">Partners</a></li>
          </ul>
        </div>
        
        <div>
          <h4 className="font-semibold text-white mb-4">Legal</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><a href="#" className="hover:text-tsia-gold transition-colors">Terms of Service</a></li>
            <li><a href="#" className="hover:text-tsia-gold transition-colors">Privacy Policy</a></li>
            <li><a href="#" className="hover:text-tsia-gold transition-colors">Verification Policy</a></li>
          </ul>
        </div>
      </div>
      <div className="container mx-auto px-4 mt-12 pt-8 border-t border-slate-800 text-center text-sm text-slate-500">
        &copy; {new Date().getFullYear()} Tuition Support Initiative for Africa. All rights reserved.
      </div>
    </footer>
  );
}
