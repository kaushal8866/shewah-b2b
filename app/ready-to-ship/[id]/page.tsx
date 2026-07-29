'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package, Check, X, MessageSquare } from 'lucide-react'
import { formatDate } from '@/lib/utils'

type Offer = {
  id: string
  partner_id: string
  offer_price: number
  note: string | null
  status: string
  counter_price: number | null
  counter_note: string | null
  created_at: string
  decided_at: string | null
  resulting_order_id: string | null
  partner: { id: string; store_name: string; owner_name: string | null; phone: string | null } | null
}

export default function ReadyToShipDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [item, setItem] = useState<Record<string, any> | null>(null)
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [busyOffer, setBusyOffer] = useState<string | null>(null)
  const [counterFor, setCounterFor] = useState<string | null>(null)
  const [counterPrice, setCounterPrice] = useState('')
  const [counterNote, setCounterNote] = useState('')

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const r = await fetch(`/api/ready-to-ship/${id}`)
    const j = await r.json()
    if (r.ok) {
      setItem(j.item)
      setOffers(j.offers || [])
    }
    setLoading(false)
  }

  async function decide(offerId: string, decision: 'accept' | 'counter' | 'reject') {
    setBusyOffer(offerId)
    const body: Record<string, unknown> = { offer_id: offerId, decision }
    if (decision === 'counter') {
      body.counter_price = Number(counterPrice)
      body.counter_note = counterNote || null
      if (!body.counter_price) { alert('Enter a counter price'); setBusyOffer(null); return }
    }
    const r = await fetch(`/api/ready-to-ship/${id}/offers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const j = await r.json()
    setBusyOffer(null)
    if (!r.ok) { alert(j.error || 'Failed'); return }
    setCounterFor(null); setCounterPrice(''); setCounterNote('')
    if (decision === 'accept') {
      alert(`Accepted! Created order ${j.order?.order_number || ''}`)
      router.push('/ready-to-ship')
      return
    }
    load()
  }

  async function withdraw() {
    if (!confirm('Withdraw this piece from the Ready-to-Ship list?')) return
    const r = await fetch(`/api/ready-to-ship/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'withdrawn' }),
    })
    if (r.ok) router.push('/ready-to-ship')
  }

  if (loading) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading...</div>
  if (!item) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Not found.</div>

  const photos: string[] = item.photos || []
  const pendingOffers = offers.filter(o => o.status === 'pending' || o.status === 'countered')
  const otherOffers = offers.filter(o => o.status !== 'pending' && o.status !== 'countered')

  return (
    <div className="p-4 lg:p-7 max-w-3xl">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/ready-to-ship" className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-stone-900">{item.product?.name || 'Ready-to-Ship piece'}</h1>
          <p className="text-stone-500 text-sm">
            {item.product?.code || 'No SKU'} · {item.karat}kt · {Number(item.gross_weight).toFixed(2)}g · listed at ₹{Number(item.list_price).toLocaleString('en-IN')}
          </p>
        </div>
        {item.status === 'available' && (
          <button onClick={withdraw}
            className="text-xs border border-stone-200 text-stone-600 px-3 py-1.5 rounded-lg hover:bg-stone-50">
            Withdraw
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        {photos.length === 0 ? (
          <div className="col-span-full bg-stone-100 rounded-xl aspect-square flex items-center justify-center text-stone-300">
            <Package className="w-10 h-10" />
          </div>
        ) : photos.map((p, i) => (
          <div key={i} className="aspect-square bg-stone-100 rounded-xl overflow-hidden">
            <img src={p} alt="" className="w-full h-full object-cover" />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-5 mb-5">
        <h2 className="font-medium text-stone-900 mb-3">Specs</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-6 text-sm">
          <div><p className="text-xs text-stone-400">Karat</p><p className="text-stone-800">{item.karat}kt</p></div>
          <div><p className="text-xs text-stone-400">Gross weight</p><p className="text-stone-800">{Number(item.gross_weight).toFixed(2)}g</p></div>
          <div><p className="text-xs text-stone-400">Pure 24kt</p><p className="text-stone-800">{item.pure_24kt_weight ? `${Number(item.pure_24kt_weight).toFixed(2)}g` : '—'}</p></div>
          <div><p className="text-xs text-stone-400">Original COGS</p><p className="text-stone-800">{item.original_cogs ? `₹${Number(item.original_cogs).toLocaleString('en-IN')}` : '—'}</p></div>
          <div><p className="text-xs text-stone-400">List price</p><p className="text-stone-800">₹{Number(item.list_price).toLocaleString('en-IN')}</p></div>
          <div><p className="text-xs text-stone-400">From</p><p className="text-stone-800">{item.source_mfg_order?.order_number || '—'}</p></div>
        </div>
        {item.diamond_specs && Object.keys(item.diamond_specs).length > 0 && (
          <div className="mt-3 pt-3 border-t border-stone-100">
            <p className="text-xs text-stone-400 mb-1">Diamond specs</p>
            <pre className="text-xs text-stone-700 whitespace-pre-wrap">{JSON.stringify(item.diamond_specs, null, 2)}</pre>
          </div>
        )}
        {item.internal_notes && (
          <div className="mt-3 pt-3 border-t border-stone-100">
            <p className="text-xs text-stone-400 mb-1">Internal notes</p>
            <p className="text-sm text-stone-700">{item.internal_notes}</p>
          </div>
        )}
      </div>

      {item.status === 'sold' && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-sm mb-5">
          Sold. Resulting order: <Link className="underline" href={`/orders/${item.sold_order_id}`}>open</Link>.
        </div>
      )}

      <div className="bg-white rounded-xl border border-stone-200 p-5 mb-5">
        <h2 className="font-medium text-stone-900 mb-3">Open offers ({pendingOffers.length})</h2>
        {pendingOffers.length === 0 ? (
          <p className="text-sm text-stone-400">No open offers yet.</p>
        ) : (
          <div className="space-y-3">
            {pendingOffers.map(o => (
              <div key={o.id} className="border border-stone-200 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900 truncate">{o.partner?.store_name || 'Unknown retailer'}</p>
                    <p className="text-xs text-stone-400">{o.partner?.owner_name || ''} · {formatDate(o.created_at)}</p>
                    {o.note && (
                      <p className="text-xs text-stone-600 mt-1 flex items-start gap-1">
                        <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" /> {o.note}
                      </p>
                    )}
                    {o.status === 'countered' && (
                      <p className="text-xs text-amber-700 mt-1">
                        Countered to ₹{Number(o.counter_price || 0).toLocaleString('en-IN')}
                        {o.counter_note ? ` — ${o.counter_note}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-semibold text-stone-900">₹{Number(o.offer_price).toLocaleString('en-IN')}</p>
                    <p className="text-[10px] text-stone-400">vs list ₹{Number(item.list_price).toLocaleString('en-IN')}</p>
                  </div>
                </div>
                {item.status === 'available' && (
                  counterFor === o.id ? (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input type="number" placeholder="Counter price (₹)" value={counterPrice}
                        onChange={e => setCounterPrice(e.target.value)}
                        className="border border-stone-200 rounded-lg px-3 py-2 text-sm" />
                      <input placeholder="Note (optional)" value={counterNote}
                        onChange={e => setCounterNote(e.target.value)}
                        className="border border-stone-200 rounded-lg px-3 py-2 text-sm" />
                      <div className="sm:col-span-2 flex gap-2">
                        <button onClick={() => decide(o.id, 'counter')} disabled={busyOffer === o.id}
                          className="flex-1 bg-stone-800 text-white py-2 rounded-lg text-sm font-medium hover:bg-stone-900 disabled:opacity-50">
                          Send counter
                        </button>
                        <button onClick={() => { setCounterFor(null); setCounterPrice(''); setCounterNote('') }}
                          className="border border-stone-200 text-stone-600 px-3 py-2 rounded-lg text-sm">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => decide(o.id, 'accept')} disabled={busyOffer === o.id}
                        className="flex-1 flex items-center justify-center gap-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                        <Check className="w-4 h-4" /> Accept
                      </button>
                      <button onClick={() => setCounterFor(o.id)} disabled={busyOffer === o.id}
                        className="flex-1 border border-stone-200 text-stone-700 py-2 rounded-lg text-sm font-medium hover:bg-stone-50 disabled:opacity-50">
                        Counter
                      </button>
                      <button onClick={() => decide(o.id, 'reject')} disabled={busyOffer === o.id}
                        className="flex items-center gap-1 border border-red-200 text-red-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50">
                        <X className="w-4 h-4" /> Reject
                      </button>
                    </div>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {otherOffers.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-3">History</h2>
          <ul className="divide-y divide-stone-100">
            {otherOffers.map(o => (
              <li key={o.id} className="py-2 flex items-center justify-between text-sm">
                <span className="text-stone-700">{o.partner?.store_name || 'Unknown'} · ₹{Number(o.offer_price).toLocaleString('en-IN')}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                  o.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
                  o.status === 'rejected' ? 'bg-red-100 text-red-600' :
                  o.status === 'withdrawn' ? 'bg-stone-100 text-stone-500' : 'bg-stone-100 text-stone-500'
                }`}>{o.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
