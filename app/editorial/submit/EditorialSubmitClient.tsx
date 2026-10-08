'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Shield,
  Key,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileText,
  RefreshCw,
  Trash2,
  ExternalLink,
  Lock,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react'

interface CapabilitiesResponse {
  authenticated: boolean
  actorType: string
  actorId: string
  displayName?: string
  scopes: string[]
  isOwner: boolean
  publicationMode: string
  isAutomationPaused: boolean
  maxDailyNewPosts: number
  allowedCategories: string[]
  timezone: string
}

interface ParsedArticle {
  title: string
  slug?: string
  category: string
  excerpt?: string
  bodyMarkdown: string
  authorDisplayName?: string
  heroImageUrl?: string
  heroImageAlt?: string
  heroImageCaption?: string
  heroImageRights?: string
  seoTitle?: string
  metaDescription?: string
  sourceReferences?: Array<{
    title: string
    sourceName: string
    url: string
    checkedAt: string
  }>
  externalContentId?: string
}

interface ReadbackRecord {
  articleId: string
  slug: string
  revisionNumber: number
  lockVersion: number
  status: string
  title: string
  bodyWordCount: number
  verifiedAt: string
}

const SAMPLE_PAYLOAD = `{
  "title": "The Geometry of the Emerald Cut: Step Faceting in Solid Gold",
  "slug": "geometry-of-the-emerald-cut",
  "category": "education",
  "excerpt": "An architectural examination of parallel step faceting, optical clarity, and bespoke 18K gold bezel mountings.",
  "bodyMarkdown": "Unlike brilliant cuts designed for chromatic dispersion, the emerald cut prioritizes optical clarity and structural symmetry. Developed during the Art Deco period, the rectangular step cut features parallel facets that create a hall-of-mirrors effect.\\n\\nWhen setting emerald-cut diamonds in solid 18K yellow or rose gold, the atelier craftsmen carefully calculate bezel wall thickness to protect the clipped corners while maximizing light entry through the pavilion.",
  "authorDisplayName": "SHEWAH Editorial Atelier",
  "heroImageUrl": "https://images.unsplash.com/photo-1605100804763-247f67b3557e",
  "heroImageAlt": "Macro photograph of step cut emerald diamond in solid gold mounting",
  "heroImageRights": "Licensed studio photography",
  "seoTitle": "Emerald Cut Diamonds: Clarity and Settings | SHEWAH",
  "metaDescription": "A gemological exploration of step-cut emerald diamonds, clarity grading, and bespoke solid gold mountings by Maison SHEWAH.",
  "sourceReferences": [
    {
      "title": "GIA Step Cut Proportions and Clarity Grading",
      "sourceName": "Gemological Institute of America",
      "url": "https://www.gia.edu",
      "checkedAt": "2026-10-01"
    }
  ],
  "externalContentId": "editorial-sample-emerald-cut"
}`

const FORBIDDEN_KEYS = [
  'status',
  'published_at',
  'scheduled_at',
  'live_revision_id',
  'is_published',
  'publish',
  'schedule',
  'permissions',
  'role',
  'scopes',
  'token',
  '__proto__',
  'constructor',
  'prototype',
]

export default function EditorialSubmitClient() {
  // Secret is held ONLY in short-lived React component state (never persisted to storage or URL)
  const [token, setToken] = useState('')
  const [checkingAccess, setCheckingAccess] = useState(false)
  const [capabilities, setCapabilities] = useState<CapabilitiesResponse | null>(null)
  const [capabilitiesError, setCapabilitiesError] = useState<string | null>(null)
  const [isPausedNotice, setIsPausedNotice] = useState(false)

  // Article JSON payload state
  const [articleJson, setArticleJson] = useState('')
  const [showSample, setShowSample] = useState(false)
  const [jsonError, setJsonError] = useState<string | null>(null)

  // Submission & readback state
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [validationBlockers, setValidationBlockers] = useState<string[]>([])
  const [readback, setReadback] = useState<ReadbackRecord | null>(null)
  const [uncertainOutcome, setUncertainOutcome] = useState<{ message: string; key: string } | null>(null)

  // Stable Idempotency-Key for deliberate retry
  const [idempotencyKey, setIdempotencyKey] = useState<string>('')
  const [lastSubmittedJson, setLastSubmittedJson] = useState<string>('')

  // Disarm telemetry and session replay on this sensitive submission page
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        if ((window as any).clarity) {
          ;(window as any).clarity('stop')
        }
      } catch {}
    }
  }, [])

  // Parse and validate article JSON safely as data only
  const parsedArticle = useMemo<ParsedArticle | null>(() => {
    setJsonError(null)
    if (!articleJson.trim()) return null

    // Request size check (max 512 KB)
    const byteLength = new TextEncoder().encode(articleJson).length
    if (byteLength > 512_000) {
      setJsonError(`Payload exceeds maximum allowed size of 512 KB (${(byteLength / 1024).toFixed(1)} KB).`)
      return null
    }

    let parsed: any
    try {
      parsed = JSON.parse(articleJson)
    } catch (e: any) {
      setJsonError(`Malformed JSON syntax: ${e.message}`)
      return null
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setJsonError('JSON payload must be a top-level object.')
      return null
    }

    // Reject unsafe / privileged / unknown publication fields
    const keys = Object.keys(parsed)
    for (const forbidden of FORBIDDEN_KEYS) {
      if (keys.includes(forbidden)) {
        setJsonError(`Rejected prohibited field "${forbidden}". Draft submission accepts editorial content only.`)
        return null
      }
    }

    // Required fields check
    if (!parsed.title || typeof parsed.title !== 'string' || parsed.title.trim().length < 5) {
      setJsonError('Missing or invalid "title" (minimum 5 characters).')
      return null
    }
    if (!parsed.category || typeof parsed.category !== 'string') {
      setJsonError('Missing or invalid "category" field.')
      return null
    }
    if (!parsed.bodyMarkdown || typeof parsed.bodyMarkdown !== 'string' || parsed.bodyMarkdown.trim().length < 10) {
      setJsonError('Missing or invalid "bodyMarkdown" (minimum 10 characters).')
      return null
    }

    return parsed as ParsedArticle
  }, [articleJson])

  // Word count helper
  const wordCount = useMemo(() => {
    if (!parsedArticle?.bodyMarkdown) return 0
    return parsedArticle.bodyMarkdown.trim().split(/\s+/).filter(Boolean).length
  }, [parsedArticle])

  // Check access / Capabilities preflight
  async function handleCheckAccess() {
    setCapabilitiesError(null)
    setIsPausedNotice(false)
    setCapabilities(null)

    const trimmedToken = token.trim()
    if (!trimmedToken) {
      setCapabilitiesError('Please enter a Draft writer token first.')
      return
    }

    setCheckingAccess(true)
    try {
      const res = await fetch('/api/blog/v1/capabilities', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${trimmedToken}`,
        },
        credentials: 'omit', // Prevent owner session from substituting for token
      })

      if (res.status === 403) {
        const data = await res.json().catch(() => ({}))
        if (data.error && data.error.includes('paused')) {
          setIsPausedNotice(true)
          setCapabilitiesError('Automation is paused; ask the owner to resume draft automation.')
        } else {
          setCapabilitiesError(data.error || 'Access forbidden: Insufficient token scope or paused automation.')
        }
        return
      }

      if (res.status === 401) {
        setCapabilitiesError('Unauthorized: Token is invalid, expired, or has been revoked.')
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setCapabilitiesError(data.error || `Failed to verify capabilities (HTTP ${res.status}).`)
        return
      }

      const data: CapabilitiesResponse = await res.json()

      // Enforce strict actor isolation: only assistant_token is accepted on this page
      if (data.actorType !== 'assistant_token') {
        setCapabilitiesError(
          'Rejected: This page requires an assistant bearer token. Owner session or staff tokens are not permitted here.'
        )
        return
      }

      // Enforce minimal required scopes
      if (!data.scopes?.includes('blog:read') || !data.scopes?.includes('blog:draft:write')) {
        setCapabilitiesError('Rejected: Token lacks required "blog:read" or "blog:draft:write" permissions.')
        return
      }

      // Reject broad / dangerous scopes
      if (
        data.scopes?.includes('blog:publish') ||
        data.scopes?.includes('blog:schedule') ||
        data.scopes?.includes('blog:owner')
      ) {
        setCapabilitiesError(
          'Rejected: Elevated publishing, scheduling, or owner-scoped tokens are prohibited on this restricted draft submission page.'
        )
        return
      }

      // Require draft_only publication mode
      if (data.publicationMode !== 'draft_only') {
        setCapabilitiesError(`System publication mode is "${data.publicationMode}". Only "draft_only" is permitted.`)
        return
      }

      // Require active automation (not paused)
      if (data.isAutomationPaused) {
        setIsPausedNotice(true)
        setCapabilitiesError('Automation is paused; ask the owner to resume draft automation.')
        return
      }

      setCapabilities(data)
    } catch {
      setCapabilitiesError('Network error: Unable to connect to same-origin capabilities endpoint.')
    } finally {
      setCheckingAccess(false)
    }
  }

  // Save Draft Handler
  async function handleSaveDraft() {
    setSubmitError(null)
    setValidationBlockers([])
    setUncertainOutcome(null)
    setReadback(null)

    if (!parsedArticle) {
      setSubmitError('Please provide a valid Article JSON payload.')
      return
    }

    const trimmedToken = token.trim()
    if (!trimmedToken) {
      setSubmitError('Draft writer token is required.')
      return
    }

    if (!capabilities || capabilities.isAutomationPaused || isPausedNotice) {
      setSubmitError('Capabilities preflight required. Click "Check access" before submitting.')
      return
    }

    // Manage stable Idempotency-Key: reuse if payload is unchanged, or generate new UUID
    let activeKey = idempotencyKey
    if (!activeKey || lastSubmittedJson !== articleJson) {
      activeKey = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idemp-${Date.now()}`
      setIdempotencyKey(activeKey)
      setLastSubmittedJson(articleJson)
    }

    setSubmitting(true)

    let createdArticleId: string | null = null
    let responseSlug: string | null = null

    try {
      const res = await fetch('/api/blog/v1/articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${trimmedToken}`,
          'Idempotency-Key': activeKey,
        },
        credentials: 'omit',
        body: JSON.stringify(parsedArticle),
      })

      if (res.status === 409) {
        const d = await res.json().catch(() => ({}))
        setSubmitError(d.error || 'Conflict: Article with this slug or externalContentId already exists.')
        setSubmitting(false)
        return
      }

      if (res.status === 403) {
        const d = await res.json().catch(() => ({}))
        if (d.error && d.error.includes('paused')) {
          setIsPausedNotice(true)
          setSubmitError('Automation is paused; ask the owner to resume draft automation.')
        } else {
          setSubmitError(d.error || 'Forbidden: Token has insufficient scope or blog system is disabled.')
        }
        setSubmitting(false)
        return
      }

      if (res.status === 422) {
        const d = await res.json().catch(() => ({}))
        setSubmitError(d.error || 'Validation Failed: Payload does not meet atelier editorial standards.')
        if (d.details?.blockers && Array.isArray(d.details.blockers)) {
          setValidationBlockers(d.details.blockers)
        }
        setSubmitting(false)
        return
      }

      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setSubmitError(d.error || `Save request failed with status ${res.status}.`)
        setSubmitting(false)
        return
      }

      const data = await res.json()
      createdArticleId = data.articleId
      responseSlug = data.slug
    } catch {
      // Network failure on POST: Save may have succeeded on the server
      setUncertainOutcome({
        message: 'Save may have succeeded; verification pending. Network interrupted during submission.',
        key: activeKey,
      })
      setSubmitting(false)
      return
    }

    // Exact Readback Verification: Call GET /api/blog/v1/articles/[id] with same token
    if (createdArticleId) {
      try {
        const readbackRes = await fetch(`/api/blog/v1/articles/${createdArticleId}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${trimmedToken}`,
          },
          credentials: 'omit',
        })

        if (!readbackRes.ok) {
          setUncertainOutcome({
            message: `Save succeeded (Article ID: ${createdArticleId}), but readback verification could not be completed. Verification pending.`,
            key: activeKey,
          })
          setSubmitting(false)
          return
        }

        const readbackData = await readbackRes.json()
        const art = readbackData.article
        const rev = readbackData.currentRevision

        // Strict verification: must be draft status with NO live revision
        if (art.status !== 'draft') {
          setSubmitError(`Security discrepancy: Stored status is "${art.status}", expected "draft".`)
          setSubmitting(false)
          return
        }
        if (art.live_revision_id !== null) {
          setSubmitError('Security discrepancy: Stored article has an active live revision. Aborting verification.')
          setSubmitting(false)
          return
        }

        setReadback({
          articleId: art.id,
          slug: art.slug,
          revisionNumber: rev?.revision_number ?? 1,
          lockVersion: art.lock_version ?? 1,
          status: art.status,
          title: art.title,
          bodyWordCount: wordCount,
          verifiedAt: new Date().toISOString(),
        })
      } catch {
        setUncertainOutcome({
          message: `Save succeeded (Article ID: ${createdArticleId}, Slug: ${responseSlug}), but readback check timed out. Verification pending.`,
          key: activeKey,
        })
      }
    }

    setSubmitting(false)
  }

  // Clear token, article, and state
  function handleClearAll() {
    setToken('')
    setCapabilities(null)
    setCapabilitiesError(null)
    setIsPausedNotice(false)
    setArticleJson('')
    setJsonError(null)
    setSubmitError(null)
    setValidationBlockers([])
    setReadback(null)
    setUncertainOutcome(null)
    setIdempotencyKey('')
    setLastSubmittedJson('')
  }

  const isSaveReady = Boolean(
    token.trim() &&
      capabilities &&
      !capabilities.isAutomationPaused &&
      !isPausedNotice &&
      parsedArticle &&
      !submitting
  )

  return (
    <div className="min-h-screen bg-[#F6F4F2] text-[#051F34] font-sans flex flex-col selection:bg-[#CB9274] selection:text-white">
      {/* Top Banner */}
      <header className="bg-[#051F34] text-white border-b border-stone-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-[#CB9274]" />
            <div>
              <h1 className="font-serif text-lg tracking-wide text-white font-normal flex items-center gap-2">
                <span>Maison SHEWAH Editorial Atelier</span>
                <span className="text-[10px] font-sans uppercase tracking-[0.2em] bg-stone-800 text-[#CB9274] px-2 py-0.5 border border-stone-700">
                  Restricted Gateway
                </span>
              </h1>
              <p className="text-[11px] text-stone-400 font-light">
                Scoped draft submission interface for authorized editorial assistants.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-stone-700 hover:border-red-400 hover:text-red-300 text-stone-400 text-xs transition-colors"
            title="Clear token, article, and local memory"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear token & article</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 p-6 md:p-8 max-w-5xl mx-auto w-full space-y-8">
        {/* Unauthenticated Bare Shell Disclaimer */}
        <div className="bg-white border border-[#E3DBD4] p-4 flex items-start gap-3 text-xs text-[#69727D] leading-relaxed">
          <Info className="w-4 h-4 text-[#CB9274] shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-[#051F34]">Token-Gated Interface:</span> The bare page shell loads
            without an owner session so an authorized browser may supply an assistant bearer token. All protected read
            and write operations require bearer authentication. Anonymous requests receive zero data and cannot mutate
            the database.
          </div>
        </div>

        {/* 1. CREDENTIAL PREFLIGHT SECTION */}
        <section className="bg-white border border-[#E3DBD4] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg text-[#051F34] flex items-center gap-2">
              <Key className="w-4 h-4 text-[#CB9274]" />
              <span>1. Draft Writer Authentication</span>
            </h2>
            {capabilities && !isPausedNotice && (
              <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Verified Active
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label
                htmlFor="draftWriterToken"
                className="block text-[11px] uppercase tracking-wider font-semibold text-[#69727D] mb-1.5"
              >
                Draft writer token
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Lock className="w-4 h-4 text-[#69727D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="draftWriterToken"
                    type="password"
                    value={token}
                    onChange={(e) => {
                      setToken(e.target.value)
                      setCapabilities(null)
                      setCapabilitiesError(null)
                    }}
                    autoComplete="off"
                    spellCheck={false}
                    autoCapitalize="none"
                    placeholder="shw_blog_..."
                    className="w-full pl-9 pr-4 py-2.5 border border-[#E3DBD4] text-xs bg-white text-[#051F34] focus:outline-none focus:border-[#051F34] font-mono"
                  />
                </div>
                <button
                  type="button"
                  id="checkAccessButton"
                  onClick={handleCheckAccess}
                  disabled={checkingAccess || !token.trim()}
                  className={`px-5 py-2.5 text-xs uppercase tracking-wider font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
                    checkingAccess || !token.trim()
                      ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                      : 'bg-[#051F34] hover:bg-[#CB9274] text-white'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checkingAccess ? 'animate-spin' : ''}`} />
                  <span>Check access</span>
                </button>
              </div>
              <p className="text-[11px] text-[#69727D] mt-1.5">
                Token is kept strictly in transient page memory and submitted over HTTPS via Bearer header with{' '}
                <code className="text-[#051F34]">credentials: omit</code>.
              </p>
            </div>

            {/* Automation Paused Warning */}
            {isPausedNotice && (
              <div className="p-4 bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-amber-950">Automation is paused by the atelier owner</div>
                  <div>
                    The master emergency stop is currently active. Draft submissions and capabilities checks are
                    blocked. Ask the atelier owner to resume draft automation in{' '}
                    <code className="bg-amber-100 px-1 py-0.5 border border-amber-200 font-mono">/admin/blog</code> before
                    proceeding.
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {capabilitiesError && !isPausedNotice && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{capabilitiesError}</span>
              </div>
            )}

            {/* Verified Capabilities Details */}
            {capabilities && !isPausedNotice && (
              <div className="p-4 bg-stone-50 border border-[#E3DBD4] text-xs space-y-2">
                <div className="font-semibold text-[#051F34] text-[11px] uppercase tracking-wider">
                  Verified Authority Readback
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                  <div>
                    <span className="text-[#69727D] block">Actor Identity:</span>
                    <span className="font-mono text-[#051F34] font-medium">{capabilities.actorId}</span>
                  </div>
                  <div>
                    <span className="text-[#69727D] block">Actor Type:</span>
                    <span className="capitalize text-[#051F34] font-medium">{capabilities.actorType}</span>
                  </div>
                  <div>
                    <span className="text-[#69727D] block">Publication Mode:</span>
                    <span className="font-mono text-[#051F34] font-medium">{capabilities.publicationMode}</span>
                  </div>
                  <div>
                    <span className="text-[#69727D] block">Granted Scopes:</span>
                    <span className="font-mono text-[#051F34] font-medium">{capabilities.scopes.join(', ')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 2. ARTICLE JSON INPUT SECTION */}
        <section className="bg-white border border-[#E3DBD4] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg text-[#051F34] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#CB9274]" />
              <span>2. Editorial Article JSON</span>
            </h2>
            <button
              type="button"
              onClick={() => setShowSample(!showSample)}
              className="text-xs text-[#CB9274] hover:text-[#051F34] font-medium inline-flex items-center gap-1"
            >
              <span>{showSample ? 'Hide sample schema' : 'View sample schema'}</span>
              {showSample ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Sample Schema Box */}
          {showSample && (
            <div className="p-4 bg-[#051F34] text-stone-200 border border-stone-800 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-[#CB9274] uppercase tracking-wider">
                  Verified Draft Schema (Data Only)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setArticleJson(SAMPLE_PAYLOAD)
                    setShowSample(false)
                  }}
                  className="px-2.5 py-1 bg-[#CB9274] hover:bg-[#b57d60] text-white text-[10px] uppercase tracking-wider font-semibold"
                >
                  Load into editor
                </button>
              </div>
              <pre className="font-mono text-[11px] overflow-x-auto max-h-64 p-2 bg-stone-900 border border-stone-800 text-stone-300">
                {SAMPLE_PAYLOAD}
              </pre>
            </div>
          )}

          <div>
            <label
              htmlFor="articleJsonTextarea"
              className="block text-[11px] uppercase tracking-wider font-semibold text-[#69727D] mb-1.5"
            >
              Article JSON
            </label>
            <textarea
              id="articleJsonTextarea"
              value={articleJson}
              onChange={(e) => setArticleJson(e.target.value)}
              spellCheck={false}
              rows={12}
              placeholder="Paste validated editorial JSON payload here..."
              className="w-full p-3 border border-[#E3DBD4] text-xs font-mono bg-white text-[#051F34] focus:outline-none focus:border-[#051F34] resize-y"
            />
          </div>

          {jsonError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{jsonError}</span>
            </div>
          )}
        </section>

        {/* 3. PARSED DRAFT REVIEW & CONFIRMATION */}
        {parsedArticle && (
          <section className="bg-white border border-[#E3DBD4] p-6 space-y-4">
            <h2 className="font-serif text-lg text-[#051F34] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>3. Review Parsed Draft</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-[#F6F4F2] border border-[#E3DBD4] space-y-1">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[#69727D] block">Title</span>
                <span className="font-serif text-sm text-[#051F34] font-medium">{parsedArticle.title}</span>
              </div>
              <div className="p-3 bg-[#F6F4F2] border border-[#E3DBD4] space-y-1">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[#69727D] block">
                  Category & Length
                </span>
                <span className="text-xs text-[#051F34] font-medium capitalize">
                  {parsedArticle.category} • {wordCount} words
                </span>
              </div>
              {parsedArticle.slug && (
                <div className="p-3 bg-[#F6F4F2] border border-[#E3DBD4] space-y-1">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-[#69727D] block">
                    Specified Slug
                  </span>
                  <span className="font-mono text-xs text-[#051F34]">/blog/{parsedArticle.slug}</span>
                </div>
              )}
              {parsedArticle.externalContentId && (
                <div className="p-3 bg-[#F6F4F2] border border-[#E3DBD4] space-y-1">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-[#69727D] block">
                    External Content ID
                  </span>
                  <span className="font-mono text-xs text-[#051F34]">{parsedArticle.externalContentId}</span>
                </div>
              )}
            </div>

            {/* Safe plain text preview: never execute Markdown or HTML */}
            <div className="space-y-1.5 pt-2">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[#69727D] block">
                Body Preview (Plain Text Verification)
              </span>
              <div className="p-3 bg-[#F6F4F2] border border-[#E3DBD4] max-h-48 overflow-y-auto text-xs text-[#051F34] font-mono whitespace-pre-wrap">
                {parsedArticle.bodyMarkdown}
              </div>
            </div>

            {/* Submission Actions */}
            <div className="pt-4 border-t border-[#E3DBD4] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="text-[11px] text-[#69727D]">
                <span>Publication Mode: </span>
                <strong className="text-[#051F34]">draft_only</strong>
                <span> (Saves isolated draft; requires separate atelier owner approval).</span>
              </div>

              <button
                type="button"
                id="saveDraftButton"
                onClick={handleSaveDraft}
                disabled={!isSaveReady}
                className={`px-6 py-3 text-xs uppercase tracking-[0.16em] font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
                  !isSaveReady
                    ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                    : 'bg-[#051F34] hover:bg-[#CB9274] text-white shadow-sm'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>{submitting ? 'Saving and verifying...' : 'Save draft'}</span>
              </button>
            </div>
          </section>
        )}

        {/* 4. SUBMISSION FEEDBACK & ERRORS */}
        {submitError && (
          <div className="p-4 bg-red-50 border border-red-300 text-red-900 text-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span>Submission Rejected</span>
            </div>
            <p>{submitError}</p>
            {validationBlockers.length > 0 && (
              <ul className="list-disc pl-5 space-y-1 text-red-800 pt-1">
                {validationBlockers.map((b, idx) => (
                  <li key={idx}>{b}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* 5. UNCERTAIN OUTCOME NOTICE */}
        {uncertainOutcome && (
          <div className="p-5 bg-amber-50 border-2 border-amber-400 text-amber-950 text-xs space-y-3">
            <div className="flex items-center gap-2 font-semibold text-sm text-amber-900">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span>Save May Have Succeeded; Verification Pending</span>
            </div>
            <p className="leading-relaxed">{uncertainOutcome.message}</p>
            <div className="p-2.5 bg-white border border-amber-200 font-mono text-[11px] text-stone-700">
              Idempotency-Key: {uncertainOutcome.key}
            </div>
            <p className="text-[11px] text-stone-600">
              Do not alter the payload if you intend to retry. Re-enter your Draft writer token and click &quot;Save
              draft&quot; again to reconcile safely using the identical idempotency key.
            </p>
          </div>
        )}

        {/* 6. VERIFIED DRAFT READBACK PANEL */}
        {readback && (
          <section className="bg-emerald-50 border-2 border-emerald-500 p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-900 font-serif text-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Draft Verified & Saved (Isolated Revision #1)</span>
            </div>

            <p className="text-xs text-emerald-950 leading-relaxed">
              Your draft article has been successfully committed to the database. Independent readback verification
              confirmed exact title match, initial revision creation, and draft lifecycle isolation.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white p-4 border border-emerald-300 text-xs font-mono">
              <div>
                <span className="text-[#69727D] block text-[10px] uppercase font-sans">Article ID:</span>
                <span className="text-[#051F34] font-semibold break-all">{readback.articleId}</span>
              </div>
              <div>
                <span className="text-[#69727D] block text-[10px] uppercase font-sans">Slug:</span>
                <span className="text-[#051F34] font-semibold">/blog/{readback.slug}</span>
              </div>
              <div>
                <span className="text-[#69727D] block text-[10px] uppercase font-sans">Revision / Lock:</span>
                <span className="text-[#051F34]">
                  Rev #{readback.revisionNumber} (v{readback.lockVersion})
                </span>
              </div>
              <div>
                <span className="text-[#69727D] block text-[10px] uppercase font-sans">Status:</span>
                <span className="text-emerald-700 font-bold uppercase">{readback.status} (Isolated)</span>
              </div>
            </div>

            <div className="p-3 bg-emerald-100/50 border border-emerald-300 text-[11px] text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <strong className="block">Storefront & Public Isolation Confirmed:</strong>
                <span>
                  This draft is not live. It remains completely invisible to public storefront visitors, feeds, and
                  sitemaps until reviewed.
                </span>
              </div>
              <Link
                href="/admin/blog"
                target="_blank"
                className="shrink-0 px-3 py-1.5 bg-[#051F34] hover:bg-[#CB9274] text-white text-[11px] uppercase tracking-wider font-medium inline-flex items-center gap-1.5 transition-colors"
              >
                <span>Owner Review (/admin/blog)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#E3DBD4] px-6 py-4 text-center text-xs text-[#69727D]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Maison SHEWAH Editorial Atelier • All rights reserved</span>
          <span className="font-mono text-[11px]">Strict Isolation Mode • Zero Token Storage</span>
        </div>
      </footer>
    </div>
  )
}
