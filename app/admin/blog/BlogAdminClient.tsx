'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  BookOpen,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  History,
  Shield,
  Key,
  PauseCircle,
  PlayCircle,
  ArrowLeft,
  ExternalLink,
  RotateCcw,
  Eye,
  Trash2,
  Copy,
  Check,
  FileText,
  Save,
  Send,
} from 'lucide-react'

interface CurrentUser {
  id?: string
  name?: string | null
  isMaster: boolean
}

export default function BlogAdminClient({ currentUser }: { currentUser: CurrentUser }) {
  const [activeTab, setActiveTab] = useState<'articles' | 'editor' | 'settings' | 'tokens' | 'audit' | 'guide'>('articles')
  const [articles, setArticles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null)

  // Editor form state
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    excerpt: '',
    bodyMarkdown: '',
    category: 'education',
    authorDisplayName: 'SHEWAH Editorial Atelier',
    heroImageUrl: '',
    heroImageAlt: '',
    heroImageCaption: '',
    heroImageRights: '',
    seoTitle: '',
    metaDescription: '',
    sourceReferences: [] as any[],
    externalContentId: '',
    lockVersion: 1,
  })

  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit')
  const [validationResult, setValidationResult] = useState<any>(null)
  const [revisions, setRevisions] = useState<any[]>([])
  const [revisionsDrawerOpen, setRevisionsDrawerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Settings state
  const [settings, setSettings] = useState<any>({
    publication_mode: 'draft_only',
    is_automation_paused: false,
    max_daily_new_posts: 1,
    allowed_categories: ['education', 'craftsmanship', 'style-guides', 'materials', 'diamonds'],
    publish_window_start_time: '09:00',
    publish_window_end_time: '20:00',
    timezone: 'Asia/Kolkata',
  })

  // Tokens state
  const [tokens, setTokens] = useState<any[]>([])
  const [newTokenName, setNewTokenName] = useState('')
  const [newTokenScopes, setNewTokenScopes] = useState<string[]>(['blog:read', 'blog:draft:write'])
  const [newTokenExpiresDays, setNewTokenExpiresDays] = useState<number>(30)
  const [createdTokenModal, setCreatedTokenModal] = useState<any>(null)
  const [copiedToken, setCopiedToken] = useState(false)

  // Audit state
  const [auditLogs, setAuditLogs] = useState<any[]>([])

  // Load articles
  async function loadArticles() {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      if (statusFilter !== 'all') q.set('status', statusFilter)
      if (search.trim()) q.set('search', search.trim())
      const res = await fetch(`/api/blog/v1/articles?${q.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setArticles(data.articles || [])
      }
    } catch {}
    setLoading(false)
  }

  // Load settings
  async function loadSettings() {
    try {
      const res = await fetch('/api/blog/v1/settings')
      if (res.ok) {
        const data = await res.json()
        setSettings(data)
      }
    } catch {}
  }

  // Load tokens
  async function loadTokens() {
    if (!currentUser.isMaster) return
    try {
      const res = await fetch('/api/blog/v1/tokens')
      if (res.ok) {
        const data = await res.json()
        setTokens(data.tokens || [])
      }
    } catch {}
  }

  // Load audit logs
  async function loadAuditLogs() {
    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'blog_audit_logs',
          op: 'select',
          order: [{ col: 'created_at', ascending: false }],
          limit: 30,
        }),
      })
      if (res.ok) {
        const d = await res.json()
        setAuditLogs(d.data || [])
      }
    } catch {}
  }

  useEffect(() => {
    loadArticles()
    loadSettings()
    loadTokens()
    loadAuditLogs()
  }, [statusFilter])

  // Open article in editor
  async function handleOpenArticle(id: string) {
    setSelectedArticleId(id)
    setActionMessage(null)
    try {
      const res = await fetch(`/api/blog/v1/articles/${id}`)
      if (res.ok) {
        const data = await res.json()
        const art = data.article
        const rev = data.currentRevision || {}
        setFormData({
          title: art.title || '',
          slug: art.slug || '',
          excerpt: art.excerpt || '',
          bodyMarkdown: rev.body_markdown || '',
          category: art.category || 'education',
          authorDisplayName: art.author_display_name || 'SHEWAH Editorial Atelier',
          heroImageUrl: art.hero_image_url || '',
          heroImageAlt: art.hero_image_alt || '',
          heroImageCaption: art.hero_image_caption || '',
          heroImageRights: art.hero_image_rights || '',
          seoTitle: art.seo_title || '',
          metaDescription: art.meta_description || '',
          sourceReferences: Array.isArray(art.source_references) ? art.source_references : [],
          externalContentId: art.external_content_id || '',
          lockVersion: art.lock_version || 1,
        })
        setRevisions(data.revisionsHistory || [])
        setActiveTab('editor')

        // Validate
        void runValidation(id)
      }
    } catch {}
  }

  function handleNewArticle() {
    setSelectedArticleId(null)
    setFormData({
      title: '',
      slug: '',
      excerpt: '',
      bodyMarkdown: '',
      category: 'education',
      authorDisplayName: '',
      heroImageUrl: '',
      heroImageAlt: '',
      heroImageCaption: '',
      heroImageRights: '',
      seoTitle: '',
      metaDescription: '',
      sourceReferences: [],
      externalContentId: '',
      lockVersion: 1,
    })
    setRevisions([])
    setValidationResult(null)
    setActionMessage(null)
    setActiveTab('editor')
  }

  async function runValidation(id: string) {
    try {
      const res = await fetch(`/api/blog/v1/articles/${id}/validate`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setValidationResult(data.validation)
      }
    } catch {}
  }

  // Save draft
  async function handleSaveDraft() {
    setSaving(true)
    setActionMessage(null)
    try {
      if (selectedArticleId) {
        // Update existing draft
        const res = await fetch(`/api/blog/v1/articles/${selectedArticleId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectedLockVersion: formData.lockVersion,
            title: formData.title,
            slug: formData.slug,
            excerpt: formData.excerpt,
            bodyMarkdown: formData.bodyMarkdown,
            category: formData.category,
            authorDisplayName: formData.authorDisplayName,
            heroImageUrl: formData.heroImageUrl,
            heroImageAlt: formData.heroImageAlt,
            heroImageCaption: formData.heroImageCaption,
            heroImageRights: formData.heroImageRights,
            seoTitle: formData.seoTitle,
            metaDescription: formData.metaDescription,
            sourceReferences: formData.sourceReferences,
          }),
        })
        const data = await res.json()
        if (res.ok) {
          setActionMessage({ type: 'success', text: `Draft saved successfully (Revision #${data.revisionNumber}).` })
          setFormData((prev) => ({ ...prev, lockVersion: data.lockVersion }))
          await runValidation(selectedArticleId)
          await loadArticles()
        } else {
          setActionMessage({ type: 'error', text: data.error || 'Failed to save draft.' })
        }
      } else {
        // Create new draft
        const res = await fetch('/api/blog/v1/articles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': crypto.randomUUID(),
          },
          body: JSON.stringify({
            title: formData.title,
            slug: formData.slug || undefined,
            excerpt: formData.excerpt,
            bodyMarkdown: formData.bodyMarkdown,
            category: formData.category,
            authorDisplayName: formData.authorDisplayName,
            heroImageUrl: formData.heroImageUrl,
            heroImageAlt: formData.heroImageAlt,
            heroImageCaption: formData.heroImageCaption,
            heroImageRights: formData.heroImageRights,
            seoTitle: formData.seoTitle,
            metaDescription: formData.metaDescription,
            sourceReferences: formData.sourceReferences,
          }),
        })
        const data = await res.json()
        if (res.ok) {
          setSelectedArticleId(data.articleId)
          setFormData((prev) => ({ ...prev, lockVersion: data.lockVersion, slug: data.slug }))
          setActionMessage({ type: 'success', text: 'New draft created successfully.' })
          await runValidation(data.articleId)
          await loadArticles()
        } else {
          setActionMessage({ type: 'error', text: data.error || 'Failed to create draft.' })
        }
      }
    } catch (e: any) {
      setActionMessage({ type: 'error', text: e?.message || 'Network error.' })
    }
    setSaving(false)
  }

  // Publish article
  async function handlePublish() {
    if (!selectedArticleId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/blog/v1/articles/${selectedArticleId}/publish`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setActionMessage({ type: 'success', text: `Article published live to ${data.canonicalUrl}!` })
        await handleOpenArticle(selectedArticleId)
        await loadArticles()
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to publish article.' })
      }
    } catch (e: any) {
      setActionMessage({ type: 'error', text: e?.message || 'Publishing error.' })
    }
    setSaving(false)
  }

  // Unpublish article
  async function handleUnpublish() {
    if (!selectedArticleId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/blog/v1/articles/${selectedArticleId}/unpublish`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setActionMessage({ type: 'success', text: 'Article unpublished and returned to review state.' })
        await handleOpenArticle(selectedArticleId)
        await loadArticles()
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to unpublish.' })
      }
    } catch (e: any) {
      setActionMessage({ type: 'error', text: e?.message || 'Error.' })
    }
    setSaving(false)
  }

  // Rollback to specific revision
  async function handleRollback(revNumber: number) {
    if (!selectedArticleId) return
    if (!confirm(`Restore article content to revision #${revNumber}?`)) return
    setSaving(true)
    try {
      const res = await fetch(`/api/blog/v1/articles/${selectedArticleId}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetRevisionNumber: revNumber }),
      })
      const data = await res.json()
      if (res.ok) {
        setActionMessage({ type: 'success', text: `Restored to revision #${revNumber} as new revision #${data.newRevisionNumber}.` })
        setRevisionsDrawerOpen(false)
        await handleOpenArticle(selectedArticleId)
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to rollback.' })
      }
    } catch {}
    setSaving(false)
  }

  // Toggle emergency pause
  async function handleTogglePause() {
    try {
      const newPaused = !settings.is_automation_paused
      const res = await fetch('/api/blog/v1/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAutomationPaused: newPaused }),
      })
      if (res.ok) {
        const d = await res.json()
        setSettings(d)
        await loadAuditLogs()
      }
    } catch {}
  }

  // Update publication mode
  async function handleUpdateMode(mode: string) {
    try {
      const res = await fetch('/api/blog/v1/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicationMode: mode }),
      })
      if (res.ok) {
        const d = await res.json()
        setSettings(d)
        await loadAuditLogs()
      }
    } catch {}
  }

  // Generate token
  async function handleCreateToken(e: React.FormEvent) {
    e.preventDefault()
    if (!newTokenName.trim()) return
    try {
      const res = await fetch('/api/blog/v1/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTokenName.trim(),
          scopes: newTokenScopes,
          expiresDays: Number(newTokenExpiresDays),
        }),
      })
      if (res.ok) {
        const d = await res.json()
        setCreatedTokenModal(d.token)
        setNewTokenName('')
        await loadTokens()
      }
    } catch {}
  }

  // Revoke token
  async function handleRevokeToken(id: string) {
    if (!confirm('Are you sure you want to revoke this credential? All automated requests using it will fail immediately.')) return
    try {
      const res = await fetch(`/api/blog/v1/tokens/${id}`, { method: 'DELETE' })
      if (res.ok) {
        await loadTokens()
      }
    } catch {}
  }

  return (
    <div className="min-h-screen bg-[#F6F4F2] text-[#051F34] font-sans flex flex-col">
      {/* Top Header */}
      <header className="bg-[#051F34] text-white border-b border-stone-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2 text-stone-400 hover:text-white transition-colors" title="Back to Main Dashboard">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-serif text-lg tracking-wide text-white font-normal flex items-center gap-2">
              <span>SHEWAH Atelier Journal</span>
              <span className="text-[10px] font-sans uppercase tracking-[0.2em] bg-[#CB9274] text-white px-2 py-0.5 font-medium">
                Editorial Admin
              </span>
            </h1>
            <p className="text-[11px] text-stone-400 font-light">
              Logged in as {currentUser.name || 'Owner'} {currentUser.isMaster ? '(Master Authority)' : ''}
            </p>
          </div>
        </div>

        {/* Emergency Pause Indicator */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleTogglePause}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] transition-colors ${
              settings.is_automation_paused
                ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse'
                : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
            }`}
          >
            {settings.is_automation_paused ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
            <span>{settings.is_automation_paused ? 'Automation Paused' : 'Automation Active'}</span>
          </button>

          <Link
            href="/blog"
            target="_blank"
            className="flex items-center gap-1.5 text-xs text-[#CB9274] hover:text-white transition-colors uppercase tracking-[0.14em]"
          >
            <span>Live Storefront</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-[#E3DBD4] px-6 flex items-center gap-8 text-xs uppercase tracking-[0.18em] font-medium">
        <button
          onClick={() => setActiveTab('articles')}
          className={`py-3.5 border-b-2 transition-colors ${activeTab === 'articles' ? 'border-[#051F34] text-[#051F34]' : 'border-transparent text-[#69727D] hover:text-[#051F34]'}`}
        >
          Articles Archive
        </button>
        <button
          onClick={() => setActiveTab('editor')}
          className={`py-3.5 border-b-2 transition-colors ${activeTab === 'editor' ? 'border-[#051F34] text-[#051F34]' : 'border-transparent text-[#69727D] hover:text-[#051F34]'}`}
        >
          {selectedArticleId ? 'Edit Article' : 'Draft Editor'}
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`py-3.5 border-b-2 transition-colors ${activeTab === 'settings' ? 'border-[#051F34] text-[#051F34]' : 'border-transparent text-[#69727D] hover:text-[#051F34]'}`}
        >
          Policies & Controls
        </button>
        {currentUser.isMaster && (
          <button
            onClick={() => setActiveTab('tokens')}
            className={`py-3.5 border-b-2 transition-colors ${activeTab === 'tokens' ? 'border-[#051F34] text-[#051F34]' : 'border-transparent text-[#69727D] hover:text-[#051F34]'}`}
          >
            Assistant Credentials
          </button>
        )}
        <button
          onClick={() => setActiveTab('audit')}
          className={`py-3.5 border-b-2 transition-colors ${activeTab === 'audit' ? 'border-[#051F34] text-[#051F34]' : 'border-transparent text-[#69727D] hover:text-[#051F34]'}`}
        >
          Audit History
        </button>
        <button
          onClick={() => setActiveTab('guide')}
          className={`py-3.5 border-b-2 transition-colors ${activeTab === 'guide' ? 'border-[#051F34] text-[#051F34]' : 'border-transparent text-[#69727D] hover:text-[#051F34]'}`}
        >
          Assistant Guide
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full">
        {/* 1. ARTICLES LIST TAB */}
        {activeTab === 'articles' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#69727D] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadArticles()}
                    placeholder="Search articles by title..."
                    className="pl-9 pr-4 py-2 border border-[#E3DBD4] text-xs bg-white focus:outline-none focus:border-[#051F34] w-64"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border border-[#E3DBD4] px-3 py-2 text-xs bg-white text-[#051F34] focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="draft">Drafts</option>
                  <option value="in_review">In Review</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <button
                onClick={handleNewArticle}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#051F34] text-white text-xs uppercase tracking-[0.16em] font-medium hover:bg-[#CB9274] transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>New Article</span>
              </button>
            </div>

            {loading ? (
              <div className="py-20 text-center text-xs text-[#69727D] font-mono">Loading articles...</div>
            ) : articles.length === 0 ? (
              <div className="py-20 text-center bg-white border border-[#E3DBD4] space-y-3">
                <BookOpen className="w-8 h-8 text-[#CB9274] mx-auto stroke-[1.5]" />
                <h3 className="font-serif text-lg text-[#051F34]">No Articles Found</h3>
                <p className="text-xs text-[#69727D] max-w-sm mx-auto">
                  No articles match the current filter. Create a draft or adjust search filters.
                </p>
                <button
                  onClick={handleNewArticle}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-[#051F34] text-white text-xs uppercase tracking-wider"
                >
                  <span>Create First Article</span>
                </button>
              </div>
            ) : (
              <div className="bg-white border border-[#E3DBD4] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F6F4F2] border-b border-[#E3DBD4] text-[10px] uppercase tracking-[0.18em] text-[#69727D]">
                    <tr>
                      <th className="py-3.5 px-4 font-semibold">Title & Slug</th>
                      <th className="py-3.5 px-4 font-semibold">Category</th>
                      <th className="py-3.5 px-4 font-semibold">Status</th>
                      <th className="py-3.5 px-4 font-semibold">Source</th>
                      <th className="py-3.5 px-4 font-semibold">Updated</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3DBD4]">
                    {articles.map((item) => (
                      <tr key={item.id} className="hover:bg-[#F6F4F2]/50 transition-colors">
                        <td className="py-4 px-4">
                          <button
                            onClick={() => handleOpenArticle(item.id)}
                            className="font-serif text-sm text-[#051F34] hover:text-[#CB9274] font-medium text-left block"
                          >
                            {item.title}
                          </button>
                          <span className="text-[11px] text-[#69727D] font-mono">/blog/{item.slug}</span>
                        </td>
                        <td className="py-4 px-4 capitalize text-[#69727D]">
                          {item.category?.replace('-', ' ')}
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold ${
                              item.status === 'published'
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.status === 'scheduled'
                                ? 'bg-blue-100 text-blue-800'
                                : item.status === 'in_review'
                                ? 'bg-amber-100 text-amber-800'
                                : item.status === 'archived'
                                ? 'bg-stone-200 text-stone-700'
                                : 'bg-stone-100 text-stone-600'
                            }`}
                          >
                            {item.status?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-[#69727D] text-[11px]">
                          {item.editorial_source}
                        </td>
                        <td className="py-4 px-4 text-[#69727D] font-mono text-[11px]">
                          {item.updated_at ? new Date(item.updated_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => handleOpenArticle(item.id)}
                            className="text-[#051F34] hover:text-[#CB9274] font-medium uppercase tracking-wider text-[11px]"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 2. DRAFT & ARTICLE EDITOR TAB */}
        {activeTab === 'editor' && (
          <div className="space-y-6">
            {actionMessage && (
              <div
                className={`p-4 border text-xs flex items-center justify-between ${
                  actionMessage.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                <span>{actionMessage.text}</span>
                <button onClick={() => setActionMessage(null)} className="font-bold ml-4">
                  &times;
                </button>
              </div>
            )}

            {/* Action Bar */}
            <div className="bg-white border border-[#E3DBD4] p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveTab('articles')}
                  className="p-1.5 text-[#69727D] hover:text-[#051F34]"
                  title="Back to list"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="text-xs">
                  <span className="font-semibold text-[#051F34]">
                    {selectedArticleId ? `Editing: ${formData.title || 'Untitled'}` : 'Creating New Draft'}
                  </span>
                  <span className="text-stone-400 font-mono ml-2">(Lock v{formData.lockVersion})</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {selectedArticleId && (
                  <button
                    onClick={() => setRevisionsDrawerOpen((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#E3DBD4] text-xs uppercase tracking-wider hover:border-[#051F34]"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Revisions ({revisions.length})</span>
                  </button>
                )}

                <button
                  onClick={handleSaveDraft}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#051F34] text-white text-xs uppercase tracking-wider font-medium hover:bg-[#CB9274] transition-colors disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Save Draft'}</span>
                </button>

                {selectedArticleId && (
                  <>
                    <button
                      onClick={handlePublish}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-700 text-white text-xs uppercase tracking-wider font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Publish Live</span>
                    </button>
                    <button
                      onClick={handleUnpublish}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-700 text-xs uppercase tracking-wider hover:bg-red-50"
                    >
                      <span>Unpublish</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Validation Feedback Bar */}
            {validationResult && (
              <div className="bg-white border border-[#E3DBD4] p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  {validationResult.valid ? (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Ready for Publication
                    </span>
                  ) : (
                    <span className="text-amber-700 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> Publication Blockers ({validationResult.blockers?.length})
                    </span>
                  )}
                </div>
                {validationResult.blockers?.length > 0 && (
                  <ul className="text-xs text-red-600 list-disc pl-5 space-y-0.5">
                    {validationResult.blockers.map((b: string, i: number) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                )}
                {validationResult.warnings?.length > 0 && (
                  <ul className="text-xs text-amber-600 list-disc pl-5 space-y-0.5">
                    {validationResult.warnings.map((w: string, i: number) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Editor Workspace Form */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Main Body & Text */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white border border-[#E3DBD4] p-6 space-y-4">
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider font-medium text-[#69727D] mb-1">
                      Article Title *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g. The Architectural Solitaire: A Guide to Diamond Cuts"
                      className="w-full p-2.5 border border-[#E3DBD4] text-base font-serif focus:outline-none focus:border-[#051F34]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase tracking-wider font-medium text-[#69727D] mb-1">
                      URL Slug (Auto-generated if blank)
                    </label>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
                      placeholder="e.g. architectural-solitaire-guide"
                      className="w-full p-2 border border-[#E3DBD4] text-xs font-mono focus:outline-none focus:border-[#051F34]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase tracking-wider font-medium text-[#69727D] mb-1">
                      Excerpt / Editorial Subtitle
                    </label>
                    <textarea
                      rows={2}
                      value={formData.excerpt}
                      onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                      placeholder="Concise summary for archive listings and social cards..."
                      className="w-full p-2.5 border border-[#E3DBD4] text-xs focus:outline-none focus:border-[#051F34]"
                    />
                  </div>

                  {/* Body Markdown */}
                  <div>
                    <div className="flex items-center justify-between pb-1">
                      <label className="text-[11px] uppercase tracking-wider font-medium text-[#69727D]">
                        Body Content (Markdown) *
                      </label>
                      <div className="flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setEditorMode('edit')}
                          className={`px-2 py-0.5 ${editorMode === 'edit' ? 'bg-[#051F34] text-white font-medium' : 'text-[#69727D]'}`}
                        >
                          Write
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditorMode('preview')}
                          className={`px-2 py-0.5 ${editorMode === 'preview' ? 'bg-[#051F34] text-white font-medium' : 'text-[#69727D]'}`}
                        >
                          Preview
                        </button>
                      </div>
                    </div>

                    {editorMode === 'edit' ? (
                      <textarea
                        rows={16}
                        value={formData.bodyMarkdown}
                        onChange={(e) => setFormData({ ...formData, bodyMarkdown: e.target.value })}
                        placeholder="Write your article in markdown. Use ## for major headings, ### for subheadings, and > for quotes..."
                        className="w-full p-3 border border-[#E3DBD4] text-sm font-mono leading-relaxed focus:outline-none focus:border-[#051F34]"
                      />
                    ) : (
                      <div className="p-4 border border-[#E3DBD4] min-h-[380px] bg-[#F6F4F2] prose prose-stone max-w-none text-sm">
                        {formData.bodyMarkdown.split('\n\n').map((p, i) => (
                          <p key={i}>{p}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Research Sources Section */}
                <div className="bg-white border border-[#E3DBD4] p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif text-base text-[#051F34]">Primary Research Sources</h3>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          sourceReferences: [
                            ...formData.sourceReferences,
                            { title: '', sourceName: '', url: '', checkedAt: new Date().toISOString().split('T')[0] },
                          ],
                        })
                      }
                      className="text-xs text-[#CB9274] hover:underline uppercase tracking-wider font-semibold"
                    >
                      + Add Source
                    </button>
                  </div>

                  {formData.sourceReferences.map((src, idx) => (
                    <div key={idx} className="p-3 border border-[#E3DBD4] bg-[#F6F4F2] space-y-2 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={src.title}
                          onChange={(e) => {
                            const updated = [...formData.sourceReferences]
                            updated[idx].title = e.target.value
                            setFormData({ ...formData, sourceReferences: updated })
                          }}
                          placeholder="Source Document / Study Title"
                          className="p-1.5 border border-[#E3DBD4] bg-white"
                        />
                        <input
                          type="text"
                          value={src.sourceName}
                          onChange={(e) => {
                            const updated = [...formData.sourceReferences]
                            updated[idx].sourceName = e.target.value
                            setFormData({ ...formData, sourceReferences: updated })
                          }}
                          placeholder="Authority (e.g. GIA, IGI, BIS)"
                          className="p-1.5 border border-[#E3DBD4] bg-white"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="url"
                          value={src.url || ''}
                          onChange={(e) => {
                            const updated = [...formData.sourceReferences]
                            updated[idx].url = e.target.value
                            setFormData({ ...formData, sourceReferences: updated })
                          }}
                          placeholder="https://..."
                          className="flex-1 p-1.5 border border-[#E3DBD4] bg-white font-mono text-[11px]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = formData.sourceReferences.filter((_, i) => i !== idx)
                            setFormData({ ...formData, sourceReferences: updated })
                          }}
                          className="text-red-600 hover:text-red-800 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Col: Metadata, Hero Media, SEO */}
              <div className="space-y-6">
                <div className="bg-white border border-[#E3DBD4] p-6 space-y-4 text-xs">
                  <h3 className="font-serif text-base text-[#051F34]">Atelier Metadata</h3>

                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-[#69727D] mb-1">
                      Editorial Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full p-2 border border-[#E3DBD4] bg-white"
                    >
                      <option value="education">Gemology & Education</option>
                      <option value="craftsmanship">Atelier Craftsmanship</option>
                      <option value="style-guides">Style & Silhouettes</option>
                      <option value="materials">Gold & Metallurgy</option>
                      <option value="diamonds">Diamond Guides</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-[#69727D] mb-1">
                      Author Display Name
                    </label>
                    <input
                      type="text"
                      value={formData.authorDisplayName}
                      onChange={(e) => setFormData({ ...formData, authorDisplayName: e.target.value })}
                      className="w-full p-2 border border-[#E3DBD4]"
                    />
                  </div>
                </div>

                <div className="bg-white border border-[#E3DBD4] p-6 space-y-4 text-xs">
                  <h3 className="font-serif text-base text-[#051F34]">Hero Media</h3>

                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-[#69727D] mb-1">
                      Hero Image URL (HTTPS)
                    </label>
                    <input
                      type="url"
                      value={formData.heroImageUrl}
                      onChange={(e) => setFormData({ ...formData, heroImageUrl: e.target.value })}
                      placeholder="https://..."
                      className="w-full p-2 border border-[#E3DBD4] font-mono text-[11px]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-[#69727D] mb-1">
                      Image Alt Text *
                    </label>
                    <input
                      type="text"
                      value={formData.heroImageAlt}
                      onChange={(e) => setFormData({ ...formData, heroImageAlt: e.target.value })}
                      placeholder="Descriptive text for accessibility"
                      className="w-full p-2 border border-[#E3DBD4]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-[#69727D] mb-1">
                      Rights & Attribution Note
                    </label>
                    <input
                      type="text"
                      value={formData.heroImageRights}
                      onChange={(e) => setFormData({ ...formData, heroImageRights: e.target.value })}
                      placeholder="e.g. Licensed atelier photography"
                      className="w-full p-2 border border-[#E3DBD4]"
                    />
                  </div>
                </div>

                <div className="bg-white border border-[#E3DBD4] p-6 space-y-4 text-xs">
                  <h3 className="font-serif text-base text-[#051F34]">Search & SEO</h3>

                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-[#69727D] mb-1">
                      SEO Title
                    </label>
                    <input
                      type="text"
                      value={formData.seoTitle}
                      onChange={(e) => setFormData({ ...formData, seoTitle: e.target.value })}
                      placeholder="Title tag for Google search"
                      className="w-full p-2 border border-[#E3DBD4]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-[#69727D] mb-1">
                      Meta Description
                    </label>
                    <textarea
                      rows={3}
                      value={formData.metaDescription}
                      onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                      placeholder="150-160 character snippet for search results..."
                      className="w-full p-2 border border-[#E3DBD4]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Revisions Drawer */}
            {revisionsDrawerOpen && (
              <div className="bg-white border border-[#E3DBD4] p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#E3DBD4] pb-3">
                  <h3 className="font-serif text-base text-[#051F34]">Revision History Snapshot</h3>
                  <button onClick={() => setRevisionsDrawerOpen(false)} className="text-xs text-[#69727D]">
                    Close
                  </button>
                </div>

                <div className="divide-y divide-[#E3DBD4] max-h-72 overflow-y-auto">
                  {revisions.map((rev) => (
                    <div key={rev.id} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-[#051F34]">Revision #{rev.revision_number}</span>
                        <p className="text-[11px] text-[#69727D]">{rev.change_summary || 'Update'}</p>
                        <span className="text-[10px] text-stone-400 font-mono">
                          {new Date(rev.created_at).toLocaleString()} by {rev.created_by_actor_type}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRollback(rev.revision_number)}
                        className="px-3 py-1 border border-[#051F34] text-[#051F34] hover:bg-[#051F34] hover:text-white uppercase tracking-wider text-[10px]"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. POLICIES & EMERGENCY CONTROLS TAB */}
        {activeTab === 'settings' && (
          <div className="bg-white border border-[#E3DBD4] p-8 max-w-3xl mx-auto space-y-8 text-xs">
            <div>
              <h2 className="font-serif text-2xl text-[#051F34]">Owner Publication Policy</h2>
              <p className="text-xs text-[#69727D] mt-1 font-light">
                Configure whether external assistant articles remain in draft state or can publish automatically.
              </p>
            </div>

            <div className="space-y-4 border-t border-[#E3DBD4] pt-6">
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#051F34]">
                Publication Mode
              </label>
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 border border-[#E3DBD4] cursor-pointer hover:border-[#051F34]">
                  <input
                    type="radio"
                    name="mode"
                    value="draft_only"
                    checked={settings.publication_mode === 'draft_only'}
                    onChange={() => handleUpdateMode('draft_only')}
                    className="mt-1"
                  />
                  <div>
                    <span className="font-semibold text-[#051F34]">Draft Only Mode (Default & Recommended)</span>
                    <p className="text-[#69727D] text-[11px]">
                      The external assistant can create and refine drafts, but cannot publish or schedule. Owner must review and release each post manually.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 border border-[#E3DBD4] cursor-pointer hover:border-[#051F34]">
                  <input
                    type="radio"
                    name="mode"
                    value="review_first"
                    checked={settings.publication_mode === 'review_first'}
                    onChange={() => handleUpdateMode('review_first')}
                    className="mt-1"
                  />
                  <div>
                    <span className="font-semibold text-[#051F34]">Review First Mode</span>
                    <p className="text-[#69727D] text-[11px]">
                      Assistant marks completed articles as &quot;In Review&quot; and schedules candidate release slots pending owner approval.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 border border-[#E3DBD4] cursor-pointer hover:border-[#051F34]">
                  <input
                    type="radio"
                    name="mode"
                    value="auto_publish"
                    checked={settings.publication_mode === 'auto_publish'}
                    onChange={() => handleUpdateMode('auto_publish')}
                    className="mt-1"
                  />
                  <div>
                    <span className="font-semibold text-[#051F34]">Autonomous Auto-Publish Mode</span>
                    <p className="text-[#69727D] text-[11px]">
                      Validated articles meeting all editorial standards publish automatically without manual owner intervention (Max 1 post/day).
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="space-y-4 border-t border-[#E3DBD4] pt-6">
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#051F34]">
                Emergency Master Pause Switch
              </label>
              <div className="flex items-center justify-between p-4 bg-[#F6F4F2] border border-[#E3DBD4]">
                <div>
                  <span className="font-semibold text-[#051F34]">Pause All Automation Immediately</span>
                  <p className="text-[11px] text-[#69727D]">
                    Instantly rejects any incoming assistant API calls and suspends scheduled publication runs.
                  </p>
                </div>
                <button
                  onClick={handleTogglePause}
                  className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider ${
                    settings.is_automation_paused ? 'bg-amber-600 text-white' : 'bg-[#051F34] text-white'
                  }`}
                >
                  {settings.is_automation_paused ? 'Resume Automation' : 'Pause Now'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. API CREDENTIALS TAB (Master only) */}
        {activeTab === 'tokens' && currentUser.isMaster && (
          <div className="space-y-8 max-w-4xl mx-auto">
            {/* Modal for one-time token display */}
            {createdTokenModal && (
              <div className="p-6 bg-emerald-50 border-2 border-emerald-500 space-y-4 shadow-lg">
                <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Scoped Assistant Credential Generated</span>
                </div>
                <p className="text-xs text-emerald-900">
                  This bearer token will <strong>never be shown again</strong>. Copy it immediately and store it securely in a secret manager or vault.
                </p>
                <div className="flex items-center gap-2 p-2.5 bg-white border border-emerald-300 font-mono text-xs break-all">
                  <span className="flex-1">{createdTokenModal.rawToken}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(createdTokenModal.rawToken)
                      setCopiedToken(true)
                      setTimeout(() => setCopiedToken(false), 2000)
                    }}
                    className="p-1.5 text-emerald-700 hover:text-emerald-900"
                  >
                    {copiedToken ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="text-[11px] text-emerald-800 flex items-center gap-3">
                  <span className="font-semibold">Valid Until:</span>
                  <span>
                    {createdTokenModal.expiresAt
                      ? `${new Date(createdTokenModal.expiresAt).toLocaleDateString()} (${Math.max(1, Math.round((new Date(createdTokenModal.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days)`
                      : '30 days'}
                  </span>
                  <span className="text-emerald-600">|</span>
                  <span className="font-semibold">Scopes:</span>
                  <span>{createdTokenModal.scopes?.join(', ')}</span>
                </div>
                <button
                  onClick={() => setCreatedTokenModal(null)}
                  className="px-4 py-1.5 bg-emerald-700 text-white text-xs uppercase tracking-wider"
                >
                  I Have Copied This Token
                </button>
              </div>
            )}

            {/* Token Creation Box */}
            <div className="bg-white border border-[#E3DBD4] p-6 space-y-4">
              <h2 className="font-serif text-lg text-[#051F34]">Generate Scoped Editorial Token</h2>
              <p className="text-xs text-[#69727D]">
                Issue an expiring, high-entropy bearer token for the external assistant. By default, tokens are granted only read and draft-write scopes.
              </p>

              <form onSubmit={handleCreateToken} className="space-y-4 text-xs">
                <div>
                  <label htmlFor="newTokenNameInput" className="block text-[11px] uppercase tracking-wider text-[#69727D] mb-1">
                    Credential Name / Identity
                  </label>
                  <input
                    id="newTokenNameInput"
                    type="text"
                    value={newTokenName}
                    onChange={(e) => setNewTokenName(e.target.value)}
                    placeholder="e.g. External Editorial Assistant 1"
                    className="w-full p-2 border border-[#E3DBD4]"
                  />
                </div>

                <div>
                  <label htmlFor="tokenExpirySelect" className="block text-[11px] uppercase tracking-wider text-[#69727D] mb-1">
                    Token Expiry
                  </label>
                  <select
                    id="tokenExpirySelect"
                    value={newTokenExpiresDays}
                    onChange={(e) => setNewTokenExpiresDays(Number(e.target.value))}
                    className="w-full p-2 border border-[#E3DBD4] text-xs bg-white text-[#051F34] focus:outline-none focus:border-[#051F34]"
                  >
                    <option value={7}>7 Days (Short-term review)</option>
                    <option value={14}>14 Days (Two-week evaluation)</option>
                    <option value={30}>30 Days (Default / 1 Month)</option>
                    <option value={90}>90 Days (Quarterly maximum)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#69727D] mb-1">
                    Granted Scopes
                  </label>
                  <div className="flex flex-wrap gap-4 pt-1">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newTokenScopes.includes('blog:read')}
                        onChange={(e) => {
                          setNewTokenScopes(
                            e.target.checked
                              ? [...newTokenScopes, 'blog:read']
                              : newTokenScopes.filter((s) => s !== 'blog:read')
                          )
                        }}
                      />
                      <span>blog:read (Archive & duplicate checks)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newTokenScopes.includes('blog:draft:write')}
                        onChange={(e) => {
                          setNewTokenScopes(
                            e.target.checked
                              ? [...newTokenScopes, 'blog:draft:write']
                              : newTokenScopes.filter((s) => s !== 'blog:draft:write')
                          )
                        }}
                      />
                      <span>blog:draft:write (Submit & edit drafts)</span>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 bg-[#051F34] text-white text-xs uppercase tracking-wider font-medium hover:bg-[#CB9274]"
                >
                  Generate Token
                </button>
              </form>
            </div>

            {/* Active Tokens Table */}
            <div className="bg-white border border-[#E3DBD4] overflow-hidden">
              <div className="p-4 bg-[#F6F4F2] border-b border-[#E3DBD4] font-serif text-sm">
                Active & Historical Credentials ({tokens.length})
              </div>
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-[#69727D] border-b border-[#E3DBD4]">
                  <tr>
                    <th className="p-3">Name & Prefix</th>
                    <th className="p-3">Scopes</th>
                    <th className="p-3">Created</th>
                    <th className="p-3">Expires</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Revoke</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3DBD4]">
                  {tokens.map((t) => (
                    <tr key={t.id}>
                      <td className="p-3">
                        <span className="font-semibold text-[#051F34]">{t.name}</span>
                        <span className="block text-[10px] font-mono text-stone-400">{t.token_prefix}...</span>
                      </td>
                      <td className="p-3 text-[11px] font-mono">{t.scopes?.join(', ')}</td>
                      <td className="p-3 font-mono text-[11px] text-[#69727D]">
                        {new Date(t.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-[#69727D]">
                        {t.expires_at ? new Date(t.expires_at).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="p-3">
                        {t.is_revoked ? (
                          <span className="text-red-700 bg-red-100 px-2 py-0.5 text-[10px] uppercase font-semibold">
                            Revoked
                          </span>
                        ) : (
                          <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 text-[10px] uppercase font-semibold">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {!t.is_revoked && (
                          <button
                            onClick={() => handleRevokeToken(t.id)}
                            className="text-red-600 hover:text-red-800 uppercase tracking-wider text-[10px] font-semibold"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. AUDIT HISTORY TAB */}
        {activeTab === 'audit' && (
          <div className="bg-white border border-[#E3DBD4] overflow-hidden max-w-5xl mx-auto">
            <div className="p-4 bg-[#F6F4F2] border-b border-[#E3DBD4] flex items-center justify-between">
              <span className="font-serif text-sm text-[#051F34]">Durable Audit Trail</span>
              <button onClick={loadAuditLogs} className="text-xs text-[#CB9274] hover:underline uppercase tracking-wider">
                Refresh
              </button>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-[#69727D] border-b border-[#E3DBD4]">
                <tr>
                  <th className="p-3">Operation</th>
                  <th className="p-3">Actor</th>
                  <th className="p-3">Outcome</th>
                  <th className="p-3">Timestamp (UTC)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3DBD4] font-mono text-[11px]">
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="p-3 font-semibold text-[#051F34]">{log.operation}</td>
                    <td className="p-3 text-[#69727D]">
                      {log.actor_type}: {log.actor_id}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-1.5 py-0.5 text-[10px] uppercase ${
                          log.outcome === 'success' ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'
                        }`}
                      >
                        {log.outcome}
                      </span>
                    </td>
                    <td className="p-3 text-[#69727D]">{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 6. ASSISTANT INTEGRATION & BROWSER FALLBACK GUIDE TAB */}
        {activeTab === 'guide' && (
          <div className="bg-white border border-[#E3DBD4] p-8 max-w-4xl mx-auto space-y-6 text-xs text-[#051F34] leading-relaxed">
            <h2 className="font-serif text-2xl">External Editorial Assistant Integration Guide</h2>
            <p className="text-[#69727D]">
              This guide provides connection instructions for external research assistants submitting articles to Maison SHEWAH.
            </p>

            <div className="p-4 bg-[#F6F4F2] border border-[#E3DBD4] space-y-2">
              <h3 className="font-serif text-base font-semibold">1. Token-Authenticated Browser Submission Interface</h3>
              <p>
                The assistant can submit drafts directly through the dedicated browser submission gateway at <code className="bg-white px-1 py-0.5 border">https://shewah.co/editorial/submit</code>. This unlinked, noindex interface allows secure fill-only bearer token authentication, capabilities verification, draft JSON validation, and idempotent draft submission without requiring staff credentials or owner login.
              </p>
            </div>

            <div className="p-4 bg-[#F6F4F2] border border-[#E3DBD4] space-y-2">
              <h3 className="font-serif text-base font-semibold">2. Scoped REST API Contract</h3>
              <p>
                When using automated submission, the assistant authenticates via HTTP Bearer token:
              </p>
              <pre className="p-3 bg-[#051F34] text-stone-200 font-mono text-[11px] overflow-x-auto">
{`Authorization: Bearer shw_blog_<TOKEN>
Idempotency-Key: <UUID>`}
              </pre>

              <h4 className="font-medium pt-2">Check System Capabilities:</h4>
              <pre className="p-3 bg-[#051F34] text-stone-200 font-mono text-[11px] overflow-x-auto">
{`GET https://shewah.co/api/blog/v1/capabilities`}
              </pre>

              <h4 className="font-medium pt-2">Submit New Researched Draft:</h4>
              <pre className="p-3 bg-[#051F34] text-stone-200 font-mono text-[11px] overflow-x-auto">
{`POST https://shewah.co/api/blog/v1/articles
Content-Type: application/json
Idempotency-Key: 11111111-2222-3333-4444-555555555555

{
  "title": "The Geometry of the Emerald Cut: Step Faceting in Solid Gold",
  "category": "education",
  "authorDisplayName": "SHEWAH Master Lapidary",
  "heroImageUrl": "https://images.unsplash.com/photo-1605100804763-247f67b3557e",
  "heroImageAlt": "Macro photograph of step cut emerald diamond",
  "heroImageRights": "Licensed studio photography",
  "seoTitle": "Emerald Cut Diamonds: Clarity, Ratios, and Settings | SHEWAH",
  "metaDescription": "A gemological examination of step-cut emerald diamonds and optimal solid 18K gold bezel settings.",
  "bodyMarkdown": "Unlike brilliant cuts designed for dispersion, the emerald cut prioritizes optical clarity...",
  "sourceReferences": [
    {
      "title": "GIA Step Cut Proportions and Clarity Grading",
      "sourceName": "Gemological Institute of America",
      "url": "https://www.gia.edu",
      "checkedAt": "2026-10-01"
    }
  ]
}`}
              </pre>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
              <h4 className="font-semibold">Important Editorial Rules:</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>British/Indian spelling is required (&quot;jewellery&quot; not &quot;jewelry&quot;).</li>
                <li>Zero fabricated citations or superlative claims (&quot;#1 in the world&quot;).</li>
                <li>Consumer guides must remain completely separate from Trade wholesale content.</li>
                <li>External assistant credentials cannot directly publish while publication mode is in Draft-Only mode.</li>
              </ul>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
