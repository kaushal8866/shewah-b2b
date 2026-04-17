'use client'

import { useEffect } from 'react'
import { AlertCircle, RefreshCcw, Home } from 'lucide-react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Application Error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center max-w-xl mx-auto">
      <div className="bg-error-container/10 p-4 rounded-full mb-6">
        <AlertCircle className="w-12 h-12 text-error" />
      </div>
      
      <h1 className="display-sm text-error">Operation Failed</h1>
      <p className="text-secondary mt-4 mb-8 text-balance">
        An unexpected error occurred while processing this request. This incident has been logged for review.
        {error.message && (
          <code className="block mt-4 p-3 bg-surface-low rounded text-xs select-all">
            {error.message}
          </code>
        )}
      </p>

      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={() => reset()}
          className="flex items-center justify-center gap-2 bg-primary text-surface-lowest px-6 py-3 rounded-md text-sm font-medium hover:bg-surface-highest transition-colors"
        >
          <RefreshCcw className="w-4 h-4" />
          Try again
        </button>
        
        <Link
          href="/dashboard"
          className="flex items-center justify-center gap-2 bg-surface-low text-primary px-6 py-3 rounded-md text-sm font-medium hover:bg-surface-highest transition-colors border ghost-border"
        >
          <Home className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
