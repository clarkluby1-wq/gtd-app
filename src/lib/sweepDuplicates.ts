import { db } from '../db/db'
import type { Action, ActionStatus } from '../db/types'
import { isProjectStalled } from './projectHealth'
import { findSimilar, flagSimilar, type Candidate } from './similar'

/** Where an existing item lives, worded to follow "Already have: <title> —". Done and trashed items are never compared. */
const STATUS_LABEL: Partial<Record<ActionStatus, string>> = {
  inbox: 'in your Inbox',
  next: 'in Next Actions',
  waiting: 'in Waiting For',
  scheduled: 'on your Calendar',
  someday: 'in Someday / Maybe',
}

/**
 * The closest thing already in the system to a title being typed or clarified right now, if it's close enough to
 * mention. Same cautious matching and same pool as the Mind Sweep check; `excludeId` keeps an item from matching itself.
 */
export async function findExistingMatch(title: string, excludeId?: string): Promise<ExistingMatch | undefined> {
  if (!title.trim()) return undefined
  const [actions, projects] = await Promise.all([
    db.actions.where('status').anyOf(Object.keys(STATUS_LABEL)).toArray(),
    db.projects.where('status').anyOf('active', 'someday').toArray(),
  ])
  // Needed to tell a project that's moving from one with no next action — everything done or never started counts.
  const allActions = await db.actions.toArray()
  const candidates: ExistingMatch[] = [
    ...actions
      .filter((a) => a.id !== excludeId)
      .map((a): ExistingMatch => ({
        kind: 'action',
        id: a.id,
        title: a.title,
        label: STATUS_LABEL[a.status] ?? 'in your system',
      })),
    ...projects.map((p): ExistingMatch => ({
      kind: 'project',
      id: p.id,
      title: p.title,
      label: p.status === 'someday' ? 'in Someday / Maybe (a project)' : 'in Projects',
      projectActive: p.status === 'active',
      projectStalled: isProjectStalled(p, allActions),
    })),
  ]
  const match = findSimilar(title, candidates)
  if (!match) return undefined
  const { score: _score, ...rest } = match
  return rest
}

/** What a similar item turned out to be: another item, or a project (and whether that project has anything next). */
export interface ExistingMatch extends Candidate {
  kind: 'action' | 'project'
  id: string
  projectActive?: boolean
  /** A project with nothing next or pending — this item could be the step it's missing. */
  projectStalled?: boolean
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
