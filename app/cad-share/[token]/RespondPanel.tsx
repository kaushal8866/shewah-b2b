'use client'

import { useState } from 'react'
import { CheckCircle2, MessageSquareWarning, Loader2 } from 'lucide-react'

export default function RespondPanel({ token }: { token: string }) {
  const [mode, setMode] = useState<'idle' | 'approve' | 'revision'>('idle')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<'approved' | 'revision' | null>(null)
  const [error, setError] = useState('')

  async function submit(decision: 'approved' | 'revision') {
    if (decision === 'revision' && !comment.trim()) {
      setError('Please describe what needs to change so the design team can act on it.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const r = await fetch(`/api/cad-share/${token}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, comment: comment.trim() || null }),
      })
      const j = await r.json()
      if (!r.ok) {
        setError(j?.error || 'Could not submit your response.')
      } else {
        setDone(decision)
      }
    } catch (e: any) {
      setError(e?.message || 'Network error')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="bg-emerald-950/40 border border-emerald-800 rounded-2xl p-5 text-emerald-100">
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle2 className="w-5 h-5" />
          <p className="text-sm font-semibold">
            Response sent — thank you.
          </p>
        </div>
        <p className="text-xs opacity-80">
          The Shewah design team has been notified on WhatsApp.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-stone-900 rounded-2xl border border-stone-800 p-5">
      <h2 className="text-white text-sm font-medium mb-3 uppercase tracking-wider text-[#B7C8DD]">
        Your response
      </h2>

      {mode === 'idle' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode('approve')}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl text-sm font-semibold transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" /> Approve design
          </button>
          <button
            type="button"
            onClick={() => setMode('revision')}
            className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white py-3.5 rounded-xl text-sm font-semibold transition-colors"
          >
            <MessageSquareWarning className="w-4 h-4" /> Request revision
          </button>
        </div>
      )}

      {mode !== 'idle' && (
        <div className="space-y-3">
          <p className="text-stone-200 text-sm">
            {mode === 'approve'
              ? 'Confirm approval and add an optional note for the design team.'
              : 'Tell the design team what needs to change. This will be sent to them on WhatsApp.'}
          </p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder={mode === 'approve'
              ? 'Optional note (e.g. "All good, ready to cut")'
              : 'Required: e.g. "Make the prongs thinner and reduce the halo by 0.5mm"'}
            className="w-full bg-stone-950 border border-stone-700 text-stone-100 rounded-xl px-3 py-2 text-sm focus:border-[#B7C8DD] outline-none placeholder:text-stone-600"
            disabled={submitting}
          />
          {error && <p className="text-amber-300 text-xs">{error}</p>}
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setMode('idle'); setComment(''); setError('') }}
              disabled={submitting}
              className="text-xs bg-stone-800 hover:bg-stone-700 text-stone-200 px-3 py-2 rounded-lg disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => submit(mode === 'approve' ? 'approved' : 'revision')}
              disabled={submitting}
              className={`text-sm flex items-center gap-2 px-4 py-2 rounded-lg font-semibold disabled:opacity-50 ${
                mode === 'approve'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'approve' ? 'Confirm approval' : 'Send revision request'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
