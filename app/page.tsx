import Link from 'next/link'
import { ArrowRight, Diamond, Layers, Cpu, ShieldCheck, ArrowUpRight } from 'lucide-react'

export default function B2BLandingPage() {
  return (
    <div className="min-h-screen bg-surface-lowest text-primary selection:bg-primary selection:text-surface-lowest flex flex-col font-sans">
      
      {/* Navigation */}
      <nav className="fixed w-full top-0 px-6 py-5 lg:px-12 flex items-center justify-between z-50 bg-surface-lowest/80 backdrop-blur-md border-b ghost-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <Diamond className="w-4 h-4 text-surface-lowest" />
          </div>
          <span className="text-primary font-medium tracking-tight text-lg">Shewah B2B</span>
        </div>
        
        <div className="flex items-center gap-6">
          <Link href="/login" className="label-md hidden md:block hover:text-secondary transition-colors">
            Partner Portal
          </Link>
          <Link href="/login" className="flex items-center gap-2 bg-primary text-surface-lowest px-5 py-2.5 rounded-sm hover:bg-surface-highest hover:text-primary transition-all text-sm font-medium">
            Sign In
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </nav>

      {/* Hero Section - Editorial Brutalism */}
      <main className="flex-1 mt-24">
        <div className="px-6 lg:px-12 pt-20 pb-24 lg:pt-32 lg:pb-40 border-b ghost-border">
          <div className="max-w-5xl">
            <h1 className="text-6xl md:text-8xl lg:text-9xl font-semibold tracking-tighter leading-[0.9] mb-8">
              PRECISION <br className="hidden md:block"/>
              <span className="text-secondary">MANUFACTURING.</span>
            </h1>
            <p className="text-xl md:text-3xl text-secondary max-w-2xl font-light tracking-wide leading-snug mb-12">
              The high-performance operating system for high-end jewelry businesses. Track orders, floats, and CAD pipelines in real time with 24kt precision.
            </p>
            
            <Link href="/login" className="inline-flex items-center gap-3 bg-primary text-surface-lowest px-8 py-5 text-lg font-medium hover:bg-surface-highest hover:text-primary transition-all group">
              Access the Network
              <ArrowUpRight className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Value Props - Monolithic Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 ghost-border border-b">
          
          <div className="p-8 lg:p-16 border-b md:border-b-0 md:border-r ghost-border hover:bg-surface-highest transition-colors cursor-default group">
            <Cpu className="w-8 h-8 md:w-12 md:h-12 text-secondary mb-8 group-hover:text-primary transition-colors" />
            <h3 className="text-2xl md:text-3xl font-medium tracking-tight mb-4">Algorithmic Tracking</h3>
            <p className="text-secondary leading-relaxed">
              Live transaction ledgers. Every gram of gold and carat of diamond is tracked instantaneously across all partner floats.
            </p>
          </div>

          <div className="p-8 lg:p-16 border-b md:border-b-0 md:border-r ghost-border hover:bg-surface-highest transition-colors cursor-default group">
            <Layers className="w-8 h-8 md:w-12 md:h-12 text-secondary mb-8 group-hover:text-primary transition-colors" />
            <h3 className="text-2xl md:text-3xl font-medium tracking-tight mb-4">24KT Standard</h3>
            <p className="text-secondary leading-relaxed">
              We eliminate karat ambiguity. All material deposits and manufacturing consumption are dynamically converted and governed in 24kt fine gold.
            </p>
          </div>

          <div className="p-8 lg:p-16 hover:bg-surface-highest transition-colors cursor-default group">
            <ShieldCheck className="w-8 h-8 md:w-12 md:h-12 text-secondary mb-8 group-hover:text-primary transition-colors" />
            <h3 className="text-2xl md:text-3xl font-medium tracking-tight mb-4">Verified Compliance</h3>
            <p className="text-secondary leading-relaxed">
              GST integration, HSN tagging, and automated invoice verification for all procurements to keep your supply chain friction-free.
            </p>
          </div>

        </div>

        {/* Data Architecture Section */}
        <div className="px-6 lg:px-12 py-24 lg:py-32 grid grid-cols-1 lg:grid-cols-2 gap-16 border-b ghost-border bg-surface-low">
          <div>
            <h2 className="text-4xl md:text-6xl font-medium tracking-tighter mb-8 max-w-lg">
              BUILT FOR SCALE.
            </h2>
            <p className="text-xl text-secondary mb-10 max-w-md font-light">
              Stop relying on spreadsheets. Manage your entire catalog, service providers, and CAD pipelines within a single source of truth.
            </p>
            <ul className="space-y-4">
              {['Live Labour & COGS Pricing', 'Custom Circuit Routing', 'Transparent Procurement App', 'Retail Margin Calculation'].map((item, i) => (
                <li key={i} className="flex items-center gap-3 border border-outline-variant/30 py-4 px-5 bg-surface-lowest">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                  <span className="font-medium tracking-wide">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative border border-outline-variant/30 bg-surface-highest flex items-center justify-center min-h-[400px] overflow-hidden group">
             {/* Decorative abstract diagram */}
             <div className="absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-outline-variant via-transparent to-transparent" />
             <div className="relative text-center grid gap-4 p-8 w-full max-w-sm">
                <div className="bg-surface-lowest border border-outline-variant/40 p-4 shadow-ambient">
                  <span className="text-xs text-secondary tracking-widest uppercase">Input</span>
                  <div className="text-lg font-medium mt-1">Design Brief</div>
                </div>
                <div className="w-px h-8 bg-outline-variant mx-auto" />
                <div className="bg-primary text-surface-lowest p-4 shadow-ambient">
                  <span className="text-xs opacity-70 tracking-widest uppercase">Engine</span>
                  <div className="text-lg font-medium mt-1">Manufacturing OS</div>
                </div>
                <div className="w-px h-8 bg-outline-variant mx-auto" />
                <div className="bg-surface-lowest border border-outline-variant/40 p-4 shadow-ambient">
                  <span className="text-xs text-secondary tracking-widest uppercase">Output</span>
                  <div className="text-lg font-medium mt-1">Ready Product</div>
                </div>
             </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 lg:px-12 py-12 flex flex-col md:flex-row items-center justify-between gap-6 bg-surface-lowest">
        <div className="flex items-center gap-2">
          <Diamond className="w-4 h-4 text-primary" />
          <span className="font-medium tracking-tight">Shewah.</span>
        </div>
        <div className="flex items-center gap-8 text-sm text-secondary">
          <span>&copy; {new Date().getFullYear()} Shewah Manufacturing. All rights reserved.</span>
          <Link href="/login" className="hover:text-primary transition-colors">Admin Login</Link>
        </div>
      </footer>
    </div>
  )
}
