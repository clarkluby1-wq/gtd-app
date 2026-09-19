import type { Action } from '../db/types'
import { ageInDays } from './staleness'

/** After this many days without contact, a Waiting For item is due a nudge. */
export const NUDGE_AFTER_DAYS = 7

/** When the wait began. Older records predate `waitingSince`, so fall back to when they were clarified, then captured. */
export function waitingStartedAt(action: Action): number {
  return action.waitingSince ?? action.clarifiedAt ?? action.createdAt
}

/** The last time anything happened on this wait: it started, or you followed up. */
export function lastContactAt(action: Action): number {
  return Math.max(waitingStartedAt(action), ...(action.followUps ?? []))
}

export function needsNudge(action: Action): boolean {
  return ageInDays(lastContactAt(action)) > NUDGE_AFTER_DAYS
}
