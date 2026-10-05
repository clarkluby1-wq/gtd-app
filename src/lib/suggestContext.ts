import { stem } from './similar'

/**
 * A quiet guess at which context fits an item, from its wording. It only ever suggests — the picker still starts
 * where it always did. Two sources, nothing leaves the device:
 *  1. Your own history: which context you gave past items that shared a word with this one. This is the main
 *     source, and it improves as you clarify more.
 *  2. A small starter list of unmistakable words, for ones you haven't used yet.
 * It stays silent unless it's fairly sure.
 */

/** Words that say a lot about where something happens. Deliberately short and unambiguous; your history covers the rest. */
const STARTER_WORDS: Record<string, string[]> = {
  '@home': [
    'clean', 'tidy', 'litter', 'kitchen', 'lawn', 'mow', 'laundry', 'dish', 'dishwasher', 'vacuum', 'garage', 'rake',
    'garden', 'weed', 'bathroom', 'bedroom', 'trash', 'garbage', 'recycling', 'fridge', 'sweep', 'mop', 'declutter',
    'closet', 'basement', 'attic', 'yard', 'shovel',
  ],
  '@computer': [
    'apply', 'application', 'resume', 'email', 'online', 'website', 'research', 'spreadsheet', 'invoice', 'bill',
    'password', 'login', 'download', 'upload', 'install', 'backup', 'submit',
  ],
  '@calls': ['call', 'phone', 'ring', 'voicemail'],
  '@errands': ['pharmacy', 'grocery', 'store', 'prescription', 'costco', 'hardware', 'mall'],
}

// Function words carry no signal. Action verbs like "call" and "email" do, so unlike the duplicate check they stay in.
const FILLER = new Set(
  'the and for with from into onto about this that these those there here you your our their its are was were has had have will would can could not but out off down over under again then than too very just also still own same'.split(
    ' ',
  ),
)

export function contextWords(title: string): string[] {
  return [
    ...new Set(
      title
        .toLowerCase()
        .replace(/['’]s\b/g, '')
        .split(/[^\p{L}\p{N}]+/u)
        .filter((w) => w.length >= 3 && !FILLER.has(w))
        .map(stem),
    ),
  ]
}

const STARTER = new Map<string, string>()
for (const [contextName, words] of Object.entries(STARTER_WORDS)) {
  for (const w of words) STARTER.set(stem(w), contextName)
}

const STARTER_WEIGHT = 0.7
/** Needed to speak up at all, and a clear lead over the runner-up. */
const MIN_SCORE = 0.65
const CLEAR_LEAD = 1.5

export interface ContextChoice {
  id: string
  name: string
}

/** The context id that most likely fits, or undefined when it isn't sure enough to say. */
export function suggestContextId(
  title: string,
  contexts: ContextChoice[],
  history: { title: string; contextId?: string }[],
): string | undefined {
  const words = contextWords(title)
  if (words.length === 0 || contexts.length === 0) return undefined
  const known = new Set(contexts.map((c) => c.id))
  const wordSet = new Set(words)

  // Per word: how many past items used it, and which contexts they were given.
  const seen = new Map<string, { total: number; byContext: Map<string, number> }>()
  for (const h of history) {
    if (!h.contextId || !known.has(h.contextId)) continue
    for (const w of contextWords(h.title)) {
      if (!wordSet.has(w)) continue
      const entry = seen.get(w) ?? { total: 0, byContext: new Map<string, number>() }
      entry.total++
      entry.byContext.set(h.contextId, (entry.byContext.get(h.contextId) ?? 0) + 1)
      seen.set(w, entry)
    }
  }

  const score = new Map<string, number>()
  const add = (id: string, amount: number) => score.set(id, (score.get(id) ?? 0) + amount)

  // One past example is a hint, three or more is a habit.
  for (const entry of seen.values()) {
    const confidence = Math.min(entry.total, 3) / 3
    for (const [id, n] of entry.byContext) add(id, (n / entry.total) * confidence)
  }

  const byName = new Map(contexts.map((c) => [c.name.toLowerCase().replace(/^@/, ''), c.id]))
  for (const w of words) {
    const starterName = STARTER.get(w)
    const id = starterName ? byName.get(starterName.replace(/^@/, '')) : undefined
    if (id) add(id, STARTER_WEIGHT)
  }

  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1])
  const [top, second] = ranked
  if (!top || top[1] < MIN_SCORE) return undefined
  if (second && top[1] < second[1] * CLEAR_LEAD) return undefined
  return top[0]
}
