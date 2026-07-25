'use client'

import { useEffect } from 'react'

/**
 * Last-resort boundary — catches errors thrown by the root layout itself,
 * which app/error.tsx cannot reach because it renders *inside* that layout.
 *
 * This replaces the entire document, so it must ship its own <html>/<body>
 * and cannot rely on the app's providers, fonts or Tailwind layer being
 * available. Styles are inline for that reason.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global-error]', error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#F5F6F8' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '48px 20px' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1px solid #E5E8EE' }}>
            <h1 style={{ fontSize: 18, margin: '0 0 8px', color: '#1A1F2E' }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: '#5C6478', margin: '0 0 16px' }}>
              The app failed to start. Your data is unaffected. Try again, and if it
              persists send the details below.
            </p>

            <button
              onClick={reset}
              style={{
                background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: 10,
                padding: '12px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer',
                minHeight: 44,
              }}
            >
              Try again
            </button>

            <pre style={{
              marginTop: 20, padding: 12, background: '#F5F6F8', borderRadius: 10,
              fontSize: 12, color: '#454B5C', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              fontFamily: 'ui-monospace, monospace', lineHeight: 1.6,
            }}>
              {error?.message || 'Unknown error'}
              {error?.digest ? `\nDigest: ${error.digest}` : ''}
            </pre>
          </div>
        </div>
      </body>
    </html>
  )
}
