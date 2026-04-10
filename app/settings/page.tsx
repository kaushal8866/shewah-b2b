'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSession } from 'next-auth/react'
import { MODULES } from '@/lib/modules'
import {
  Save, Settings2, Calculator, User, Phone, Users, Plus,
  Edit2, Trash2, X, Check, Shield, ShieldOff, Eye, EyeOff, Lock
} from 'lucide-react'

const ALL_MODULES = MODULES.filter(m => m.id !== 'dashboard')

type AppUser = {
  id: string
  username: string
  display_name: string
  role: 'master' | 'sub'
  permissions: string[]
  is_active: boolean
  created_at: string
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const isMaster = session?.user?.role === 'master'
  const [tab, setTab] = useState<'general' | 'users'>('general')

  // General settings
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // User management
  const [users, setUsers] = useState<AppUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [showNewUser, setShowNewUser] = useState(false)
  const [editingUser, setEditingUser] = useState<AppUser | null>(null)
  const [newUser, setNewUser] = useState({ username: '', displayName: '', password: '', permissions: [] as string[] })
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
    if (tab === 'users' && isMaster) loadUsers()
  }, [tab])

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
    if (error) { alert('Error: ' + error.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function togglePermission(perms: string[], id: string): string[] {
    return perms.includes(id) ? perms.filter(p => p !== id) : [...perms, id]
  }

  async function createUser() {
    if (!newUser.username || !newUser.password) { setUserError('Username and password required'); return }
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
    setNewUser({ username: '', displayName: '', password: '', permissions: [] })
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

  const input = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none"
  const label = "block text-xs font-medium text-stone-500 mb-1"
  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none bg-white"

  return (
    <div className="p-4 lg:p-7 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Settings</h1>
          <p className="text-stone-500 text-sm mt-0.5">Admin configuration</p>
        </div>
        {tab === 'general' && (
          <button onClick={saveAll} disabled={saving}
            className="flex items-center gap-2 bg-[#C49C64] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#9B7A40] disabled:opacity-50 transition-colors">
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
              <User className="w-4 h-4 text-[#C49C64]" />
              <h2 className="font-medium text-stone-900">Business information</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={label}>Business name</label><input className={input} value={settings.business_name || ''} onChange={e => set('business_name', e.target.value)} /></div>
              <div><label className={label}>Owner name</label><input className={input} value={settings.owner_name || ''} onChange={e => set('owner_name', e.target.value)} /></div>
              <div><label className={label}>WhatsApp number</label><input className={input} value={settings.whatsapp_number || ''} onChange={e => set('whatsapp_number', e.target.value)} placeholder="919XXXXXXXXX" /></div>
              <div><label className={label}>Business address</label><input className={input} value={settings.surat_address || ''} onChange={e => set('surat_address', e.target.value)} /></div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="w-4 h-4 text-[#C49C64]" />
              <h2 className="font-medium text-stone-900">Default pricing parameters</h2>
            </div>
            <p className="text-xs text-stone-400 mb-4">Used in the gold rate calculator and new product forms.</p>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={label}>Default IGI cert cost (₹)</label><input type="number" className={input} value={settings.default_igi_cost || ''} onChange={e => set('default_igi_cost', e.target.value)} /></div>
              <div><label className={label}>Default making charges (₹)</label><input type="number" className={input} value={settings.default_making_charges || ''} onChange={e => set('default_making_charges', e.target.value)} /></div>
              <div>
                <label className={label}>Trade margin target (% above COGS)</label>
                <input type="number" className={input} value={settings.trade_margin_target || ''} onChange={e => set('trade_margin_target', e.target.value)} placeholder="28" />
                <p className="text-xs text-stone-400 mt-1">e.g. 28 = trade price × 1.28</p>
              </div>
              <div>
                <label className={label}>MRP markup target (% above trade)</label>
                <input type="number" className={input} value={settings.mrp_markup_target || ''} onChange={e => set('mrp_markup_target', e.target.value)} placeholder="40" />
                <p className="text-xs text-stone-400 mt-1">e.g. 40 = MRP × 1.40</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Settings2 className="w-4 h-4 text-[#C49C64]" />
              <h2 className="font-medium text-stone-900">Gold karat multipliers</h2>
            </div>
            <p className="text-xs text-stone-400 mb-4">Used to calculate gold cost per gram for each karat from the 24K base rate.</p>
            <div className="grid grid-cols-3 gap-4">
              {[
                { key: 'gold_markup_14k', label: '14K multiplier', default: '0.585' },
                { key: 'gold_markup_18k', label: '18K multiplier', default: '0.750' },
                { key: 'gold_markup_22k', label: '22K multiplier', default: '0.916' },
              ].map(f => (
                <div key={f.key}>
                  <label className={label}>{f.label}</label>
                  <input type="number" step="0.001" className={input} value={settings[f.key] || f.default} onChange={e => set(f.key, e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Phone className="w-4 h-4 text-[#C49C64]" />
              <h2 className="font-medium text-stone-900">Operations defaults</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={label}>CAD turnaround SLA (hours)</label><input type="number" className={input} value={settings.cad_sla_hours || '48'} onChange={e => set('cad_sla_hours', e.target.value)} /></div>
              <div><label className={label}>Default catalog delivery (days)</label><input type="number" className={input} value={settings.default_delivery_days || '14'} onChange={e => set('default_delivery_days', e.target.value)} /></div>
              <div>
                <label className={label}>Advance payment required (%)</label>
                <input type="number" className={input} value={settings.advance_pct || '50'} onChange={e => set('advance_pct', e.target.value)} />
                <p className="text-xs text-stone-400 mt-1">% of order value required upfront</p>
              </div>
              <div><label className={label}>Follow-up reminder (days after visit)</label><input type="number" className={input} value={settings.followup_days || '3'} onChange={e => set('followup_days', e.target.value)} /></div>
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
              className="flex items-center gap-2 bg-[#C49C64] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#9B7A40]">
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
              <div className="mb-4">
                <label className={label}>Module access</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                  {ALL_MODULES.map(m => (
                    <label key={m.id} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors text-sm ${
                      newUser.permissions.includes(m.id) ? 'border-[#C49C64] bg-[#C49C64]/8 text-stone-800' : 'border-stone-200 text-stone-500'
                    }`}>
                      <input type="checkbox" className="sr-only"
                        checked={newUser.permissions.includes(m.id)}
                        onChange={() => setNewUser(prev => ({ ...prev, permissions: togglePermission(prev.permissions, m.id) }))} />
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        newUser.permissions.includes(m.id) ? 'bg-[#C49C64] border-[#C49C64]' : 'border-stone-300'
                      }`}>
                        {newUser.permissions.includes(m.id) && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>
              {userError && <p className="text-red-500 text-sm mb-3">{userError}</p>}
              <div className="flex justify-end gap-2">
                <button onClick={() => { setShowNewUser(false); setUserError('') }}
                  className="px-4 py-2 text-sm text-stone-500 border border-stone-200 rounded-lg hover:bg-stone-50">Cancel</button>
                <button onClick={createUser} disabled={userSaving}
                  className="px-4 py-2 text-sm bg-[#C49C64] text-white rounded-lg hover:bg-[#9B7A40] disabled:opacity-50">
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
                        editingUser.permissions.includes(m.id) ? 'border-[#C49C64] bg-[#C49C64]/8 text-stone-800' : 'border-stone-200 text-stone-500'
                      }`}>
                        <input type="checkbox" className="sr-only"
                          checked={editingUser.permissions.includes(m.id)}
                          onChange={() => setEditingUser(prev => prev ? { ...prev, permissions: togglePermission(prev.permissions, m.id) } : null)} />
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          editingUser.permissions.includes(m.id) ? 'bg-[#C49C64] border-[#C49C64]' : 'border-stone-300'
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
                    className="flex-1 px-4 py-2.5 text-sm bg-[#C49C64] text-white rounded-xl hover:bg-[#9B7A40] disabled:opacity-50">
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
                      u.role === 'master' ? 'bg-[#C49C64]/15 text-[#C49C64]' : 'bg-stone-100 text-stone-600'
                    }`}>
                      {(u.display_name || u.username).split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-stone-800">{u.display_name || u.username}</p>
                        <span className="text-xs text-stone-400">@{u.username}</span>
                        {u.role === 'master' && (
                          <span className="text-[10px] bg-[#C49C64]/15 text-[#C49C64] px-1.5 py-0.5 rounded font-medium">MASTER</span>
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
    </div>
  )
}
