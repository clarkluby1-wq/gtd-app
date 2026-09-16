import type { Action } from '../db/types'

export function ageInDays(timestamp: number) {
  return Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24))
}

/** Next Actions untouched (created, edited, or reclarified) for more than 7 days. */
export function staleNextActions(actions: Action[], somedayProjectIds: Set<string>) {
  return actions
    .filter((a) => a.status === 'next')
    .filter((a) => !a.projectId || !somedayProjectIds.has(a.projectId))
    .map((a) => ({ action: a, days: ageInDays(a.touchedAt ?? a.clarifiedAt ?? a.createdAt) }))
    .filter((x) => x.days > 7)
}
