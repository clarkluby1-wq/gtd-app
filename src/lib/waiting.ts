import type { Action } from '../db/types'
import { startOfToday, startOfWorkday } from './date'
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

/** A check-back date you set that hasn't been used yet. Following up on or after that day uses it up. */
export function followUpPending(action: Action): boolean {
  return action.followUpDate !== undefined && (lastFollowUpAt(action) ?? 0) < action.followUpDate
}

/**
 * Due for a nudge. One rule per item: if you picked a check-back date, that day decides; otherwise it's the
 * usual week without contact.
 */
export function needsNudge(action: Action): boolean {
  if (followUpPending(action)) return action.followUpDate! <= startOfToday()
  return ageInDays(lastContactAt(action)) > NUDGE_AFTER_DAYS
}

/** The most recent time you followed up, if ever. */
export function lastFollowUpAt(action: Action): number | undefined {
  return action.followUps?.[action.followUps.length - 1]
}

/** Followed up today (your workday, not literal midnight) — these sink to the bottom of the list, then return
 *  to their place once the next workday starts. */
export function wasFollowedUpToday(action: Action): boolean {
  const last = lastFollowUpAt(action)
  return last !== undefined && last >= startOfWorkday()
}
