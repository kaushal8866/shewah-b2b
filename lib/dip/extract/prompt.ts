import { createHash } from 'crypto'
import { VOCAB, GOLD_FIELDS, FIELD_HELP, IMAGE_COLOUR, VOCAB_VERSION } from '../attributes/vocabulary'

/**
 * The vision extraction prompt.
 *
 * Three rules encoded here, each because breaking it corrupts the corpus:
 *
 *  1. CLOSED VOCABULARY. The model picks from a list; free text would make
 *     every downstream count a string-matching problem.
 *
 *  2. IT IS NEVER ASKED FOR KARAT OR GOLD COLOUR as a fact. Those are already
 *     known exactly from the Shopify options. Asking a model to restate a
 *     known fact only creates opportunities to contradict it. It IS asked what
 *     colour the metal *appears* in the photograph, which is a different
 *     question and is used only to check its visual competence.
 *
 *  3. "unsure" IS ALWAYS AVAILABLE and explicitly encouraged. A model pushed
 *     to answer produces a confident guess, and a confident guess is worse
 *     than a gap because nothing downstream can tell them apart.
 */

export const PROMPT_SCHEMA_VERSION = VOCAB_VERSION

export function buildPrompt(): string {
  const fields = GOLD_FIELDS.map(f =>
    `- ${f}: one of [${VOCAB[f].join(', ')}]\n  ${FIELD_HELP[f]}`
  ).join('\n')

  return `You are cataloguing jewellery from product photographs for a manufacturer's
competitor database. Accuracy matters far more than completeness.

You will see up to three photographs of the SAME piece. Some are studio product
shots; some show the piece worn by a model, often at a distance where fine
detail is not visible. Use whichever images actually show the detail you need.

For each field, choose exactly one value from its list. Do not invent values.

${fields}

- image_colour_observed: one of [${IMAGE_COLOUR.join(', ')}]
  What colour the METAL appears in the photographs. This is a reading of the
  photograph only. Do not guess what the product might be available in.

For every field also give a confidence from 0 to 1:
  1.0  the detail is clearly visible and unambiguous
  0.6  visible but partly obscured, or a judgement call between two values
  0.3  barely visible, mostly inference
  0.0  not visible at all

RULES
- If a detail is not visible in any image, answer "unsure" with low confidence.
  That is a correct and useful answer. A confident guess is not — it cannot be
  distinguished from a real observation later.
- "none" and "unsure" mean different things and must not be swapped. Use "none"
  when the feature genuinely is not there — a plain band has no stone and no
  setting, and that is a confident observation deserving high confidence. Use
  "unsure" only when the feature may be there but you cannot see it.
- Judge only what is in the photographs. You have no other information about
  this piece, and there is no product description.
- If the piece is not a ring, still answer category correctly and use "unsure"
  for the ring-specific fields where they do not apply.

Reply with ONLY this JSON object and nothing else:
{
  "category": "...",
  "silhouette": "...",
  "stone_shape": "...",
  "setting": "...",
  "image_colour_observed": "...",
  "confidence": {
    "category": 0.0,
    "silhouette": 0.0,
    "stone_shape": 0.0,
    "setting": 0.0,
    "image_colour_observed": 0.0
  },
  "notes": "one short sentence on anything ambiguous, or empty"
}`
}

/** Identifies the exact prompt text that produced a row. */
export function promptHash(): string {
  return createHash('sha256').update(buildPrompt()).digest('hex').slice(0, 16)
}

export interface ExtractedAttributes {
  category: string
  silhouette: string
  stone_shape: string
  setting: string
  image_colour_observed: string
  confidence: Record<string, number>
  notes: string
}

/**
 * Coerce model output into the closed vocabulary.
 *
 * Anything outside the vocabulary becomes 'unsure' at confidence 0 rather than
 * being stored verbatim — an unrecognised value that reaches the database
 * silently becomes a new category in every count that follows.
 */
export function normaliseOutput(raw: any): ExtractedAttributes {
  const pick = (field: string, allowed: readonly string[]): string => {
    const v = String(raw?.[field] ?? '').trim().toLowerCase()
    return allowed.includes(v) ? v : 'unsure'
  }
  const conf = (field: string, value: string): number => {
    if (value === 'unsure') return Math.min(0.3, Number(raw?.confidence?.[field]) || 0)
    const n = Number(raw?.confidence?.[field])
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0
  }

  const out: any = { confidence: {} }
  for (const f of GOLD_FIELDS) {
    out[f] = pick(f, VOCAB[f])
    out.confidence[f] = conf(f, out[f])
  }
  out.image_colour_observed = pick('image_colour_observed', IMAGE_COLOUR)
  out.confidence.image_colour_observed = conf('image_colour_observed', out.image_colour_observed)
  out.notes = typeof raw?.notes === 'string' ? raw.notes.slice(0, 300) : ''
  return out as ExtractedAttributes
}

/**
 * Compare the photographed colour against the colours the merchant offers.
 *
 * DIAGNOSTIC ONLY — never overwrites colour_options. A mismatch is at least as
 * likely to mean the merchant photographed one colourway while offering three,
 * or that studio lighting made rhodium-plated white gold look yellow, as it is
 * to mean the model misread the image.
 */
export function colourCheck(observed: string, offered: string[] | null): 'pass' | 'mismatch' | 'uncertain' | 'n/a' {
  if (!offered || offered.length === 0) return 'n/a'
  if (observed === 'unsure') return 'uncertain'
  if (observed === 'two_tone') return 'uncertain'
  return offered.includes(observed) ? 'pass' : 'mismatch'
}
