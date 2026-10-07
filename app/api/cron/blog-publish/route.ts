import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { runScheduledBlogPublisher } from '@/lib/blog/scheduler'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function isAuthorizedCron(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  // If CRON_SECRET is configured, strictly enforce bearer token
  if (cronSecret) {
    const authHeader = req.headers.get('authorization')
    return authHeader === `Bearer ${cronSecret}`
  }
  // If no CRON_SECRET is set in local/development, check if called from localhost or authorization header
  const authHeader = req.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return true
  }
  return false
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid or missing CRON_SECRET' }, { status: 401 })
  }

  try {
    const result = await runScheduledBlogPublisher()

    if (result.success && result.processed > 0 && result.slug) {
      // Revalidate public routes and syndication feeds
      try {
        revalidatePath('/blog')
        revalidatePath(`/blog/${result.slug}`)
        revalidatePath('/sitemap.xml')
        revalidatePath('/blog/rss.xml')
        revalidatePath('/blog/atom.xml')
        revalidatePath('/blog/feed.json')
      } catch (revErr) {
        console.warn('[cron/blog-publish] Revalidation warning:', revErr)
      }
    }

    return NextResponse.json(result, { status: 200 })
  } catch (err: any) {
    console.error('[cron/blog-publish] Exception:', err)
    return NextResponse.json({ error: 'Internal server error', details: err?.message || err }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
