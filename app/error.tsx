'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw, Home, Copy, Check } from 'lucide-react'

/**
 * Route-level error boundary.
 *
 * The app had NO error boundary of any kind. In the App Router that means any
 * unhandled throw during render of a client component bubbles to the root and
 * Next shows its generic production message:
 *
 *     "Application error: a client-side exception has occurred
 *      (see the browser console for more information)"
 *
 * With 120 of 127 pages being client components that fetch on mount, a single
 * bad row, a missing column after a schema change, or one unguarded property
 * access white-screens the whole page — and tells the operator nothing they
 * can act on or report.
 *
 * This boundary keeps the app shell alive, shows what actually broke, and
 * offers a retry that re-runs the failed render rather than forcing a reload.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Still log it — the console remains the richest source, and this keeps
    // whatever error reporting gets wired up later working unchanged.
    console.error('[route-error]', error)
  }, [error])

  const details = [
    `Page:    ${typeof window !== 'undefined' ? window.location.pathname : '—'}`,
    `Error:   ${error?.message || 'Unknown error'}`,
    error?.digest ? `Digest:  ${error.digest}` : null,
    `Time:    ${new Date().toISOString()}`,
  ].filter(Boolean).join('\n')

  async function copyDetails() {
    try {
      await navigator.clipboard.writeText(details)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be blocked; the text is on screen and selectable anyway.
    }
  }

  return (
    <div className="p-5 md:p-8 max-w-2xl mx-auto">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-medium text-amber-900">
              This screen couldn&apos;t load
            </h1>
            <p className="text-sm text-amber-900/80 mt-1">
              Nothing was lost — the problem is with displaying this page, not with your data.
              Try again, and if it keeps happening send the details below.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 bg-[#1E3A5F] hover:bg-[#162B47] text-white text-sm font-medium px-4 py-2 rounded-lg min-h-[44px]"
              >
                <RefreshCw className="w-4 h-4" /> Try again
              </button>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 bg-white border border-stone-200 hover:border-stone-300 text-stone-700 text-sm font-medium px-4 py-2 rounded-lg min-h-[44px]"
              >
                <Home className="w-4 h-4" /> Go to dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* The actual error, always shown. Hiding it is what produced "see the
          browser console" — advice nobody on a phone can act on. */}
      <div className="mt-4 rounded-xl border border-stone-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Error details
          </h2>
          <button
            onClick={copyDetails}
            className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 px-2 py-1 rounded-md min-h-[32px]"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="text-xs text-stone-700 whitespace-pre-wrap break-words font-mono leading-relaxed">
          {details}
        </pre>
      </div>
    </div>
  )
}
