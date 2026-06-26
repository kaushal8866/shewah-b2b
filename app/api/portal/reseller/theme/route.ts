import { NextResponse } from 'next/server'
import { getResellerSession } from '@/lib/resellerAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { safeDbError } from '@/lib/sanitizeDbError'

export async function GET() {
  const { reseller, error } = await getResellerSession()
  if (error || !reseller) {
    return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
  }

  // Fetch theme configuration
  const { data: theme, error: dbErr } = await supabaseAdmin
    .from('reseller_themes')
    .select('*')
    .eq('reseller_id', reseller.id)
    .maybeSingle()

  if (dbErr) {
    return NextResponse.json({ error: safeDbError(dbErr, 'reseller.theme.get', 'Could not load theme settings.') }, { status: 500 })
  }

  return NextResponse.json({ theme: theme || null })
}

export async function POST(req: Request) {
  const { reseller, error } = await getResellerSession()
  if (error || !reseller) {
    return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const {
    store_name,
    logo_url,
    favicon_url,
    colors,
    typography,
    buttons,
    layout,
    sections
  } = body

  if (!store_name) {
    return NextResponse.json({ error: 'Store name is required' }, { status: 400 })
  }

  const themePayload: any = {
    reseller_id: reseller.id,
    store_name,
    logo_url: logo_url || null,
    favicon_url: favicon_url || null,
    colors: colors || {
      primary: '#1E3A5F',
      secondary: '#C9A86A',
      background: '#FFFFFF',
      surface: '#F5F5F5',
      text: '#1C1917',
      borders: '#E7E5E4',
      accent: '#F59E0B'
    },
    typography: typography || {
      heading: 'Inter',
      body: 'Inter',
      scale: 'medium'
    },
    buttons: buttons || {
      shape: 'rounded-xl',
      style: 'fill',
      hover: 'darken',
      shadow: 'sm'
    },
    layout: layout || {
      density: 'comfortable',
      spacing: 'medium'
    },
    sections: sections || [],
    is_active: true,
    updated_at: new Date().toISOString()
  }

  // Upsert theme config
  let theme: any = null
  let { data: upsertData, error: upsertErr } = await supabaseAdmin
    .from('reseller_themes')
    .upsert(themePayload, { onConflict: 'reseller_id' })
    .select('*')
    .maybeSingle()

  if (upsertErr) {
    const errorMsg = upsertErr.message || ''
    // Check if the error is due to missing "sections" column
    if (errorMsg.includes('sections') || upsertErr.code === '42703') {
      return NextResponse.json({ 
        error: 'Database migration pending: The "sections" column is missing from the "reseller_themes" table. Please ask your administrator to execute the SQL migration script located at "scripts/migrate_reseller_theme_sections.sql" in the Supabase SQL editor.'
      }, { status: 400 })
    }
    return NextResponse.json({ error: safeDbError(upsertErr, 'reseller.theme.save', 'Could not save branding configuration.') }, { status: 500 })
  } else {
    theme = upsertData
  }

  // Also update reseller's profile store name if changed
  if (store_name !== reseller.store_name) {
    await supabaseAdmin
      .from('resellers')
      .update({ store_name })
      .eq('id', reseller.id)
  }

  return NextResponse.json({ theme })
}
