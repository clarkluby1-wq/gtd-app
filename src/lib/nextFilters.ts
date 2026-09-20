import type { Action, EnergyLevel } from '../db/types'

/** What you can actually do right now: where you are, how much energy you have, how long you've got. */
export interface NextFilters {
  /** A context id, "none" (no context), or "all". */
  contextId: string
  energy: EnergyLevel | 'all'
  maxTime: number | 'all'
}

export const NO_FILTERS: NextFilters = { contextId: 'all', energy: 'all', maxTime: 'all' }

/**
 * Shared by Next Actions and Focus, so the two can never disagree about what "fits".
 * Unset energy/time means "unknown", not "doesn't fit" — an untagged action always stays in.
 */
export function matchesNextFilters(a: Action, f: NextFilters): boolean {
  if (f.contextId === 'none' && a.contextId) return false
  if (f.contextId !== 'all' && f.contextId !== 'none' && a.contextId !== f.contextId) return false
  if (f.energy !== 'all' && a.energy !== undefined && a.energy !== f.energy) return false
  if (f.maxTime !== 'all' && a.timeEstimateMin != null && a.timeEstimateMin > f.maxTime) return false
  return true
}

/** "@computer · low energy · ≤ 30 min", or "" when nothing is filtered. */
export function describeFilters(f: NextFilters, contextName?: string): string {
  const parts: string[] = []
  if (f.contextId === 'none') parts.push('no context')
  else if (f.contextId !== 'all') parts.push(contextName ?? 'one context')
  if (f.energy !== 'all') parts.push(`${f.energy} energy`)
  if (f.maxTime !== 'all') parts.push(`≤ ${f.maxTime} min`)
  return parts.join(' · ')
}
