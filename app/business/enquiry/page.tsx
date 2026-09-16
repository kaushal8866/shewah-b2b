import { Metadata } from 'next'
import LeadForm from '../../LeadForm'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck, Factory, Diamond, Sparkles } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Trade Enquiry | Shewah Business',
  description: 'Apply to become a verified Shewah retail partner or manufacturing client.',
}

export default function BusinessEnquiryPage() {
  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <Link
          href="/business"
          className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-amber-500 hover:text-amber-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Business Overview</span>
        </Link>

        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-amber-500 font-mono">
            Partner Onboarding
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-white font-normal mt-1">
            B2B Trade & Atelier Enquiry
          </h1>
          <p className="text-sm text-stone-400 mt-2">
            Connect with our atelier for wholesale orders, custom CAD development, diamond replenishment, or white-label collections.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4">
          <div className="bg-stone-800/60 p-4 rounded-xl border border-stone-700/60">
            <Factory className="w-5 h-5 text-amber-500 mb-2" />
            <div className="text-xs font-semibold text-stone-200">Wholesale & Mfg</div>
            <div className="text-[11px] text-stone-400 mt-0.5">Direct atelier pricing with zero intermediaries</div>
          </div>
          <div className="bg-stone-800/60 p-4 rounded-xl border border-stone-700/60">
            <Diamond className="w-5 h-5 text-amber-500 mb-2" />
            <div className="text-xs font-semibold text-stone-200">Certified Stones</div>
            <div className="text-[11px] text-stone-400 mt-0.5">Natural & Lab-grown diamonds with IGI/GIA grading</div>
          </div>
          <div className="bg-stone-800/60 p-4 rounded-xl border border-stone-700/60">
            <Sparkles className="w-5 h-5 text-amber-500 mb-2" />
            <div className="text-xs font-semibold text-stone-200">CAD Studio</div>
            <div className="text-[11px] text-stone-400 mt-0.5">Rapid 24-48h 3D modeling and rendering revisions</div>
          </div>
        </div>

        <div className="bg-stone-800 border border-stone-700 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <LeadForm />
        </div>

        <div className="text-center pt-4">
          <p className="text-xs text-stone-400">
            Already a registered business partner?{' '}
            <Link href="/login" className="text-amber-500 underline hover:text-amber-400 font-medium">
              Sign in to Trade Portal
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
