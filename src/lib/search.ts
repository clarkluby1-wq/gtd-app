/** Lowercased and accent-folded, so "cafe" finds "Café". */
export function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function tokenize(query: string): string[] {
  return normalize(query).split(/\s+/).filter(Boolean)
}

/** True when every token appears somewhere across the given fields — order and field don't matter. */
export function matchesAll(tokens: string[], ...fields: (string | undefined)[]): boolean {
  const haystack = normalize(fields.filter(Boolean).join('\n'))
  return tokens.every((t) => haystack.includes(t))
}

export function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function snippetAround(text: string, tokens: string[], radius = 50): string {
  const lower = text.toLowerCase()
  let idx = -1
  for (const t of tokens) {
    const i = lower.indexOf(t)
    if (i !== -1 && (idx === -1 || i < idx)) idx = i
  }
  const start = idx === -1 ? 0 : Math.max(0, idx - radius)
  const end = Math.min(text.length, (idx === -1 ? 0 : idx) + radius * 2)
  return (
    (start > 0 ? '…' : '') + text.slice(start, end).replace(/\s+/g, ' ').trim() + (end < text.length ? '…' : '')
  )
}

/** A short excerpt from the first field that contains any token — shows *why* something matched. */
export function matchSnippet(tokens: string[], fields: (string | undefined)[]): string | undefined {
  for (const field of fields) {
    if (!field) continue
    const n = normalize(field)
    if (tokens.some((t) => n.includes(t))) return snippetAround(field, tokens)
  }
  return undefined
}
