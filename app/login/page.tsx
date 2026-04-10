'use client'

import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Diamond, Eye, EyeOff, Lock, User } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!username || !password) { setError('Enter username and password'); return }
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      username: username.trim(),
      password,
      redirect: false,
    })

    setLoading(false)
    if (result?.error) {
      setError('Incorrect username or password')
    } else {
      router.replace('/')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-[#1C1A17] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#C49C64] flex items-center justify-center mb-4 shadow-lg">
            <Diamond className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-white text-2xl font-bold tracking-tight">Shewah Admin</h1>
          <p className="text-white/40 text-sm mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Username"
                autoComplete="username"
                className="w-full bg-white/8 border border-white/10 rounded-xl pl-10 pr-4 py-3.5 text-white placeholder-white/30 text-sm outline-none focus:border-[#C49C64] focus:bg-white/10 transition-colors"
              />
            </div>
          </div>

          <div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                className="w-full bg-white/8 border border-white/10 rounded-xl pl-10 pr-11 py-3.5 text-white placeholder-white/30 text-sm outline-none focus:border-[#C49C64] focus:bg-white/10 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center bg-red-400/10 border border-red-400/20 rounded-xl py-2.5 px-4">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#C49C64] hover:bg-[#9B7A40] text-white font-semibold py-3.5 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="text-white/20 text-xs text-center mt-8">
          Shewah Jewellery B2B · Internal use only
        </p>
      </div>
    </div>
  )
}
