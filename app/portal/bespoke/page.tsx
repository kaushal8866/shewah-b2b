'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowRight, UploadCloud } from 'lucide-react'

export default function PartnerBespokeStudio() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [partnerId, setPartnerId] = useState<string | null>(null)

  const [form, setForm] = useState({
    brief_text: '',
    diamond_shape: 'round',
    diamond_weight: '',
    gold_karat: '18',
    stone_origin: 'natural',
    special_requests: '',
  })

  useEffect(() => {
    async function loadPartner() {
      const { data } = await supabase.from('partners').select('id').single()
      if (data) setPartnerId(data.id)
    }
    loadPartner()
  }, [])

  function set(k: string, v: string) { setForm(prev => ({ ...prev, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.brief_text) {
      alert('Please describe your design brief.')
      return
    }
    
    // In production, we would alert if partnerId is null, 
    // but we can allow it to just attempt DB insert and let RLS block it if unauthorized
    setSaving(true)

    // Generate request number logic
    const { count } = await supabase.from('cad_requests').select('*', { count: 'exact', head: true })
    const num = `SH-CAD-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`

    const requestPayload = {
      partner_id: partnerId,
      brief_text: form.brief_text,
      diamond_shape: form.diamond_shape,
      diamond_weight: form.diamond_weight,
      gold_karat: parseInt(form.gold_karat),
      special_requests: `Origin: ${form.stone_origin}\n` + form.special_requests,
      priority: 'normal',
      status: 'pending',
      request_number: num,
      received_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 48 * 3600000).toISOString().split('T')[0],
    }

    const { error } = await supabase.from('cad_requests').insert([requestPayload])

    setSaving(false)
    if (error) {
      alert('Failed to submit: ' + error.message)
      return
    }
    router.push('/portal/overview')
  }

  const inputStyles = "w-full bg-surface-highest border-b border-outline-variant/40 focus:border-primary px-0 py-3 text-sm outline-none transition-colors appearance-none"
  const labelStyles = "block text-[10px] uppercase font-bold tracking-widest text-secondary mb-2"

  return (
    <div className="p-6 md:p-12 lg:p-24 max-w-5xl mx-auto font-sans">
      
      <div className="mb-16">
        <span className="text-[10px] uppercase tracking-[0.2em] text-secondary font-bold">Studio Engine 0.1</span>
        <h1 className="text-4xl lg:text-6xl font-serif text-primary mt-4 tracking-tight leading-none mb-6">
          Initiate Bespoke Request
        </h1>
        <p className="text-secondary font-light max-w-xl text-lg leading-relaxed">
          Provide the foundational details for your client's piece. Once submitted, our architectural team will produce CAD renderings for your approval within 48 hours.
        </p>
      </div>

      <div className="bg-surface-lowest shadow-ambient p-8 lg:p-16 border border-outline-variant/20 relative">
        {/* Subtle decorative accent */}
        <div className="absolute top-0 left-0 w-1/4 h-1 bg-primary"></div>
        
        <form onSubmit={handleSubmit} className="space-y-12">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <label className={labelStyles}>Primary Metal Specification</label>
              <select className={inputStyles} value={form.gold_karat} onChange={e => set('gold_karat', e.target.value)}>
                <option value="18">18K High-Grade Gold</option>
                <option value="14">14K Hardened Gold</option>
                <option value="22">22K Fine Value Gold</option>
              </select>
            </div>

            <div>
              <label className={labelStyles}>Stone Origin Preference</label>
              <div className="flex gap-8 mt-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="radio" className="w-4 h-4 text-primary border-outline-variant focus:ring-0 focus:ring-offset-0" 
                    checked={form.stone_origin === 'natural'} onChange={() => set('stone_origin', 'natural')} />
                  <span className="text-sm font-medium text-secondary group-hover:text-primary transition-colors">Natural Earth Mined</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="radio" className="w-4 h-4 text-primary border-outline-variant focus:ring-0 focus:ring-offset-0" 
                    checked={form.stone_origin === 'lab-grown'} onChange={() => set('stone_origin', 'lab-grown')} />
                  <span className="text-sm font-medium text-secondary group-hover:text-primary transition-colors">Lab-Grown Excellence</span>
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <label className={labelStyles}>Center Stone Shape</label>
              <select className={inputStyles} value={form.diamond_shape} onChange={e => set('diamond_shape', e.target.value)}>
                {['Round Brilliant', 'Oval', 'Emerald Cut', 'Pear Shape', 'Marquise', 'Cushion', 'Princess'].map(s => (
                  <option key={s.toLowerCase()} value={s.toLowerCase()}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelStyles}>Target Carat Weight</label>
              <input className={inputStyles} placeholder="e.g. 1.50ct - 2.00ct" 
                value={form.diamond_weight} onChange={e => set('diamond_weight', e.target.value)} />
            </div>
          </div>

          <hr className="border-t border-outline-variant/20" />

          <div>
            <label className={labelStyles}>Architectural Brief & Specifications *</label>
            <textarea className={`${inputStyles} resize-none h-32 leading-relaxed`} 
              placeholder="Describe the structural elements, setting styles (e.g. hidden halo, split shank), and client lifestyle considerations..."
              value={form.brief_text} onChange={e => set('brief_text', e.target.value)} required />
          </div>

          <div>
            <label className={labelStyles}>Specialized Instructions</label>
            <textarea className={`${inputStyles} resize-none h-20`} 
              placeholder="Specific ring sizes, budget ceilings, or timeline constraints..."
              value={form.special_requests} onChange={e => set('special_requests', e.target.value)} />
          </div>

          <div>
            <label className={labelStyles}>Reference Material Upload (Coming Soon)</label>
            <div className="border-2 border-dashed border-outline-variant/30 py-12 flex flex-col items-center justify-center gap-4 bg-surface-highest/50 cursor-not-allowed">
              <UploadCloud className="w-8 h-8 text-outline-variant" />
              <span className="text-sm text-secondary font-medium">Drive integration pending configuration</span>
            </div>
          </div>

          <div className="flex justify-end pt-6">
            <button type="submit" disabled={saving || !partnerId} 
              className="bg-primary text-surface-lowest px-12 py-5 uppercase text-[10px] tracking-[0.2em] font-bold hover:bg-surface-highest hover:text-primary transition-all duration-300 flex items-center gap-3 disabled:opacity-50">
              {saving ? 'Transmitting...' : 'Submit to CAD Team'}
              {!saving && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
          
        </form>
      </div>
    </div>
  )
}
