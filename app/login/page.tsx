'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Diamond } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(authError.message)
        setLoading(false)
        return
      }

      if (!data.session) {
        setError('No session returned. Please check if email confirmation is required in Supabase.')
        setLoading(false)
        return
      }

      window.location.href = '/'
    } catch (err: any) {
      setError(err?.message || 'Sign in failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-md flex items-center justify-center shadow-ambient">
            <Diamond className="w-8 h-8 text-surface-lowest" />
          </div>
        </div>
        <h1 className="display-sm text-center mb-2">Shewah Admin</h1>
        <p className="text-secondary tracking-wide text-sm text-center mb-10">Sign in to continue</p>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="bg-surface-highest border border-outline-variant/30 text-primary text-sm p-4">
              {error}
            </div>
          )}

          <div>
            <label className="label-md block mb-2">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="label-md block mb-2">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-surface-lowest py-4 text-sm font-medium hover:bg-surface-highest hover:text-primary disabled:opacity-50 transition-colors mt-4"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="label-md text-center mt-12 text-outline-variant">
          Shewah B2B Admin · Surat, Gujarat
        </p>
      </div>
    </div>
  )
}
