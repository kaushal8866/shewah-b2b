'use client'

import { useEffect, useState, useRef } from 'react'
import {
  MessageSquare,
  Send,
  Image,
  X,
  Search,
  User,
  ShoppingBag,
  Briefcase,
  Info,
  CheckCircle,
  Clock,
  Lock,
  ChevronRight,
  UserCheck
} from 'lucide-react'
import { uploadToCloudinary } from '@/lib/cloudinaryUpload'

type Message = {
  id: string
  reseller_id: string
  sender_role: string
  sender_id?: string
  message_type: string
  body: string
  file_url?: string
  thread_type: string
  linked_order_id?: string
  linked_sample_id?: string
  is_read_by_reseller: boolean
  is_read_by_admin: boolean
  assigned_admin_id?: string
  internal_notes?: string
  created_at: string
}

type Reseller = {
  id: string
  reseller_code: string
  store_name: string
  owner_name: string
  phone: string
  outstanding_balance_paise: number
  credit_limit_paise: number
  lifetime_sales_paise: number
}

type AdminUser = {
  id: string
  username: string
  role: string
  display_name?: string
}

export default function AdminResellerMessagesPage() {
  const [resellers, setResellers] = useState<Reseller[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [samples, setSamples] = useState<any[]>([])

  const [loading, setLoading] = useState(true)
  const [selectedResellerId, setSelectedResellerId] = useState<string | null>(null)
  
  // Filtering chat threads for the active reseller
  const [activeType, setActiveType] = useState<'general' | 'order' | 'sample'>('general')
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null)

  // Chat inputs
  const [inputText, setInputText] = useState('')
  const [isInternalNote, setIsInternalNote] = useState(false)
  const [screenshotUrl, setScreenshotUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    if (selectedResellerId) {
      loadMessages()

      const interval = setInterval(() => {
        loadMessages()
      }, 4000)

      return () => clearInterval(interval)
    }
  }, [selectedResellerId, activeType, selectedOrderId, selectedSampleId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadInitialData() {
    setLoading(true)
    try {
      // 1. Fetch Resellers
      const r1 = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: 'resellers', op: 'select' })
      })
      const d1 = await r1.json()
      if (d1.data) setResellers(d1.data)

      // 2. Fetch all messages to show unread badges
      const r2 = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'reseller_messages',
          op: 'select',
          order: [{ col: 'created_at', ascending: true }]
        })
      })
      const d2 = await r2.json()
      if (d2.data) setMessages(d2.data)

      // 3. Fetch app_users (admins)
      const r3 = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: 'app_users', op: 'select' })
      })
      const d3 = await r3.json()
      if (d3.data) setAdmins(d3.data)

      // 4. Fetch orders and samples for contextual side panels
      const r4 = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: 'reseller_orders', op: 'select', select: '*, products(code, name)' })
      })
      const d4 = await r4.json()
      if (d4.data) setOrders(d4.data)

      const r5 = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: 'reseller_sample_ledger', op: 'select', select: '*, products(code, name)' })
      })
      const d5 = await r5.json()
      if (d5.data) setSamples(d5.data)

      // Default select first reseller if exists
      if (d1.data && d1.data.length > 0) {
        setSelectedResellerId(d1.data[0].id)
      }
    } catch {}
    setLoading(false)
  }

  async function loadMessages() {
    if (!selectedResellerId) return
    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'reseller_messages',
          op: 'select',
          filters: [
            { col: 'reseller_id', type: 'eq', val: selectedResellerId }
          ],
          order: [{ col: 'created_at', ascending: true }]
        })
      })
      const data = await res.json()
      if (data.data) {
        setMessages(data.data)

        // Mark these messages as read by admin
        const unreadIds = data.data
          .filter((m: Message) => !m.is_read_by_admin && m.sender_role === 'reseller')
          .map((m: Message) => m.id)

        if (unreadIds.length > 0) {
          await fetch('/api/db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table: 'reseller_messages',
              op: 'update',
              values: { is_read_by_admin: true },
              filters: [{ col: 'id', type: 'in', val: unreadIds }]
            })
          })
        }
      }
    } catch {}
  }

  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const url = await uploadToCloudinary(files[0])
      setScreenshotUrl(url)
    } catch (err: any) {
      alert('Upload failed: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!inputText.trim() && !screenshotUrl) return
    if (!selectedResellerId) return

    setSending(true)
    try {
      const payload = {
        reseller_id: selectedResellerId,
        sender_role: 'admin',
        message_type: screenshotUrl ? 'file' : 'text',
        body: isInternalNote ? 'Internal Note' : inputText,
        internal_notes: isInternalNote ? inputText : null,
        file_url: screenshotUrl || null,
        thread_type: activeType,
        linked_order_id: activeType === 'order' ? selectedOrderId : null,
        linked_sample_id: activeType === 'sample' ? selectedSampleId : null,
        is_read_by_reseller: isInternalNote ? true : false, // internal notes are never read by reseller
        is_read_by_admin: true,
        created_at: new Date().toISOString()
      }

      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'reseller_messages',
          op: 'insert',
          values: payload
        })
      })

      const data = await res.json()
      if (data.data) {
        // Reload messages
        loadMessages()
        setInputText('')
        setScreenshotUrl('')
        setIsInternalNote(false)
      }
    } catch (err: any) {
      alert('Error sending: ' + err.message)
    } finally {
      setSending(false)
    }
  }

  async function handleAssignThread(adminId: string) {
    if (!selectedResellerId) return
    try {
      const threadMessages = messages.filter(m => {
        if (m.thread_type !== activeType) return false
        if (activeType === 'order' && m.linked_order_id !== selectedOrderId) return false
        if (activeType === 'sample' && m.linked_sample_id !== selectedSampleId) return false
        return true
      })

      if (threadMessages.length === 0) {
        // If no messages exist yet, insert a placeholder system message with the assignee
        await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: 'reseller_messages',
            op: 'insert',
            values: {
              reseller_id: selectedResellerId,
              sender_role: 'system',
              body: `Thread assigned to admin.`,
              thread_type: activeType,
              linked_order_id: activeType === 'order' ? selectedOrderId : null,
              linked_sample_id: activeType === 'sample' ? selectedSampleId : null,
              assigned_admin_id: adminId || null,
              is_read_by_admin: true,
              is_read_by_reseller: true
            }
          })
        })
      } else {
        const msgIds = threadMessages.map(m => m.id)
        await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: 'reseller_messages',
            op: 'update',
            values: { assigned_admin_id: adminId || null },
            filters: [{ col: 'id', type: 'in', val: msgIds }]
          })
        })
      }
      alert('Thread assignee updated!')
      loadMessages()
    } catch (err: any) {
      alert(err.message)
    }
  }

  // Filtered reseller list based on search
  const filteredResellers = resellers.filter(r =>
    r.store_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.owner_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.reseller_code.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Get selected reseller profile
  const selectedReseller = resellers.find(r => r.id === selectedResellerId)

  // Filter messages for current active thread filters
  const activeThreadMessages = messages.filter(m => {
    if (m.reseller_id !== selectedResellerId) return false
    if (m.thread_type !== activeType) return false
    if (activeType === 'order' && m.linked_order_id !== selectedOrderId) return false
    if (activeType === 'sample' && m.linked_sample_id !== selectedSampleId) return false
    return true
  })

  // Get active assignee from the latest message in this thread
  const latestThreadMessage = activeThreadMessages[activeThreadMessages.length - 1]
  const activeAssigneeId = latestThreadMessage?.assigned_admin_id || ''

  // Context sidebar details
  const activeOrder = orders.find(o => o.id === selectedOrderId)
  const activeSample = samples.find(s => s.id === selectedSampleId)

  const activeResellerOrders = orders.filter(o => o.reseller_id === selectedResellerId)
  const activeResellerSamples = samples.filter(s => s.reseller_id === selectedResellerId)

  return (
    <div className="flex h-[calc(100vh-64px)] bg-stone-50 border-t border-stone-200">
      {/* 1. Reseller List Pane */}
      <div className="w-80 shrink-0 border-r border-stone-200 bg-white flex flex-col">
        <div className="p-4 border-b border-stone-150 space-y-3 shrink-0">
          <h2 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
            <MessageSquare className="w-4.5 h-4.5 text-amber-600" /> Reseller Inboxes
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-stone-400" />
            <input
              type="text"
              placeholder="Search boutiques..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-stone-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-amber-500 bg-white font-medium"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
          {filteredResellers.map(r => {
            const isSelected = r.id === selectedResellerId
            // Count unread messages for this reseller
            const unreadCount = messages.filter(
              m => m.reseller_id === r.id && !m.is_read_by_admin && m.sender_role === 'reseller'
            ).length

            return (
              <button
                key={r.id}
                onClick={() => {
                  setSelectedResellerId(r.id)
                  setActiveType('general')
                  setSelectedOrderId(null)
                  setSelectedSampleId(null)
                }}
                className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between group ${
                  isSelected
                    ? 'bg-amber-50/75 border-amber-500 text-stone-950 font-bold'
                    : 'bg-white border-stone-200 hover:border-stone-300 text-stone-600'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-bold truncate leading-tight">{r.store_name}</p>
                  <p className="text-[10px] text-stone-450 mt-0.5">{r.owner_name} · {r.reseller_code}</p>
                </div>
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 shrink-0">
                    {unreadCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 2. Middle Pane: Chat Timeline */}
      <div className="flex-1 flex flex-col border-r border-stone-200 bg-stone-50">
        {/* Chat Header */}
        <div className="p-4 border-b border-stone-200 bg-white flex items-center justify-between shrink-0 shadow-sm">
          <div>
            <h3 className="text-sm font-bold text-stone-900">
              {selectedReseller?.store_name || 'Boutique Chat'}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-stone-450 font-medium">Owner: {selectedReseller?.owner_name}</span>
              <span className="text-[10px] text-stone-300">|</span>
              <span className="text-[10px] text-stone-450 font-medium">Code: {selectedReseller?.reseller_code}</span>
            </div>
          </div>

          {/* Assignee dropdown */}
          <div className="flex items-center gap-1.5 text-xs">
            <UserCheck className="w-4 h-4 text-stone-400 shrink-0" />
            <select
              value={activeAssigneeId}
              onChange={e => handleAssignThread(e.target.value)}
              className="border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs outline-none bg-white font-bold text-stone-800 focus:ring-1 focus:ring-amber-500"
            >
              <option value="">Unassigned</option>
              {admins.map(a => (
                <option key={a.id} value={a.id}>
                  {a.display_name || a.username} ({a.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Thread Tabs */}
        <div className="bg-white border-b border-stone-200 px-4 py-2 flex gap-2 shrink-0 overflow-x-auto">
          <button
            onClick={() => {
              setActiveType('general')
              setSelectedOrderId(null)
              setSelectedSampleId(null)
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              activeType === 'general'
                ? 'bg-amber-600 text-white'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
            }`}
          >
            General Support
          </button>

          {activeResellerOrders.map(o => (
            <button
              key={o.id}
              onClick={() => {
                setActiveType('order')
                setSelectedOrderId(o.id)
                setSelectedSampleId(null)
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap font-mono flex items-center gap-1 ${
                activeType === 'order' && selectedOrderId === o.id
                  ? 'bg-amber-600 text-white'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
              }`}
            >
              <ShoppingBag className="w-3 h-3" /> {o.order_number}
            </button>
          ))}

          {activeResellerSamples.map(s => (
            <button
              key={s.id}
              onClick={() => {
                setActiveType('sample')
                setSelectedSampleId(s.id)
                setSelectedOrderId(null)
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1 ${
                activeType === 'sample' && selectedSampleId === s.id
                  ? 'bg-amber-600 text-white'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
              }`}
            >
              <Briefcase className="w-3 h-3" /> Sample #{s.id.substring(0, 5).toUpperCase()}
            </button>
          ))}
        </div>

        {/* Chat Timeline */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeThreadMessages.length === 0 ? (
            <div className="text-center py-20 text-stone-400 text-xs">
              No conversations in this thread. Send a message below to start chatting.
            </div>
          ) : (
            activeThreadMessages.map(m => {
              const isReseller = m.sender_role === 'reseller'
              const isSystem = m.sender_role === 'system'
              const isNote = m.internal_notes !== null

              if (isSystem) {
                return (
                  <div key={m.id} className="flex justify-center my-2">
                    <span className="bg-stone-200/60 border border-stone-250 text-stone-600 text-[10px] font-semibold py-1 px-3 flex items-center gap-1">
                      <Info className="w-3 h-3 text-stone-500 shrink-0" /> {m.body}
                    </span>
                  </div>
                )
              }

              if (isNote) {
                return (
                  <div key={m.id} className="flex justify-center my-2.5 w-full">
                    <div className="bg-amber-50 border border-amber-250 text-amber-900 rounded-2xl p-3 max-w-[85%] text-xs shadow-sm leading-relaxed space-y-1.5">
                      <p className="font-bold flex items-center gap-1 text-[10px] text-amber-700 uppercase tracking-wider">
                        <Lock className="w-3 h-3 text-amber-600" /> Internal Staff Note (Hidden from Reseller)
                      </p>
                      <p className="font-semibold">{m.internal_notes}</p>
                      <p className="text-[8px] text-amber-500 text-right mt-1 font-semibold">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={m.id}
                  className={`flex ${isReseller ? 'justify-start' : 'justify-end'}`}
                >
                  <div className="max-w-[75%]">
                    <p className={`text-[9px] font-bold text-stone-400 mb-0.5 ${isReseller ? 'text-left' : 'text-right'}`}>
                      {isReseller ? selectedReseller?.store_name : 'You (Admin)'}
                    </p>
                    <div
                      className={`p-3 rounded-2xl text-xs border leading-relaxed shadow-sm ${
                        isReseller
                          ? 'bg-white border-stone-200 text-stone-850 rounded-tl-none'
                          : 'bg-stone-800 border-transparent text-white rounded-tr-none'
                      }`}
                    >
                      <p className="whitespace-pre-line font-medium">{m.body}</p>

                      {m.file_url && (
                        <div className="mt-2 rounded-lg overflow-hidden border bg-stone-50 max-w-sm">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={m.file_url} alt="Uploaded Proof" className="max-h-48 w-auto object-contain mx-auto" />
                          <a
                            href={m.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block bg-stone-100 text-[9px] text-stone-600 text-center py-1 font-bold hover:bg-stone-200"
                          >
                            Open attachment link
                          </a>
                        </div>
                      )}

                      <p className={`text-[8px] font-semibold mt-1 text-right ${
                        isReseller ? 'text-stone-400' : 'text-stone-300'
                      }`}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input box */}
        <div className="p-4 border-t border-stone-200 bg-white shrink-0">
          <form onSubmit={handleSendMessage} className="space-y-3">
            {screenshotUrl && (
              <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-stone-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={screenshotUrl} alt="upload preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setScreenshotUrl('')}
                  className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-3">
              <label className="p-2.5 border border-stone-200 rounded-xl hover:bg-stone-50 cursor-pointer transition-colors text-stone-500 shrink-0">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => handleFileUpload(e.target.files)}
                  disabled={uploading}
                />
                <Image className="w-4 h-4" />
              </label>

              <input
                type="text"
                placeholder={isInternalNote ? 'Post a note hidden from reseller...' : 'Type response message...'}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                disabled={sending || uploading}
                className={`flex-1 border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 bg-white font-semibold text-stone-850 ${
                  isInternalNote ? 'border-amber-300 focus:border-amber-500 bg-amber-50/10' : 'border-stone-200 focus:border-amber-605'
                }`}
              />

              <button
                type="submit"
                disabled={sending || uploading || (!inputText.trim() && !screenshotUrl)}
                className="bg-amber-600 hover:bg-amber-700 text-white p-2.5 rounded-xl shadow-sm transition-all disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-stone-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isInternalNote}
                  onChange={e => setIsInternalNote(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                />
                <span className="font-bold flex items-center gap-0.5 text-[10px] text-stone-605 uppercase tracking-wider">
                  <Lock className="w-3 h-3 text-amber-650" /> Internal Staff Note
                </span>
              </label>
            </div>
          </form>
        </div>
      </div>

      {/* 3. Right Pane: Context Panels */}
      <div className="w-72 shrink-0 bg-white overflow-y-auto p-4 space-y-6">
        {activeType === 'general' && selectedReseller && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider border-b pb-1.5">
              Boutique Summary
            </h4>
            <div className="space-y-3 text-xs">
              <div>
                <p className="text-[10px] text-stone-400 uppercase font-semibold">Store Code</p>
                <p className="font-bold text-stone-850 mt-0.5">{selectedReseller.reseller_code}</p>
              </div>
              <div>
                <p className="text-[10px] text-stone-400 uppercase font-semibold">Owner Contact</p>
                <p className="font-bold text-stone-850 mt-0.5">{selectedReseller.phone}</p>
              </div>
              <div className="border-t pt-2.5">
                <p className="text-[10px] text-stone-400 uppercase font-semibold">Owed Balance</p>
                <p className="text-lg font-black text-red-650 mt-0.5">
                  ₹{(Number(selectedReseller.outstanding_balance_paise || 0) / 100).toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-stone-400 uppercase font-semibold">Credit Limit</p>
                <p className="font-bold text-stone-850 mt-0.5">
                  ₹{(Number(selectedReseller.credit_limit_paise || 0) / 100).toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-stone-400 uppercase font-semibold">Lifetime Sales</p>
                <p className="font-bold text-stone-850 mt-0.5">
                  ₹{(Number(selectedReseller.lifetime_sales_paise || 0) / 100).toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeType === 'order' && activeOrder && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider border-b pb-1.5">
              Order Context
            </h4>
            <div className="space-y-3 text-xs">
              <div>
                <p className="text-[10px] text-stone-400 uppercase font-semibold">Order Number</p>
                <p className="font-mono font-black text-stone-900 mt-0.5">{activeOrder.order_number}</p>
              </div>
              <div>
                <p className="text-[10px] text-stone-400 uppercase font-semibold">Status</p>
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-stone-100 border text-stone-700 mt-1">
                  {activeOrder.status}
                </span>
              </div>
              <div>
                <p className="text-[10px] text-stone-400 uppercase font-semibold">Ordered Product</p>
                <p className="font-bold text-stone-850 mt-0.5">
                  {activeOrder.products?.code} · {activeOrder.products?.name}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-stone-400 uppercase font-semibold">Floor cost (B2B)</p>
                <p className="font-black text-stone-850 mt-0.5">
                  ₹{(activeOrder.reseller_cost_paise / 100).toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-stone-400 uppercase font-semibold">Selling Price</p>
                <p className="font-bold text-green-650 mt-0.5">
                  ₹{(activeOrder.customer_selling_price_paise / 100).toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-stone-400 uppercase font-semibold">Recipient Details</p>
                <p className="font-semibold text-stone-800 mt-1 leading-relaxed">
                  {activeOrder.shipping_name} <br />
                  {activeOrder.shipping_phone} <br />
                  {activeOrder.shipping_address}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeType === 'sample' && activeSample && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider border-b pb-1.5">
              Sample Context
            </h4>
            <div className="space-y-3 text-xs">
              <div>
                <p className="text-[10px] text-stone-400 uppercase font-semibold">Sample Type</p>
                <p className="font-bold text-stone-850 mt-0.5 capitalize">{activeSample.sample_type}</p>
              </div>
              <div>
                <p className="text-[10px] text-stone-400 uppercase font-semibold">Status</p>
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-stone-100 border text-stone-700 mt-1">
                  {activeSample.status}
                </span>
              </div>
              <div>
                <p className="text-[10px] text-stone-400 uppercase font-semibold">Product SKU</p>
                <p className="font-bold text-stone-850 mt-0.5">
                  {activeSample.products?.code} · {activeSample.products?.name}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-stone-400 uppercase font-semibold">Sample Value</p>
                <p className="font-black text-stone-850 mt-0.5">
                  ₹{(activeSample.sample_value_paise / 100).toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-stone-400 uppercase font-semibold">Due Return Date</p>
                <p className="font-bold text-red-650 mt-0.5">
                  {new Date(activeSample.return_due_date).toLocaleDateString('en-IN')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
