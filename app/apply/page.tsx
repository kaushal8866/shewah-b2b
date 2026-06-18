'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, ArrowRight, Diamond } from 'lucide-react'
import Link from 'next/link'

export default function ApplyPage() {
  const [form, setForm] = useState({
    store_name: '',
    owner_name: '',
    phone: '',
    email: '',
  })
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  function set(k: string, v: string) { setForm(prev => ({ ...prev, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    // Insert as a prospect with stage 'pending_approval'
    // We set city/state to TBD if the DB requires it, but migration 003 drops NOT NULL. 
    // We will use TBD as a fallback just in case migration hasn't run.
    const { error } = await supabase.from('partners').insert([{
      store_name: form.store_name,
      owner_name: form.owner_name,
      phone: form.phone,
      email: form.email,
      city: 'TBD',
      state: 'TBD',
      status: 'warm',
      stage: 'pending_approval'
    }])

    setSaving(false)
    if (error) {
      alert('Application failed: ' + error.message)
      return
    }
    setSubmitted(true)
  }

  const inputStyles = "w-full bg-transparent border-b border-outline-variant/40 focus:border-primary px-0 py-3 text-sm outline-none transition-colors appearance-none text-primary"
  const labelStyles = "block text-[10px] uppercase font-bold tracking-widest text-secondary mt-6 mb-1"

  if (submitted) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-surface-lowest p-12 text-center border border-outline-variant/20 shadow-ambient">
          <Diamond className="w-12 h-12 text-primary mx-auto mb-6" />
          <h1 className="text-2xl font-serif text-primary mb-2">Application Received</h1>
          <p className="text-sm text-secondary leading-relaxed mb-8">
            Your architectural profile is under review. Our administrative team will authenticate your enterprise within 24 hours.
          </p>
          <Link href="/" className="text-[10px] uppercase tracking-widest font-bold text-primary hover:text-secondary transition-colors underline underline-offset-4">
            Return to Root
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 font-sans py-24">
      <div className="max-w-xl w-full">
        <Link href="/" className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-secondary hover:text-primary transition-colors mb-12">
          <ArrowLeft className="w-3 h-3" /> Return to Genesis
        </Link>
        
        <div className="mb-12">
          <span className="text-[10px] uppercase tracking-[0.2em] text-secondary font-bold">Partnership Protocol</span>
          <h1 className="text-4xl lg:text-5xl font-serif text-primary mt-4 tracking-tight leading-none mb-4">
            Network Access
          </h1>
          <p className="text-secondary font-light text-lg">
            Request an encrypted gateway into the Shewah B2B architecture.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface-lowest shadow-ambient p-10 md:p-14 border border-outline-variant/20 relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-primary"></div>
          
          <div>
            <label className={labelStyles}>Retail Enterprise Name *</label>
            <input className={inputStyles} value={form.store_name} onChange={e => set('store_name', e.target.value)} required placeholder="e.g. Acme Fine Jewelry" />
          </div>

          <div>
            <label className={labelStyles}>Principal Visionary (Owner) *</label>
            <input className={inputStyles} value={form.owner_name} onChange={e => set('owner_name', e.target.value)} required placeholder="e.g. Jane Doe" />
          </div>

          <div>
            <label className={labelStyles}>Secure Communications Line (Phone) *</label>
            <input className={inputStyles} value={form.phone} onChange={e => set('phone', e.target.value)} required placeholder="+91 98765 43210" />
          </div>

          <div>
            <label className={labelStyles}>Encrypted Signal (Email) *</label>
            <input type="email" className={inputStyles} value={form.email} onChange={e => set('email', e.target.value)} required placeholder="jane@acme.com" />
          </div>

          <div className="mt-12 flex justify-end">
            <button type="submit" disabled={saving} 
              className="bg-primary text-surface-lowest px-10 py-5 uppercase text-[10px] tracking-[0.2em] font-bold hover:bg-surface-highest hover:text-primary transition-all duration-300 flex items-center gap-3 disabled:opacity-50 w-full md:w-auto justify-center">
              {saving ? 'Transmitting...' : 'Submit Application'}
              {!saving && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
