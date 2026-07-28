import fs from 'fs'
import path from 'path'

/**
 * Populate process.env from .env.local when running a DIP script locally.
 *
 * The Next.js runtime does this for the app, but these scripts run under
 * vite-node outside that runtime. In GitHub Actions the variables arrive from
 * repository secrets and no file exists, so a missing .env.local is normal
 * rather than an error.
 *
 * Never overwrites a variable that is already set — CI must win over any file
 * that happens to be lying around.
 *
 * Deliberately hand-rolled: this needs to parse five lines of KEY=value, and
 * a dependency that reads secrets is a dependency worth not having.
 */
export function loadEnv(): void {
  const file = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(file)) return

  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue

    const key = trimmed.slice(0, eq).trim()
    if (!key || process.env[key] !== undefined) continue

    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

/** Fail loudly and early rather than on a confusing 401 mid-run. */
export function requireSupabaseEnv(): void {
  const missing = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
    .filter(k => !process.env[k])
  if (missing.length > 0) {
    throw new Error(
      `Missing ${missing.join(' and ')}. ` +
      'Locally these come from .env.local; in GitHub Actions from repository secrets.',
    )
  }
}
