'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import Script from 'next/script'

// Owner / back-office routes that Microsoft Clarity must NOT record.
// Public shop, blog, partner catalogue and customer pages stay tracked.
// Prefixes match exactly or on a path boundary ("/orders" does not catch
// "/order-confirmation"). Grounded in lib/authz.ts ROUTE_MODULES, minus
// routes that also serve public or partner-facing content.
const EXCLUDED_PREFIXES = [
  '/admin',
  '/dashboard',
  '/analytics',
  '/aurora',
  '/auth',
  '/cad-partners',
  '/cad-requests',
  '/cash',
  '/circuits',
  '/configurator',
  '/customers',
  '/diamond-asks',
  '/enquiries',
  '/invoices',
  '/manufacturing',
  '/order-change-requests',
  '/orders',
  '/partners',
  '/profitability',
  '/purchase-lots',
  '/quotes',
  '/resellers',
  '/settings',
  '/setup',
  '/stock',
  '/vendors',
  '/api',
]

function isExcluded(pathname: string | null): boolean {
  if (!pathname) return false
  return EXCLUDED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  )
}

const RELOAD_FLAG = 'clarity-admin-reload'

export default function ClarityTag() {
  const pathname = usePathname()
  const excluded = isExcluded(pathname)

  // Hard navigation boundary, deliberately in the render phase.
  //
  // Clarity has no supported client-side "stop recording" API. If the
  // recorder is already running because the visitor reached this excluded
  // route through a client-side (SPA) navigation from a tracked page, the
  // only way to keep admin DOM out of the recording is a full document
  // reload that serves this page without the tag at all.
  //
  // This runs during render, not in an effect: effects fire after React has
  // committed the new route's DOM, and Clarity records DOM mutations, so an
  // effect-based reload would already have leaked the admin screen. Running
  // here fires the reload before the protected tree commits and paints.
  // Known client-side entries (post-login redirect, error-boundary link)
  // already use full-document navigation, so this is the fallback for any
  // unknown future entry. The session flag guarantees a single reload.
  if (excluded && typeof window !== 'undefined') {
    const recorderLoaded =
      typeof (window as any).clarity === 'function' ||
      !!document.querySelector('script[src*="clarity.ms"]')
    if (recorderLoaded && !sessionStorage.getItem(RELOAD_FLAG)) {
      sessionStorage.setItem(RELOAD_FLAG, '1')
      window.location.reload()
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!excluded) sessionStorage.removeItem(RELOAD_FLAG)
  }, [excluded])

  if (excluded) return null

  return (
    <Script
      id="ms-clarity-init"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "xr0qwz63wd");
`,
      }}
    />
  )
}
