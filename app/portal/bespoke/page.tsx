'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { usePartner } from '@/app/hooks/usePartner'
import { Pen, Upload, Send, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function BespokeStudio() {
  const router = useRouter()
  const { partner, loading: partnerLoading } = usePartner()
  const [saving, setSaving] = useState(false)
  
  const [form, setForm] = useState({
    brief: '',
    gold_karat: '18',
    diamond_shape: '',
    diamond_weight: '',
    setting_type: '',
    special_requests: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!partner) return
    setSaving(true)

    const { count } = await supabase.from('cad_requests').select('*', { count: 'exact', head: true })
    const num = `SH-CAD-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`

    const { error } = await supabase.from('cad_requests').insert([{
      request_number: num,
      partner_id: partner.id,
      brief_text: form.brief,
      gold_karat: parseInt(form.gold_karat),
      diamond_shape: form.diamond_shape,
      diamond_weight: form.diamond_weight,
      setting_type: form.setting_type,
      special_requests: form.special_requests,
      status: 'pending',
      priority: 'normal',
      received_date: new Date().toISOString().split('T')[0],
    }])

    setSaving(false)
    if (error) {
      alert('Failed to initiate draft: ' + error.message)
    } else {
      router.push('/portal/overview')
    }
  }

  if (partnerLoading) return <div className="p-12 text-sm text-secondary animate-pulse">Initializing design desk...</div>

  const input = "w-full bg-surface-highest border-b border-outline-variant/40 focus:border-primary px-0 py-3 text-sm outline-none transition-colors"
  const label = "block text-[10px] uppercase font-bold tracking-widest text-secondary mt-6"

  return (
    <div className="p-6 md:p-12 lg:p-24 max-w-4xl mx-auto font-sans">
      <Link href="/portal/overview" className="flex items-center gap-2 text-secondary hover:text-primary mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span className="text-[10px] uppercase font-bold tracking-widest">Return to Core</span>
      </Link>

      <div className="mb-16">
        <span className="text-[10px] uppercase tracking-[0.2em] text-secondary font-bold">Studio Access</span>
        <h1 className="text-4xl lg:text-6xl font-serif text-primary mt-4 tracking-tight leading-none mb-6">
          Initiate Bespoke Draft
        </h1>
        <p className="text-secondary font-light max-w-xl text-lg leading-relaxed">
          Provide the architectural intent for your customer's request. Our design team translates these parameters into technical CAD renders.
        </p>
      </div>

      <div className="bg-surface-lowest border border-outline-variant/20 p-8 lg:p-12 shadow-ambient">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
            <div className="md:col-span-2">
              <label className={label}>Primary Design Intent *</label>
              <textarea required rows={4} className={`${input} resize-none`}
                placeholder="Describe the aesthetic direction, occasion, or specific inspiration..."
                value={form.brief} onChange={e => setForm({...form, brief: e.target.value})} />
            </div>

            <div>
              <label className={label}>Gold Karat</label>
              <select className={input} value={form.gold_karat} onChange={e => setForm({...form, gold_karat: e.target.value})}>
                <option value="14">14K Hardened</option>
                <option value="18">18K High-Grade</option>
                <option value="22">22K Fine Value</option>
              </select>
            </div>

            <div>
              <label className={label}>Specific Setting Type</label>
              <input className={input} placeholder="e.g. Prong, Bezel, Micro-pave"
                value={form.setting_type} onChange={e => setForm({...form, setting_type: e.target.value})} />
            </div>

            <div>
              <label className={label}>Diamond Shape (If applicable)</label>
              <input className={input} placeholder="e.g. Emerald Cut, Round Brilliant"
                value={form.diamond_shape} onChange={e => setForm({...form, diamond_shape: e.target.value})} />
            </div>

            <div>
              <label className={label}>Target Diamond Weight</label>
              <input className={input} placeholder="e.g. 1.25ct, 2.50ct Total"
                value={form.diamond_weight} onChange={e => setForm({...form, diamond_weight: e.target.value})} />
            </div>

            <div className="md:col-span-2">
              <label className={label}>Technical Notes / Constraints</label>
              <input className={input} placeholder="Budget range, size constraints, etc."
                value={form.special_requests} onChange={e => setForm({...form, special_requests: e.target.value})} />
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-outline-variant/30 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 text-secondary">
              <div className="p-3 bg-surface-highest border border-outline-variant/10">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-primary">Attachments Required</p>
                <p className="text-xs font-light">Email sketches to design@shewah.co with Ref ID after submission.</p>
              </div>
            </div>
            
            <button type="submit" disabled={saving}
              className="w-full md:w-auto bg-primary text-surface-lowest px-12 py-4 uppercase text-[10px] tracking-[0.2em] font-bold hover:bg-surface-highest hover:text-primary transition-all shadow-ambient">
              {saving ? 'Transmitting...' : 'Send to Design Desk'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
