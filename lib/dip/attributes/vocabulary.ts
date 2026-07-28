/**
 * The closed vocabulary for extracted attributes.
 *
 * ONE definition, used by both the human labelling sheet and the vision
 * extractor's prompt. If those two drift apart the gold set stops measuring
 * the extractor and starts measuring the mismatch between two word lists.
 *
 * Terms are taken from the DIP v5 attribute vector. Ring-relevant values only
 * where a dimension is large — the pilot is rings, and offering a labeller
 * twenty irrelevant silhouettes makes the task slower and the labels worse.
 *
 * `unsure` exists on every dimension on purpose. A labeller forced to choose
 * produces a confident wrong label, which is worse than a recorded gap: it
 * silently penalises an extractor that was right.
 */

export const VOCAB_VERSION = 'attr-v1'

export const CATEGORY = [
  'ring', 'earring', 'pendant', 'necklace', 'bracelet',
  'mangalsutra', 'nose', 'set', 'other', 'unsure',
] as const

/** Ring-relevant silhouettes from the spec, plus a plain band. */
export const SILHOUETTE = [
  'solitaire', 'halo', 'hidden-halo', 'three-stone', 'toi-et-moi',
  'cluster', 'eternity', 'half-eternity', 'band', 'bar',
  'other', 'unsure',
] as const

export const STONE_SHAPE = [
  'round', 'oval', 'emerald', 'pear', 'marquise', 'cushion', 'radiant',
  'princess', 'baguette', 'asscher', 'heart', 'rose-cut', 'elongated-cushion',
  'mixed', 'none', 'other', 'unsure',
] as const

export const SETTING = [
  'prong4', 'prong6', 'bezel', 'half-bezel', 'pave', 'micro-pave',
  'channel', 'bar', 'tension', 'illusion', 'flush',
  // 'none' is NOT a synonym for 'unsure'. A plain band genuinely has no
  // setting; that is a determined fact. Without this value the first pilot run
  // forced every plain band to 'unsure', which reads downstream as "we could
  // not see" and would have made the field look far weaker than it is.
  'none',
  'mixed', 'other', 'unsure',
] as const

/** Gold colours a photograph can show. Validation only — never canonical. */
export const IMAGE_COLOUR = ['yellow', 'white', 'rose', 'two_tone', 'unsure'] as const

/** How certain the human labeller was. Distinct from the model's confidence. */
export const LABEL_CONFIDENCE = ['certain', 'probable', 'unsure'] as const

/** The four fields the gold set labels. Deliberately not all seven. */
export const GOLD_FIELDS = ['category', 'silhouette', 'stone_shape', 'setting'] as const

export type GoldField = typeof GOLD_FIELDS[number]

export const VOCAB: Record<GoldField, readonly string[]> = {
  category: CATEGORY,
  silhouette: SILHOUETTE,
  stone_shape: STONE_SHAPE,
  setting: SETTING,
}

/**
 * Short definitions, shown in the labelling sheet and given to the model.
 *
 * Both sides need the same definition of "halo", or disagreement measures
 * vocabulary rather than vision.
 */
export const FIELD_HELP: Record<GoldField, string> = {
  category: 'What kind of jewellery is this?',
  silhouette: 'Overall stone arrangement. solitaire = one centre stone alone. ' +
    'halo = centre stone ringed by smaller stones. hidden-halo = halo visible only from the side. ' +
    'three-stone = one centre plus one either side. eternity = stones all the way round. ' +
    'half-eternity = stones across the front only. band = plain or textured, no centre stone.',
  stone_shape: 'Shape of the CENTRE stone. Use "none" for a plain band, ' +
    '"mixed" when several shapes share the piece with no clear centre.',
  setting: 'How the centre stone is held. prong4/prong6 = claws, counted. ' +
    'bezel = metal rim fully around. half-bezel = rim on two sides. ' +
    'pave/micro-pave = tiny stones set flush in the metal. channel = stones between two rails. ' +
    'tension = stone appears squeezed between two ends, no visible claws. ' +
    'Use "none" for a plain band with no stones at all — that is different from ' +
    '"unsure", which means stones are present but you cannot make out how they are held.',
}
