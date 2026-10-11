'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
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
  Image as ImageIcon,
  Upload,
  Plus,
  ArrowUp,
  ArrowDown,
  Smartphone,
  Monitor,
  Star,
} from 'lucide-react'
import {
  AI_ILLUSTRATION_DISCLAIMER,
  BlogMediaAttachment,
  BlogMediaPlacement,
  BlogMediaSourceType,
} from '@/lib/blog/types'
import {
  EditorialArticleBodyRenderer,
  ensureAiDisclaimerCaption,
} from '@/lib/blog/renderer'

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
  currentDailyNewDrafts?: number
  remainingDailyNewDrafts?: number
  currentDateAsiaKolkata?: string
  canUploadDraftMedia?: boolean
  maxImagesPerDraft?: number
  recommendedImagesPerDraft?: { min: number; max: number }
  maxImageUploadBytes?: number
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
  images?: BlogMediaAttachment[]
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
  externalContentId: string | null
  revisionNumber: number
  lockVersion: number
  status: string
  liveRevisionId: string | null
  title: string
  seoTitle: string | null
  metaDescription: string | null
  bodyWordCount: number
  bodyMatches: boolean
  titleMatches: boolean
  seoMatches: boolean
  mediaMatches: boolean
  imagesCount: number
  imagesPending: boolean
  heroUrl: string | null
  heroAlt: string | null
  verifiedImages: BlogMediaAttachment[]
  verifiedAt: string
}

interface PendingVerificationRecord {
  message: string
  key: string
  articleId?: string | null
  slug?: string | null
  externalContentId?: string | null
  revisionNumber?: number | null
}

const SAMPLE_PAYLOAD = `{
  "title": "The Geometry of the Emerald Cut: Step Faceting in Solid Gold",
  "slug": "geometry-of-the-emerald-cut",
  "category": "education",
  "excerpt": "An architectural examination of parallel step faceting, optical clarity, and bespoke 18K gold bezel mountings.",
  "bodyMarkdown": "Unlike brilliant cuts designed for chromatic dispersion, the emerald cut prioritizes optical clarity and structural symmetry. Developed during the Art Deco period, the rectangular step cut features parallel facets that create a hall-of-mirrors effect.\\n\\n## Step-Cut Proportions and Pavilion Depth\\n\\nWhen evaluating an emerald-cut diamond, gemologists inspect long linear facets where inclusions are more visible to the unaided eye. Precision symmetry along the keel line ensures balanced light return across each concentric step.\\n\\n## Architectural Gold Mountings\\n\\nWhen setting emerald-cut diamonds in solid 18K yellow or rose gold, the atelier craftsmen carefully calculate bezel wall thickness to protect the clipped corners while maximizing light entry through the pavilion.\\n\\n## Care and Long-Term Inspection\\n\\nBecause step-cut tables act as clear optical windows, routine ultrasonic or warm-soap cleaning preserves the crisp contrast between illuminated and dark facets.",
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

const PLACEMENT_OPTIONS: Array<{ value: BlogMediaPlacement; label: string }> = [
  { value: 'after_intro', label: 'After Introduction (Paragraph 1)' },
  { value: 'after_section_1', label: 'After Section 1' },
  { value: 'after_section_2', label: 'After Section 2' },
  { value: 'after_section_3', label: 'After Section 3' },
  { value: 'after_section_4', label: 'After Section 4' },
  { value: 'before_conclusion', label: 'Before Conclusion' },
  { value: 'hero_only', label: 'Hero Banner Only (Not repeated in body)' },
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

  // First-party image attachments state (3-5 recommended, max 5)
  const [attachments, setAttachments] = useState<BlogMediaAttachment[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [previewObjectUrls, setPreviewObjectUrls] = useState<Record<string, string>>({})
  const previewUrlsRef = useRef<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Preview viewport mode ('desktop' | 'mobile_390' | 'plain')
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile_390' | 'plain'>('desktop')

  // Submission & readback state
  const [submitting, setSubmitting] = useState(false)
  const [rechecking, setRechecking] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [validationBlockers, setValidationBlockers] = useState<string[]>([])
  const [validationWarnings, setValidationWarnings] = useState<string[]>([])
  const [readback, setReadback] = useState<ReadbackRecord | null>(null)
  const [uncertainOutcome, setUncertainOutcome] = useState<PendingVerificationRecord | null>(null)

  // Stable Idempotency-Key for deliberate retry
  const [idempotencyKey, setIdempotencyKey] = useState<string>('')
  const [lastSubmittedSignature, setLastSubmittedSignature] = useState<string>('')

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

  // Keep ref in sync and cleanup any in-memory blob preview URLs strictly on unmount
  useEffect(() => {
    previewUrlsRef.current = previewObjectUrls
  }, [previewObjectUrls])

  useEffect(() => {
    return () => {
      Object.values(previewUrlsRef.current).forEach((u) => {
        try {
          URL.revokeObjectURL(u)
        } catch {}
      })
    }
  }, [])

  // Parse and validate article JSON safely as data only
  const parsedArticle = useMemo<ParsedArticle | null>(() => {
    setJsonError(null)
    if (!articleJson.trim()) return null

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

    const keys = Object.keys(parsed)
    for (const forbidden of FORBIDDEN_KEYS) {
      if (keys.includes(forbidden)) {
        setJsonError(`Rejected prohibited field "${forbidden}". Draft submission accepts editorial content only.`)
        return null
      }
    }

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

  // Sync initial attachments from parsed JSON if attachments list is empty and JSON contains `images`
  useEffect(() => {
    if (attachments.length === 0 && Array.isArray(parsedArticle?.images) && parsedArticle.images.length > 0) {
      setAttachments(
        parsedArticle.images.slice(0, 5).map((img, i) => ({
          ...img,
          order: i + 1,
          isHero: Boolean(img.isHero ?? i === 0),
          position: img.position || (i === 0 ? 'after_intro' : 'after_section_1'),
          sourceType: img.sourceType || 'ai_illustration',
          caption:
            (img.sourceType || 'ai_illustration') === 'ai_illustration'
              ? ensureAiDisclaimerCaption(img.caption)
              : img.caption || '',
          rightsNote: img.rightsNote || '© SHEWAH Atelier',
        }))
      )
    }
  }, [parsedArticle, attachments.length])

  // Combine parsedArticle + UI image attachments into the final submission payload
  const effectiveSubmissionPayload = useMemo<ParsedArticle | null>(() => {
    if (!parsedArticle) return null
    const activeImages: BlogMediaAttachment[] = attachments.map((img, idx) => ({
      ...img,
      order: idx + 1,
      caption:
        img.sourceType === 'ai_illustration'
          ? ensureAiDisclaimerCaption(img.caption)
          : (img.caption || '').trim(),
      catalogueProduct: img.sourceType === 'catalogue_product' ? img.catalogueProduct : null,
    }))

    const heroAttachment = activeImages.find((img) => img.isHero) || activeImages[0]

    return {
      ...parsedArticle,
      heroImageUrl: heroAttachment?.url || parsedArticle.heroImageUrl,
      heroImageAlt: heroAttachment?.altText || parsedArticle.heroImageAlt,
      heroImageCaption: heroAttachment?.caption || parsedArticle.heroImageCaption,
      heroImageRights: heroAttachment?.rightsNote || parsedArticle.heroImageRights,
      images: activeImages.length > 0 ? activeImages : parsedArticle.images,
    }
  }, [parsedArticle, attachments])

  const wordCount = useMemo(() => {
    if (!parsedArticle?.bodyMarkdown) return 0
    return parsedArticle.bodyMarkdown.trim().split(/\s+/).filter(Boolean).length
  }, [parsedArticle])

  // Fetch private draft media preview into an in-memory Blob URL using Authorization header (never putting token in URL)
  async function fetchAuthenticatedPreviewBlob(mediaId: string, mediaUrl: string) {
    const trimmedToken = token.trim()
    if (!trimmedToken || !mediaUrl.startsWith('/api/blog/v1/media/')) return
    try {
      const res = await fetch(mediaUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${trimmedToken}`,
        },
        credentials: 'omit',
      })
      if (!res.ok) return
      const blob = await res.blob()
      const objUrl = URL.createObjectURL(blob)
      setPreviewObjectUrls((prev) => ({ ...prev, [mediaId]: objUrl }))
    } catch {
      // Ignore preview blob fetch errors
    }
  }

  // Automatically fetch private preview blobs for any /api/blog/v1/media/<id> attachments when token is available
  useEffect(() => {
    const trimmedToken = token.trim()
    if (!trimmedToken || attachments.length === 0) return
    for (const att of attachments) {
      if (att.url?.startsWith('/api/blog/v1/media/') && !previewUrlsRef.current[att.mediaId]) {
        fetchAuthenticatedPreviewBlob(att.mediaId, att.url)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments, token])

  // Upload 1..5 image files to /api/blog/v1/media
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setUploadError(null)
    const files = e.target.files
    if (!files || files.length === 0) return

    const trimmedToken = token.trim()
    if (!trimmedToken) {
      setUploadError('Please enter your Draft writer token before uploading images.')
      return
    }

    if (attachments.length + files.length > 5) {
      setUploadError(`A draft can attach at most 5 images (currently ${attachments.length} attached).`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setUploadingImage(true)
    const defaultPositions: BlogMediaPlacement[] = [
      'hero_only',
      'after_intro',
      'after_section_1',
      'after_section_2',
      'before_conclusion',
    ]

    try {
      const newlyUploaded: BlogMediaAttachment[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const slotIndex = attachments.length + newlyUploaded.length
        const isFirstHero = slotIndex === 0 && !attachments.some((a) => a.isHero)
        const defaultPos = defaultPositions[Math.min(slotIndex, defaultPositions.length - 1)]
        const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()
        const defaultAlt =
          baseName.length >= 10
            ? `Editorial illustration: ${baseName}`
            : `SHEWAH editorial illustration #${slotIndex + 1} showing gemstone and ring proportion details`

        const formData = new FormData()
        formData.append('file', file)
        formData.append('alt_text', defaultAlt)
        formData.append('caption', AI_ILLUSTRATION_DISCLAIMER)
        formData.append('rights_note', 'SHEWAH Editorial Concept Illustration (Non-Catalogue)')
        formData.append('source_type', 'ai_illustration')
        formData.append('position', defaultPos)
        formData.append('is_hero', String(isFirstHero))

        const res = await fetch('/api/blog/v1/media', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${trimmedToken}`,
          },
          credentials: 'omit',
          body: formData,
        })

        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.mediaId) {
          setUploadError(data.error || `Failed to upload "${file.name}" (HTTP ${res.status}).`)
          break
        }

        const localPreviewUrl = URL.createObjectURL(file)
        setPreviewObjectUrls((prev) => ({ ...prev, [data.mediaId]: localPreviewUrl }))

        newlyUploaded.push({
          mediaId: data.mediaId,
          storageKey: data.storageKey || null,
          url: data.stableUrl || `/api/blog/v1/media/${data.mediaId}`,
          altText: data.altText || defaultAlt,
          caption: data.caption || AI_ILLUSTRATION_DISCLAIMER,
          sourceType: 'ai_illustration',
          rightsNote: data.rightsNote || 'SHEWAH Editorial Concept Illustration (Non-Catalogue)',
          isHero: isFirstHero,
          position: defaultPos,
          order: slotIndex + 1,
          mimeType: data.mimeType,
          sizeBytes: data.sizeBytes,
          width: data.width || undefined,
          height: data.height || undefined,
          catalogueProduct: null,
        })
      }

      if (newlyUploaded.length > 0) {
        setAttachments((prev) => [...prev, ...newlyUploaded])
      }
    } catch {
      setUploadError('Network error while uploading image to /api/blog/v1/media.')
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleAddAttachmentSlot(sourceType: BlogMediaSourceType) {
    setUploadError(null)
    if (attachments.length >= 5) {
      setUploadError('Maximum of 5 image attachments reached.')
      return
    }
    const slotIndex = attachments.length
    const defaultPositions: BlogMediaPlacement[] = [
      'after_intro',
      'after_section_1',
      'after_section_2',
      'after_section_3',
      'before_conclusion',
    ]
    const isHero = slotIndex === 0 && !attachments.some((a) => a.isHero)
    const newSlot: BlogMediaAttachment = {
      mediaId: `slot-${Date.now()}-${slotIndex + 1}`,
      storageKey: null,
      url:
        sourceType === 'catalogue_product'
          ? 'https://res.cloudinary.com/ddnlacdta/image/upload/v1783844231/NCK61.1.webp'
          : 'https://images.unsplash.com/photo-1605100804763-247f67b3557e.jpg',
      altText:
        sourceType === 'catalogue_product'
          ? 'Verified SHEWAH catalogue solitaire ring photographed in solid gold setting'
          : `Editorial illustration #${slotIndex + 1} depicting ring proportion and sizing geometry`,
      caption:
        sourceType === 'ai_illustration'
          ? AI_ILLUSTRATION_DISCLAIMER
          : sourceType === 'catalogue_product'
            ? 'Photographed from the verified SHEWAH collection.'
            : 'Photographed at the SHEWAH Atelier.',
      sourceType,
      rightsNote:
        sourceType === 'ai_illustration'
          ? 'SHEWAH Editorial Concept Illustration (Non-Catalogue)'
          : '© SHEWAH Archives',
      isHero,
      position: defaultPositions[Math.min(slotIndex, defaultPositions.length - 1)],
      order: slotIndex + 1,
      catalogueProduct:
        sourceType === 'catalogue_product'
          ? {
              productCode: 'NCK61',
              productName: 'SHEWAH Graduated Tennis Necklace',
              productSlug: 'graduated-tennis-necklace',
              productUrl: 'https://shewah.co/jewellery/graduated-tennis-necklace',
              productImageUrl: 'https://res.cloudinary.com/ddnlacdta/image/upload/v1783844231/NCK61.1.webp',
            }
          : null,
    }
    setAttachments((prev) => [...prev, newSlot])
  }

  function updateAttachment(index: number, patch: Partial<BlogMediaAttachment>) {
    setAttachments((prev) => {
      const next = [...prev]
      const current = next[index]
      if (!current) return prev

      const updated: BlogMediaAttachment = { ...current, ...patch }

      // Enforce strict AI vs Catalogue separation on sourceType change
      if (patch.sourceType === 'ai_illustration') {
        updated.catalogueProduct = null
        updated.caption = ensureAiDisclaimerCaption(updated.caption)
        if (!updated.rightsNote || updated.rightsNote === '© SHEWAH Archives') {
          updated.rightsNote = 'SHEWAH Editorial Concept Illustration (Non-Catalogue)'
        }
      } else if (patch.sourceType === 'catalogue_product' && !updated.catalogueProduct) {
        updated.catalogueProduct = {
          productCode: '',
          productName: '',
          productSlug: '',
          productUrl: 'https://shewah.co/jewellery/',
          productImageUrl: updated.url || '',
        }
      }

      if (patch.isHero) {
        return next.map((item, i) => ({
          ...(i === index ? updated : item),
          isHero: i === index,
        }))
      }

      next[index] = updated
      return next
    })
  }

  function moveAttachment(index: number, direction: -1 | 1) {
    setAttachments((prev) => {
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const copy = [...prev]
      const temp = copy[index]
      copy[index] = copy[target]
      copy[target] = temp
      return copy.map((item, idx) => ({ ...item, order: idx + 1 }))
    })
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => {
      const remaining = prev.filter((_, i) => i !== index).map((item, idx) => ({ ...item, order: idx + 1 }))
      if (remaining.length > 0 && !remaining.some((r) => r.isHero)) {
        remaining[0].isHero = true
      }
      return remaining
    })
  }

  function syncAttachmentsIntoJsonTextarea() {
    if (!effectiveSubmissionPayload) return
    setArticleJson(JSON.stringify(effectiveSubmissionPayload, null, 2))
  }

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
        credentials: 'omit',
        cache: 'no-store',
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

      if (data.actorType !== 'assistant_token') {
        setCapabilitiesError(
          'Rejected: This page requires an assistant bearer token. Owner session or staff tokens are not permitted here.'
        )
        return
      }

      if (!data.scopes?.includes('blog:read') || !data.scopes?.includes('blog:draft:write')) {
        setCapabilitiesError('Rejected: Token lacks required "blog:read" or "blog:draft:write" permissions.')
        return
      }

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

      if (data.publicationMode !== 'draft_only') {
        setCapabilitiesError(`System publication mode is "${data.publicationMode}". Only "draft_only" is permitted.`)
        return
      }

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

  // Independent Readback Verifier (used both immediately after POST 201 and by the read-only "Recheck Verification" button)
  async function performIndependentReadbackVerification(
    targetArticleId: string,
    expectedPayload: ParsedArticle,
    activeKey: string,
    fallbackMeta?: { slug?: string | null; revisionNumber?: number | null }
  ) {
    const trimmedToken = token.trim()
    if (!trimmedToken) {
      setUncertainOutcome({
        message: `Save succeeded (Article ID: ${targetArticleId}), but token is needed to run readback verification.`,
        key: activeKey,
        articleId: targetArticleId,
        slug: fallbackMeta?.slug || expectedPayload.slug || null,
        externalContentId: expectedPayload.externalContentId || null,
        revisionNumber: fallbackMeta?.revisionNumber || 1,
      })
      return
    }

    try {
      const readbackRes = await fetch(`/api/blog/v1/articles/${targetArticleId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${trimmedToken}`,
        },
        credentials: 'omit',
        cache: 'no-store',
      })

      if (!readbackRes.ok) {
        setUncertainOutcome({
          message: `Save may have succeeded; verification pending (Article ID: ${targetArticleId}). Independent GET readback returned HTTP ${readbackRes.status}.`,
          key: activeKey,
          articleId: targetArticleId,
          slug: fallbackMeta?.slug || expectedPayload.slug || null,
          externalContentId: expectedPayload.externalContentId || null,
          revisionNumber: fallbackMeta?.revisionNumber || 1,
        })
        return
      }

      const readbackData = await readbackRes.json()
      const art = readbackData.article
      const rev = readbackData.currentRevision

      if (art.status !== 'draft') {
        setSubmitError(`Security discrepancy: Stored status is "${art.status}", expected "draft".`)
        return
      }
      if (art.live_revision_id !== null) {
        setSubmitError('Security discrepancy: Stored article has an active live revision. Aborting verification.')
        return
      }

      const storedImages: BlogMediaAttachment[] = Array.isArray(rev?.body_structured?.images)
        ? rev.body_structured.images
        : []

      // Fetch private preview blobs for any stored private draft media not yet cached in memory
      for (const img of storedImages) {
        if (img.url?.startsWith('/api/blog/v1/media/') && !previewObjectUrls[img.mediaId]) {
          fetchAuthenticatedPreviewBlob(img.mediaId, img.url)
        }
      }

      const titleMatches = (art.title || '').trim() === (expectedPayload.title || '').trim()
      const bodyMatches = Boolean(rev?.body_markdown && rev.body_markdown.trim().length >= 20)
      const seoMatches =
        (!expectedPayload.seoTitle || (art.seo_title || '').trim() === expectedPayload.seoTitle.trim()) &&
        (!expectedPayload.metaDescription ||
          (art.meta_description || '').trim() === expectedPayload.metaDescription.trim())

      const expectedImages = Array.isArray(expectedPayload.images) ? expectedPayload.images : []
      const mediaMatches =
        expectedImages.length === 0 ||
        (storedImages.length === expectedImages.length &&
          storedImages.every(
            (sImg, idx) =>
              sImg.url === expectedImages[idx].url &&
              sImg.altText === expectedImages[idx].altText.trim() &&
              sImg.sourceType === expectedImages[idx].sourceType
          ))

      setUncertainOutcome(null)
      setReadback({
        articleId: art.id,
        slug: art.slug,
        externalContentId: art.external_content_id || null,
        revisionNumber: rev?.revision_number ?? 1,
        lockVersion: art.lock_version ?? 1,
        status: art.status,
        liveRevisionId: art.live_revision_id ?? null,
        title: art.title,
        seoTitle: art.seo_title || null,
        metaDescription: art.meta_description || null,
        bodyWordCount: (rev?.body_markdown || '').trim().split(/\s+/).filter(Boolean).length,
        bodyMatches,
        titleMatches,
        seoMatches,
        mediaMatches,
        imagesCount: storedImages.length,
        imagesPending: Boolean(rev?.body_structured?.imagesPending ?? storedImages.length < 3),
        heroUrl: art.hero_image_url || null,
        heroAlt: art.hero_image_alt || null,
        verifiedImages: storedImages,
        verifiedAt: new Date().toISOString(),
      })
    } catch {
      setUncertainOutcome({
        message: `Save may have succeeded; verification pending (Article ID: ${targetArticleId}). Network interrupted during readback check.`,
        key: activeKey,
        articleId: targetArticleId,
        slug: fallbackMeta?.slug || expectedPayload.slug || null,
        externalContentId: expectedPayload.externalContentId || null,
        revisionNumber: fallbackMeta?.revisionNumber || 1,
      })
    }
  }

  // Read-only Recheck Verification handler (never creates another draft)
  async function handleRecheckVerification() {
    if (!uncertainOutcome || !effectiveSubmissionPayload) return
    const trimmedToken = token.trim()
    if (!trimmedToken) {
      setSubmitError('Please enter your Draft writer token to recheck verification.')
      return
    }

    setRechecking(true)
    setSubmitError(null)
    try {
      let targetArticleId = uncertainOutcome.articleId || null

      // If POST itself timed out before returning articleId, look up by slug/externalContentId in read-only GET list
      if (!targetArticleId) {
        const listRes = await fetch('/api/blog/v1/articles?limit=20', {
          method: 'GET',
          headers: { Authorization: `Bearer ${trimmedToken}` },
          credentials: 'omit',
          cache: 'no-store',
        })
        if (listRes.ok) {
          const listData = await listRes.json()
          const matched = (listData.articles || []).find(
            (a: any) =>
              (effectiveSubmissionPayload.externalContentId &&
                a.external_content_id === effectiveSubmissionPayload.externalContentId) ||
              (effectiveSubmissionPayload.slug && a.slug === effectiveSubmissionPayload.slug) ||
              a.title === effectiveSubmissionPayload.title.trim()
          )
          if (matched?.id) {
            targetArticleId = matched.id
          }
        }
      }

      if (!targetArticleId) {
        setUncertainOutcome({
          ...uncertainOutcome,
          message:
            'No matching saved draft record was found yet on read-only check. You may safely click "Save draft" to retry with the same Idempotency-Key.',
        })
        return
      }

      await performIndependentReadbackVerification(
        targetArticleId,
        effectiveSubmissionPayload,
        uncertainOutcome.key,
        {
          slug: uncertainOutcome.slug,
          revisionNumber: uncertainOutcome.revisionNumber,
        }
      )
    } finally {
      setRechecking(false)
    }
  }

  // Save Draft Handler
  async function handleSaveDraft() {
    setSubmitError(null)
    setValidationBlockers([])
    setValidationWarnings([])
    setUncertainOutcome(null)
    setReadback(null)

    if (!effectiveSubmissionPayload) {
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

    const serializedPayload = JSON.stringify(effectiveSubmissionPayload)
    let activeKey = idempotencyKey
    if (!activeKey || lastSubmittedSignature !== serializedPayload) {
      activeKey = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idemp-${Date.now()}`
      setIdempotencyKey(activeKey)
      setLastSubmittedSignature(serializedPayload)
    }

    setSubmitting(true)

    let createdArticleId: string | null = null
    let responseSlug: string | null = null
    let responseRevNum: number | null = null

    try {
      const res = await fetch('/api/blog/v1/articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${trimmedToken}`,
          'Idempotency-Key': activeKey,
        },
        credentials: 'omit',
        body: serializedPayload,
      })

      if (res.status === 429) {
        const d = await res.json().catch(() => ({}))
        setSubmitError(
          d.error ||
            'Daily new draft capacity (10/day in Asia/Kolkata) has been reached. Existing drafts remain intact.'
        )
        setSubmitting(false)
        return
      }

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
        if (d.details?.warnings && Array.isArray(d.details.warnings)) {
          setValidationWarnings(d.details.warnings)
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
      responseRevNum = data.revisionNumber ?? 1
    } catch {
      setUncertainOutcome({
        message: 'Save may have succeeded; verification pending. Network interrupted during submission.',
        key: activeKey,
        articleId: null,
        slug: effectiveSubmissionPayload.slug || null,
        externalContentId: effectiveSubmissionPayload.externalContentId || null,
      })
      setSubmitting(false)
      return
    }

    if (createdArticleId) {
      await performIndependentReadbackVerification(createdArticleId, effectiveSubmissionPayload, activeKey, {
        slug: responseSlug,
        revisionNumber: responseRevNum,
      })
    }

    setSubmitting(false)
  }

  function handleClearAll() {
    setToken('')
    setCapabilities(null)
    setCapabilitiesError(null)
    setIsPausedNotice(false)
    setArticleJson('')
    setJsonError(null)
    setAttachments([])
    setUploadError(null)
    setSubmitError(null)
    setValidationBlockers([])
    setValidationWarnings([])
    setReadback(null)
    setUncertainOutcome(null)
    setIdempotencyKey('')
    setLastSubmittedSignature('')
  }

  const isSaveReady = Boolean(
    token.trim() &&
      capabilities &&
      !capabilities.isAutomationPaused &&
      !isPausedNotice &&
      effectiveSubmissionPayload &&
      !submitting
  )

  const attachedCount = effectiveSubmissionPayload?.images?.length ?? 0
  const isImagesPending = attachedCount < 3

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
                Scoped draft submission &amp; private media attachment interface (Draft-Only Mode).
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
            <span>Clear token &amp; article</span>
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
            without an owner session so an authorized browser may supply an assistant bearer token. All protected read,
            draft-write, and private image upload operations require bearer authentication. Anonymous requests receive
            zero data and cannot mutate the database.
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
                    name="draft-writer-token-ephemeral"
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
                <code className="text-[#051F34]">credentials: omit</code>. Never stored in URLs, cookies, or web storage.
              </p>
            </div>

            {isPausedNotice && (
              <div className="p-4 bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-amber-950">Automation is paused by the atelier owner</div>
                  <div>
                    The master emergency stop is currently active. Draft submissions, media uploads, and capabilities
                    checks are blocked. Ask the atelier owner to resume draft automation in{' '}
                    <code className="bg-amber-100 px-1 py-0.5 border border-amber-200 font-mono">/admin/blog</code> before
                    proceeding.
                  </div>
                </div>
              </div>
            )}

            {capabilitiesError && !isPausedNotice && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{capabilitiesError}</span>
              </div>
            )}

            {capabilities && !isPausedNotice && (
              <div className="p-4 bg-stone-50 border border-[#E3DBD4] text-xs space-y-2">
                <div className="font-semibold text-[#051F34] text-[11px] uppercase tracking-wider">
                  Verified Authority &amp; Quota Readback
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[11px]">
                  <div>
                    <span className="text-[#69727D] block">Actor Identity:</span>
                    <span className="font-mono text-[#051F34] font-medium">
                      {capabilities.actorType} ({capabilities.actorId})
                    </span>
                  </div>
                  <div>
                    <span className="text-[#69727D] block">Publication Mode:</span>
                    <span className="font-mono text-[#051F34] font-medium">{capabilities.publicationMode}</span>
                  </div>
                  <div>
                    <span className="text-[#69727D] block">Granted Scopes:</span>
                    <span className="font-mono text-[#051F34] font-medium">{capabilities.scopes.join(', ')}</span>
                  </div>
                  <div>
                    <span className="text-[#69727D] block">Daily New-Draft Capacity:</span>
                    <span className="font-mono text-[#051F34] font-semibold">
                      {capabilities.maxDailyNewPosts} / day ({capabilities.timezone})
                    </span>
                  </div>
                  <div>
                    <span className="text-[#69727D] block">Remaining Today ({capabilities.currentDateAsiaKolkata || 'IST'}):</span>
                    <span className="font-mono text-emerald-700 font-semibold">
                      {capabilities.remainingDailyNewDrafts ?? capabilities.maxDailyNewPosts} of {capabilities.maxDailyNewPosts} available
                    </span>
                  </div>
                  <div>
                    <span className="text-[#69727D] block">Draft Image Attachments:</span>
                    <span className="font-mono text-[#051F34] font-medium">
                      3–5 images (Max {capabilities.maxImagesPerDraft ?? 5}, ≤5 MB)
                    </span>
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

        {/* 3. FIRST-PARTY IMAGES SECTION (3-5 ATTACHMENTS) */}
        <section id="draftImagesSection" className="bg-white border border-[#E3DBD4] p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E3DBD4] pb-4">
            <div>
              <h2 className="font-serif text-lg text-[#051F34] flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#CB9274]" />
                <span>3. Images (3–5 Draft Attachments)</span>
              </h2>
              <p className="text-xs text-[#69727D] mt-0.5">
                Attach 3 to 5 first-party illustrations or verified Shewah catalogue photos. Text drafts remain saveable
                when images are pending.
              </p>
            </div>
            <div>
              {isImagesPending ? (
                <span
                  data-testid="images-pending-badge"
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-300 text-amber-900 text-[11px] font-semibold uppercase tracking-wider"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Images Pending — Draft Only ({attachedCount}/3–5)</span>
                </span>
              ) : (
                <span
                  data-testid="images-ready-badge"
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-300 text-emerald-800 text-[11px] font-semibold uppercase tracking-wider"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{attachedCount}/5 Images Attached (Draft Only)</span>
                </span>
              )}
            </div>
          </div>

          {/* Upload & Slot Actions */}
          <div className="p-4 bg-[#F6F4F2] border border-[#E3DBD4] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <label
                htmlFor="draftImageFileInput"
                className="text-xs font-semibold text-[#051F34] block"
              >
                Upload First-Party Draft Images (JPEG, PNG, WebP, AVIF • Max 5 MB)
              </label>
              <p className="text-[11px] text-[#69727D]">
                Uploaded files are magic-byte verified, stripped of EXIF metadata, and stored privately under stable
                media IDs (<code className="text-[#051F34]">/api/blog/v1/media/&lt;id&gt;</code>).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <input
                ref={fileInputRef}
                id="draftImageFileInput"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                multiple
                disabled={uploadingImage || attachments.length >= 5}
                onChange={handleFileUpload}
                className="sr-only"
              />
              <label
                htmlFor="draftImageFileInput"
                className={`px-4 py-2 text-xs uppercase tracking-wider font-semibold inline-flex items-center gap-2 cursor-pointer transition-colors ${
                  uploadingImage || attachments.length >= 5
                    ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                    : 'bg-[#051F34] hover:bg-[#CB9274] text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadingImage ? 'Uploading...' : 'Upload Image File(s)'}</span>
              </label>

              <button
                type="button"
                onClick={() => handleAddAttachmentSlot('ai_illustration')}
                disabled={attachments.length >= 5}
                className="px-3 py-2 border border-[#051F34] text-[#051F34] hover:bg-[#051F34] hover:text-white text-[11px] uppercase tracking-wider font-semibold inline-flex items-center gap-1 transition-colors disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ AI Illustration Slot</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddAttachmentSlot('catalogue_product')}
                disabled={attachments.length >= 5}
                className="px-3 py-2 border border-[#CB9274] text-[#051F34] bg-white hover:bg-[#CB9274] hover:text-white text-[11px] uppercase tracking-wider font-semibold inline-flex items-center gap-1 transition-colors disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Catalogue Product Card</span>
              </button>
            </div>
          </div>

          {uploadError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Attached Images List */}
          {attachments.length === 0 ? (
            <div className="p-6 border border-dashed border-[#E3DBD4] text-center space-y-1 text-xs text-[#69727D]">
              <p className="font-medium text-[#051F34]">
                No draft images attached yet (Images Pending — Not Publication Ready).
              </p>
              <p>
                You may save an editorial text-only draft now, or attach 3 to 5 images above with captions, alt text,
                hero selection, and body placement.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {attachments.map((att, idx) => {
                const resolvedPreview =
                  previewObjectUrls[att.mediaId] ||
                  att.catalogueProduct?.productImageUrl ||
                  (!att.url.startsWith('/api/blog/v1/media/') ? att.url : undefined)

                return (
                  <div
                    key={att.mediaId || idx}
                    data-testid={`draft-attachment-card-${idx + 1}`}
                    className="p-4 border border-[#E3DBD4] bg-[#FBF9F7] space-y-4 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E3DBD4] pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2 py-0.5 bg-[#051F34] text-white font-mono text-[11px] font-semibold">
                          Image #{idx + 1}
                        </span>
                        <span className="font-mono text-[11px] text-[#69727D]">
                          ID: {att.mediaId}
                        </span>
                        {att.isHero && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#CB9274] text-white text-[10px] uppercase tracking-wider font-semibold">
                            <Star className="w-3 h-3" />
                            <span>Hero Image</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateAttachment(idx, { isHero: true })}
                          className={`px-2.5 py-1 text-[10px] uppercase tracking-wider font-semibold border ${
                            att.isHero
                              ? 'bg-[#051F34] text-white border-[#051F34]'
                              : 'bg-white text-[#051F34] border-[#E3DBD4] hover:border-[#051F34]'
                          }`}
                        >
                          {att.isHero ? 'Selected as Hero' : 'Set as Hero'}
                        </button>
                        <button
                          type="button"
                          onClick={() => moveAttachment(idx, -1)}
                          disabled={idx === 0}
                          title="Move image up"
                          className="p-1 border border-[#E3DBD4] bg-white hover:border-[#051F34] disabled:opacity-40"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveAttachment(idx, 1)}
                          disabled={idx === attachments.length - 1}
                          title="Move image down"
                          className="p-1 border border-[#E3DBD4] bg-white hover:border-[#051F34] disabled:opacity-40"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeAttachment(idx)}
                          title="Remove image attachment"
                          className="p-1 border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      {/* Thumbnail Preview */}
                      <div className="md:col-span-4 space-y-2">
                        <div className="aspect-16/10 bg-[#F6F4F2] border border-[#E3DBD4] overflow-hidden flex items-center justify-center">
                          {resolvedPreview ? (
                            <img
                              src={resolvedPreview}
                              alt={att.altText || `Draft attachment ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="p-3 text-center space-y-1.5">
                              <span className="block text-[11px] text-[#69727D]">
                                Private Draft Media ({att.mediaId})
                              </span>
                              {token.trim() && att.url.startsWith('/api/blog/v1/media/') && (
                                <button
                                  type="button"
                                  onClick={() => fetchAuthenticatedPreviewBlob(att.mediaId, att.url)}
                                  className="px-2.5 py-1 bg-[#051F34] text-white text-[10px] uppercase tracking-wider"
                                >
                                  Load Private Preview
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-[#69727D] break-all">
                          Stable Ref: {att.url}
                        </div>
                      </div>

                      {/* Metadata Fields */}
                      <div className="md:col-span-8 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#69727D] mb-1">
                              Source / Rights Classification *
                            </label>
                            <select
                              aria-label={`Image ${idx + 1} source type`}
                              value={att.sourceType}
                              onChange={(e) =>
                                updateAttachment(idx, { sourceType: e.target.value as BlogMediaSourceType })
                              }
                              className="w-full p-2 border border-[#E3DBD4] bg-white text-xs text-[#051F34]"
                            >
                              <option value="ai_illustration">
                                AI Illustration / Sizing Diagram (Non-Catalogue)
                              </option>
                              <option value="catalogue_product">
                                Authorised Shewah Catalogue Product Photo
                              </option>
                              <option value="studio_photography">
                                First-Party Studio / Atelier Photography
                              </option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#69727D] mb-1">
                              Body Placement Position *
                            </label>
                            <select
                              aria-label={`Image ${idx + 1} body placement`}
                              value={att.position}
                              onChange={(e) =>
                                updateAttachment(idx, { position: e.target.value as BlogMediaPlacement })
                              }
                              className="w-full p-2 border border-[#E3DBD4] bg-white text-xs text-[#051F34]"
                            >
                              {PLACEMENT_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#69727D] mb-1">
                            Stable Media URL or First-Party Key *
                          </label>
                          <input
                            type="text"
                            aria-label={`Image ${idx + 1} URL`}
                            value={att.url}
                            onChange={(e) => updateAttachment(idx, { url: e.target.value })}
                            placeholder="/api/blog/v1/media/... or https://res.cloudinary.com/..."
                            className="w-full p-2 border border-[#E3DBD4] bg-white font-mono text-[11px]"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#69727D] mb-1">
                            Descriptive Alt Text (Min 10 chars) *
                          </label>
                          <input
                            type="text"
                            aria-label={`Image ${idx + 1} alt text`}
                            value={att.altText}
                            onChange={(e) => updateAttachment(idx, { altText: e.target.value })}
                            placeholder="Describe the diagram, measurement step, or jewellery piece..."
                            className="w-full p-2 border border-[#E3DBD4] bg-white text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#69727D] mb-1">
                            Visible Caption {att.sourceType === 'ai_illustration' ? '(Mandatory AI Disclaimer) *' : ''}
                          </label>
                          <input
                            type="text"
                            aria-label={`Image ${idx + 1} caption`}
                            value={att.caption}
                            onChange={(e) => updateAttachment(idx, { caption: e.target.value })}
                            placeholder={
                              att.sourceType === 'ai_illustration'
                                ? AI_ILLUSTRATION_DISCLAIMER
                                : 'Editorial caption...'
                            }
                            className="w-full p-2 border border-[#E3DBD4] bg-white text-xs"
                          />
                          {att.sourceType === 'ai_illustration' && (
                            <p className="text-[10px] text-[#69727D] mt-1">
                              AI illustrations automatically carry the non-product, non-scale disclosure:{' '}
                              <span className="italic text-[#051F34]">&ldquo;{AI_ILLUSTRATION_DISCLAIMER}&rdquo;</span>
                            </p>
                          )}
                        </div>

                        {/* Verified Catalogue Product Metadata (ONLY when sourceType === 'catalogue_product') */}
                        {att.sourceType === 'catalogue_product' && (
                          <div className="p-3 bg-white border border-[#CB9274] space-y-2.5">
                            <div className="text-[10px] uppercase tracking-wider font-semibold text-[#051F34]">
                              Verified Shewah Catalogue Product Identity (Required for Product Cards)
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[10px] text-[#69727D] mb-0.5">Product Name *</label>
                                <input
                                  type="text"
                                  aria-label={`Image ${idx + 1} catalogue product name`}
                                  value={att.catalogueProduct?.productName || ''}
                                  onChange={(e) =>
                                    updateAttachment(idx, {
                                      catalogueProduct: {
                                        productCode: att.catalogueProduct?.productCode || '',
                                        productName: e.target.value,
                                        productSlug: att.catalogueProduct?.productSlug || '',
                                        productUrl: att.catalogueProduct?.productUrl || '',
                                        productImageUrl: att.catalogueProduct?.productImageUrl || att.url,
                                      },
                                    })
                                  }
                                  placeholder="e.g. SHEWAH Graduated Tennis Necklace"
                                  className="w-full p-1.5 border border-[#E3DBD4] text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-[#69727D] mb-0.5">Product Code / SKU *</label>
                                <input
                                  type="text"
                                  aria-label={`Image ${idx + 1} catalogue product code`}
                                  value={att.catalogueProduct?.productCode || ''}
                                  onChange={(e) =>
                                    updateAttachment(idx, {
                                      catalogueProduct: {
                                        productCode: e.target.value,
                                        productName: att.catalogueProduct?.productName || '',
                                        productSlug: att.catalogueProduct?.productSlug || '',
                                        productUrl: att.catalogueProduct?.productUrl || '',
                                        productImageUrl: att.catalogueProduct?.productImageUrl || att.url,
                                      },
                                    })
                                  }
                                  placeholder="e.g. NCK61"
                                  className="w-full p-1.5 border border-[#E3DBD4] font-mono text-xs"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[10px] text-[#69727D] mb-0.5">
                                  Exact Shewah Product URL (/jewellery/&lt;slug&gt;) *
                                </label>
                                <input
                                  type="text"
                                  aria-label={`Image ${idx + 1} catalogue product URL`}
                                  value={att.catalogueProduct?.productUrl || ''}
                                  onChange={(e) =>
                                    updateAttachment(idx, {
                                      catalogueProduct: {
                                        productCode: att.catalogueProduct?.productCode || '',
                                        productName: att.catalogueProduct?.productName || '',
                                        productSlug:
                                          e.target.value.split('/jewellery/')[1]?.replace(/\/$/, '') || '',
                                        productUrl: e.target.value,
                                        productImageUrl: att.catalogueProduct?.productImageUrl || att.url,
                                      },
                                    })
                                  }
                                  placeholder="https://shewah.co/jewellery/graduated-tennis-necklace"
                                  className="w-full p-1.5 border border-[#E3DBD4] font-mono text-[11px]"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-[#69727D] mb-0.5">
                                  Verified Product Image URL *
                                </label>
                                <input
                                  type="text"
                                  aria-label={`Image ${idx + 1} catalogue product image URL`}
                                  value={att.catalogueProduct?.productImageUrl || ''}
                                  onChange={(e) =>
                                    updateAttachment(idx, {
                                      url: e.target.value,
                                      catalogueProduct: {
                                        productCode: att.catalogueProduct?.productCode || '',
                                        productName: att.catalogueProduct?.productName || '',
                                        productSlug: att.catalogueProduct?.productSlug || '',
                                        productUrl: att.catalogueProduct?.productUrl || '',
                                        productImageUrl: e.target.value,
                                      },
                                    })
                                  }
                                  placeholder="https://res.cloudinary.com/..."
                                  className="w-full p-1.5 border border-[#E3DBD4] font-mono text-[11px]"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {parsedArticle && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={syncAttachmentsIntoJsonTextarea}
                    className="px-3.5 py-1.5 border border-[#051F34] text-[#051F34] hover:bg-[#051F34] hover:text-white text-[11px] uppercase tracking-wider font-semibold transition-colors"
                  >
                    Sync Images into Article JSON Textarea
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 4. PARSED DRAFT REVIEW, RENDERED PREVIEW & CONFIRMATION */}
        {effectiveSubmissionPayload && (
          <section className="bg-white border border-[#E3DBD4] p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E3DBD4] pb-4">
              <h2 className="font-serif text-lg text-[#051F34] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>4. Review Parsed Draft &amp; Layout Preview</span>
              </h2>

              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setPreviewViewport('desktop')}
                  className={`px-3 py-1.5 border inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold ${
                    previewViewport === 'desktop'
                      ? 'bg-[#051F34] text-white border-[#051F34]'
                      : 'bg-white text-[#051F34] border-[#E3DBD4]'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Desktop Preview</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewViewport('mobile_390')}
                  className={`px-3 py-1.5 border inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold ${
                    previewViewport === 'mobile_390'
                      ? 'bg-[#051F34] text-white border-[#051F34]'
                      : 'bg-white text-[#051F34] border-[#E3DBD4]'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Mobile (390px)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewViewport('plain')}
                  className={`px-3 py-1.5 border inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold ${
                    previewViewport === 'plain'
                      ? 'bg-[#051F34] text-white border-[#051F34]'
                      : 'bg-white text-[#051F34] border-[#E3DBD4]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Plain Text</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-[#F6F4F2] border border-[#E3DBD4] space-y-1">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[#69727D] block">Title</span>
                <span className="font-serif text-sm text-[#051F34] font-medium">
                  {effectiveSubmissionPayload.title}
                </span>
              </div>
              <div className="p-3 bg-[#F6F4F2] border border-[#E3DBD4] space-y-1">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[#69727D] block">
                  Category, Length &amp; Media
                </span>
                <span className="text-xs text-[#051F34] font-medium capitalize">
                  {effectiveSubmissionPayload.category} • {wordCount} words • {attachedCount} image(s)
                </span>
              </div>
              <div className="p-3 bg-[#F6F4F2] border border-[#E3DBD4] space-y-1">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[#69727D] block">
                  Slug &amp; External ID
                </span>
                <span className="font-mono text-xs text-[#051F34] block truncate">
                  /blog/{effectiveSubmissionPayload.slug || '(auto-generated)'}
                </span>
                {effectiveSubmissionPayload.externalContentId && (
                  <span className="font-mono text-[10px] text-[#69727D] block truncate">
                    Ext: {effectiveSubmissionPayload.externalContentId}
                  </span>
                )}
              </div>
            </div>

            {previewViewport === 'plain' ? (
              <div className="space-y-1.5 pt-2">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[#69727D] block">
                  Body Preview (Plain Text Verification)
                </span>
                <div className="p-3 bg-[#F6F4F2] border border-[#E3DBD4] max-h-60 overflow-y-auto text-xs text-[#051F34] font-mono whitespace-pre-wrap">
                  {effectiveSubmissionPayload.bodyMarkdown}
                </div>
              </div>
            ) : (
              <div className="bg-[#F6F4F2] border border-[#E3DBD4] p-4 md:p-6 overflow-x-auto">
                <div
                  data-testid="editorial-rendered-preview"
                  className={
                    previewViewport === 'mobile_390'
                      ? 'w-[390px] max-w-full mx-auto bg-white border border-[#E3DBD4] p-4 shadow-sm space-y-5'
                      : 'max-w-3xl mx-auto bg-white border border-[#E3DBD4] p-6 md:p-8 shadow-sm space-y-6'
                  }
                >
                  <div className="flex items-center justify-between border-b border-[#E3DBD4] pb-3 text-[10px] uppercase tracking-widest text-[#69727D]">
                    <span>{effectiveSubmissionPayload.category}</span>
                    <span>
                      {isImagesPending
                        ? 'Draft Preview • Images Pending'
                        : `Draft Preview • ${attachedCount} Images Placed`}
                    </span>
                  </div>

                  <h3 className="font-serif text-2xl md:text-3xl text-[#051F34] leading-tight">
                    {effectiveSubmissionPayload.title}
                  </h3>

                  {effectiveSubmissionPayload.excerpt && (
                    <p className="text-sm text-[#69727D] italic leading-relaxed">
                      {effectiveSubmissionPayload.excerpt}
                    </p>
                  )}

                  {/* Hero Preview */}
                  {effectiveSubmissionPayload.heroImageUrl && (
                    <figure className="border border-[#E3DBD4] bg-[#FBF9F7] overflow-hidden">
                      <div className="px-3 py-1 bg-[#051F34] text-white text-[10px] uppercase tracking-widest flex items-center justify-between">
                        <span>Hero Banner</span>
                        {effectiveSubmissionPayload.images?.find((i) => i.isHero)?.sourceType ===
                          'ai_illustration' && <span>AI Illustration (Non-Catalogue)</span>}
                      </div>
                      <div className="aspect-16/9 bg-[#F6F4F2] overflow-hidden flex items-center justify-center">
                        {(() => {
                          const heroAtt = effectiveSubmissionPayload.images?.find((i) => i.isHero)
                          const heroSrc =
                            (heroAtt && previewObjectUrls[heroAtt.mediaId]) ||
                            heroAtt?.catalogueProduct?.productImageUrl ||
                            effectiveSubmissionPayload.heroImageUrl
                          return heroSrc ? (
                            <img
                              src={heroSrc}
                              alt={effectiveSubmissionPayload.heroImageAlt || 'Hero preview'}
                              className="w-full h-full object-cover"
                            />
                          ) : null
                        })()}
                      </div>
                      {(effectiveSubmissionPayload.heroImageCaption ||
                        effectiveSubmissionPayload.heroImageRights) && (
                        <figcaption className="p-3 text-xs text-[#051F34] border-t border-[#E3DBD4] space-y-1">
                          {effectiveSubmissionPayload.heroImageCaption && (
                            <p>{effectiveSubmissionPayload.heroImageCaption}</p>
                          )}
                          {effectiveSubmissionPayload.heroImageRights && (
                            <p className="text-[10px] uppercase tracking-wider text-[#69727D]">
                              {effectiveSubmissionPayload.heroImageRights}
                            </p>
                          )}
                        </figcaption>
                      )}
                    </figure>
                  )}

                  {/* Body + Interleaved Inline Images */}
                  <EditorialArticleBodyRenderer
                    bodyMarkdown={effectiveSubmissionPayload.bodyMarkdown}
                    images={effectiveSubmissionPayload.images || []}
                    resolveImageSrc={(att) =>
                      previewObjectUrls[att.mediaId] ||
                      att.catalogueProduct?.productImageUrl ||
                      att.url
                    }
                    compact={previewViewport === 'mobile_390'}
                  />
                </div>
              </div>
            )}

            {/* Submission Actions */}
            <div className="pt-4 border-t border-[#E3DBD4] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="text-[11px] text-[#69727D] space-y-0.5">
                <div>
                  <span>Publication Mode: </span>
                  <strong className="text-[#051F34]">draft_only</strong>
                  <span> (Saves isolated draft; requires separate atelier owner approval).</span>
                </div>
                <div>
                  <span>Image Status: </span>
                  <strong className={isImagesPending ? 'text-amber-700' : 'text-emerald-700'}>
                    {isImagesPending
                      ? `Images Pending (${attachedCount}/3–5 attached — text draft remains saveable)`
                      : `${attachedCount}/5 Images Ready`}
                  </strong>
                </div>
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

        {/* 5. SUBMISSION FEEDBACK & ERRORS */}
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
            {validationWarnings.length > 0 && (
              <ul className="list-disc pl-5 space-y-1 text-amber-800 pt-1">
                {validationWarnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* 6. UNCERTAIN OUTCOME NOTICE + READ-ONLY RECHECK VERIFICATION BUTTON */}
        {uncertainOutcome && (
          <div
            data-testid="verification-pending-banner"
            className="p-5 bg-amber-50 border-2 border-amber-400 text-amber-950 text-xs space-y-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-semibold text-sm text-amber-900">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <span>Save may have succeeded; verification pending</span>
              </div>
              <button
                type="button"
                id="recheckVerificationButton"
                onClick={handleRecheckVerification}
                disabled={rechecking || !token.trim()}
                className="px-4 py-2 bg-[#051F34] hover:bg-[#CB9274] text-white text-[11px] uppercase tracking-wider font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${rechecking ? 'animate-spin' : ''}`} />
                <span>{rechecking ? 'Rechecking (Read-Only)...' : 'Recheck Verification'}</span>
              </button>
            </div>
            <p className="leading-relaxed">{uncertainOutcome.message}</p>
            <div className="p-3 bg-white border border-amber-200 font-mono text-[11px] text-stone-700 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>Idempotency-Key: {uncertainOutcome.key}</div>
              {uncertainOutcome.articleId && <div>Article ID: {uncertainOutcome.articleId}</div>}
              {uncertainOutcome.slug && <div>Slug: /blog/{uncertainOutcome.slug}</div>}
              {uncertainOutcome.externalContentId && (
                <div>External Content ID: {uncertainOutcome.externalContentId}</div>
              )}
            </div>
            <p className="text-[11px] text-stone-600">
              Click <strong>Recheck Verification</strong> to perform a read-only check (<code className="font-mono">GET /api/blog/v1/articles/[id]</code>) without creating another draft.
            </p>
          </div>
        )}

        {/* 7. VERIFIED DRAFT READBACK PANEL */}
        {readback && (
          <section
            data-testid="verified-readback-panel"
            className="bg-emerald-50 border-2 border-emerald-500 p-6 space-y-4 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-emerald-900 font-serif text-lg">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Draft Verified &amp; Saved (Isolated Revision #{readback.revisionNumber})</span>
              </div>
              <span className="px-2.5 py-1 bg-white border border-emerald-300 text-emerald-800 font-mono text-[11px] font-semibold">
                status={readback.status} • live_revision_id={String(readback.liveRevisionId)}
              </span>
            </div>

            <p className="text-xs text-emerald-950 leading-relaxed">
              Independent <code className="font-mono">GET /api/blog/v1/articles/{readback.articleId}</code> readback
              verified exact saved title, body content, SEO title, meta description, media ordering, and draft lifecycle
              isolation.
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
                <span className="text-[#69727D] block text-[10px] uppercase font-sans">Media Status:</span>
                <span className={readback.imagesPending ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold'}>
                  {readback.imagesPending
                    ? `Images Pending (${readback.imagesCount}/3–5)`
                    : `${readback.imagesCount} Images Verified`}
                </span>
              </div>
            </div>

            {/* Field-by-Field Readback Verification Matrix */}
            <div className="bg-white border border-emerald-300 p-4 space-y-2 text-xs">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-[#051F34]">
                Independent Readback Verification Checks
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Title Match: {readback.titleMatches ? 'Verified' : 'Mismatch'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Body Match ({readback.bodyWordCount} words): {readback.bodyMatches ? 'Verified' : 'Mismatch'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>SEO &amp; Meta Match: {readback.seoMatches ? 'Verified' : 'Mismatch'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Media Order &amp; Captions: {readback.mediaMatches ? 'Verified' : 'Mismatch'}</span>
                </div>
              </div>

              {readback.verifiedImages.length > 0 && (
                <div className="pt-2 border-t border-emerald-100 space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-[#69727D]">
                    Saved Media References ({readback.verifiedImages.length}):
                  </div>
                  {readback.verifiedImages.map((vImg, idx) => (
                    <div key={vImg.mediaId || idx} className="font-mono text-[11px] text-[#051F34] flex flex-wrap gap-2">
                      <span>#{vImg.order}</span>
                      <span>[{vImg.sourceType}]</span>
                      <span>pos={vImg.position}</span>
                      {vImg.isHero && <span className="text-[#CB9274] font-semibold">[HERO]</span>}
                      <span className="text-[#69727D] truncate max-w-md">{vImg.url}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 bg-emerald-100/50 border border-emerald-300 text-[11px] text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <strong className="block">Storefront &amp; Public Isolation Confirmed:</strong>
                <span>
                  This draft is not live. It remains completely invisible to public storefront visitors, feeds, and
                  sitemaps until reviewed by the owner.
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
