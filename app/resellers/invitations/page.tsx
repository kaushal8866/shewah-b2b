'use client'

import { useEffect, useState } from 'react'
import { supabase, ResellerInvitation } from '@/lib/supabase'
import { ArrowLeft, UserPlus, Send, RefreshCw, Trash2, Calendar, Clipboard, Check } from 'lucide-react'
import Link from 'next/link'

export default function ResellerInvitationsPage() {
  const [invitations, setInvitations] = useState<ResellerInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [form, setForm] = useState({
    recipient_name: '',
    recipient_phone: '',
    recipient_email: '',
    personal_message: 'Hi! You are invited to join Shewah Jewelry as a White-Label Reseller.',
    duration_days: '7',
  })

  useEffect(() => {
    fetchInvitations()
  }, [])

  async function fetchInvitations() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('reseller_invitations')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        alert('Error loading invitations: ' + error.message)
      } else {
        setInvitations(data || [])
      }
    } catch (e: any) {
      alert('Error fetching invitations: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateInvitation(e: React.FormEvent) {
    e.preventDefault()
    if (!form.recipient_name.trim() || !form.recipient_phone.trim()) {
      alert('Recipient Name and Phone are required')
      return
    }

    setSubmitting(true)
    const code = Math.random().toString(36).substring(2, 8).toUpperCase() // random 6 chars invite code
    const expiry = new Date()
    expiry.setDate(expiry.getDate() + parseInt(form.duration_days))

    const payload = {
      invitation_code: code,
      recipient_name: form.recipient_name.trim(),
      recipient_phone: form.recipient_phone.trim(),
      recipient_email: form.recipient_email.trim() || null,
      personal_message: form.personal_message.trim() || null,
      expiry_date: expiry.toISOString(),
      status: 'pending',
    }

    try {
      const { error } = await supabase.from('reseller_invitations').insert([payload])
      if (error) {
        alert('Error creating invitation: ' + error.message)
      } else {
        // Trigger simulated WhatsApp notification
        // (Reseller notification utility runs inside the API or can be called here)
        await fetch('/api/public/invite/trigger-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'invite_sent',
            name: payload.recipient_name,
            phone: payload.recipient_phone,
            code: payload.invitation_code,
            expiryDate: payload.expiry_date,
            url: `${window.location.origin}/accept-invite/${code}`,
          }),
        }).catch(err => console.error('Simulated invite notify error:', err))

        setForm({
          recipient_name: '',
          recipient_phone: '',
          recipient_email: '',
          personal_message: 'Hi! You are invited to join Shewah Jewelry as a White-Label Reseller.',
          duration_days: '7',
        })
        fetchInvitations()
      }
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRevokeInvitation(id: string) {
    if (!confirm('Are you sure you want to revoke this invitation? The recipient will not be able to onboard.')) return
    try {
      const { error } = await supabase
        .from('reseller_invitations')
        .update({ status: 'revoked', updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) {
        alert('Failed to revoke: ' + error.message)
      } else {
        setInvitations(prev =>
          prev.map(inv => (inv.id === id ? { ...inv, status: 'revoked' } : inv))
        )
      }
    } catch (e: any) {
      alert('Error revoking invitation: ' + e.message)
    }
  }

  function copyInviteLink(code: string) {
    const link = `${window.location.origin}/accept-invite/${code}`
    navigator.clipboard.writeText(link)
    setCopiedId(code)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const lbl = 'block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1'
  const inp = 'w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white shadow-sm'

  return (
    <div className="p-4 lg:p-7 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/resellers"
          className="p-2 border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors text-stone-500"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2 text-stone-500 text-xs mb-0.5 font-medium">
            <Link href="/resellers" className="hover:text-stone-700">Resellers</Link>
            <span>/</span>
            <span className="text-stone-700">Invitations</span>
          </div>
          <h1 className="text-xl font-semibold text-stone-900 tracking-tight flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-stone-500" />
            Invitation Management
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Invite Form */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5 shadow-sm space-y-4 h-fit">
          <h2 className="font-semibold text-stone-900 text-sm flex items-center gap-2 pb-2 border-b border-stone-100">
            Send New Invitation
          </h2>
          <form onSubmit={handleCreateInvitation} className="space-y-4">
            <div>
              <label className={lbl}>Recipient Name *</label>
              <input
                type="text"
                className={inp}
                placeholder="e.g. Pooja Sharma"
                value={form.recipient_name}
                onChange={e => setForm(p => ({ ...p, recipient_name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className={lbl}>Recipient Phone (WhatsApp) *</label>
              <input
                type="text"
                className={inp}
                placeholder="e.g. +91 98765 43210"
                value={form.recipient_phone}
                onChange={e => setForm(p => ({ ...p, recipient_phone: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className={lbl}>Recipient Email (Optional)</label>
              <input
                type="email"
                className={inp}
                placeholder="e.g. pooja@gmail.com"
                value={form.recipient_email}
                onChange={e => setForm(p => ({ ...p, recipient_email: e.target.value }))}
              />
            </div>
            <div>
              <label className={lbl}>Invite Duration</label>
              <select
                className={inp}
                value={form.duration_days}
                onChange={e => setForm(p => ({ ...p, duration_days: e.target.value }))}
              >
                <option value="3">3 Days</option>
                <option value="7">7 Days</option>
                <option value="15">15 Days</option>
                <option value="30">30 Days</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Personal Message</label>
              <textarea
                className={`${inp} resize-none`}
                rows={3}
                placeholder="Invite note..."
                value={form.personal_message}
                onChange={e => setForm(p => ({ ...p, personal_message: e.target.value }))}
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-stone-800 hover:bg-stone-900 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Generating link...' : 'Create Invite Link'}
            </button>
          </form>
        </div>

        {/* Invitations Directory Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3 mb-4">
              <h2 className="font-semibold text-stone-900 text-sm">Reseller Invitation History</h2>
              <button
                onClick={fetchInvitations}
                className="p-1 hover:bg-stone-50 rounded text-stone-400 hover:text-stone-600 transition-colors"
                title="Refresh list"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {loading ? (
              <div className="text-stone-400 text-sm py-12 text-center">Loading invitations...</div>
            ) : invitations.length === 0 ? (
              <div className="py-12 text-center text-stone-450 border border-dashed border-stone-200 rounded-xl bg-stone-50/50">
                No reseller invitations generated yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-stone-50 text-stone-500 font-semibold border-b border-stone-200">
                      <th className="px-4 py-3">Recipient</th>
                      <th className="px-4 py-3">Code / Link</th>
                      <th className="px-4 py-3"><span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Expiry</span></th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {invitations.map(invite => {
                      const isExpired = new Date(invite.expiry_date) < new Date() && invite.status === 'pending'
                      const displayStatus = isExpired ? 'expired' : invite.status

                      const statusColors: Record<string, string> = {
                        pending: 'bg-blue-50 text-blue-700 border-blue-200',
                        accepted: 'bg-green-50 text-green-700 border-green-200',
                        expired: 'bg-stone-100 text-stone-500 border-stone-200',
                        revoked: 'bg-red-50 text-red-700 border-red-200',
                      }

                      return (
                        <tr key={invite.id} className="hover:bg-stone-50/50 transition-colors">
                          <td className="px-4 py-3.5">
                            <p className="font-semibold text-stone-900">{invite.recipient_name}</p>
                            <p className="text-xs text-stone-400 mt-0.5">{invite.recipient_phone}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono bg-stone-100 text-stone-750 px-2 py-0.5 rounded text-xs font-semibold">
                                {invite.invitation_code}
                              </span>
                              {displayStatus === 'pending' && (
                                <button
                                  onClick={() => copyInviteLink(invite.invitation_code)}
                                  className="p-1 hover:bg-stone-100 rounded text-stone-400 hover:text-stone-600 transition-colors"
                                  title="Copy Invite Link"
                                >
                                  {copiedId === invite.invitation_code ? (
                                    <Check className="w-3.5 h-3.5 text-green-500" />
                                  ) : (
                                    <Clipboard className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-stone-500 text-xs font-mono">
                            {new Date(invite.expiry_date).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`px-2 py-0.5 text-xs font-medium border ${statusColors[displayStatus]}`}>
                              {displayStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            {displayStatus === 'pending' && (
                              <button
                                onClick={() => handleRevokeInvitation(invite.id)}
                                className="p-1 hover:bg-red-50 text-red-500 rounded transition-colors"
                                title="Revoke Invitation"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
