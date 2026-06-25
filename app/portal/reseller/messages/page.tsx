'use client'

import { useEffect, useState, useRef } from 'react'
import {
  MessageSquare,
  Send,
  Image,
  Paperclip,
  X,
  ChevronRight,
  ArrowLeft,
  ShoppingBag,
  Info,
  Clock,
  Briefcase
} from 'lucide-react'
import { uploadToCloudinary } from '@/lib/cloudinaryUpload'

const QUICK_TEMPLATES = [
  'Need CAD update',
  'Expedite request',
  'Payment proof uploaded',
  'Address change request',
  'Sample box return inquiry'
]

type ThreadType = 'general' | 'order' | 'sample'

export default function ResellerMessagesPage() {
  const [messages, setMessages] = useState<any[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [orders, setOrders] = useState<any[]>([])
  const [samples, setSamples] = useState<any[]>([])
  
  // Active Thread
  const [activeType, setActiveType] = useState<ThreadType>('general')
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null)

  // Input states
  const [inputText, setInputText] = useState('')
  const [screenshotUrl, setScreenshotUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)

  // View state for mobile responsiveness (sidebar vs chat pane)
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list')

  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Load orders and samples for thread list
    fetch('/api/portal/reseller/orders')
      .then(r => r.json())
      .then(data => {
        if (!data.error) setOrders(data.orders || [])
      })
      .catch(() => {})

    fetch('/api/portal/reseller/samples')
      .then(r => r.json())
      .then(data => {
        if (!data.error) setSamples(data.samples || [])
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadMessages()
  }, [activeType, selectedOrderId, selectedSampleId])

  useEffect(() => {
    // Scroll to bottom on message load/update
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadMessages() {
    setLoadingMessages(true)
    try {
      let url = `/api/portal/reseller/messages?thread_type=${activeType}`
      if (activeType === 'order' && selectedOrderId) {
        url += `&linked_order_id=${selectedOrderId}`
      } else if (activeType === 'sample' && selectedSampleId) {
        url += `&linked_sample_id=${selectedSampleId}`
      }

      const res = await fetch(url)
      const data = await res.json()
      if (!data.error) {
        setMessages(data.messages || [])
      }
    } catch {}
    setLoadingMessages(false)
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

  async function handleSendMessage(e?: React.FormEvent, customBody?: string) {
    if (e) e.preventDefault()
    const textToSend = customBody || inputText
    if (!textToSend.trim() && !screenshotUrl) return

    setSending(true)
    try {
      const payload = {
        body: textToSend || 'Image Attachment',
        file_url: screenshotUrl || null,
        thread_type: activeType,
        linked_order_id: activeType === 'order' ? selectedOrderId : null,
        linked_sample_id: activeType === 'sample' ? selectedSampleId : null
      }

      const res = await fetch('/api/portal/reseller/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!data.error) {
        setMessages(prev => [...prev, data.message])
        setInputText('')
        setScreenshotUrl('')
      } else {
        alert(data.error)
      }
    } catch (err: any) {
      alert('Error sending message: ' + err.message)
    } finally {
      setSending(false)
    }
  }

  const selectedOrder = orders.find(o => o.id === selectedOrderId)
  const selectedSample = samples.find(s => s.id === selectedSampleId)

  return (
    <div className="flex h-[calc(100vh-64px)] max-w-6xl mx-auto border-x border-stone-200 bg-stone-50">
      {/* 1. Left Sidebar: Channels & Threads list */}
      <div
        className={`w-full md:w-80 shrink-0 border-r border-stone-200 bg-white flex flex-col ${
          mobileView === 'chat' ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="p-4 border-b border-stone-100 shrink-0 bg-stone-50/50">
          <h1 className="text-base font-bold text-stone-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-amber-600" /> Unified Chat Support
          </h1>
          <p className="text-[10px] text-stone-400 mt-0.5 leading-none">Direct helpline link with Shewah Admin desk</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* General Thread Option */}
          <div>
            <p className="text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 px-2">Helpline Support</p>
            <button
              onClick={() => {
                setActiveType('general')
                setSelectedOrderId(null)
                setSelectedSampleId(null)
                setMobileView('chat')
              }}
              className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between group ${
                activeType === 'general'
                  ? 'bg-amber-50/80 border-amber-500 text-stone-950 font-bold'
                  : 'bg-white border-stone-200 hover:border-amber-600 text-stone-600'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  activeType === 'general' ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-500'
                }`}>
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">General Assistance</p>
                  <p className="text-[10px] text-stone-450 truncate">Ask query, check updates</p>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-stone-300 group-hover:text-amber-600 transition-colors" />
            </button>
          </div>

          {/* Orders list */}
          <div>
            <p className="text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 px-2">Order Specific Chats</p>
            {orders.length === 0 ? (
              <p className="text-[10px] text-stone-400 px-2">No active orders yet.</p>
            ) : (
              <div className="space-y-1.5">
                {orders.map(o => {
                  const isActive = activeType === 'order' && selectedOrderId === o.id
                  return (
                    <button
                      key={o.id}
                      onClick={() => {
                        setActiveType('order')
                        setSelectedOrderId(o.id)
                        setSelectedSampleId(null)
                        setMobileView('chat')
                      }}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between group ${
                        isActive
                          ? 'bg-amber-50/80 border-amber-500 text-stone-950 font-bold'
                          : 'bg-white border-stone-200 hover:border-amber-600 text-stone-600'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isActive ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-500'
                        }`}>
                          <ShoppingBag className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-black font-mono truncate">{o.order_number}</p>
                          <p className="text-[9px] text-stone-450 truncate">{o.products?.name}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-stone-300 group-hover:text-amber-600 transition-colors" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Samples list */}
          <div>
            <p className="text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 px-2">Sample Box Chats</p>
            {samples.length === 0 ? (
              <p className="text-[10px] text-stone-400 px-2">No active sample boxes.</p>
            ) : (
              <div className="space-y-1.5">
                {samples.map(s => {
                  const isActive = activeType === 'sample' && selectedSampleId === s.id
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setActiveType('sample')
                        setSelectedSampleId(s.id)
                        setSelectedOrderId(null)
                        setMobileView('chat')
                      }}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between group ${
                        isActive
                          ? 'bg-amber-50/80 border-amber-500 text-stone-950 font-bold'
                          : 'bg-white border-stone-200 hover:border-amber-600 text-stone-600'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isActive ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-500'
                        }`}>
                          <Briefcase className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold truncate">Sample Box #{s.id.substring(0, 8).toUpperCase()}</p>
                          <p className="text-[9px] text-stone-450 truncate">Status: {s.status}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-stone-300 group-hover:text-amber-600 transition-colors" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Right Pane: Chat History & Input */}
      <div
        className={`flex-1 flex flex-col bg-stone-50 ${
          mobileView === 'list' ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Chat Pane Header */}
        <div className="p-3.5 border-b border-stone-200 bg-white flex items-center gap-3 shrink-0">
          <button
            onClick={() => setMobileView('list')}
            className="md:hidden p-1.5 border border-stone-200 rounded-lg text-stone-550"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="min-w-0">
            {activeType === 'general' && (
              <>
                <h3 className="text-sm font-bold text-stone-900">General Helpline Chat</h3>
                <p className="text-[10px] text-stone-450 leading-none">Chat with Shewah B2B manufacturing support</p>
              </>
            )}
            {activeType === 'order' && selectedOrderId && (
              <>
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-amber-600" />
                  Order: <span className="font-mono">{selectedOrder?.order_number || 'Loading...'}</span>
                </h3>
                <p className="text-[10px] text-stone-450 leading-none truncate">
                  Item: {selectedOrder?.products?.code} · {selectedOrder?.products?.name}
                </p>
              </>
            )}
            {activeType === 'sample' && selectedSampleId && (
              <>
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-amber-600" />
                  Sample Box
                </h3>
                <p className="text-[10px] text-stone-450 leading-none">
                  Box ID: #{selectedSampleId.toUpperCase()} (Status: {selectedSample?.status || '...'})
                </p>
              </>
            )}
          </div>
        </div>

        {/* Chat History Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {loadingMessages ? (
            <div className="text-center text-xs text-stone-400 py-10">Loading conversation history...</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 px-6">
              <MessageSquare className="w-8 h-8 text-stone-300 mx-auto mb-2" />
              <p className="text-xs text-stone-500 font-semibold">No messages in this thread yet</p>
              <p className="text-[10px] text-stone-400 mt-0.5">Type your query or choose a quick helper text below to begin.</p>
            </div>
          ) : (
            messages.map((m) => {
              const isAdmin = m.sender_role === 'admin'
              const isSystem = m.sender_role === 'system'

              if (isSystem) {
                return (
                  <div key={m.id} className="flex justify-center my-2">
                    <span className="bg-stone-200/60 border border-stone-250 text-stone-600 text-[10px] font-semibold py-1 px-3 rounded-full flex items-center gap-1">
                      <Info className="w-3 h-3 text-stone-500 shrink-0" /> {m.body}
                    </span>
                  </div>
                )
              }

              return (
                <div
                  key={m.id}
                  className={`flex ${isAdmin ? 'justify-start' : 'justify-end'}`}
                >
                  <div className="max-w-[85%] sm:max-w-[70%]">
                    {/* Role header */}
                    <p className={`text-[9px] font-bold text-stone-400 mb-0.5 ${isAdmin ? 'text-left' : 'text-right'}`}>
                      {isAdmin ? 'Shewah Admin' : 'You'}
                    </p>

                    <div
                      className={`p-3 rounded-2xl text-xs border leading-relaxed shadow-sm ${
                        isAdmin
                          ? 'bg-white border-stone-200 text-stone-850 rounded-tl-none'
                          : 'bg-[#1E3A5F] border-transparent text-white rounded-tr-none'
                      }`}
                    >
                      <p className="whitespace-pre-line font-medium">{m.body}</p>

                      {m.file_url && (
                        <div className="mt-2.5 rounded-xl overflow-hidden border border-stone-100 bg-stone-50">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={m.file_url}
                            alt="Attachment"
                            className="max-h-48 w-auto object-contain mx-auto"
                          />
                          <a
                            href={m.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block bg-stone-100 hover:bg-stone-200 text-[9px] font-bold py-1.5 text-center text-stone-700 transition-colors"
                          >
                            Open Original image
                          </a>
                        </div>
                      )}

                      <p className={`text-[8px] font-semibold mt-1 text-right ${
                        isAdmin ? 'text-stone-400' : 'text-stone-300'
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

        {/* Quick helper templates */}
        {messages.length === 0 && !loadingMessages && (
          <div className="p-3 border-t border-stone-200 bg-white flex flex-wrap gap-1.5 shrink-0">
            {QUICK_TEMPLATES.map(tmpl => (
              <button
                key={tmpl}
                onClick={() => handleSendMessage(undefined, tmpl)}
                className="bg-stone-100 hover:bg-stone-200 text-[10px] text-stone-700 font-bold py-1.5 px-3 rounded-full border border-stone-150 transition-colors shrink-0"
              >
                {tmpl}
              </button>
            ))}
          </div>
        )}

        {/* Input box form */}
        <div className="p-3.5 border-t border-stone-200 bg-white shrink-0">
          <form onSubmit={e => handleSendMessage(e)} className="space-y-3">
            {/* Attachment preview */}
            {screenshotUrl && (
              <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-stone-200">
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

            <div className="flex items-center gap-2">
              {/* Photo/attachment button */}
              <label className="p-2.5 border border-stone-200 rounded-xl hover:bg-stone-50 cursor-pointer transition-colors text-stone-550 shrink-0 bg-white">
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
                placeholder={uploading ? 'Uploading image...' : 'Type message here...'}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                disabled={uploading || sending}
                className="flex-1 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 bg-white font-semibold text-stone-850"
              />

              <button
                type="submit"
                disabled={sending || uploading || (!inputText.trim() && !screenshotUrl)}
                className="bg-amber-600 hover:bg-amber-700 text-white p-2.5 rounded-xl shadow-sm transition-colors shrink-0 disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
