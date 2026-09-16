import { Metadata } from 'next'
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import StoreLayout from '@/components/d2c/StoreLayout'
import { formatCurrency, type CurrencyCode } from '@/lib/markets'
import { CheckCircle2, Diamond, ArrowLeft, Truck, Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Order Status | Shewah Client Care',
  description: 'View the crafting and delivery status of your Shewah jewellery order.',
}

export default async function CustomerOrderTrackingPage({
  params,
}: {
  params: { id: string }
}) {
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('*, customers(full_name, email)')
    .eq('id', params.id)
    .maybeSingle()

  if (error || !order) {
    return (
      <StoreLayout>
        <div className="max-w-xl mx-auto px-6 py-24 text-center space-y-4">
          <Diamond className="w-12 h-12 text-[#A88A4F] mx-auto" />
          <h1 className="font-serif text-2xl text-[#2A241B]">Order Not Found</h1>
          <p className="text-xs text-[#5C5347]">
            Please check the link provided in your confirmation email or contact client care.
          </p>
          <div className="pt-4">
            <Link
              href="/"
              className="px-6 py-2.5 bg-[#2A241B] text-white text-xs uppercase tracking-widest font-medium rounded-full"
            >
              Return to Shewah
            </Link>
          </div>
        </div>
      </StoreLayout>
    )
  }

  const items = Array.isArray(order.d2c_items) ? order.d2c_items : []
  const currency = (order.currency || 'USD') as CurrencyCode

  const stages = [
    { label: 'Order Confirmed', completed: true },
    { label: 'Being Crafted in Atelier', completed: ['in_production', 'qc_passed', 'dispatched', 'delivered'].includes(order.status) },
    { label: 'Quality Audit & Hallmarking', completed: ['qc_passed', 'dispatched', 'delivered'].includes(order.status) },
    { label: 'Insured Air Courier Dispatched', completed: ['dispatched', 'delivered'].includes(order.status) },
    { label: 'Delivered', completed: order.status === 'delivered' },
  ]

  return (
    <StoreLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Link
          href="/jewellery"
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-[#A88A4F] hover:text-[#2A241B] mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Collections</span>
        </Link>

        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#E8DFC9] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E8DFC9]">
            <div>
              <span className="text-[10px] uppercase tracking-[0.25em] text-[#A88A4F] font-semibold">
                Order Tracking
              </span>
              <h1 className="font-serif text-2xl sm:text-3xl text-[#2A241B] font-medium mt-1">
                {order.order_number}
              </h1>
              <p className="text-xs text-[#5C5347] mt-0.5">
                Client: {order.customers?.full_name || 'Valued Client'}
              </p>
            </div>

            <div className="text-left sm:text-right">
              <span className="inline-block px-3 py-1 bg-[#F4ECDD] text-[#2A241B] rounded-full text-xs font-medium capitalize">
                {order.status?.replace(/_/g, ' ')}
              </span>
              <div className="text-[11px] text-[#8C8275] mt-1">
                Ordered on {order.order_date || 'Recently'}
              </div>
            </div>
          </div>

          {/* Delivery Window */}
          {order.expected_delivery_date && (
            <div className="p-4 bg-[#FBF7F0] border border-[#E8DFC9] rounded-xl flex items-center gap-3 text-xs text-[#2A241B]">
              <Truck className="w-5 h-5 text-[#A88A4F] shrink-0" />
              <div>
                <strong>Estimated Delivery:</strong> {order.expected_delivery_date}
                <div className="text-[11px] text-[#5C5347]">Direct door-to-door insured air courier with signature required</div>
              </div>
            </div>
          )}

          {/* Stage Progress Tracker */}
          <div className="space-y-4 pt-2">
            <h3 className="font-serif text-base font-medium text-[#2A241B]">
              Atelier Milestones
            </h3>
            <div className="space-y-3">
              {stages.map((st, i) => (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                    st.completed ? 'bg-[#5C7F5F] text-white' : 'bg-stone-200 text-stone-400'
                  }`}>
                    {st.completed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3 h-3" />}
                  </div>
                  <span className={st.completed ? 'font-medium text-[#2A241B]' : 'text-stone-400 font-light'}>
                    {st.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Items List */}
          <div className="pt-6 border-t border-[#E8DFC9] space-y-4">
            <h3 className="font-serif text-base font-medium text-[#2A241B]">
              Commissioned Items
            </h3>
            <div className="divide-y divide-[#E8DFC9]">
              {items.map((it: any, idx: number) => (
                <div key={idx} className="py-3 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-medium text-[#2A241B]">{it.name}</div>
                    <div className="text-[11px] text-[#5C5347]">
                      Qty: {it.quantity} {it.config?.metalTone && `• ${it.config.metalTone} Gold`}
                    </div>
                  </div>
                  <span className="font-semibold text-[#2A241B]">
                    {formatCurrency(it.lineTotal, currency)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-[#E8DFC9] flex justify-between font-serif text-lg font-medium text-[#2A241B]">
              <span>Total Billed</span>
              <span>{formatCurrency(order.total_amount, currency)}</span>
            </div>
          </div>
        </div>
      </div>
    </StoreLayout>
  )
}
