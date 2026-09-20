import { db } from '../db/db'
import type { Action, ActionStatus } from '../db/types'
import { flagSimilar, type Candidate } from './similar'

/** What each kind of existing item is called on screen. Done and trashed items are never compared. */
const STATUS_LABEL: Partial<Record<ActionStatus, string>> = {
  inbox: 'Inbox',
  next: 'Next Action',
  waiting: 'Waiting For',
  scheduled: 'Scheduled',
  someday: 'Someday',
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
      .map((a) => ({ title: a.title, label: STATUS_LABEL[a.status] ?? 'Item' })),
    ...projects.map((p) => ({ title: p.title, label: p.status === 'someday' ? 'Someday project' : 'Project' })),
  ]

  return flagSimilar(sweepItems, candidates).map(({ item, match }) => ({
    item,
    match: { title: match.title, label: match.label },
  }))
}
