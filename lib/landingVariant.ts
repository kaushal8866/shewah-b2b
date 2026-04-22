// Task 102 — A/B test infrastructure for the public landing page (`/`).
//
// Two variants are served from `/`:
//   • `original`       — the layout shipped in task #85 (preserved at
//                        app/LandingPageOriginal.tsx).
//   • `outcome_first`  — the redesign from task #96 at app/LandingPage.tsx.
//
// A sticky cookie (`lp_variant`) is set by the middleware on the first visit,
// 50/50, and re-read for subsequent visits so a returning user keeps seeing
// the same layout. The variant value is forwarded with every signup payload
// and persisted on the `partner_signups.landing_variant` column so the lead
// inbox can show conversion counts per variant.
//
// ── Kill-switch ──────────────────────────────────────────────────────────
// Once a winner is decided, set the env var below in Replit Secrets and
// redeploy. All traffic — including users with the losing cookie already
// set — will be force-served the override variant. The losing layout file
// can then be deleted in a follow-up cleanup.
//
//   LANDING_VARIANT_OVERRIDE=original          (kill the redesign)
//   LANDING_VARIANT_OVERRIDE=outcome_first     (kill the original)
//
// Leave it unset while the test is running.

export const LANDING_VARIANTS = ['original', 'outcome_first'] as const
export type LandingVariant = typeof LANDING_VARIANTS[number]

export const LANDING_VARIANT_COOKIE = 'lp_variant'

// Middleware stamps the chosen variant onto this request header so the
// downstream Server Component renders the same variant we just persisted
// in the response cookie. Without this, first-time visitors (no cookie
// yet) would render whichever fallback the page picked, but submit a
// signup tagged with whatever middleware randomly assigned — corrupting
// the conversion attribution.
export const LANDING_VARIANT_HEADER = 'x-landing-variant'

// 60 days — long enough to span a multi-week test plus the buffer needed to
// retire a variant without immediately rolling cookies for repeat visitors.
export const LANDING_VARIANT_COOKIE_MAX_AGE = 60 * 60 * 24 * 60

export function isLandingVariant(v: unknown): v is LandingVariant {
  return v === 'original' || v === 'outcome_first'
}

export function readKillSwitch(): LandingVariant | null {
  const v = process.env.LANDING_VARIANT_OVERRIDE
  return isLandingVariant(v) ? v : null
}

export function pickRandomVariant(): LandingVariant {
  return Math.random() < 0.5 ? 'original' : 'outcome_first'
}

export const LANDING_VARIANT_LABEL: Record<LandingVariant, string> = {
  original:      'Original',
  outcome_first: 'Outcome-First',
}
