import { db } from '../db/db'
import type { Action, ActionStatus } from '../db/types'
import { celebrate, getCelebrationLevel, originOf } from './celebrate'
import { startOfWorkday } from './date'

/** Parked (someday) actions aren't commitments, so they don't keep a project "open". */
const OPEN_STATUSES: ActionStatus[] = ['next', 'waiting', 'scheduled']

/**
 * True when finishing `completed` leaves an active project with nothing else in motion.
 * `completed` is excluded explicitly so this is correct even before its status write lands.
 */
export async function isLastOpenAction(completed: Action): Promise<boolean> {
  if (!completed.projectId) return false
  const project = await db.projects.get(completed.projectId)
  if (project?.status !== 'active') return false
  const remaining = await db.actions
    .where('projectId')
    .equals(completed.projectId)
    .filter((a) => a.id !== completed.id && OPEN_STATUSES.includes(a.status))
    .count()
  return remaining === 0
}

async function clearsBigThree(completed: Action): Promise<boolean> {
  const today = startOfWorkday()
  if (completed.bigThreeDate !== today) return false
  const otherPinned = await db.actions
    .filter((a) => a.id !== completed.id && a.bigThreeDate === today && a.status !== 'trash')
    .toArray()
  return otherPinned.every((a) => a.status === 'done')
}

/**
 * Celebrate an action being completed. Milestones — clearing today's Short List, or finishing a
 * project's last open action — get the bigger burst. Pass the action as it was *before* completion.
 */
export async function celebrateCompletion(completed: Action, from: Element) {
  const origin = originOf(from)
  if (getCelebrationLevel() === 'off') return
  const milestone = await Promise.all([isLastOpenAction(completed), clearsBigThree(completed)])
    .then((hits) => hits.some(Boolean))
    .catch(() => false)
  celebrate(origin, milestone ? 'big' : 'normal')
}
