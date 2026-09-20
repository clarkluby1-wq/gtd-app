import { db } from '../db/db'
import type { Action, ActionStatus } from '../db/types'
import { flagSimilar, type Candidate } from './similar'

/** Where an existing item lives, worded to follow "Already have: <title> —". Done and trashed items are never compared. */
const STATUS_LABEL: Partial<Record<ActionStatus, string>> = {
  inbox: 'in your Inbox',
  next: 'in Next Actions',
  waiting: 'in Waiting For',
  scheduled: 'on your Calendar',
  someday: 'in Someday / Maybe',
}

export interface SweepDuplicate {
  item: Action
  /** The closest thing already in the system. */
  match: Candidate
}

/**
 * Which Mind Sweep items look like something that is already in the system. Compares against active items and
 * projects only, never against the sweep's own items. Suggests at most five, most convincing first.
 */
export async function findSweepDuplicates(sweepItems: Action[]): Promise<SweepDuplicate[]> {
  if (sweepItems.length === 0) return []
  const sweepIds = new Set(sweepItems.map((a) => a.id))

  const [actions, projects] = await Promise.all([
    db.actions.where('status').anyOf(Object.keys(STATUS_LABEL)).toArray(),
    db.projects.where('status').anyOf('active', 'someday').toArray(),
  ])

  const candidates: Candidate[] = [
    ...actions
      .filter((a) => !sweepIds.has(a.id))
      .map((a) => ({ title: a.title, label: STATUS_LABEL[a.status] ?? 'in your system' })),
    ...projects.map((p) => ({ title: p.title, label: p.status === 'someday' ? 'in Someday / Maybe (a project)' : 'in Projects' })),
  ]

  return flagSimilar(sweepItems, candidates).map(({ item, match }) => ({
    item,
    match: { title: match.title, label: match.label },
  }))
}
