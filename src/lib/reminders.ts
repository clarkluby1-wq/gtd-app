import { hasTimeOfDay } from './date'
import type { Action } from '../db/types'

export type ReminderKind = 'today' | 'tomorrow' | 'now'
export interface DueReminder {
  action: Action
  kind: ReminderKind
}

const STORAGE_KEY = 'gtd.reminders'
export const REMINDERS_CHANGED = 'gtd:reminders-changed'

export function getRemindersEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

export function setRemindersEnabled(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off')
  } catch {
    // The choice just won't persist.
  }
  window.dispatchEvent(new Event(REMINDERS_CHANGED))
}

function startOfNextDay(dayStart: number): number {
  const d = new Date(dayStart)
  d.setDate(d.getDate() + 1)
  return d.getTime()
}

function startOfDayOf(timestamp: number): number {
  const d = new Date(timestamp)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * Which calendar items should pop up right now.
 *
 * - "tomorrow": scheduled for tomorrow, and the heads-up hasn't been dealt with.
 * - "today": scheduled for today AND you asked to be reminded on the day — or, as a safety net, nobody was
 *   ever told (the app wasn't open yesterday), so you still get a warning, late.
 * - "now": has an actual time of day (not just a day), and the clock has reached or passed it today. Fires
 *   once, whenever it's first noticed — if the app wasn't open right at the moment, it still fires late
 *   rather than silently never, same safety-net spirit as "today" above.
 *
 * Skipped: recurring occurrences (a daily habit would pop up every morning), items parked in a Someday
 * project, and anything touched *today* — you just scheduled it, so a pop-up would only be noise (this
 * doesn't apply to "now", which is about the clock, not about when you last touched the item). A
 * rescheduled item starts fresh, because its saved state is tied to the old date.
 */
export function dueReminders(
  actions: Action[],
  somedayProjectIds: Set<string>,
  todayStart: number,
  now: number = Date.now(),
): DueReminder[] {
  const tomorrowStart = startOfNextDay(todayStart)
  const due: DueReminder[] = []

  for (const action of actions) {
    if (action.status !== 'scheduled' || action.scheduledDate === undefined || action.recurringTemplateId) continue
    if (action.projectId && somedayProjectIds.has(action.projectId)) continue

    const state = action.reminder?.forDate === action.scheduledDate ? action.reminder : undefined
    const day = startOfDayOf(action.scheduledDate)
    const settledBeforeToday = (action.touchedAt ?? action.clarifiedAt ?? action.createdAt) < todayStart

    if (day === tomorrowStart && !state?.headsUpDone && settledBeforeToday) {
      due.push({ action, kind: 'tomorrow' })
    } else if (day === todayStart && !state?.dayOfDone && (state?.remindOnDay || (!state?.headsUpDone && settledBeforeToday))) {
      due.push({ action, kind: 'today' })
    }

    if (day === todayStart && hasTimeOfDay(action.scheduledDate) && now >= action.scheduledDate && !state?.atTimeDone) {
      due.push({ action, kind: 'now' })
    }
  }
  return due.sort((a, b) => a.action.order - b.action.order)
}
