/** Parse a `<input type="date">` value ("YYYY-MM-DD") as local midnight, not UTC. */
export function parseLocalDate(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).getTime()
}

export function startOfToday(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
