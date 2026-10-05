import type { Action } from '../db/types'

export function ageInDays(timestamp: number) {
  return Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24))
}

export function ageLabel(days: number) {
  if (days === 0) return 'today'
  if (days === 1) return '1 day'
  return `${days} days`
}

/** Days since this was last created, edited, or reclarified. */
export function daysUntouched(a: Action) {
  return ageInDays(a.touchedAt ?? a.clarifiedAt ?? a.createdAt)
}

/** Untouched for more than this many days counts as stale. */
export const STALE_AFTER_DAYS = 7

/** Next Actions untouched (created, edited, or reclarified) for more than 7 days. */
export function staleNextActions(actions: Action[], somedayProjectIds: Set<string>) {
  return actions
    .filter((a) => a.status === 'next')
    .filter((a) => !a.projectId || !somedayProjectIds.has(a.projectId))
    .map((a) => ({ action: a, days: daysUntouched(a) }))
    .filter((x) => x.days > STALE_AFTER_DAYS)
}
