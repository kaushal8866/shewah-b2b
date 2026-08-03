'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { displayPhone, type Customer } from '@/lib/customers'
import { Loader2, Search, Users, Plus, ArrowUpRight } from 'lucide-react'

export default function CustomersPage() {
  const [rows, setRows] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')

  async function load() {
    setLoading(true); setError(null)
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) setError(error.message)
    setRows((data as Customer[]) || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return rows
    const digits = term.replace(/\D/g, '')
    return rows.filter(r => {
      if (r.full_name.toLowerCase().includes(term)) return true
      if (r.email && r.email.toLowerCase().includes(term)) return true
      if (r.city && r.city.toLowerCase().includes(term)) return true
      if (digits && (r.whatsapp.includes(digits) || (r.phone || '').includes(digits))) return true
      return false
    })
  }, [rows, q])

  return (
    <div className="p-5 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-stone-500 font-semibold">D2C</p>
          <h1 className="text-2xl font-serif mt-0.5">Customers</h1>
        </div>
        <Link href="/enquiries/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-stone-800 text-white text-sm font-medium hover:bg-stone-900">
          <Plus className="w-4 h-4" /> Log enquiry
        </Link>
      </div>
      <p className="text-sm text-stone-600 mb-5">Every consumer who has ever enquired or purchased. Customers are created automatically when an enquiry is logged.</p>

      <div className="relative mb-5 max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, phone, email, city…"
          className="w-full pl-9 pr-3 py-2.5 border border-stone-200 rounded-lg text-sm" />
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error.includes('relation') && error.includes('does not exist')
            ? 'The customers table is not yet provisioned. Run scripts/migrate_d2c_customers.sql in the Supabase SQL Editor and refresh.'
            : error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-stone-500 py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading customers…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-500">
          <Users className="w-8 h-8 mx-auto text-stone-300" />
          <p className="mt-3 text-sm">{q ? `No customers match "${q}".` : 'No customers yet.'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 text-xs text-stone-500">
                <th className="text-left px-4 py-2.5 font-medium">Name</th>
                <th className="text-left px-4 py-2.5 font-medium">WhatsApp</th>
                <th className="text-left px-4 py-2.5 font-medium">Email</th>
                <th className="text-left px-4 py-2.5 font-medium">City</th>
                <th className="text-left px-4 py-2.5 font-medium">Source</th>
                <th className="text-left px-4 py-2.5 font-medium">Added</th>
                <th className="px-2 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-t border-stone-100 hover:bg-stone-50">
                  <td className="px-4 py-2.5 font-medium text-stone-900">{c.full_name}</td>
                  <td className="px-4 py-2.5 text-stone-700">{displayPhone(c.whatsapp)}</td>
                  <td className="px-4 py-2.5 text-stone-700">{c.email || '—'}</td>
                  <td className="px-4 py-2.5 text-stone-700">{c.city || '—'}</td>
                  <td className="px-4 py-2.5 text-stone-700">{c.source || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-stone-500">{new Date(c.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="px-2 py-2.5">
                    <Link href={`/customers/${c.id}`} className="text-stone-800 hover:text-stone-900">
                      <ArrowUpRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
