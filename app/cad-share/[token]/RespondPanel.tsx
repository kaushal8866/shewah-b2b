'use client'

import { useRef, useState } from 'react'
import {
  CheckCircle2,
  MessageSquareWarning,
  Loader2,
  Upload,
  FileIcon,
  ImageIcon,
  X,
  Download,
} from 'lucide-react'

const MAX_BYTES = 25 * 1024 * 1024
const ACCEPT =
  'image/*,.stl,.3dm,.step,.stp,.obj,.pdf,.zip,.dwg,application/pdf,application/zip'

type PartnerUpload = {
  id: string
  url: string
  filename: string
  resource_type: 'image' | 'raw'
  bytes: number | null
  uploaded_at: string
}

function fmtBytes(n: number | null | undefined): string {
  if (!n || n <= 0) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export default function RespondPanel({
  token,
  initialUploads,
}: {
  token: string
  initialUploads?: PartnerUpload[]
}) {
  const [mode, setMode] = useState<'idle' | 'approve' | 'revision'>('idle')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<'approved' | 'revision' | null>(null)
  const [error, setError] = useState('')

  const [uploads, setUploads] = useState<PartnerUpload[]>(initialUploads || [])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadNote, setUploadNote] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)

    const tooBig = files.find(f => f.size > MAX_BYTES)
    if (tooBig) {
      setUploadError(`"${tooBig.name}" is larger than 25 MB.`)
      return
    }

    setUploading(true)
    setUploadError('')
    setUploadNote(null)
    try {
      const fd = new FormData()
      for (const f of files) fd.append('file', f)
      const r = await fetch(`/api/cad-share/${token}/upload`, {
        method: 'POST',
        body: fd,
      })
      const j = await r.json()
      if (!r.ok) {
        setUploadError(j?.error || `Upload failed (${r.status})`)
        return
      }
      const newOnes: PartnerUpload[] = j.uploaded || []
      if (newOnes.length > 0) {
        setUploads(prev => [...newOnes, ...prev])
      }
      const errs: string[] = j.errors || []
      if (errs.length > 0) {
        setUploadError(errs.join('; '))
      }
      if (newOnes.length > 0) {
        setUploadNote(
          `${newOnes.length} file${newOnes.length === 1 ? '' : 's'} uploaded — the Shewah team can now see them.`,
        )
      }
    } catch (e: any) {
      setUploadError(e?.message || 'Network error')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

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

  return (
    <>
      {/* -- Attach draft files ------------------------------------------------ */}
      <div className="bg-stone-900 rounded-2xl border border-stone-800 p-5">
        <h2 className="text-white text-sm font-medium mb-1 uppercase tracking-wider text-stone-300">
          Attach draft files
        </h2>
        <p className="text-stone-400 text-xs mb-3">
          Upload draft renders, STL / 3DM / STEP, or a PDF mockup directly here so the
          Shewah team gets them with this brief. Up to 25&nbsp;MB per file, 6 at a time.
        </p>

        <label
          className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-6 px-3 text-sm cursor-pointer transition-colors ${
            uploading
              ? 'border-stone-700 text-stone-500 pointer-events-none'
              : 'border-stone-700 hover:border-stone-300 text-stone-300'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            disabled={uploading}
            onChange={e => handleFiles(e.target.files)}
          />
          {uploading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-xs">Uploading…</span>
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              <span className="font-medium">Choose files to upload</span>
              <span className="text-[11px] text-stone-500">
                Images, STL, 3DM, STEP, OBJ, PDF, ZIP, DWG
              </span>
            </>
          )}
        </label>

        {uploadError && (
          <p className="text-amber-300 text-xs mt-3 whitespace-pre-wrap">{uploadError}</p>
        )}
        {uploadNote && (
          <p className="text-emerald-300 text-xs mt-3">{uploadNote}</p>
        )}

        {uploads.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] text-stone-500 uppercase tracking-wider mb-2">
              Uploaded so far ({uploads.length})
            </p>
            <ul className="space-y-2">
              {uploads.map(u => (
                <li
                  key={u.id}
                  className="flex items-center gap-3 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2"
                >
                  {u.resource_type === 'image' ? (
                    <a
                      href={u.url}
                      target="_blank"
                      rel="noreferrer"
                      className="w-10 h-10 rounded-lg overflow-hidden border border-stone-700 shrink-0 bg-stone-800 flex items-center justify-center"
                    >
                      <img
                        src={u.url}
                        alt={u.filename}
                        className="w-full h-full object-cover"
                      />
                    </a>
                  ) : (
                    <div className="w-10 h-10 rounded-lg border border-stone-700 shrink-0 bg-stone-800 flex items-center justify-center">
                      <FileIcon className="w-4 h-4 text-stone-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-100 truncate" title={u.filename}>
                      {u.filename}
                    </p>
                    <p className="text-[11px] text-stone-500">
                      {u.resource_type === 'image' ? (
                        <ImageIcon className="w-3 h-3 inline -mt-0.5 mr-1" />
                      ) : null}
                      {fmtBytes(u.bytes)}
                    </p>
                  </div>
                  <a
                    href={u.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-stone-400 hover:text-white p-1.5 rounded-md hover:bg-stone-800"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-stone-500 mt-2">
              These files are uploaded as soon as you pick them — no need to also click
              Approve or Request revision below.
            </p>
          </div>
        )}
      </div>

      {/* -- Approve / request revision --------------------------------------- */}
      {done ? (
        <div className="bg-emerald-950/40 border border-emerald-800 rounded-2xl p-5 text-emerald-100">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-5 h-5" />
            <p className="text-sm font-semibold">Response sent — thank you.</p>
          </div>
          <p className="text-xs opacity-80">
            The Shewah design team has been notified on WhatsApp.
          </p>
        </div>
      ) : (
        <div className="bg-stone-900 rounded-2xl border border-stone-800 p-5">
          <h2 className="text-white text-sm font-medium mb-3 uppercase tracking-wider text-stone-300">
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
                onChange={e => setComment(e.target.value)}
                rows={4}
                maxLength={4000}
                placeholder={
                  mode === 'approve'
                    ? 'Optional note (e.g. "All good, ready to cut")'
                    : 'Required: e.g. "Make the prongs thinner and reduce the halo by 0.5mm"'
                }
                className="w-full bg-stone-950 border border-stone-700 text-stone-100 rounded-xl px-3 py-2 text-sm focus:border-stone-300 outline-none placeholder:text-stone-600"
                disabled={submitting}
              />
              {error && <p className="text-amber-300 text-xs">{error}</p>}
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setMode('idle')
                    setComment('')
                    setError('')
                  }}
                  disabled={submitting}
                  className="text-xs bg-stone-800 hover:bg-stone-700 text-stone-200 px-3 py-2 rounded-lg disabled:opacity-50"
                >
                  <X className="w-3 h-3 inline -mt-0.5 mr-1" />
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
      )}
    </>
  )
}
