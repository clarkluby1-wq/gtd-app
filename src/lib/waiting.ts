import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../db/db'
import type { Action } from '../db/types'
import { startOfDay, startOfToday, startOfWorkday } from './date'
import { getReviewSchedule, nextMoment } from './reviewSchedule'
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
  if (isSnoozed(action)) return false
  if (followUpPending(action)) return action.followUpDate! <= startOfToday()
  return ageInDays(lastContactAt(action)) > NUDGE_AFTER_DAYS
}

/** Waiting, but deliberately not being chased until a later moment. */
export function isSnoozed(action: Action): boolean {
  return action.status === 'waiting' && action.snoozedUntil !== undefined && action.snoozedUntil > Date.now()
}

export type SnoozeChoice = '1w' | '2w' | '1m' | '3m' | 'review'

export const SNOOZE_CHOICES: { key: SnoozeChoice; label: string }[] = [
  { key: '1w', label: '1 week' },
  { key: '2w', label: '2 weeks' },
  { key: '1m', label: '1 month' },
  { key: '3m', label: '3 months' },
  { key: 'review', label: 'Until my weekly review' },
]

/** When a snooze ends. Date choices wake at the start of that day; "weekly review" wakes at your next review slot. */
export function snoozeWakeTime(choice: SnoozeChoice, now: Date = new Date()): number {
  const d = new Date(startOfDay(now.getTime()))
  if (choice === 'review') {
    const schedule = getReviewSchedule()
    // With no review time set, a week is the usual rhythm.
    if (schedule) return nextMoment(schedule, now)
    d.setDate(d.getDate() + 7)
  } else if (choice === '1w') d.setDate(d.getDate() + 7)
  else if (choice === '2w') d.setDate(d.getDate() + 14)
  else if (choice === '1m') d.setMonth(d.getMonth() + 1)
  else d.setMonth(d.getMonth() + 3)
  return d.getTime()
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

/** Every distinct name ever typed into "waiting on", alphabetically — for autocomplete, so "John" and "john"
 *  don't quietly become two different people. */
export function useWaitingOnNames(): string[] {
  const rows = useLiveQuery(() => db.actions.filter((a) => !!a.waitingOn).toArray())
  return useMemo(() => {
    const names = new Set<string>()
    for (const a of rows ?? []) if (a.waitingOn) names.add(a.waitingOn)
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [rows])
}
