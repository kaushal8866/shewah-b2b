'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Save, UserCircle } from 'lucide-react'

export default function PartnerProfile() {
  const [partner, setPartner] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [form, setForm] = useState({
    store_name: '',
    owner_name: '',
    phone: '',
    email: '',
    city: ''
  })

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('partners').select('*').single()
      if (data) {
        setPartner(data)
        setForm({
          store_name: data.store_name || '',
          owner_name: data.owner_name || '',
          phone: data.phone || '',
          email: data.email || '',
          city: data.city || ''
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  function set(k: string, v: string) { setForm(prev => ({ ...prev, [k]: v })) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!partner) return
    setSaving(true)
    setMessage('')
    const { error } = await supabase.from('partners').update(form).eq('id', partner.id)
    setSaving(false)
    if (error) {
      setMessage('Failed to commit structural changes: ' + error.message)
    } else {
      setMessage('Structural parameters successfully synchronized.')
    }
  }

  const inputStyles = "w-full bg-surface-lowest border-b border-outline-variant/40 focus:border-primary px-0 py-4 text-sm outline-none transition-colors appearance-none text-primary"
  const labelStyles = "block text-[10px] uppercase font-bold tracking-widest text-secondary mb-1"

  if (loading) return <div className="p-12 text-secondary animate-pulse text-sm">Validating clearance...</div>

  return (
    <div className="p-6 md:p-12 lg:p-24 max-w-4xl mx-auto font-sans">
      <div className="mb-16">
        <span className="text-[10px] uppercase tracking-[0.2em] text-secondary font-bold">Identity Core</span>
        <h1 className="text-4xl lg:text-6xl font-serif text-primary mt-4 tracking-tight leading-none mb-6">
          Architectural Profile
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-16">
        {/* Profile Identity Card */}
        <div>
          <div className="bg-surface-highest p-8 border border-outline-variant/20 shadow-ambient">
            <div className="flex justify-center mb-8">
              <div className="w-24 h-24 bg-surface-lowest rounded-full flex items-center justify-center shadow-inner border border-outline-variant/10">
                <UserCircle className="w-12 h-12 text-outline-variant" />
              </div>
            </div>
            <div className="text-center mb-8 border-b border-outline-variant/30 pb-8">
              <h2 className="text-xl font-serif text-primary mb-1">{form.store_name || 'Retailer Name'}</h2>
              <p className="text-xs tracking-widest uppercase text-secondary font-medium">{form.city || 'Location'}</p>
            </div>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-secondary">Network Stage:</span>
                <span className="text-primary font-medium capitalize">{partner?.stage || 'Active'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Access Control:</span>
                <span className="text-primary font-medium">B2B Verified</span>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div>
          <form onSubmit={handleSave} className="space-y-10">
            {message && (
              <div className={`p-4 border ${message.includes('Failed') ? 'border-[#515255] bg-[#3a3b3e] text-white' : 'border-[#c49c64]/30 bg-[#f7f2ea] text-[#9B7A40]'} text-xs font-medium tracking-widest uppercase`}>
                {message}
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="md:col-span-2">
                <label className={labelStyles}>Retail Enterprise Name</label>
                <input className={inputStyles} value={form.store_name} onChange={e => set('store_name', e.target.value)} required />
              </div>
              
              <div>
                <label className={labelStyles}>Principal Visionary (Owner)</label>
                <input className={inputStyles} value={form.owner_name} onChange={e => set('owner_name', e.target.value)} required />
              </div>
              
              <div>
                <label className={labelStyles}>Primary Operation City</label>
                <input className={inputStyles} value={form.city} onChange={e => set('city', e.target.value)} />
              </div>

              <div>
                <label className={labelStyles}>Secure Communications Line (Phone)</label>
                <input className={inputStyles} value={form.phone} onChange={e => set('phone', e.target.value)} required />
              </div>

              <div>
                <label className={labelStyles}>Encrypted Signal (Email)</label>
                <input type="email" className={inputStyles} value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button type="submit" disabled={saving} 
                className="bg-primary text-surface-lowest px-12 py-5 uppercase text-[10px] tracking-[0.2em] font-bold hover:bg-surface-highest hover:text-primary transition-all duration-300 flex items-center gap-3 disabled:opacity-50 border border-transparent hover:border-outline-variant/30">
                <Save className="w-4 h-4" />
                {saving ? 'Synchronizing...' : 'Synchronize Identity'}
              </button>
            </div>
          </form>
        </div>
      </div>

    </div>
  )
}
