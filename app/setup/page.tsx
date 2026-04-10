'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Diamond, CheckCircle, AlertCircle, Lock, User } from 'lucide-react'

export default function SetupPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'checking' | 'ready' | 'done' | 'error'>('checking')
  const [errorMsg, setErrorMsg] = useState('')
  const [form, setForm] = useState({ username: '', displayName: '', password: '', confirm: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/setup')
      .then(r => r.json())
      .then(data => {
        if (!data.ready) {
          setStatus('error')
          setErrorMsg(data.error || 'Setup not available')
        } else if (data.hasUsers) {
          router.replace('/login')
        } else {
          setStatus('ready')
        }
      })
      .catch(() => { setStatus('error'); setErrorMsg('Could not connect to server') })
  }, [])

  function set(k: string, v: string) { setForm(prev => ({ ...prev, [k]: v })) }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault()
    if (!form.username || !form.password) { setErrorMsg('Username and password are required'); return }
    if (form.password !== form.confirm) { setErrorMsg('Passwords do not match'); return }
    if (form.password.length < 6) { setErrorMsg('Password must be at least 6 characters'); return }

    setSaving(true)
    setErrorMsg('')

    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: form.username,
        password: form.password,
        displayName: form.displayName || form.username,
      }),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) { setErrorMsg(data.error || 'Setup failed'); return }

    setStatus('done')
    setTimeout(async () => {
      await signIn('credentials', {
        username: form.username,
        password: form.password,
        redirect: false,
      })
      router.replace('/')
    }, 1500)
  }

  const inp = "w-full bg-white/8 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm outline-none focus:border-[#C49C64] focus:bg-white/10 transition-colors"

  return (
    <div className="min-h-screen bg-[#1C1A17] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#C49C64] flex items-center justify-center mb-4 shadow-lg">
            <Diamond className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-white text-2xl font-bold">Initial Setup</h1>
          <p className="text-white/40 text-sm mt-1">Create your master account</p>
        </div>

        {status === 'checking' && (
          <div className="text-center text-white/40 text-sm py-8">Checking setup status...</div>
        )}

        {status === 'error' && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 text-center">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-red-300 text-sm font-medium mb-1">Setup not available</p>
            <p className="text-red-400/70 text-xs leading-relaxed">{errorMsg}</p>
            {errorMsg.includes('SUPABASE_SERVICE_ROLE_KEY') && (
              <p className="text-white/40 text-xs mt-3 leading-relaxed">
                Add your Supabase service role key in the environment secrets, then refresh this page.
              </p>
            )}
          </div>
        )}

        {status === 'done' && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6 text-center">
            <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
            <p className="text-green-300 font-medium">Master account created!</p>
            <p className="text-white/40 text-sm mt-1">Signing you in...</p>
          </div>
        )}

        {status === 'ready' && (
          <form onSubmit={handleSetup} className="space-y-3">
            <div className="bg-[#C49C64]/10 border border-[#C49C64]/20 rounded-xl p-4 mb-2">
              <p className="text-[#C49C64] text-xs font-medium">
                This account will have full access to all modules and can create sub-users with limited access.
              </p>
            </div>

            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input className={`${inp} pl-10`} placeholder="Username *" value={form.username}
                onChange={e => set('username', e.target.value.toLowerCase())} />
            </div>
            <input className={inp} placeholder="Display name (e.g. Rahul)" value={form.displayName}
              onChange={e => set('displayName', e.target.value)} />
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input type="password" className={`${inp} pl-10`} placeholder="Password * (min 6 chars)"
                value={form.password} onChange={e => set('password', e.target.value)} />
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input type="password" className={`${inp} pl-10`} placeholder="Confirm password *"
                value={form.confirm} onChange={e => set('confirm', e.target.value)} />
            </div>

            {errorMsg && (
              <p className="text-red-400 text-sm text-center bg-red-400/10 border border-red-400/20 rounded-xl py-2.5 px-4">
                {errorMsg}
              </p>
            )}

            <button type="submit" disabled={saving}
              className="w-full bg-[#C49C64] hover:bg-[#9B7A40] text-white font-semibold py-3.5 rounded-xl text-sm transition-colors disabled:opacity-50 mt-2">
              {saving ? 'Creating account...' : 'Create master account'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
