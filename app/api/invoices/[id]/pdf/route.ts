import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { renderInvoicePdf } from '@/lib/invoicePdf'
import { toResponseBody } from '@/lib/pdfHelpers'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return new Response('Unauthorized', { status: 401 })
  if (session.user?.role !== 'master' && session.user?.role !== 'sub') {
    return new Response('Forbidden', { status: 403 })
  }

  const { id } = params
  if (!id) return new Response('Invoice ID is required', { status: 400 })

  try {
    // 1. Fetch invoice
    const { data: invoice, error } = await supabaseAdmin
      .from('gst_invoices')
      .select(`
        *,
        orders:order_id (order_number)
      `)
      .eq('id', id)
      .single()

    if (error || !invoice) {
      return new Response('Invoice not found', { status: 404 })
    }

    // 2. Load settings for bank details and terms
    const { data: settings } = await supabaseAdmin.from('settings').select('*')
    const settingMap = new Map((settings || []).map(s => [s.key, s.value]))
    
    const bankDetails = {
      accountName: settingMap.get('bank_details_account_name') || 'Shewah',
      bankName: settingMap.get('bank_details_bank_name') || '',
      accountNo: settingMap.get('bank_details_account_no') || '',
      ifsc: settingMap.get('bank_details_ifsc') || '',
      terms: settingMap.get('invoice_terms_conditions') || 'Goods once sold will not be taken back.',
    }

    // 3. Render PDF
    const pdfBuffer = await renderInvoicePdf(invoice, bankDetails)

    // 4. Return PDF stream response
    return new Response(toResponseBody(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Invoice_${invoice.invoice_number}.pdf"`,
      },
    })
  } catch (e: any) {
    return new Response(e.message || 'Failed to render invoice PDF', { status: 500 })
  }
}
