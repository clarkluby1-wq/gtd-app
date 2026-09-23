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

/**
 * The hour a new "workday" begins — later than midnight, so working past midnight doesn't reset things
 * mid-session. Only concepts that are really about *your* day (Today's Short List, Start My Day, daily
 * counts, the Weekly Review prompt, ...) use this. Calendar dates and times — a scheduled item's actual
 * day, a due date, a follow-up date — stay literal and keep using startOfDay / startOfToday above.
 */
const WORKDAY_START_HOUR = 4
const WORKDAY_START_MINUTE = 30

/** Start of the workday containing `timestamp` (defaults to now): that day at 4:30am, or the day before's
 *  4:30am if it's not 4:30am yet. Two moments before and after the boundary but on the same real calendar
 *  day still land in different workdays; two moments either side of midnight but before 4:30am land in
 *  the same one. */
export function startOfWorkday(timestamp: number = Date.now()): number {
  const d = new Date(timestamp)
  d.setHours(WORKDAY_START_HOUR, WORKDAY_START_MINUTE, 0, 0)
  if (d.getTime() > timestamp) {
    d.setDate(d.getDate() - 1)
  }
  return d.getTime()
}

/** The workday immediately before the one containing `timestamp` (defaults to now). Uses calendar-day
 *  arithmetic (not a fixed 24h subtraction), so it stays correct across a DST change. */
export function previousWorkdayStart(timestamp: number = Date.now()): number {
  const d = new Date(startOfWorkday(timestamp))
  d.setDate(d.getDate() - 1)
  return d.getTime()
}
