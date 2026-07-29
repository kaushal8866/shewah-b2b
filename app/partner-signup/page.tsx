import Link from 'next/link'
import { Diamond, ArrowLeft } from 'lucide-react'
import LeadForm from '../LeadForm'
import { BRAND, HERO } from '@/lib/landingCopy'

export const metadata = {
  title: 'Become a Shewah partner — apply for your trade account',
  description:
    'Apply to become a Shewah partner. Diamond jewellery wholesale and manufacturing for Indian retailers — no joining fee, no exclusivity.',
  robots: { index: true, follow: true },
}

export default function PartnerSignupPage() {
  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-100">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-stone-800 flex items-center justify-center">
              <Diamond className="w-4 h-4 text-white" />
            </div>
            <p className="font-semibold text-[15px]">{BRAND.name}</p>
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-5 py-12 md:py-20">
        <p className="text-xs uppercase tracking-[0.18em] text-stone-800 font-semibold mb-3">{HERO.eyebrow}</p>
        <h1 className="text-3xl md:text-4xl font-serif leading-tight">Apply to become a Shewah partner.</h1>
        <p className="mt-3 text-stone-600">
          Tell us a bit about your store. Your assigned partner manager will reach out on WhatsApp within one business day.
        </p>
        <div className="mt-8 bg-white rounded-2xl border border-stone-100 p-6 md:p-7 shadow-sm">
          <LeadForm multiStep />
        </div>
        <p className="mt-6 text-xs text-stone-500 text-center">
          Already a partner? <Link href="/login" className="text-stone-800 underline">Sign in</Link> instead.
        </p>
      </main>
    </div>
  )
}
