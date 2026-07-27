'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/app/components/Toast'
import { supabase } from '@/lib/supabase'
import { useSession } from 'next-auth/react'
import { MODULES } from '@/lib/modules'
import {
  Save, Settings2, Calculator, User, Phone, Users, Plus,
  Edit2, Trash2, X, Check, Shield, ShieldOff, Eye, EyeOff, Lock, MessageCircle,
  AlertTriangle, RefreshCw
} from 'lucide-react'

const ALL_MODULES = MODULES.filter(m => m.id !== 'dashboard')

type AppUser = {
  id: string
  username: string
  display_name: string
  role: 'master' | 'sub' | 'manufacturer' | 'retailer'
  permissions: string[]
  is_active: boolean
  created_at: string
  manufacturing_partner_id?: string | null
  partner_id?: string | null
}

type MfgPartner = { id: string; name: string; city?: string }
type RetailPartner = { id: string; store_name: string; city?: string }

export default function SettingsPage() {
  const { data: session } = useSession()
  const isMaster = session?.user?.role === 'master'
  const [tab, setTab] = useState<'general' | 'users' | 'upload_errors'>('general')

  type UploadError = {
    id: string
    created_at: string
    user_id: string | null
    username: string | null
    user_role: string | null
    file_name: string | null
    file_size: number | null
    file_type: string | null
    status_code: number | null
    error_message: string | null
    source: string | null
  }
  const [uploadErrors, setUploadErrors] = useState<UploadError[]>([])
  const [uploadErrorsLoading, setUploadErrorsLoading] = useState(false)
  const [uploadErrorsMigration, setUploadErrorsMigration] = useState<string | null>(null)

  // General settings
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const { toast } = useToast()

  // User management
  const [users, setUsers] = useState<AppUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [showNewUser, setShowNewUser] = useState(false)
  const [editingUser, setEditingUser] = useState<AppUser | null>(null)
  const [newUser, setNewUser] = useState({
    username: '', displayName: '', password: '',
    permissions: [] as string[],
    role: 'sub' as 'sub' | 'manufacturer' | 'retailer',
    manufacturingPartnerId: '',
    partnerId: '',
  })
  const [mfgPartners, setMfgPartners] = useState<MfgPartner[]>([])
  const [retailPartners, setRetailPartners] = useState<{ id: string; store_name: string; city?: string }[]>([])
  const [userSaving, setUserSaving] = useState(false)
  const [userError, setUserError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [editPassword, setEditPassword] = useState('')

  useEffect(() => {
    supabase.from('settings').select('key, value').then(({ data }) => {
      const map: Record<string, string> = {}
      data?.forEach(row => { map[row.key] = row.value || '' })
      setSettings(map)
    })
  }, [])

  useEffect(() => {
    if (tab === 'users' && isMaster) {
      loadUsers()
      supabase.from('manufacturing_partners').select('id, name, city').order('name').then(({ data }) => {
        setMfgPartners(data || [])
      })
      supabase.from('partners').select('id, store_name, city').order('store_name').then(({ data }) => {
        setRetailPartners(data || [])
      })
    }
    if (tab === 'upload_errors' && isMaster) {
      loadUploadErrors()
    }
  }, [tab])

  async function loadUploadErrors() {
    setUploadErrorsLoading(true)
    setUploadErrorsMigration(null)
    try {
      const res = await fetch('/api/upload-errors')
      const data = await res.json()
      setUploadErrors(data.errors || [])
      if (data.migrationRequired) setUploadErrorsMigration(data.message || 'Migration required')
    } catch {
      setUploadErrors([])
    } finally {
      setUploadErrorsLoading(false)
    }
  }

  function fmtSize(bytes: number | null) {
    if (!bytes && bytes !== 0) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }

  function fmtTime(iso: string) {
    try {
      const d = new Date(iso)
      return d.toLocaleString()
    } catch { return iso }
  }

  async function loadUsers() {
    setUsersLoading(true)
    const res = await fetch('/api/users')
    const data = await res.json()
    setUsers(data.users || [])
    setUsersLoading(false)
  }

  function set(key: string, val: string) { setSettings(prev => ({ ...prev, [key]: val })) }

  async function saveAll() {
    setSaving(true)
    const upserts = Object.entries(settings).map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }))
    const { error } = await supabase.from('settings').upsert(upserts, { onConflict: 'key' })
    setSaving(false)
    if (error) { toast('Error: ' + error.message, 'error'); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function togglePermission(perms: string[], id: string): string[] {
    return perms.includes(id) ? perms.filter(p => p !== id) : [...perms, id]
  }

  async function createUser() {
    if (!newUser.username || !newUser.password) { setUserError('Username and password required'); return }
    if (newUser.role === 'manufacturer' && !newUser.manufacturingPartnerId) {
      setUserError('Pick a manufacturing partner for this login'); return
    }
    if (newUser.role === 'retailer' && !newUser.partnerId) {
      setUserError('Pick a retailer (partner) for this login'); return
    }
    setUserSaving(true)
    setUserError('')
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    })
    const data = await res.json()
    setUserSaving(false)
    if (!res.ok) { setUserError(data.error || 'Failed to create user'); return }
    setShowNewUser(false)
    setNewUser({ username: '', displayName: '', password: '', permissions: [], role: 'sub', manufacturingPartnerId: '', partnerId: '' })
    loadUsers()
  }

  async function updateUser() {
    if (!editingUser) return
    setUserSaving(true)
    setUserError('')
    const body: any = {
      id: editingUser.id,
      displayName: editingUser.display_name,
      permissions: editingUser.permissions,
      isActive: editingUser.is_active,
    }
    if (editPassword) body.password = editPassword
    const res = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setUserSaving(false)
    if (!res.ok) { setUserError(data.error || 'Failed to update user'); return }
    setEditingUser(null)
    setEditPassword('')
    loadUsers()
  }

  async function deleteUser(id: string, name: string) {
    if (!confirm(`Delete user "${name}"? They will no longer be able to log in.`)) return
    const res = await fetch('/api/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error || 'Delete failed'); return }
    loadUsers()
  }

  async function toggleActive(user: AppUser) {
    await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, isActive: !user.is_active }),
    })
    loadUsers()
  }

  const input = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#1E3A5F] outline-none"
  const label = "block text-xs font-medium text-stone-500 mb-1"
  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#1E3A5F] outline-none bg-white"

  return (
    <div className="p-4 lg:p-7 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Settings</h1>
          <p className="text-stone-500 text-sm mt-0.5">Admin configuration</p>
        </div>
        {tab === 'general' && (
          <button onClick={saveAll} disabled={saving}
            className="flex items-center gap-2 bg-[#1E3A5F] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#162B47] disabled:opacity-50 transition-colors">
            <Save className="w-4 h-4" />
            {saved ? 'Saved!' : saving ? 'Saving...' : 'Save all'}
          </button>
        )}
      </div>

      {/* Tabs */}
      {isMaster && (
        <div className="flex gap-1 bg-stone-100 rounded-xl p-1 mb-6">
          {[
            { id: 'general', label: 'General', icon: Settings2 },
            { id: 'users', label: 'User management', icon: Users },
            { id: 'upload_errors', label: 'Upload errors', icon: AlertTriangle },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
              }`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
      )}

      {/* General settings */}
      {tab === 'general' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-4 h-4 text-[#1E3A5F]" />
              <h2 className="font-medium text-stone-900">Business information</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={label}>Business name</label><input className={input} value={settings.business_name || ''} onChange={e => set('business_name', e.target.value)} /></div>
              <div><label className={label}>Owner name</label><input className={input} value={settings.owner_name || ''} onChange={e => set('owner_name', e.target.value)} /></div>
              <div><label className={label}>WhatsApp number</label><input className={input} value={settings.whatsapp_number || ''} onChange={e => set('whatsapp_number', e.target.value)} placeholder="919XXXXXXXXX" /></div>
              <div><label className={label}>Business address</label><input className={input} value={settings.surat_address || ''} onChange={e => set('surat_address', e.target.value)} /></div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-[#1E3A5F]" />
              <h2 className="font-medium text-stone-900">GST & Billing Details</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={label}>Company GSTIN</label>
                <input className={input} value={settings.business_gstin || ''} onChange={e => set('business_gstin', e.target.value)} placeholder="24ABCDE1234F1Z5" />
              </div>
              <div>
                <label className={label}>Company State</label>
                <input className={input} value={settings.business_state || ''} onChange={e => set('business_state', e.target.value)} placeholder="Gujarat" />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Billing Address</label>
                <input className={input} value={settings.business_billing_address || ''} onChange={e => set('business_billing_address', e.target.value)} placeholder="Billing address printed on invoice" />
              </div>
            </div>

            <div className="flex items-center gap-2 mt-6 mb-4">
              <Calculator className="w-4 h-4 text-[#1E3A5F]" />
              <h3 className="font-semibold text-stone-800 text-sm">Bank account details</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={label}>Account Name</label>
                <input className={input} value={settings.bank_details_account_name || ''} onChange={e => set('bank_details_account_name', e.target.value)} />
              </div>
              <div>
                <label className={label}>Bank Name</label>
                <input className={input} value={settings.bank_details_bank_name || ''} onChange={e => set('bank_details_bank_name', e.target.value)} />
              </div>
              <div>
                <label className={label}>Account Number</label>
                <input className={input} value={settings.bank_details_account_no || ''} onChange={e => set('bank_details_account_no', e.target.value)} />
              </div>
              <div>
                <label className={label}>IFSC Code</label>
                <input className={input} value={settings.bank_details_ifsc || ''} onChange={e => set('bank_details_ifsc', e.target.value)} />
              </div>
            </div>

            <div className="mt-6">
              <label className={label}>Invoice Terms & Conditions</label>
              <textarea className={`${input} resize-none`} rows={3} value={settings.invoice_terms_conditions || ''} onChange={e => set('invoice_terms_conditions', e.target.value)} placeholder="Terms & conditions printed on PDF" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className="w-4 h-4 text-[#1E3A5F]" />
              <h2 className="font-medium text-stone-900">Marketing landing page</h2>
            </div>
            <p className="text-xs text-stone-400 mb-4">
              Number used by the floating WhatsApp button on the public landing page at <code>/</code> and the standalone <code>/partner-signup</code> form. Digits only with country code, no <code>+</code> or spaces (e.g. <code>919876543210</code> for +91&nbsp;98765&nbsp;43210). Leave blank to use the built-in default.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={label}>Public WhatsApp number (landing page)</label>
                <input
                  className={input}
                  value={settings.landing_whatsapp_e164 || ''}
                  onChange={e => set('landing_whatsapp_e164', e.target.value.replace(/\D/g, '').slice(0, 15))}
                  placeholder="919876543210"
                  inputMode="numeric"
                />
                {settings.landing_whatsapp_e164 && (
                  <p className="text-xs text-stone-500 mt-1">
                    Will display as <span className="font-medium">+{settings.landing_whatsapp_e164.slice(0,2)} {settings.landing_whatsapp_e164.slice(2,7)} {settings.landing_whatsapp_e164.slice(7)}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="w-4 h-4 text-[#1E3A5F]" />
              <h2 className="font-medium text-stone-900">Default pricing parameters</h2>
            </div>
            <p className="text-xs text-stone-400 mb-4">Used in the gold rate calculator and new product forms.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={label}>Default IGI cert cost (₹)</label><input type="number" inputMode="decimal" className={input} value={settings.default_igi_cost || ''} onChange={e => set('default_igi_cost', e.target.value)} /></div>
              <div><label className={label}>Default making charges (₹)</label><input type="number" inputMode="decimal" className={input} value={settings.default_making_charges || ''} onChange={e => set('default_making_charges', e.target.value)} /></div>
              <div>
                <label className={label}>Trade margin target (% above COGS)</label>
                <input type="number" inputMode="decimal" className={input} value={settings.trade_margin_target || ''} onChange={e => set('trade_margin_target', e.target.value)} placeholder="28" />
                <p className="text-xs text-stone-400 mt-1">e.g. 28 = trade price × 1.28</p>
              </div>
              <div>
                <label className={label}>MRP markup target (% above trade)</label>
                <input type="number" inputMode="decimal" className={input} value={settings.mrp_markup_target || ''} onChange={e => set('mrp_markup_target', e.target.value)} placeholder="40" />
                <p className="text-xs text-stone-400 mt-1">e.g. 40 = MRP × 1.40</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Settings2 className="w-4 h-4 text-[#1E3A5F]" />
              <h2 className="font-medium text-stone-900">Gold karat multipliers</h2>
            </div>
            <p className="text-xs text-stone-400 mb-4">Used to calculate gold cost per gram for each karat from the 24K base rate.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { key: 'gold_markup_14k', label: '14K multiplier', default: '0.60' },
                { key: 'gold_markup_18k', label: '18K multiplier', default: '0.75' },
                { key: 'gold_markup_22k', label: '22K multiplier', default: '0.916' },
              ].map(f => (
                <div key={f.key}>
                  <label className={label}>{f.label}</label>
                  <input type="number" inputMode="decimal" step="0.001" className={input} value={settings[f.key] || f.default} onChange={e => set(f.key, e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Phone className="w-4 h-4 text-[#1E3A5F]" />
              <h2 className="font-medium text-stone-900">Operations defaults</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={label}>CAD turnaround SLA (hours)</label><input type="number" inputMode="decimal" className={input} value={settings.cad_sla_hours || '48'} onChange={e => set('cad_sla_hours', e.target.value)} /></div>
              <div><label className={label}>Default catalog delivery (days)</label><input type="number" inputMode="decimal" className={input} value={settings.default_delivery_days || '14'} onChange={e => set('default_delivery_days', e.target.value)} /></div>
              <div>
                <label className={label}>Advance payment required (%)</label>
                <input type="number" inputMode="decimal" className={input} value={settings.advance_pct || '50'} onChange={e => set('advance_pct', e.target.value)} />
                <p className="text-xs text-stone-400 mt-1">% of order value required upfront</p>
              </div>
              <div><label className={label}>Follow-up reminder (days after visit)</label><input type="number" inputMode="decimal" className={input} value={settings.followup_days || '3'} onChange={e => set('followup_days', e.target.value)} /></div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className="w-4 h-4 text-[#1E3A5F]" />
              <h2 className="font-medium text-stone-900">Retailer WhatsApp notifications</h2>
            </div>
            <p className="text-xs text-stone-400 mb-4">
              Send retailers a WhatsApp ping when their order moves to a milestone (CAD sent, design approved, dispatched, delivered) or when courier / tracking is added. Per-retailer toggle lives on each partner's profile.
            </p>
            <div className="space-y-4">
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-stone-800">Globally enabled</p>
                  <p className="text-xs text-stone-400">Master kill-switch. When off, no retailer pings are sent.</p>
                </div>
                <input
                  type="checkbox"
                  className="w-5 h-5 accent-[#1E3A5F]"
                  checked={(settings.whatsapp_notifications_enabled ?? 'true').toLowerCase() !== 'false'}
                  onChange={e => set('whatsapp_notifications_enabled', e.target.checked ? 'true' : 'false')}
                />
              </label>
              <div>
                <label className={label}>Webhook URL</label>
                <input
                  className={input}
                  value={settings.whatsapp_webhook_url || ''}
                  onChange={e => set('whatsapp_webhook_url', e.target.value)}
                  placeholder="https://your-whatsapp-gateway.example.com/send"
                />
                <p className="text-xs text-stone-400 mt-1">
                  POSTs JSON: <code>{`{ phone, message, orderId, trigger }`}</code>. Use your WhatsApp Business / gateway endpoint.
                </p>
              </div>
              <div>
                <label className={label}>Webhook bearer token (optional)</label>
                <input
                  type="password"
                  className={input}
                  value={settings.whatsapp_webhook_token || ''}
                  onChange={e => set('whatsapp_webhook_token', e.target.value)}
                  placeholder="Sent as Authorization: Bearer ..."
                />
              </div>
              <div>
                <label className={label}>Inbound webhook bearer token (optional)</label>
                <input
                  type="password"
                  className={input}
                  value={settings.whatsapp_inbound_token || ''}
                  onChange={e => set('whatsapp_inbound_token', e.target.value)}
                  placeholder="Verifies inbound replies posted to /api/whatsapp/inbound"
                />
                <p className="text-xs text-stone-400 mt-1">
                  Used by the inbound webhook so the design team can reply <code>ACK &lt;order#&gt;</code> to a CAD revision ping and have it marked acknowledged. Configure your gateway to forward replies to <code>/api/whatsapp/inbound</code> with this token as <code>Authorization: Bearer ...</code>.
                </p>
              </div>
              <div>
                <label className={label}>Public app URL (used in message links)</label>
                <input
                  className={input}
                  value={settings.public_base_url || ''}
                  onChange={e => set('public_base_url', e.target.value)}
                  placeholder="https://shewah.example.com"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User management */}
      {tab === 'users' && isMaster && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-stone-500">Manage who can access this admin panel and what they can see.</p>
            <button onClick={() => { setShowNewUser(true); setUserError('') }}
              className="flex items-center gap-2 bg-[#1E3A5F] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#162B47]">
              <Plus className="w-4 h-4" /> Add user
            </button>
          </div>

          {/* New user form */}
          {showNewUser && (
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-stone-900">New user</h3>
                <button onClick={() => { setShowNewUser(false); setUserError('') }}><X className="w-4 h-4 text-stone-400" /></button>
              </div>
              <div className="mb-4">
                <label className={label}>User type</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'sub', label: 'Staff (admin)', desc: 'Internal team member' },
                    { id: 'manufacturer', label: 'Manufacturer', desc: 'Workshop / karigar login' },
                    { id: 'retailer', label: 'Retailer', desc: 'Partner store login' },
                  ].map(r => (
                    <button key={r.id} type="button"
                      onClick={() => setNewUser(prev => ({ ...prev, role: r.id as any }))}
                      className={`text-left px-3 py-2.5 rounded-lg border transition-colors ${
                        newUser.role === r.id ? 'border-[#1E3A5F] bg-[#1E3A5F]/8' : 'border-stone-200 hover:bg-stone-50'
                      }`}>
                      <p className="text-sm font-medium text-stone-800">{r.label}</p>
                      <p className="text-xs text-stone-400 mt-0.5">{r.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className={label}>Username *</label>
                  <input className={inp} placeholder="e.g. rahul" value={newUser.username}
                    onChange={e => setNewUser(prev => ({ ...prev, username: e.target.value.toLowerCase() }))} />
                </div>
                <div>
                  <label className={label}>Display name</label>
                  <input className={inp} placeholder="e.g. Rahul Shah" value={newUser.displayName}
                    onChange={e => setNewUser(prev => ({ ...prev, displayName: e.target.value }))} />
                </div>
                {newUser.role === 'manufacturer' && (
                  <div className="sm:col-span-2">
                    <label className={label}>Manufacturing partner *</label>
                    <select className={inp} value={newUser.manufacturingPartnerId}
                      onChange={e => setNewUser(prev => ({ ...prev, manufacturingPartnerId: e.target.value }))}>
                      <option value="">Select partner...</option>
                      {mfgPartners.map(p => (
                        <option key={p.id} value={p.id}>{p.name}{p.city ? ` — ${p.city}` : ''}</option>
                      ))}
                    </select>
                    <p className="text-xs text-stone-400 mt-1">Manufacturer will only see orders assigned to this partner.</p>
                  </div>
                )}
                {newUser.role === 'retailer' && (
                  <div className="sm:col-span-2">
                    <label className={label}>Retailer (partner store) *</label>
                    <select className={inp} value={newUser.partnerId}
                      onChange={e => setNewUser(prev => ({ ...prev, partnerId: e.target.value }))}>
                      <option value="">Select retailer...</option>
                      {retailPartners.map(p => (
                        <option key={p.id} value={p.id}>{p.store_name}{p.city ? ` — ${p.city}` : ''}</option>
                      ))}
                    </select>
                    <p className="text-xs text-stone-400 mt-1">Retailer will only see their own orders and the catalog. They cannot see costs, manufacturers or ledger.</p>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <label className={label}>Password *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                    <input type={showPass ? 'text' : 'password'} className={`${inp} pl-8 pr-9`}
                      placeholder="Min 6 characters" value={newUser.password}
                      onChange={e => setNewUser(prev => ({ ...prev, password: e.target.value }))} />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                      {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
              {newUser.role === 'sub' && (
              <div className="mb-4">
                <label className={label}>Module access</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                  {ALL_MODULES.map(m => (
                    <label key={m.id} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors text-sm ${
                      newUser.permissions.includes(m.id) ? 'border-[#1E3A5F] bg-[#1E3A5F]/8 text-stone-800' : 'border-stone-200 text-stone-500'
                    }`}>
                      <input type="checkbox" className="sr-only"
                        checked={newUser.permissions.includes(m.id)}
                        onChange={() => setNewUser(prev => ({ ...prev, permissions: togglePermission(prev.permissions, m.id) }))} />
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        newUser.permissions.includes(m.id) ? 'bg-[#1E3A5F] border-[#1E3A5F]' : 'border-stone-300'
                      }`}>
                        {newUser.permissions.includes(m.id) && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>
              )}
              {userError && <p className="text-red-500 text-sm mb-3">{userError}</p>}
              <div className="flex justify-end gap-2">
                <button onClick={() => { setShowNewUser(false); setUserError('') }}
                  className="px-4 py-2 text-sm text-stone-500 border border-stone-200 rounded-lg hover:bg-stone-50">Cancel</button>
                <button onClick={createUser} disabled={userSaving}
                  className="px-4 py-2 text-sm bg-[#1E3A5F] text-white rounded-lg hover:bg-[#162B47] disabled:opacity-50">
                  {userSaving ? 'Creating...' : 'Create user'}
                </button>
              </div>
            </div>
          )}

          {/* Edit user modal */}
          {editingUser && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-stone-900">Edit — {editingUser.username}</h3>
                  <button onClick={() => { setEditingUser(null); setEditPassword(''); setUserError('') }}>
                    <X className="w-5 h-5 text-stone-400" />
                  </button>
                </div>
                <div className="space-y-3 mb-4">
                  <div>
                    <label className={label}>Display name</label>
                    <input className={inp} value={editingUser.display_name || ''}
                      onChange={e => setEditingUser(prev => prev ? { ...prev, display_name: e.target.value } : null)} />
                  </div>
                  <div>
                    <label className={label}>New password (leave blank to keep current)</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                      <input type={showPass ? 'text' : 'password'} className={`${inp} pl-8 pr-9`}
                        placeholder="Enter new password to change" value={editPassword}
                        onChange={e => setEditPassword(e.target.value)} />
                      <button type="button" onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400">
                        {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mb-4">
                  <label className={`${label} mb-2`}>Module access</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_MODULES.map(m => (
                      <label key={m.id} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer text-sm ${
                        editingUser.permissions.includes(m.id) ? 'border-[#1E3A5F] bg-[#1E3A5F]/8 text-stone-800' : 'border-stone-200 text-stone-500'
                      }`}>
                        <input type="checkbox" className="sr-only"
                          checked={editingUser.permissions.includes(m.id)}
                          onChange={() => setEditingUser(prev => prev ? { ...prev, permissions: togglePermission(prev.permissions, m.id) } : null)} />
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          editingUser.permissions.includes(m.id) ? 'bg-[#1E3A5F] border-[#1E3A5F]' : 'border-stone-300'
                        }`}>
                          {editingUser.permissions.includes(m.id) && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        {m.label}
                      </label>
                    ))}
                  </div>
                </div>
                {userError && <p className="text-red-500 text-sm mb-3">{userError}</p>}
                <div className="flex gap-2">
                  <button onClick={() => { setEditingUser(null); setEditPassword(''); setUserError('') }}
                    className="flex-1 px-4 py-2.5 text-sm text-stone-500 border border-stone-200 rounded-xl hover:bg-stone-50">Cancel</button>
                  <button onClick={updateUser} disabled={userSaving}
                    className="flex-1 px-4 py-2.5 text-sm bg-[#1E3A5F] text-white rounded-xl hover:bg-[#162B47] disabled:opacity-50">
                    {userSaving ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Users list */}
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            {usersLoading ? (
              <div className="p-8 text-center text-stone-400 text-sm">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-stone-400 text-sm">No users found</div>
            ) : (
              <div className="divide-y divide-stone-50">
                {users.map(u => (
                  <div key={u.id} className="flex items-center gap-4 px-5 py-4">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold ${
                      u.role === 'master' ? 'bg-[#1E3A5F]/15 text-[#1E3A5F]' : 'bg-stone-100 text-stone-600'
                    }`}>
                      {(u.display_name || u.username).split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-stone-800">{u.display_name || u.username}</p>
                        <span className="text-xs text-stone-400">@{u.username}</span>
                        {u.role === 'master' && (
                          <span className="text-[10px] bg-[#1E3A5F]/15 text-[#1E3A5F] px-1.5 py-0.5 rounded font-medium">MASTER</span>
                        )}
                        {u.role === 'manufacturer' && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">MANUFACTURER</span>
                        )}
                        {u.role === 'retailer' && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">RETAILER</span>
                        )}
                        {!u.is_active && (
                          <span className="text-[10px] bg-red-100 text-red-500 px-1.5 py-0.5 rounded font-medium">INACTIVE</span>
                        )}
                      </div>
                      {u.role === 'sub' && (
                        <p className="text-xs text-stone-400 mt-0.5 truncate">
                          {u.permissions.length === 0 ? 'No modules assigned' :
                            u.permissions.map(p => ALL_MODULES.find(m => m.id === p)?.label).filter(Boolean).join(', ')}
                        </p>
                      )}
                      {u.role === 'master' && (
                        <p className="text-xs text-stone-400 mt-0.5">Full access to all modules</p>
                      )}
                      {u.role === 'manufacturer' && (
                        <p className="text-xs text-stone-400 mt-0.5 truncate">
                          {(() => {
                            const p = mfgPartners.find(x => x.id === u.manufacturing_partner_id)
                            return p ? `Linked to ${p.name}` : 'Linked manufacturing partner'
                          })()}
                        </p>
                      )}
                      {u.role === 'retailer' && (
                        <p className="text-xs text-stone-400 mt-0.5 truncate">
                          {(() => {
                            const p = retailPartners.find(x => x.id === u.partner_id)
                            return p ? `Linked to ${p.store_name}` : 'Linked retailer partner'
                          })()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {u.id !== session?.user?.id && (
                        <>
                          <button onClick={() => toggleActive(u)}
                            title={u.is_active ? 'Deactivate' : 'Activate'}
                            className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-50 rounded-lg">
                            {u.is_active ? <Shield className="w-4 h-4" /> : <ShieldOff className="w-4 h-4 text-red-400" />}
                          </button>
                          {u.role === 'sub' && (
                            <button onClick={() => { setEditingUser(u); setEditPassword(''); setUserError('') }}
                              className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-50 rounded-lg">
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => deleteUser(u.id, u.display_name || u.username)}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {u.id === session?.user?.id && (
                        <span className="text-xs text-stone-300 px-2">You</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload errors */}
      {tab === 'upload_errors' && isMaster && (
        <div className="space-y-4 max-w-5xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-stone-700 font-medium">Recent failed file uploads</p>
              <p className="text-xs text-stone-400 mt-0.5">
                Last 100 failures recorded by <code>/api/upload</code>. Use this to diagnose the next time a retailer reports a stuck upload.
              </p>
            </div>
            <button onClick={loadUploadErrors}
              className="flex items-center gap-2 text-sm text-stone-600 border border-stone-200 px-3 py-2 rounded-lg hover:bg-stone-50">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {uploadErrorsMigration && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
              <p className="font-medium mb-1">Migration required</p>
              <p className="text-amber-700">{uploadErrorsMigration}</p>
            </div>
          )}

          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            {uploadErrorsLoading ? (
              <div className="p-8 text-center text-stone-400 text-sm">Loading…</div>
            ) : uploadErrors.length === 0 ? (
              <div className="p-8 text-center text-stone-400 text-sm">
                No upload failures recorded. {!uploadErrorsMigration && "That's a good thing."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 text-stone-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium">When</th>
                      <th className="text-left px-4 py-2.5 font-medium">User</th>
                      <th className="text-left px-4 py-2.5 font-medium">File</th>
                      <th className="text-left px-4 py-2.5 font-medium">Size</th>
                      <th className="text-left px-4 py-2.5 font-medium">Status</th>
                      <th className="text-left px-4 py-2.5 font-medium">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {uploadErrors.map(e => (
                      <tr key={e.id} className="align-top">
                        <td className="px-4 py-3 text-stone-600 whitespace-nowrap">{fmtTime(e.created_at)}</td>
                        <td className="px-4 py-3 text-stone-600 whitespace-nowrap">
                          {e.username ? (
                            <>
                              <span className="text-stone-800">@{e.username}</span>
                              {e.user_role && (
                                <span className="ml-1 text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded">{e.user_role}</span>
                              )}
                            </>
                          ) : <span className="text-stone-400">anonymous</span>}
                          {e.source && <p className="text-[11px] text-stone-400 mt-0.5">via {e.source}</p>}
                        </td>
                        <td className="px-4 py-3 text-stone-700 break-all max-w-[220px]">
                          {e.file_name || <span className="text-stone-400">—</span>}
                          {e.file_type && <p className="text-[11px] text-stone-400 mt-0.5">{e.file_type}</p>}
                        </td>
                        <td className="px-4 py-3 text-stone-600 whitespace-nowrap">{fmtSize(e.file_size)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                            (e.status_code || 0) >= 500 ? 'bg-red-100 text-red-700' :
                            (e.status_code || 0) === 413 ? 'bg-amber-100 text-amber-700' :
                            'bg-stone-100 text-stone-600'
                          }`}>{e.status_code ?? '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-stone-700 break-words max-w-[420px]">
                          {e.error_message || <span className="text-stone-400">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
