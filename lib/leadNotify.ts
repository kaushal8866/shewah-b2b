import { supabaseAdmin } from './supabaseAdmin'

export type DispatchOutcome = {
  sent: boolean
  error?: string | null
  at: string
}

type LeadPayload = {
  id: string
  full_name: string
  city: string
  whatsapp: string
  store_name?: string | null
  phone?: string | null
  email?: string | null
  gst_number?: string | null
  monthly_volume?: string | null
  note?: string | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  utm_content?: string | null
  referrer?: string | null
}

type Settings = {
  emailEnabled: boolean
  whatsappEnabled: boolean
  emailTo: string
  emailFrom: string
  whatsappTo: string
}

async function loadSettings(): Promise<Settings> {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('key, value')
    .in('key', [
      'lead_notify_email_enabled',
      'lead_notify_whatsapp_enabled',
      'lead_notify_email_to',
      'lead_notify_whatsapp_to',
      'reconciliation_alert_email_from',
    ])
  const map: Record<string, string> = {}
  for (const row of data || []) map[(row as any).key] = ((row as any).value || '').toString().trim()
  return {
    emailEnabled:    (map['lead_notify_email_enabled']    || 'true').toLowerCase() !== 'false',
    whatsappEnabled: (map['lead_notify_whatsapp_enabled'] || 'true').toLowerCase() !== 'false',
    emailTo:         map['lead_notify_email_to']    || process.env.LEAD_NOTIFY_EMAIL    || '',
    whatsappTo:      map['lead_notify_whatsapp_to'] || process.env.LEAD_NOTIFY_WHATSAPP_TO || '',
    emailFrom:       map['reconciliation_alert_email_from'] || process.env.RESEND_FROM || '',
  }
}

function buildBodyText(lead: LeadPayload): string {
  const lines: string[] = []
  lines.push(`New partner lead from the landing page.`)
  lines.push('')
  lines.push(`Name        : ${lead.full_name}`)
  if (lead.store_name)   lines.push(`Store       : ${lead.store_name}`)
  lines.push(`City        : ${lead.city}`)
  lines.push(`WhatsApp    : ${lead.whatsapp}`)
  if (lead.phone && lead.phone !== lead.whatsapp) {
    lines.push(`Phone       : ${lead.phone}`)
  }
  if (lead.email)        lines.push(`Email       : ${lead.email}`)
  if (lead.gst_number)   lines.push(`GST         : ${lead.gst_number}`)
  if (lead.monthly_volume) lines.push(`Volume      : ${lead.monthly_volume} pieces / month`)
  if (lead.note)         lines.push(`Note        : ${lead.note}`)
  lines.push('')
  lines.push(`Source attribution`)
  lines.push(`  utm_source   : ${lead.utm_source   || '—'}`)
  lines.push(`  utm_medium   : ${lead.utm_medium   || '—'}`)
  lines.push(`  utm_campaign : ${lead.utm_campaign || '—'}`)
  lines.push(`  utm_content  : ${lead.utm_content  || '—'}`)
  lines.push(`  referrer     : ${lead.referrer     || '—'}`)
  lines.push('')
  lines.push(`Open in admin: ${(process.env.NEXTAUTH_URL || '').replace(/\/$/, '')}/partners/leads`)
  return lines.join('\n')
}

function buildWhatsappText(lead: LeadPayload): string {
  const utmCamp = lead.utm_campaign ? `\nCampaign: ${lead.utm_campaign}` : ''
  const utmSrc  = lead.utm_source   ? ` (${lead.utm_source})` : ''
  const who = lead.store_name ? `${lead.full_name} — ${lead.store_name}` : lead.full_name
  return [
    `New Shewah partner lead`,
    ``,
    who,
    `${lead.city}`,
    `WhatsApp: ${lead.whatsapp}`,
    lead.phone && lead.phone !== lead.whatsapp ? `Phone: ${lead.phone}` : '',
    lead.monthly_volume ? `Volume: ${lead.monthly_volume} pcs/mo` : '',
    lead.note ? `Note: ${lead.note}` : '',
    utmCamp + utmSrc,
  ].filter(Boolean).join('\n')
}

async function dispatchEmail(s: Settings, lead: LeadPayload): Promise<DispatchOutcome> {
  const at = new Date().toISOString()
  if (!s.emailEnabled)            return { sent: false, error: 'disabled', at }
  if (!process.env.RESEND_API_KEY) return { sent: false, error: 'RESEND_API_KEY not set', at }
  if (!s.emailFrom)               return { sent: false, error: 'lead_notify_email_from not set', at }
  if (!s.emailTo)                 return { sent: false, error: 'lead_notify_email_to not set', at }
  try {
    const recipients = s.emailTo.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean)
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: s.emailFrom,
        to: recipients,
        subject: `New Shewah partner lead — ${lead.full_name}${lead.store_name ? ` (${lead.store_name})` : ` · ${lead.city}`}`,
        text: buildBodyText(lead),
      }),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      return { sent: false, error: `Resend ${res.status}: ${txt.slice(0, 200)}`, at }
    }
    return { sent: true, error: null, at }
  } catch (e: any) {
    return { sent: false, error: e?.message || 'network error', at }
  }
}

async function dispatchWhatsapp(s: Settings, lead: LeadPayload): Promise<DispatchOutcome> {
  const at = new Date().toISOString()
  if (!s.whatsappEnabled) return { sent: false, error: 'disabled', at }
  const token   = process.env.META_WHATSAPP_ACCESS_TOKEN
  const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneId) return { sent: false, error: 'META_WHATSAPP credentials not set', at }
  if (!s.whatsappTo)      return { sent: false, error: 'lead_notify_whatsapp_to not set', at }

  // Send to one or more E.164 numbers (digits only after stripping)
  const recipients = s.whatsappTo
    .split(/[,;\s]+/)
    .map(x => x.replace(/\D/g, ''))
    .filter(Boolean)
  if (recipients.length === 0) return { sent: false, error: 'no valid recipient numbers', at }

  const message = buildWhatsappText(lead)
  let firstError: string | null = null
  let anySent = false
  for (const to of recipients) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v20.0/${phoneId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { preview_url: false, body: message },
          }),
        },
      )
      if (res.ok) { anySent = true; continue }
      const txt = await res.text().catch(() => '')
      if (!firstError) firstError = `Meta ${res.status}: ${txt.slice(0, 200)}`
    } catch (e: any) {
      if (!firstError) firstError = e?.message || 'network error'
    }
  }
  return anySent
    ? { sent: true, error: firstError, at }
    : { sent: false, error: firstError || 'unknown', at }
}

/**
 * Notify the Shewah ops team about a new partner lead. Both channels run
 * in parallel; per-channel failures are returned in the result object so
 * the caller can persist them on the lead row. Never throws.
 */
export async function notifyNewPartnerLead(lead: LeadPayload): Promise<{
  email: DispatchOutcome
  whatsapp: DispatchOutcome
}> {
  const settings = await loadSettings()
  const [email, whatsapp] = await Promise.all([
    dispatchEmail(settings, lead),
    dispatchWhatsapp(settings, lead),
  ])
  return { email, whatsapp }
}

export type ConsultationPayload = {
  id: string
  full_name: string
  whatsapp: string
  email?: string | null
  city: string
  occasion: string
  budget: string
  jewellery_type: string
  preferred_contact: string
}

function buildConsultationBodyText(c: ConsultationPayload): string {
  const lines: string[] = []
  lines.push(`New D2C Jewellery Design Consultation request.`)
  lines.push('')
  lines.push(`Name           : ${c.full_name}`)
  lines.push(`WhatsApp       : ${c.whatsapp}`)
  if (c.email) lines.push(`Email          : ${c.email}`)
  lines.push(`City           : ${c.city}`)
  lines.push(`Occasion       : ${c.occasion}`)
  lines.push(`Target Budget  : ${c.budget}`)
  lines.push(`Jewellery Type : ${c.jewellery_type}`)
  lines.push(`Preferred Contact : ${c.preferred_contact}`)
  lines.push('')
  lines.push(`Open in admin: ${(process.env.NEXTAUTH_URL || '').replace(/\/$/, '')}/enquiries`)
  return lines.join('\n')
}

function buildConsultationWhatsappText(c: ConsultationPayload): string {
  return [
    `New SHEWAH D2C Consultation Request`,
    ``,
    `Name: ${c.full_name}`,
    `WhatsApp: ${c.whatsapp}`,
    `City: ${c.city}`,
    `Jewellery: ${c.jewellery_type}`,
    `Occasion: ${c.occasion}`,
    `Budget: ${c.budget}`,
    `Preferred contact: ${c.preferred_contact}`,
  ].join('\n')
}

/**
 * Notify the Shewah ops team about a new D2C consultation lead.
 */
export async function notifyNewD2cConsultation(c: ConsultationPayload): Promise<{
  email: DispatchOutcome
  whatsapp: DispatchOutcome
}> {
  const s = await loadSettings()
  const at = new Date().toISOString()

  let emailOutcome: DispatchOutcome = { sent: false, error: 'disabled', at }
  if (s.emailEnabled && process.env.RESEND_API_KEY && s.emailFrom && s.emailTo) {
    try {
      const recipients = s.emailTo.split(/[,;\s]+/).map(x => x.trim()).filter(Boolean)
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: s.emailFrom,
          to: recipients,
          subject: `New D2C Consultation Lead — ${c.full_name} · ${c.jewellery_type}`,
          text: buildConsultationBodyText(c),
        }),
      })
      if (res.ok) {
        emailOutcome = { sent: true, error: null, at }
      } else {
        const txt = await res.text().catch(() => '')
        emailOutcome = { sent: false, error: `Resend ${res.status}: ${txt.slice(0, 200)}`, at }
      }
    } catch (e: any) {
      emailOutcome = { sent: false, error: e?.message || 'network error', at }
    }
  }

  let whatsappOutcome: DispatchOutcome = { sent: false, error: 'disabled', at }
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN
  const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID
  if (s.whatsappEnabled && token && phoneId && s.whatsappTo) {
    const recipients = s.whatsappTo.split(/[,;\s]+/).map(x => x.replace(/\D/g, '')).filter(Boolean)
    if (recipients.length > 0) {
      const message = buildConsultationWhatsappText(c)
      let firstError: string | null = null
      let anySent = false
      for (const to of recipients) {
        try {
          const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to,
              type: 'text',
              text: { preview_url: false, body: message },
            }),
          })
          if (res.ok) {
            anySent = true
          } else {
            const txt = await res.text().catch(() => '')
            if (!firstError) firstError = `Meta ${res.status}: ${txt.slice(0, 200)}`
          }
        } catch (e: any) {
          if (!firstError) firstError = e?.message || 'network error'
        }
      }
      whatsappOutcome = anySent ? { sent: true, error: firstError, at } : { sent: false, error: firstError || 'unknown', at }
    } else {
      whatsappOutcome = { sent: false, error: 'no valid recipient numbers', at }
    }
  }

  return { email: emailOutcome, whatsapp: whatsappOutcome }
}

