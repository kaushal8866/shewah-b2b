'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Diamond } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [debugInfo, setDebugInfo] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setDebugInfo('')

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      setDebugInfo(`URL: ${supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'MISSING'}`)

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(authError.message)
        setDebugInfo(prev => prev + ` | Auth Error: ${authError.message}`)
        setLoading(false)
        return
      }

      if (!data.session) {
        setError('Login succeeded but no session was returned. Check if email confirmation is required in your Supabase dashboard.')
        setDebugInfo(prev => prev + ' | No session returned')
        setLoading(false)
        return
      }

      setDebugInfo(prev => prev + ` | Session OK, user: ${data.session.user.email} | Redirecting...`)

      // Small delay so user can see the debug info
      await new Promise(r => setTimeout(r, 500))
      window.location.href = '/'
    } catch (err: any) {
      setError(err?.message || 'Unknown error')
      setDebugInfo(prev => prev + ` | Caught: ${err?.message}`)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#1C1A17] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="w-14 h-14 bg-[#C49C64] rounded-2xl flex items-center justify-center shadow-lg shadow-[#C49C64]/20">
            <Diamond className="w-7 h-7 text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-semibold text-white text-center mb-1">Shewah Admin</h1>
        <p className="text-white/40 text-sm text-center mb-8">Sign in to continue</p>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {debugInfo && (
            <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs rounded-xl px-4 py-3 font-mono break-all">
              {debugInfo}
            </div>
          )}

          <div>
            <label className="block text-xs text-white/50 mb-1.5 font-medium">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:border-[#C49C64] focus:outline-none transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-1.5 font-medium">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:border-[#C49C64] focus:outline-none transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#C49C64] text-white py-3 rounded-xl text-sm font-medium hover:bg-[#9B7A40] disabled:opacity-50 transition-colors mt-2"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="text-white/20 text-xs text-center mt-8">
          Shewah B2B Admin · Surat, Gujarat
        </p>
      </div>
    </div>
  )
}
