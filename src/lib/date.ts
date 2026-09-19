/** Parse a `<input type="date">` value ("YYYY-MM-DD") as local midnight, not UTC. */
export function parseLocalDate(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).getTime()
}

/** "Sep 10", or "Sep 10, 2025" when it isn't this year, so an old date is never ambiguous. */
export function formatShortDate(timestamp: number): string {
  const d = new Date(timestamp)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(undefined, sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Format a timestamp as the local "YYYY-MM-DD" an `<input type="date">` expects. */
export function toDateInputValue(timestamp?: number): string {
  if (timestamp === undefined) return ''
  const d = new Date(timestamp)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

export function startOfDay(timestamp: number): number {
  const d = new Date(timestamp)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function startOfToday(): number {
  return startOfDay(Date.now())
}
