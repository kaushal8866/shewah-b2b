import { supabaseAdmin } from './supabaseAdmin'
import { runInBackground } from './backgroundTask'

interface NotificationPayload {
  toPhone: string
  message: string
}

async function getAdminNotifyPhone(): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'lead_notify_whatsapp_to')
      .maybeSingle()
    return data?.value || ''
  } catch {
    return ''
  }
}

/** True when a real WhatsApp send is possible. Callers that carry a secret
 *  (e.g. storefront OTP) must check this rather than trusting the simulated
 *  `true` that `sendWhatsApp` returns when credentials are absent. */
export function isWhatsAppConfigured(): boolean {
  return !!(process.env.META_WHATSAPP_ACCESS_TOKEN && process.env.META_WHATSAPP_PHONE_NUMBER_ID)
}

export async function sendWhatsApp({ toPhone, message }: NotificationPayload): Promise<boolean> {
  const cleanPhone = toPhone.replace(/\D/g, '')
  if (!cleanPhone) return false

  const token = process.env.META_WHATSAPP_ACCESS_TOKEN
  const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID

  console.log(`[WhatsApp Notifications] Sending to: ${cleanPhone}`);

  if (!token || !phoneId) {
    console.warn('[WhatsApp Notifications] Meta credentials not set. Simulated send only.');
    console.log(`[WhatsApp Notifications] Message:\n${message}\n`);
    return true
  }

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
          to: cleanPhone,
          type: 'text',
          text: { preview_url: false, body: message },
        }),
      }
    )
    if (res.ok) {
      console.log(`[WhatsApp Notifications] Successfully sent message to ${cleanPhone}`);
      return true
    }
    const txt = await res.text()
    console.error(`[WhatsApp Notifications] Fail response from Meta: ${res.status} - ${txt}`);
    return false
  } catch (err: any) {
    console.error(`[WhatsApp Notifications] Error sending message:`, err?.message || err);
    return false
  }
}

export type ResellerNotificationEvent =
  | 'invite_sent'               // to Reseller: you have been invited
  | 'invite_accepted'           // to Admin: reseller accepted invite, onboarding started
  | 'reseller_approved'         // to Reseller: account approved, welcome!
  | 'order_placed_reseller'     // to Reseller: order received, pending payment
  | 'order_placed_admin'        // to Admin: new reseller order placed
  | 'payment_uploaded'          // to Admin: reseller uploaded proof of payment
  | 'payment_confirmed'         // to Reseller: payment verified, order in production
  | 'order_status_update'       // to Reseller: order status changed (QC, Dispatched, Delivered)
  | 'sample_requested'          // to Admin: reseller requested samples
  | 'sample_approved'           // to Reseller: sample approved and issued
  | 'sample_overdue_reminder'   // to Reseller: sample return overdue reminder
  | 'sample_charged'            // to Reseller: sample charged due to loss / expiry
  | 'callback_request'          // to Reseller: customer requested callback on storefront

export async function notifyResellerEvent(
  event: ResellerNotificationEvent,
  data: Record<string, any>
): Promise<void> {
  // Detached on purpose — callers must never block on a WhatsApp round-trip.
  // Routed through runInBackground so the platform keeps the invocation alive
  // until the send settles; a bare detached promise is killed when the
  // response returns, which silently dropped these messages.
  runInBackground(`notify.reseller.${event}`, async () => {
    try {
      let message = ''
      let toPhone = data.toPhone || ''

      const adminPhone = await getAdminNotifyPhone()

      switch (event) {
        case 'invite_sent':
          message = `Hello ${data.name},\n\nYou have been invited to join the Shewah White-Label Reseller Network! 🌟\n\nConfigure your own store, set custom markups, and dropship directly to your customers. Complete your onboarding here:\n${data.inviteUrl}\n\nInvitation Code: ${data.inviteCode}\nExpires: ${new Date(data.expiryDate).toLocaleDateString('en-IN')}`
          break

        case 'invite_accepted':
          toPhone = adminPhone
          message = `🔔 Admin Alert: Invitation accepted!\n\nReseller ${data.name} (${data.phone}) has completed onboarding registration. Verify their KYC profile in the Admin portal under Resellers.`
          break

        case 'reseller_approved':
          message = `Congratulations ${data.name}! 🎉\n\nYour Reseller account has been approved by Shewah. Log in to your Reseller Dashboard using your credentials to customize your storefront and start selling:\n${data.portalUrl}`
          break

        case 'order_placed_reseller':
          message = `Order placed: #${data.orderNumber} 🛍️\n\nProduct: ${data.productName}\nAmount Due: ₹${(data.floorPricePaise / 100).toLocaleString('en-IN')}\nPayment Deadline: ${new Date(data.deadline).toLocaleString('en-IN')}\n\nShewah dropships directly to your customer. Please remit the floor price and upload the screenshot in your portal before the deadline to initiate manufacturing.`
          break

        case 'order_placed_admin':
          toPhone = adminPhone
          message = `🔔 Admin Alert: New Reseller Order placed!\n\nOrder: #${data.orderNumber}\nReseller: ${data.resellerName}\nProduct: ${data.productName}\nFloor Price: ₹${(data.floorPricePaise / 100).toLocaleString('en-IN')}\nStatus: Pending Reseller Payment.`
          break

        case 'payment_uploaded':
          toPhone = adminPhone
          message = `🔔 Admin Alert: Payment proof uploaded!\n\nReseller: ${data.resellerName}\nOrder: #${data.orderNumber}\nAmount: ₹${(data.amountPaise / 100).toLocaleString('en-IN')}\nVerify the transaction in the Reseller Portal details screen.`
          break

        case 'payment_confirmed':
          message = `Payment verified! ✅\n\nYour order #${data.orderNumber} for ${data.productName} has been confirmed. Manufacturing has begun.`
          break

        case 'order_status_update':
          message = `Order status update: #${data.orderNumber} 📦\n\nYour order for ${data.productName} status is now: ${data.status}.\n${data.trackingNumber ? `Courier: ${data.courier} | Tracking Number: ${data.trackingNumber}` : ''}`
          break

        case 'sample_requested':
          toPhone = adminPhone
          message = `🔔 Admin Alert: New Sample request!\n\nReseller: ${data.resellerName}\nProduct: ${data.productName}\nType: ${data.sampleType === 'credit' ? 'Credit-based' : 'Deposit-based'}`
          break

        case 'sample_approved':
          message = `Sample Request Approved! 💎\n\nProduct: ${data.productName}\nType: ${data.sampleType === 'credit' ? 'Credit-based' : 'Deposit-based'}\nReturn Due Date: ${new Date(data.dueDate).toLocaleDateString('en-IN')}\n\nYour sample has been approved and issued. Ensure it is returned before the due date to avoid outstanding charges.`
          break

        case 'sample_overdue_reminder':
          message = `Urgent: Sample Return Overdue! ⚠️\n\nProduct: ${data.productName}\nReturn Due Date: ${new Date(data.dueDate).toLocaleDateString('en-IN')}\n\nPlease return the sample immediately. If not returned, the sample value of ₹${(data.valuePaise / 100).toLocaleString('en-IN')} will be charged to your outstanding balance.`
          break

        case 'sample_charged':
          message = `Sample charged: outstanding balance update! ⚠️\n\nThe sample for ${data.productName} was not returned by the due date. The sample value of ₹${(data.valuePaise / 100).toLocaleString('en-IN')} has been charged to your outstanding balance.`
          break

        case 'callback_request':
          message = `New enquiry from storefront! 📞\n\nCustomer: ${data.customerName}\nPhone: ${data.customerPhone}\nProduct: ${data.productName}\nMessage: ${data.customerMessage || 'No message provided.'}\n\nPlease contact them on WhatsApp to discuss selling options.`
          break

        default:
          return
      }

      if (toPhone) {
        await sendWhatsApp({ toPhone, message })
      }
    } catch (e) {
      console.error('[WhatsApp Notifications] Dispatch thread crash:', e)
    }
  })
}
