/**
 * Cautious "these look like the same thing" matching, used at the end of a Mind Sweep. It compares the meaningful
 * words of two short titles (names, nouns — not filler like "need to", "call", "about"), so it catches a shared
 * person or subject, and misses pure rewordings ("book teeth cleaning" vs "call the dentist"). That trade is
 * deliberate: a missed duplicate costs nothing, a false alarm is one more thing to think about.
 * Nothing here decides anything — it only suggests.
 */

/** Everyday filler, plus generic action verbs — "call Sam" and "call Craig" must not look alike. */
const STOP = new Set(
  (
    'a an the and or but if so of to in on at by for with from into onto over under about around after before as up out ' +
    'off down back again then than this that these those there here it its i me my mine we our you your he him his she ' +
    'her they them their what which who whom whose when where why how is are was were be been being am do does did doing ' +
    'done have has had having will would shall should can could may might must not no yes just also very really maybe ' +
    'please some any all more most much many few other another each every both either neither only own same too now ' +
    'still already even ever once while until since because though although however need needs needed needing want ' +
    'wants wanted wanting get gets got getting go goes going went gone make makes made making take takes took taking ' +
    'put puts set sets try tries tried trying remember remind reminder think thinking look looks looking see seen say ' +
    'said tell told ask asked call called calling phone email emailed text texted message messaged contact contacted ' +
    'reach reached talk talked speak spoke follow followed check checked find found buy bought pick picked send sent ' +
    'give gave let lets keep kept start started finish finished work working use using fix fixed fixing thing things ' +
    'stuff something anything everything someone anyone lot lots bit kind sort way time times new next'
  ).split(' '),
)

/** Just enough to treat "jobs"/"job" and "painting"/"paint" alike. Only needs to be consistent on both sides. */
function stem(word: string): string {
  let w = word
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y'
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3)
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2)
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1)
  return w
}

/** The distinctive words of a title. */
export function meaningfulWords(title: string): Set<string> {
  const words = title
    .toLowerCase()
    .replace(/['’]s\b/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .map(stem)
  return new Set(words)
}

export interface Candidate {
  title: string
  /** Where it lives, in words the user knows: "Next Action", "Waiting For", "Project"… */
  label: string
}

export interface SimilarMatch extends Candidate {
  /** Higher is closer. Only used to pick the best match and to order the list. */
  score: number
}

/**
 * The closest existing item, if it is close enough to mention. "Close enough" means at least two meaningful words
 * in common that make up at least half of the shorter title, or an identical set of meaningful words.
 */
export function findSimilar(title: string, candidates: Candidate[]): SimilarMatch | undefined {
  const mine = meaningfulWords(title)
  if (mine.size === 0) return undefined

  let best: SimilarMatch | undefined
  for (const candidate of candidates) {
    const theirs = meaningfulWords(candidate.title)
    if (theirs.size === 0) continue
    let shared = 0
    for (const word of mine) if (theirs.has(word)) shared++
    if (shared === 0) continue

    const smaller = Math.min(mine.size, theirs.size)
    const strong = (shared >= 2 && shared / smaller >= 0.5) || (shared === mine.size && shared === theirs.size)
    if (!strong) continue

    const score = shared + shared / smaller
    if (!best || score > best.score) best = { ...candidate, score }
  }
  return best
}

/** Items that have a close match, most convincing first, and never more than `max` so it can't become a chore. */
export function flagSimilar<T extends { title: string }>(
  items: T[],
  candidates: Candidate[],
  max = 5,
): { item: T; match: SimilarMatch }[] {
  return items
    .map((item) => ({ item, match: findSimilar(item.title, candidates) }))
    .filter((x): x is { item: T; match: SimilarMatch } => x.match !== undefined)
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, max)
}
