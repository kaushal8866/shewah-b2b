import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { ORDER_STATUSES } from '@/lib/supabase'
import { Check, AlertTriangle, Diamond } from 'lucide-react'

type OrderRow = {
  id: string
  order_number: string
  status: string
  order_date: string
  expected_delivery: string | null
  actual_delivery: string | null
  dispatch_date: string | null
  courier: string | null
  tracking_number: string | null
  updated_at: string | null
  partners: { store_name: string; city: string } | null
  products: { code: string; name: string } | null
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function TrackOrderPage({ params }: { params: { orderId: string } }) {
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('id, order_number, status, order_date, expected_delivery, actual_delivery, dispatch_date, courier, tracking_number, updated_at, partners(store_name, city), products(code, name)')
    .eq('id', params.orderId)
    .single()

  if (error || !order) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center px-4">
        <div className="text-center text-stone-400 max-w-sm">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-stone-600" />
          <h1 className="text-white text-lg font-semibold mb-2">Order not found</h1>
          <p className="text-sm">This tracking link is invalid or the order could not be found. Please contact your Shewah representative.</p>
        </div>
      </div>
    )
  }

  const o = order as unknown as OrderRow
  const currentStageIdx = ORDER_STATUSES.findIndex(s => s.value === o.status)

  return (
    <div className="min-h-screen bg-stone-950 pb-12">
      {/* Header */}
      <div className="bg-stone-900 border-b border-stone-800">
        <div className="max-w-lg mx-auto px-4 py-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-xl bg-[#C49C64] flex items-center justify-center shrink-0">
              <Diamond className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-[#C49C64] text-xs font-medium tracking-wider uppercase">Shewah Jewellery</p>
              <p className="text-stone-400 text-xs">Order Tracking</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Order summary */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-stone-400 text-xs mb-0.5">Order number</p>
              <p className="text-white text-xl font-semibold">{o.order_number}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-stone-400 text-xs mb-0.5">Placed</p>
              <p className="text-stone-300 text-sm">{formatDate(o.order_date)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-stone-500 text-xs mb-0.5">Store</p>
              <p className="text-white">{o.partners?.store_name ?? '—'}</p>
              {o.partners?.city && <p className="text-stone-400 text-xs">{o.partners.city}</p>}
            </div>
            <div>
              <p className="text-stone-500 text-xs mb-0.5">Item</p>
              <p className="text-white text-sm leading-tight">{o.products ? `${o.products.code} — ${o.products.name}` : 'Custom design'}</p>
            </div>
            {o.expected_delivery && (
              <div>
                <p className="text-stone-500 text-xs mb-0.5">Expected delivery</p>
                <p className="text-white">{formatDate(o.expected_delivery)}</p>
              </div>
            )}
            {o.updated_at && (
              <div>
                <p className="text-stone-500 text-xs mb-0.5">Last updated</p>
                <p className="text-stone-300">{formatDate(o.updated_at)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Pipeline stepper */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
          <p className="text-stone-400 text-xs font-medium uppercase tracking-wider mb-4">Order status</p>

          <div className="space-y-0">
            {ORDER_STATUSES.map((stage, idx) => {
              const isDone = currentStageIdx > idx
              const isActive = currentStageIdx === idx
              const isLast = idx === ORDER_STATUSES.length - 1
              return (
                <div key={stage.value} className="flex items-stretch gap-4">
                  {/* Icon column */}
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 border-2 transition-colors ${
                      isDone
                        ? 'bg-[#C49C64] border-[#C49C64] text-white'
                        : isActive
                        ? 'bg-stone-950 border-[#C49C64] text-[#C49C64]'
                        : 'bg-stone-950 border-stone-700 text-stone-600'
                    }`}>
                      {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                    </div>
                    {!isLast && (
                      <div className={`w-0.5 flex-1 min-h-5 mt-1 mb-1 transition-colors ${isDone ? 'bg-[#C49C64]/60' : 'bg-stone-800'}`} />
                    )}
                  </div>
                  {/* Label column */}
                  <div className={`${isLast ? 'pb-0' : 'pb-4'} pt-1 flex-1`}>
                    <p className={`text-sm font-medium ${
                      isActive ? 'text-[#C49C64]' : isDone ? 'text-stone-400' : 'text-stone-600'
                    }`}>
                      {stage.label}
                      {isActive && (
                        <span className="ml-2 text-xs bg-[#C49C64]/20 text-[#C49C64] px-2 py-0.5 rounded-full border border-[#C49C64]/30 font-normal">
                          Current
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Dispatch info (if dispatched+) */}
        {currentStageIdx >= ORDER_STATUSES.findIndex(s => s.value === 'dispatched') && (
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
            <p className="text-stone-400 text-xs font-medium uppercase tracking-wider mb-3">Dispatch details</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Dispatch date', formatDate(o.dispatch_date)],
                ['Courier', o.courier ?? '—'],
                ['Tracking number', o.tracking_number ?? '—'],
                ['Actual delivery', formatDate(o.actual_delivery)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-stone-500 text-xs mb-0.5">{label}</p>
                  <p className="text-stone-300">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-stone-600 text-xs px-4">
          For questions about your order, contact your Shewah representative directly.
        </p>
      </div>
    </div>
  )
}
