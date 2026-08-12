import { supabaseAdmin } from './supabaseAdmin'
import { fmtDate } from './pdfHelpers'

type Settings = {
  enabled: boolean
  webhookUrl: string
  webhookToken: string
  publicBaseUrl: string
}

async function loadSettings(): Promise<Settings> {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('key, value')
    .in('key', [
      'whatsapp_notifications_enabled',
      'whatsapp_webhook_url',
      'whatsapp_webhook_token',
      'public_base_url',
    ])
  const map: Record<string, string> = {}
  for (const row of data || []) map[(row as any).key] = (row as any).value || ''
  return {
    enabled: (map.whatsapp_notifications_enabled || 'true').toLowerCase() !== 'false',
    webhookUrl: map.whatsapp_webhook_url || '',
    webhookToken: map.whatsapp_webhook_token || '',
    publicBaseUrl: map.public_base_url || process.env.NEXTAUTH_URL || '',
  }
}

async function postToWebhook(
  settings: Settings,
  payload: any
): Promise<{ ok: boolean; status: number; body: string }> {
  try {
    const res = await fetch(settings.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(settings.webhookToken ? { Authorization: `Bearer ${settings.webhookToken}` } : {}),
      },
      body: JSON.stringify(payload),
    })
    let body = ''
    try { body = await res.text() } catch {}
    return { ok: res.ok, status: res.status, body: body.slice(0, 500) }
  } catch (err: any) {
    return { ok: false, status: 0, body: err?.message || 'fetch_error' }
  }
}

export type QuoteShareSendResult = {
  ok: boolean
  status: number
  body: string
  reason?: string
  publicUrl?: string
  waUrl?: string
}

/**
 * Prepares the quote share URL and wa.me link, and optionally sends the notification webhook.
 */
export async function sendQuoteShareLink(opts: {
  quoteId: string
  token: string
  recipientName: string
  recipientPhone: string
  validUntil: string
}): Promise<QuoteShareSendResult> {
  const { quoteId, token, recipientName, recipientPhone, validUntil } = opts

  const rawPhone = (recipientPhone || '').toString().replace(/\D/g, '')
  // If phone begins with 10 digits in India, we can prepend 91 for wa.me.
  const phone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone

  const settings = await loadSettings()
  const baseUrl = (settings.publicBaseUrl || '').replace(/\/$/, '')
  const publicUrl = baseUrl ? `${baseUrl}/q/${token}` : `/q/${token}`

  const { data: quote } = await supabaseAdmin
    .from('quotes')
    .select('id, quote_number')
    .eq('id', quoteId)
    .maybeSingle()
  
  if (!quote) {
    return { ok: false, status: 0, body: '', reason: 'quote_not_found' }
  }

  const greetName = recipientName ? recipientName.split(' ')[0] : 'Customer'
  const message = `Hi ${greetName}, your Shewah quote ${(quote as any).quote_number} is ready: ${publicUrl}. Valid until ${fmtDate(validUntil)}.`
  const waUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : undefined

  if (!phone) {
    return { ok: true, status: 0, body: 'Prepared client link (no phone number)', publicUrl, waUrl }
  }

  if (!settings.enabled) {
    return { ok: true, status: 0, body: 'Prepared client link (notifications disabled)', publicUrl, waUrl, reason: 'notifications_disabled' }
  }

  if (!settings.webhookUrl) {
    return { ok: true, status: 0, body: 'Prepared client link (webhook not configured)', publicUrl, waUrl, reason: 'webhook_url_not_configured' }
  }

  const result = await postToWebhook(settings, {
    phone,
    message,
    quoteId,
    trigger: 'quote_share_link',
  })

  return { ...result, publicUrl, waUrl }
}

export async function notifyInternalQuoteResponse(opts: {
  quoteId: string
  decision: 'accepted' | 'revision'
  comment?: string | null
  customerName: string
}): Promise<void> {
  try {
    const { quoteId, decision, comment, customerName } = opts
    const settings = await loadSettings()
    
    // Fetch WhatsApp number, owner name, and email details
    const { data: settingRows } = await supabaseAdmin
      .from('settings')
      .select('key, value')
      .in('key', [
        'whatsapp_number',
        'owner_name',
        'lead_notify_email_to',
        'reconciliation_alert_email_from',
      ])
    const cfg: Record<string, string> = {}
    for (const row of settingRows || []) cfg[(row as any).key] = (row as any).value || ''
    
    const phone = (cfg.whatsapp_number || '').toString().replace(/\D/g, '')
    const emailTo = cfg.lead_notify_email_to || process.env.LEAD_NOTIFY_EMAIL || ''
    const emailFrom = cfg.reconciliation_alert_email_from || process.env.RESEND_FROM || ''
    
    const { data: quote } = await supabaseAdmin
      .from('quotes')
      .select('id, quote_number')
      .eq('id', quoteId)
      .maybeSingle()
    if (!quote) return

    const baseUrl = (settings.publicBaseUrl || '').replace(/\/$/, '')
    const adminUrl = `${baseUrl}/quotes/${quoteId}`
    const greet = cfg.owner_name ? `Hi ${cfg.owner_name.split(' ')[0]}` : 'Heads up'
    const qNum = (quote as any).quote_number

    const actionText = decision === 'accepted' ? 'ACCEPTED' : 'REVISION REQUESTED'
    const message = [
      `${greet}, quote ${qNum} has been ${actionText} by ${customerName}.`,
      comment ? `Note: ${comment}` : '',
      `View: ${adminUrl}`,
    ].filter(Boolean).join('\n')

    // 1. Dispatch WhatsApp if enabled
    if (settings.enabled && settings.webhookUrl && phone) {
      await postToWebhook(settings, {
        phone,
        message,
        quoteId,
        trigger: decision === 'accepted' ? 'quote_accepted_internal' : 'quote_revision_internal',
      })
    }

    // 2. Dispatch Email if Resend configured and target email available
    if (process.env.RESEND_API_KEY && emailFrom && emailTo) {
      try {
        const recipients = emailTo.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean)
        if (recipients.length > 0) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: emailFrom,
              to: recipients,
              subject: `Quote ${qNum} ${decision === 'accepted' ? 'ACCEPTED' : 'REVISION'} — ${customerName}`,
              text: message,
            }),
          })
        }
      } catch (emailErr: any) {
        console.error('[quoteShareNotify:email] failed to send email', emailErr?.message || emailErr)
      }
    }
  } catch (err: any) {
    console.error('[quoteShareNotify:internal] unexpected error', err?.message || err)
  }
}

/**
 * Tells the desk a customer has paid an advance and is waiting on verification.
 * The order does not move until someone acts on this, so it is worth an alert
 * rather than leaving it to be spotted in the dashboard.
 */
export async function notifyInternalAdvanceSubmitted(opts: {
  quoteId: string
  customerName: string
  amount: number
  reference?: string | null
  proofUrl?: string | null
}): Promise<void> {
  try {
    const { quoteId, customerName, amount, reference, proofUrl } = opts
    const settings = await loadSettings()

    const { data: settingRows } = await supabaseAdmin
      .from('settings')
      .select('key, value')
      .in('key', [
        'whatsapp_number',
        'owner_name',
        'lead_notify_email_to',
        'reconciliation_alert_email_from',
      ])
    const cfg: Record<string, string> = {}
    for (const row of settingRows || []) cfg[(row as any).key] = (row as any).value || ''

    const phone = (cfg.whatsapp_number || '').toString().replace(/\D/g, '')
    const emailTo = cfg.lead_notify_email_to || process.env.LEAD_NOTIFY_EMAIL || ''
    const emailFrom = cfg.reconciliation_alert_email_from || process.env.RESEND_FROM || ''

    const { data: quote } = await supabaseAdmin
      .from('quotes')
      .select('id, quote_number')
      .eq('id', quoteId)
      .maybeSingle()
    if (!quote) return

    const baseUrl = (settings.publicBaseUrl || '').replace(/\/$/, '')
    const adminUrl = `${baseUrl}/quotes/${quoteId}`
    const greet = cfg.owner_name ? `Hi ${cfg.owner_name.split(' ')[0]}` : 'Heads up'
    const qNum = (quote as any).quote_number
    const amountStr = `Rs. ${Math.round(amount).toLocaleString('en-IN')}`

    const message = [
      `${greet}, ${customerName} has submitted an advance of ${amountStr} for quote ${qNum}.`,
      reference ? `Reference: ${reference}` : '',
      proofUrl ? `Proof: ${proofUrl}` : '',
      `Verify to release production: ${adminUrl}`,
    ].filter(Boolean).join('\n')

    if (settings.enabled && settings.webhookUrl && phone) {
      await postToWebhook(settings, {
        phone,
        message,
        quoteId,
        trigger: 'quote_advance_submitted',
      })
    }

    if (process.env.RESEND_API_KEY && emailFrom && emailTo) {
      try {
        const recipients = emailTo.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean)
        if (recipients.length > 0) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: emailFrom,
              to: recipients,
              subject: `Advance ${amountStr} submitted — Quote ${qNum} (${customerName})`,
              text: message,
            }),
          })
        }
      } catch (emailErr: any) {
        console.error('[quoteShareNotify:email] failed to send email', emailErr?.message || emailErr)
      }
    }
  } catch (err: any) {
    console.error('[quoteShareNotify:advance] unexpected error', err?.message || err)
  }
}
