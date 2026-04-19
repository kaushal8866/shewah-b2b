'use client'

import { useEffect, useState } from 'react'
import { Save, Lock, Check, AlertCircle, MessageCircle } from 'lucide-react'

type Profile = {
  id: string
  store_name: string
  owner_name: string
  phone: string
  email: string | null
  city: string
  state: string
  address: string | null
  sarafa_bazaar: string | null
  notify_whatsapp: boolean
}

export default function RetailerProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [account, setAccount] = useState<{ username: string; displayName: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedTick, setSavedTick] = useState(false)
  const [error, setError] = useState('')

  // Editable form mirror
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [sarafa, setSarafa] = useState('')
  const [notifyWa, setNotifyWa] = useState(true)

  // Password change
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNext, setPwNext] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => { load() }, [])

  function load() {
    setLoading(true)
    fetch('/api/portal/retailer/profile')
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        const p: Profile = d.profile
        setProfile(p)
        setAccount(d.account || null)
        setPhone(p.phone || '')
        setEmail(p.email || '')
        setAddress(p.address || '')
        setSarafa(p.sarafa_bazaar || '')
        setNotifyWa(!!p.notify_whatsapp)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  async function saveProfile() {
    setSaving(true)
    setError('')
    setSavedTick(false)
    try {
      const r = await fetch('/api/portal/retailer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone, email, address,
          sarafa_bazaar: sarafa,
          notify_whatsapp: notifyWa,
        }),
      })
      const j = await r.json()
      if (!r.ok) { setError(j.error || 'Save failed'); return }
      setProfile(j.profile)
      setSavedTick(true)
      setTimeout(() => setSavedTick(false), 2500)
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwMsg(null)
    if (pwNext !== pwConfirm) {
      setPwMsg({ kind: 'err', text: 'New passwords do not match' })
      return
    }
    setPwBusy(true)
    try {
      const r = await fetch('/api/portal/retailer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_password',
          current_password: pwCurrent,
          new_password: pwNext,
        }),
      })
      const j = await r.json()
      if (!r.ok) {
        setPwMsg({ kind: 'err', text: j.error || 'Could not change password' })
        return
      }
      setPwMsg({ kind: 'ok', text: 'Password updated.' })
      setPwCurrent(''); setPwNext(''); setPwConfirm('')
    } catch (err: any) {
      setPwMsg({ kind: 'err', text: err?.message || 'Could not change password' })
    } finally {
      setPwBusy(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-stone-500">Loading...</div>
  if (error && !profile) return (
    <div className="p-6 max-w-xl">
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <div>{error}</div>
      </div>
    </div>
  )
  if (!profile) return null

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#1E3A5F] outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  return (
    <div className="p-4 lg:p-7 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">My profile</h1>
        <p className="text-sm text-stone-500 mt-1">Manage your store details, notifications, and password.</p>
      </div>

      {/* Store info — read-only fields managed by Shewah */}
      <section className="bg-white rounded-xl border border-stone-200 p-5">
        <h2 className="font-medium text-stone-900 mb-4">Store details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className={lbl}>Store name</p>
            <p className="text-stone-800">{profile.store_name}</p>
          </div>
          <div>
            <p className={lbl}>Owner</p>
            <p className="text-stone-800">{profile.owner_name}</p>
          </div>
          <div>
            <p className={lbl}>City</p>
            <p className="text-stone-800">{profile.city}</p>
          </div>
          <div>
            <p className={lbl}>State</p>
            <p className="text-stone-800">{profile.state}</p>
          </div>
        </div>
        <p className="text-xs text-stone-400 mt-3">
          To change your store name, owner, or location, please contact Shewah.
        </p>
      </section>

      {/* Editable contact + notification preferences */}
      <section className="bg-white rounded-xl border border-stone-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-stone-900">Contact & preferences</h2>
          {savedTick && (
            <span className="text-xs text-emerald-700 inline-flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Saved
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Phone *</label>
            <input className={inp} value={phone} onChange={e => setPhone(e.target.value)} placeholder="10-digit mobile" />
          </div>
          <div>
            <label className={lbl}>Email</label>
            <input type="email" className={inp} value={email} onChange={e => setEmail(e.target.value)} placeholder="optional" />
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>Shop address</label>
            <textarea className={`${inp} resize-none`} rows={2} value={address} onChange={e => setAddress(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>Sarafa bazaar / market</label>
            <input className={inp} value={sarafa} onChange={e => setSarafa(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input type="checkbox" className="w-4 h-4 accent-[#1E3A5F]" checked={notifyWa} onChange={e => setNotifyWa(e.target.checked)} />
              <span className="flex items-center gap-1.5 text-sm text-stone-800">
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                Send WhatsApp updates for my orders
              </span>
            </label>
            <p className="text-xs text-stone-400 mt-1 ml-7">
              Status changes (CAD ready, dispatch, delivery), tracking numbers and revision pings.
            </p>
          </div>
        </div>
        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        )}
        <div className="flex justify-end mt-4">
          <button onClick={saveProfile} disabled={saving}
            className="flex items-center gap-2 bg-[#1E3A5F] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#162B47] disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </section>

      {/* Password change */}
      <section className="bg-white rounded-xl border border-stone-200 p-5">
        <h2 className="font-medium text-stone-900 mb-1 flex items-center gap-2">
          <Lock className="w-4 h-4 text-[#1E3A5F]" /> Change password
        </h2>
        <p className="text-xs text-stone-400 mb-4">
          Logged in as <strong className="text-stone-700">{account?.username}</strong>.
          Choose a password of at least 8 characters.
        </p>
        <form onSubmit={changePassword} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={lbl}>Current password</label>
            <input type="password" className={inp} value={pwCurrent} onChange={e => setPwCurrent(e.target.value)} required autoComplete="current-password" />
          </div>
          <div>
            <label className={lbl}>New password</label>
            <input type="password" className={inp} value={pwNext} onChange={e => setPwNext(e.target.value)} required minLength={8} autoComplete="new-password" />
          </div>
          <div>
            <label className={lbl}>Confirm new password</label>
            <input type="password" className={inp} value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
          </div>
          {pwMsg && (
            <div className={`sm:col-span-2 rounded-lg px-3 py-2 text-sm flex items-start gap-2 ${
              pwMsg.kind === 'ok'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {pwMsg.kind === 'ok' ? <Check className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              <span>{pwMsg.text}</span>
            </div>
          )}
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" disabled={pwBusy || !pwCurrent || !pwNext || !pwConfirm}
              className="flex items-center gap-2 bg-[#1E3A5F] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#162B47] disabled:opacity-50">
              <Lock className="w-4 h-4" /> {pwBusy ? 'Updating...' : 'Update password'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
