'use client'

import { useEffect, useState } from 'react'
import {
  Share2,
  Copy,
  CheckCircle,
  Plus,
  Trash2,
  ExternalLink,
  MessageCircle,
  Check,
  X,
  Sliders,
  Sparkles,
  Info
} from 'lucide-react'

export default function ResellerShareLinks() {
  const [shareLinks, setShareLinks] = useState<any[] | null>(null)
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [linkName, setLinkName] = useState('')
  const [markupPercent, setMarkupPercent] = useState('15')
  const [scope, setScope] = useState<'full' | 'curated'>('full')
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)

  // Copy state
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    loadAllData()
  }, [])

  async function loadAllData() {
    try {
      setLoading(true)
      const [linksRes, catRes] = await Promise.all([
        fetch('/api/portal/reseller/share').then(r => r.json()),
        fetch('/api/portal/reseller/catalog').then(r => r.json())
      ])

      if (linksRes.error) setError(linksRes.error)
      else setShareLinks(linksRes.shareLinks || [])

      if (catRes.error) setError(catRes.error)
      else setProducts(catRes.products || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      const res = await fetch('/api/portal/reseller/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          link_name: linkName,
          markup_percent: Number(markupPercent),
          scope,
          curated_product_ids: scope === 'curated' ? selectedProductIds : [],
          is_active: isActive
        })
      })

      const data = await res.json()
      if (data.error) {
        alert(data.error)
      } else {
        alert(editingId ? 'Share link updated successfully!' : 'Share link created successfully!')
        resetForm()
        loadAllData()
      }
    } catch (err: any) {
      alert('Error saving share link: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(link: any) {
    setEditingId(link.id)
    setLinkName(link.link_name)
    setMarkupPercent(String(link.markup_percent))
    setScope(link.scope)
    setSelectedProductIds(link.curated_product_ids || [])
    setIsActive(link.is_active)
    setShowForm(true)
  }

  async function handleToggleActive(link: any) {
    try {
      await fetch('/api/portal/reseller/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: link.id,
          link_name: link.link_name,
          markup_percent: link.markup_percent,
          scope: link.scope,
          curated_product_ids: link.curated_product_ids,
          is_active: !link.is_active
        })
      })
      loadAllData()
    } catch {
      // ignore
    }
  }

  function resetForm() {
    setEditingId(null)
    setLinkName('')
    setMarkupPercent('15')
    setScope('full')
    setSelectedProductIds([])
    setIsActive(true)
    setShowForm(false)
  }

  function handleProductCheckboxChange(productId: string) {
    setSelectedProductIds(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    )
  }

  function copyToClipboard(token: string, id: string) {
    const url = `${window.location.origin}/r/${token}`
    navigator.clipboard.writeText(url)
      .then(() => {
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2500)
      })
      .catch(() => alert('Copy failed.'))
  }

  if (loading) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading share manager...</div>
  if (error) return <div className="p-4 lg:p-7 max-w-4xl mx-auto"><div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div></div>

  const lbl = 'block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1'
  const inp = 'w-full border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 bg-white font-semibold text-stone-855 shadow-sm'

  return (
    <div className="p-4 lg:p-7 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <Share2 className="w-5.5 h-5.5 text-amber-600" />
            Branded Storefront Share Links
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Create custom-markup storefront links and monitor customer click/enquiry counts.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center gap-1 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> Create New Share Link
          </button>
        )}
      </div>

      {/* RLS policy information banner */}
      <div className="bg-stone-50 border border-stone-150 rounded-2xl p-4 flex items-start gap-3 text-xs text-stone-500">
        <Info className="w-4.5 h-4.5 text-stone-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Create unique URLs (e.g. for Instagram, WhatsApp status or catalog sharing).
          You can lock a custom markup profit on each link. Setting the scope to "Curated" lets you handpick a subset of products for targeted promotions.
        </p>
      </div>

      {/* Share Link Form Drawer/Modal */}
      {showForm && (
        <form onSubmit={handleSave} className="bg-white border border-stone-200 rounded-2xl p-5 shadow-md space-y-5">
          <div className="pb-3 border-b border-stone-100 flex items-center justify-between">
            <h3 className="font-bold text-stone-900 text-sm">
              {editingId ? 'Edit Share Link Configuration' : 'Generate New Share Link'}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="p-1 border border-stone-200 rounded-lg hover:bg-stone-50 text-stone-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className={lbl}>Collection Name *</label>
              <input
                type="text"
                className={inp}
                placeholder="e.g. My Best Ring Designs, Diwali Collection"
                value={linkName}
                onChange={e => setLinkName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className={lbl}>Selling Markup % *</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  className={`${inp} pr-6`}
                  value={markupPercent}
                  onChange={e => setMarkupPercent(e.target.value)}
                  min="0"
                  max="100"
                  required
                />
                <span className="absolute right-3 top-2 text-stone-400 text-xs font-bold">%</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className={lbl}>Catalog Scope Selection</label>
            <div className="flex bg-stone-100 rounded-xl p-1 w-full max-w-[320px]">
              <button
                type="button"
                onClick={() => setScope('full')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  scope === 'full' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400'
                }`}
              >
                Full Catalog
              </button>
              <button
                type="button"
                onClick={() => setScope('curated')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  scope === 'curated' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400'
                }`}
              >
                Curated Selection
              </button>
            </div>
          </div>

          {/* Curated checklist */}
          {scope === 'curated' && (
            <div className="border border-stone-200 rounded-xl p-4 bg-stone-50 space-y-3">
              <div className="flex justify-between items-center text-xs font-bold text-stone-500 uppercase tracking-wide">
                <span>Select Products to Include ({selectedProductIds.length})</span>
                <button
                  type="button"
                  onClick={() => setSelectedProductIds(selectedProductIds.length === products.length ? [] : products.map(p => p.id))}
                  className="text-amber-700 hover:underline hover:text-amber-800"
                >
                  {selectedProductIds.length === products.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto pt-1.5 border-t border-stone-200">
                {products.map(p => (
                  <label key={p.id} className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-stone-150 text-xs font-medium text-stone-750 cursor-pointer hover:bg-stone-50/50">
                    <input
                      type="checkbox"
                      className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                      checked={selectedProductIds.includes(p.id)}
                      onChange={() => handleProductCheckboxChange(p.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold truncate">{p.name}</p>
                      <p className="text-[10px] text-stone-400 font-mono mt-0.5">{p.code} · {p.category}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="px-5 py-2.5 text-xs text-stone-600 border border-stone-200 rounded-xl hover:bg-stone-50 font-bold bg-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs shadow-sm transition-colors"
            >
              {saving ? 'Saving...' : 'Generate URL Link'}
            </button>
          </div>
        </form>
      )}

      {/* Share Links List Table */}
      {shareLinks === null ? (
        <p className="text-stone-400 text-sm">Loading share links...</p>
      ) : shareLinks.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center shadow-sm">
          <Share2 className="w-10 h-10 text-stone-300 mx-auto mb-2" />
          <p className="text-stone-500 font-semibold text-sm">No Storefront Links Created</p>
          <p className="text-stone-400 text-xs mt-1">Generate your first custom share link using the button above.</p>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-50 text-stone-550 font-bold border-b border-stone-200 uppercase tracking-wider">
                  <th className="px-5 py-3">Link Name / Collection</th>
                  <th className="px-5 py-3 text-right">Markup</th>
                  <th className="px-5 py-3">Scope</th>
                  <th className="px-5 py-3 text-center">Clicks</th>
                  <th className="px-5 py-3 text-center">Enquiries</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {shareLinks.map(link => {
                  const storefrontUrl = `${window.location.origin}/r/${link.link_token}`
                  return (
                    <tr key={link.id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="px-5 py-4 space-y-1">
                        <p className="font-bold text-stone-900 text-sm leading-none">{link.link_name}</p>
                        <div className="flex items-center gap-1.5 pt-1">
                          <span className="text-[10px] text-stone-400 font-mono select-all truncate max-w-[180px]">{storefrontUrl}</span>
                          <button
                            onClick={() => copyToClipboard(link.link_token, link.id)}
                            className="p-1 hover:bg-stone-100 rounded text-stone-500 hover:text-stone-850"
                            title="Copy link to clipboard"
                          >
                            {copiedId === link.id ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <a
                            href={storefrontUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 hover:bg-stone-100 rounded text-stone-500 hover:text-[#1E3A5F]"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right font-black text-amber-700 text-sm">
                        {link.markup_percent}%
                      </td>
                      <td className="px-5 py-4">
                        <span className="bg-stone-100 text-stone-750 text-[10px] font-bold uppercase px-2 py-0.5 rounded border border-stone-200">
                          {link.scope}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center font-bold text-stone-850">
                        {link.click_count || 0}
                      </td>
                      <td className="px-5 py-4 text-center font-bold text-stone-850">
                        {link.enquiry_count || 0}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(link)}
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                            link.is_active
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-stone-100 text-stone-450 border-stone-200'
                          }`}
                        >
                          {link.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleEdit(link)}
                          className="bg-stone-100 hover:bg-stone-200 text-stone-650 text-xs font-bold px-2.5 py-1.5 rounded-lg border border-stone-200"
                        >
                          Edit Settings
                        </button>
                        <a
                          href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                            `✨ View our latest jewelry designs here!\n🔗 ${storefrontUrl}`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg shadow-sm"
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> Share
                        </a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
