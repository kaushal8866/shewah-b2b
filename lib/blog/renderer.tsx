import React from 'react'
import {
  AI_ILLUSTRATION_DISCLAIMER,
  BlogMediaAttachment,
  BlogMediaPlacement,
} from './types'

export function isSafeRenderLinkUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false
  const trimmed = rawUrl.trim()
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return true
  }
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * Renders inline Markdown formatting (bold, italic, and validated safe links) as React nodes
 * without using dangerouslySetInnerHTML.
 */
export function renderInlineMarkdown(text: string): React.ReactNode[] {
  if (!text) return []
  const nodes: React.ReactNode[] = []
  // Match markdown links [label](url) or bold **text**
  const tokenRegex = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let keyIdx = 0

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    if (match[1] !== undefined && match[2] !== undefined) {
      const label = match[1]
      const rawUrl = match[2].trim()
      if (isSafeRenderLinkUrl(rawUrl)) {
        const isInternal = rawUrl.startsWith('/') || rawUrl.startsWith('https://shewah.co')
        nodes.push(
          <a
            key={`link-${keyIdx++}`}
            href={rawUrl}
            target={isInternal ? undefined : '_blank'}
            rel={isInternal ? undefined : 'noopener noreferrer'}
            className="text-[#051F34] underline decoration-[#CB9274] underline-offset-4 hover:text-[#CB9274] font-medium transition-colors"
          >
            {label}
          </a>
        )
      } else {
        nodes.push(<span key={`txt-${keyIdx++}`}>{label}</span>)
      }
    } else if (match[3] !== undefined) {
      nodes.push(
        <strong key={`bold-${keyIdx++}`} className="font-semibold text-[#051F34]">
          {match[3]}
        </strong>
      )
    }

    lastIndex = tokenRegex.lastIndex
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}

export function ensureAiDisclaimerCaption(caption?: string | null): string {
  const trimmed = (caption || '').trim()
  if (!trimmed) return AI_ILLUSTRATION_DISCLAIMER
  if (trimmed.toLowerCase().includes('ai-generated illustration')) {
    return trimmed
  }
  return `${trimmed} — ${AI_ILLUSTRATION_DISCLAIMER}`
}

export interface EditorialMediaFigureProps {
  attachment: BlogMediaAttachment
  resolvedSrc?: string
  compact?: boolean
}

export function EditorialMediaFigure({
  attachment,
  resolvedSrc,
  compact = false,
}: EditorialMediaFigureProps) {
  const src =
    resolvedSrc ||
    attachment.catalogueProduct?.productImageUrl ||
    attachment.url

  if (attachment.sourceType === 'catalogue_product' && attachment.catalogueProduct) {
    const prod = attachment.catalogueProduct
    const safeProductUrl = isSafeRenderLinkUrl(prod.productUrl) ? prod.productUrl : '#'
    return (
      <figure
        data-testid={`editorial-media-${attachment.order}`}
        data-source-type="catalogue_product"
        className="my-8 border border-[#E3DBD4] bg-white overflow-hidden shadow-xs"
      >
        <div className="px-4 py-2 bg-[#051F34] text-white flex items-center justify-between text-[10px] uppercase tracking-[0.18em]">
          <span>Shewah Archive &amp; Catalogue Piece</span>
          {prod.productCode && <span className="font-mono text-[#CB9274]">{prod.productCode}</span>}
        </div>
        <div className={compact ? 'p-4 space-y-4' : 'grid grid-cols-1 sm:grid-cols-12 gap-5 p-5 items-center'}>
          <div className={compact ? 'w-full' : 'sm:col-span-5'}>
            <div className="aspect-4/3 bg-[#F6F4F2] border border-[#E3DBD4] overflow-hidden flex items-center justify-center">
              {src ? (
                <img
                  src={src}
                  alt={attachment.altText}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="text-[11px] text-[#69727D] px-3 text-center">
                  Catalogue preview loading...
                </span>
              )}
            </div>
          </div>
          <figcaption className={compact ? 'space-y-2.5' : 'sm:col-span-7 space-y-2.5'}>
            <div className="text-[10px] uppercase tracking-widest text-[#CB9274] font-semibold">
              Verified Storefront Reference
            </div>
            <h4 className="font-serif text-lg text-[#051F34] leading-snug">
              {prod.productName}
            </h4>
            {attachment.caption && (
              <p className="text-xs text-[#69727D] leading-relaxed">
                {attachment.caption}
              </p>
            )}
            <div className="pt-1 flex flex-wrap items-center gap-3">
              <a
                href={safeProductUrl}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#051F34] text-white text-[11px] uppercase tracking-wider hover:bg-[#CB9274] transition-colors"
              >
                <span>View Catalogue Piece</span>
                <span aria-hidden="true">&rarr;</span>
              </a>
              <span className="text-[10px] font-mono text-[#69727D] break-all">
                {prod.productUrl}
              </span>
            </div>
            {attachment.rightsNote && (
              <p className="text-[10px] text-[#69727D] italic">
                {attachment.rightsNote}
              </p>
            )}
          </figcaption>
        </div>
      </figure>
    )
  }

  if (attachment.sourceType === 'ai_illustration') {
    const captionWithDisclaimer = ensureAiDisclaimerCaption(attachment.caption)
    return (
      <figure
        data-testid={`editorial-media-${attachment.order}`}
        data-source-type="ai_illustration"
        className="my-8 border border-[#E3DBD4] bg-[#FBF9F7] overflow-hidden"
      >
        <div className="px-4 py-1.5 bg-[#F3EFEA] border-b border-[#E3DBD4] flex items-center justify-between text-[10px] uppercase tracking-wider text-[#69727D]">
          <span className="font-semibold text-[#051F34]">Editorial Concept / Diagram</span>
          <span>AI Illustration (Non-Catalogue)</span>
        </div>
        <div className="aspect-16/10 bg-[#F6F4F2] overflow-hidden flex items-center justify-center">
          {src ? (
            <img
              src={src}
              alt={attachment.altText}
              className="w-full h-full object-cover"
              loading={attachment.isHero ? 'eager' : 'lazy'}
              fetchPriority={attachment.isHero ? 'high' : undefined}
            />
          ) : (
            <span className="text-xs text-[#69727D] px-4 text-center">
              Private draft illustration preview
            </span>
          )}
        </div>
        <figcaption className="p-4 bg-[#FBF9F7] border-t border-[#E3DBD4] space-y-1">
          <p className="text-xs text-[#051F34] leading-relaxed font-medium">
            {captionWithDisclaimer}
          </p>
          {attachment.rightsNote && (
            <p className="text-[10px] uppercase tracking-wider text-[#69727D]">
              {attachment.rightsNote}
            </p>
          )}
        </figcaption>
      </figure>
    )
  }

  // Default: studio_photography
  return (
    <figure
      data-testid={`editorial-media-${attachment.order}`}
      data-source-type="studio_photography"
      className="my-8 border border-[#E3DBD4] bg-white overflow-hidden"
    >
      <div className="aspect-16/10 bg-[#F6F4F2] overflow-hidden flex items-center justify-center">
        {src ? (
          <img
            src={src}
            alt={attachment.altText}
            className="w-full h-full object-cover"
            loading={attachment.isHero ? 'eager' : 'lazy'}
            fetchPriority={attachment.isHero ? 'high' : undefined}
          />
        ) : (
          <span className="text-xs text-[#69727D] px-4 text-center">
            Private draft image preview
          </span>
        )}
      </div>
      {(attachment.caption || attachment.rightsNote) && (
        <figcaption className="p-3.5 bg-[#F6F4F2] border-t border-[#E3DBD4] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-[#69727D]">
          {attachment.caption && <span>{attachment.caption}</span>}
          {attachment.rightsNote && (
            <span className="text-[10px] uppercase tracking-wider">{attachment.rightsNote}</span>
          )}
        </figcaption>
      )}
    </figure>
  )
}

/**
 * Splits markdown blocks and interleaves inline images at their exact requested body placements
 * (`after_intro`, `after_section_1`, `after_section_2`, `after_section_3`, `after_section_4`, `before_conclusion`).
 */
export function EditorialArticleBodyRenderer({
  bodyMarkdown,
  images = [],
  resolveImageSrc,
  compact = false,
}: {
  bodyMarkdown: string
  images?: BlogMediaAttachment[]
  resolveImageSrc?: (attachment: BlogMediaAttachment) => string | undefined
  compact?: boolean
}) {
  const rawBlocks = (bodyMarkdown || '')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)

  const orderedInlineImages = [...images]
    .filter((img) => img && img.position !== 'hero_only')
    .sort((a, b) => (a.order || 0) - (b.order || 0))

  const byPosition: Record<BlogMediaPlacement, BlogMediaAttachment[]> = {
    hero_only: [],
    after_intro: [],
    after_section_1: [],
    after_section_2: [],
    after_section_3: [],
    after_section_4: [],
    before_conclusion: [],
  }

  for (const img of orderedInlineImages) {
    const pos = byPosition[img.position] ? img.position : 'after_section_1'
    byPosition[pos].push(img)
  }

  // Identify heading indices (`## `) to place section images accurately
  const headingIndices: number[] = []
  rawBlocks.forEach((b, idx) => {
    if (b.startsWith('## ') || b.startsWith('### ')) {
      headingIndices.push(idx)
    }
  })

  // Compute block index after which each placement slot should render
  const totalBlocks = rawBlocks.length
  const getTargetBlockIndex = (slot: BlogMediaPlacement): number => {
    if (totalBlocks === 0) return 0
    if (slot === 'after_intro') {
      return headingIndices.length > 0 ? Math.max(0, headingIndices[0] - 1) : 0
    }
    if (slot === 'after_section_1') {
      if (headingIndices.length >= 2) return Math.max(0, headingIndices[1] - 1)
      return Math.min(totalBlocks - 1, Math.max(0, Math.floor(totalBlocks * 0.25)))
    }
    if (slot === 'after_section_2') {
      if (headingIndices.length >= 3) return Math.max(0, headingIndices[2] - 1)
      return Math.min(totalBlocks - 1, Math.max(0, Math.floor(totalBlocks * 0.5)))
    }
    if (slot === 'after_section_3') {
      if (headingIndices.length >= 4) return Math.max(0, headingIndices[3] - 1)
      return Math.min(totalBlocks - 1, Math.max(0, Math.floor(totalBlocks * 0.7)))
    }
    if (slot === 'after_section_4') {
      if (headingIndices.length >= 5) return Math.max(0, headingIndices[4] - 1)
      return Math.min(totalBlocks - 1, Math.max(0, Math.floor(totalBlocks * 0.85)))
    }
    if (slot === 'before_conclusion') {
      if (headingIndices.length >= 1) {
        const lastHeading = headingIndices[headingIndices.length - 1]
        return Math.max(0, lastHeading - 1)
      }
      return Math.max(0, totalBlocks - 2)
    }
    return totalBlocks - 1
  }

  const attachmentsAfterBlock = new Map<number, BlogMediaAttachment[]>()
  const slots: BlogMediaPlacement[] = [
    'after_intro',
    'after_section_1',
    'after_section_2',
    'after_section_3',
    'after_section_4',
    'before_conclusion',
  ]

  for (const slot of slots) {
    const slotImages = byPosition[slot]
    if (slotImages.length === 0) continue
    const targetIdx = getTargetBlockIndex(slot)
    const list = attachmentsAfterBlock.get(targetIdx) || []
    list.push(...slotImages)
    attachmentsAfterBlock.set(targetIdx, list)
  }

  const renderBlock = (block: string, idx: number) => {
    if (block.startsWith('## ')) {
      return (
        <h2
          key={`b-${idx}`}
          className={
            compact
              ? 'font-serif text-xl text-[#051F34] pt-4 pb-1 leading-snug'
              : 'font-serif text-2xl md:text-3xl text-[#051F34] pt-6 pb-2 leading-snug'
          }
        >
          {renderInlineMarkdown(block.slice(3))}
        </h2>
      )
    }
    if (block.startsWith('### ')) {
      return (
        <h3
          key={`b-${idx}`}
          className={
            compact
              ? 'font-serif text-lg text-[#051F34] pt-3 pb-1 leading-snug'
              : 'font-serif text-xl md:text-2xl text-[#051F34] pt-4 pb-1 leading-snug'
          }
        >
          {renderInlineMarkdown(block.slice(4))}
        </h3>
      )
    }
    if (block.startsWith('> ')) {
      return (
        <blockquote
          key={`b-${idx}`}
          className="border-l-2 border-[#CB9274] pl-5 py-2 my-5 italic font-serif text-base md:text-lg text-[#051F34] bg-[#FBF9F7]"
        >
          {renderInlineMarkdown(block.slice(2))}
        </blockquote>
      )
    }
    const lines = block.split('\n')
    if (lines.every((l) => /^[-*]\s+/.test(l.trim()))) {
      return (
        <ul key={`b-${idx}`} className="list-disc pl-6 space-y-2 text-[#051F34]/90">
          {lines.map((line, li) => (
            <li key={li} className="leading-relaxed">
              {renderInlineMarkdown(line.trim().replace(/^[-*]\s+/, ''))}
            </li>
          ))}
        </ul>
      )
    }
    if (lines.every((l) => /^\d+\.\s+/.test(l.trim()))) {
      return (
        <ol key={`b-${idx}`} className="list-decimal pl-6 space-y-2 text-[#051F34]/90">
          {lines.map((line, li) => (
            <li key={li} className="leading-relaxed">
              {renderInlineMarkdown(line.trim().replace(/^\d+\.\s+/, ''))}
            </li>
          ))}
        </ol>
      )
    }
    return (
      <p key={`b-${idx}`} className="leading-relaxed text-[#051F34]/90">
        {renderInlineMarkdown(block)}
      </p>
    )
  }

  if (rawBlocks.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-xs italic text-[#69727D]">No body content entered yet.</p>
        {orderedInlineImages.map((img) => (
          <EditorialMediaFigure
            key={img.mediaId || img.order}
            attachment={img}
            resolvedSrc={resolveImageSrc ? resolveImageSrc(img) : undefined}
            compact={compact}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={compact ? 'space-y-4 text-sm' : 'space-y-6 text-base md:text-lg font-light'}>
      {rawBlocks.map((block, idx) => {
        const afterImages = attachmentsAfterBlock.get(idx) || []
        return (
          <React.Fragment key={`frag-${idx}`}>
            {renderBlock(block, idx)}
            {afterImages.map((img) => (
              <EditorialMediaFigure
                key={`${img.mediaId}-${img.order}`}
                attachment={img}
                resolvedSrc={resolveImageSrc ? resolveImageSrc(img) : undefined}
                compact={compact}
              />
            ))}
          </React.Fragment>
        )
      })}
    </div>
  )
}
