import { waitUntil } from '@vercel/functions'

/**
 * Run side-effect work (WhatsApp sends, audit writes) that must not block the
 * response but must still be allowed to finish.
 *
 * The pattern this replaces was:
 *
 *     notifySomething(...).catch(err => console.error(err))
 *     return NextResponse.json(...)
 *
 * On a serverless platform that is a silent data-loss bug: once the response
 * is returned the function is frozen or torn down, so an in-flight fetch is
 * routinely killed mid-request and the notification never arrives. Nothing
 * logs, because the process is simply gone.
 *
 * `waitUntil` registers the promise with the platform so the invocation stays
 * alive until it settles, while the response still goes out immediately.
 *
 * This is a mitigation, not durability: the work is still lost if it throws or
 * if the platform hard-times-out. Anything that MUST be delivered belongs in a
 * persisted outbox table drained by cron.
 */
export function runInBackground(label: string, work: () => Promise<unknown>): void {
  try {
    waitUntil(
      work().catch((err) => {
        console.error(`[background:${label}]`, err?.message || err)
      }),
    )
  } catch (err) {
    // waitUntil throws outside a request context (e.g. during a unit test or a
    // local script). Fall back to a detached promise so behaviour degrades to
    // the previous best-effort rather than breaking the caller.
    console.warn(`[background:${label}] waitUntil unavailable, running detached`)
    void work().catch((e) => console.error(`[background:${label}]`, e?.message || e))
  }
}
