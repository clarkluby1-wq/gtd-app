/**
 * The Weekly Review only works if it keeps happening, so the user picks a regular slot ("Every Thursday at 2:00 pm")
 * and the app helps them keep it: it shows the slot, mentions it on that day, and asks once when the time comes.
 * Weeks run Monday to Sunday, the same as the review's own week. Everything here takes `now` so it can be tested.
 *
 * The slot itself is a real clock time, so matching it against "today" (startOfDayOf) stays calendar-real. Only
 * whether the prompt has already been answered in this stretch of working (handledDay, below) uses the workday
 * boundary, so working past midnight doesn't bring the prompt back before you've actually started a new day.
 */
import { startOfWorkday } from './date'

export interface ReviewSchedule {
  /** 0 = Sunday … 6 = Saturday. */
  day: number
  /** 24-hour "HH:MM". */
  time: string
  /**
   * When the slot was chosen. A slot that had already passed this week when you chose it doesn't count as "late" —
   * it starts with its next occurrence.
   */
  since?: number
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const SCHEDULE_KEY = 'gtd.weeklyReview.schedule'
const PROMPT_KEY = 'gtd.weeklyReview.prompt'
export const REVIEW_SCHEDULE_CHANGED = 'gtd:review-schedule-changed'

const notify = () => window.dispatchEvent(new Event(REVIEW_SCHEDULE_CHANGED))

export function getReviewSchedule(): ReviewSchedule | null {
  try {
    const raw = JSON.parse(localStorage.getItem(SCHEDULE_KEY) ?? 'null')
    if (
      raw &&
      Number.isInteger(raw.day) &&
      raw.day >= 0 &&
      raw.day <= 6 &&
      typeof raw.time === 'string' &&
      /^\d{2}:\d{2}$/.test(raw.time)
    ) {
      return { day: raw.day, time: raw.time, since: typeof raw.since === 'number' ? raw.since : undefined }
    }
  } catch {
    // Treated as "no schedule yet".
  }
  return null
}

export function setReviewSchedule(schedule: ReviewSchedule | null) {
  try {
    if (schedule) localStorage.setItem(SCHEDULE_KEY, JSON.stringify({ ...schedule, since: schedule.since ?? Date.now() }))
    else localStorage.removeItem(SCHEDULE_KEY)
  } catch {
    // The choice just won't persist.
  }
  notify()
}

function startOfDayOf(timestamp: number): number {
  const d = new Date(timestamp)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Monday 00:00 of the week that contains `d`. */
export function startOfReviewWeek(d: Date): number {
  const date = new Date(d)
  const daysSinceMonday = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - daysSinceMonday)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** The scheduled moment inside the week that contains `now`. */
export function scheduledMoment(schedule: ReviewSchedule, now: Date): number {
  const d = new Date(startOfReviewWeek(now))
  d.setDate(d.getDate() + ((schedule.day + 6) % 7))
  const [hours, minutes] = schedule.time.split(':').map(Number)
  d.setHours(hours, minutes, 0, 0)
  return d.getTime()
}

/**
 * This week's slot, unless it had already passed when the slot was chosen — then it's next week's, so choosing a time
 * never makes you instantly late.
 */
export function effectiveMoment(schedule: ReviewSchedule, now: Date): number {
  const thisWeek = scheduledMoment(schedule, now)
  if (schedule.since === undefined || thisWeek >= schedule.since) return thisWeek
  const d = new Date(thisWeek)
  d.setDate(d.getDate() + 7)
  return d.getTime()
}

/** The slot coming up next: this week's if it hasn't passed yet, otherwise next week's. */
export function nextMoment(schedule: ReviewSchedule, now: Date): number {
  const thisWeek = scheduledMoment(schedule, now)
  if (thisWeek >= now.getTime()) return thisWeek
  const d = new Date(thisWeek)
  d.setDate(d.getDate() + 7)
  return d.getTime()
}

/** "14:00" → "2:00 pm", "09:30" → "9:30 am". */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const suffix = hours >= 12 ? 'pm' : 'am'
  const twelve = hours % 12 === 0 ? 12 : hours % 12
  return `${twelve}:${String(minutes).padStart(2, '0')} ${suffix}`
}

export function describeSchedule(schedule: ReviewSchedule): string {
  return `Every ${DAY_NAMES[schedule.day]} at ${formatTime(schedule.time)}`
}

/** Where this week stands against the slot. */
export type ReviewPhase = 'none' | 'later' | 'today' | 'open'

/**
 * - none: no slot chosen, or this week's review is already done
 * - later: the slot is on a day still to come
 * - today: the slot is today (before or after the hour)
 * - open: the slot has passed and the review hasn't been done this week
 */
export function reviewPhase(schedule: ReviewSchedule | null, now: Date, doneThisWeek: boolean): ReviewPhase {
  if (!schedule || doneThisWeek) return 'none'
  const moment = effectiveMoment(schedule, now)
  const sameDay = startOfDayOf(moment) === startOfDayOf(now.getTime())
  if (sameDay) return 'today'
  return now.getTime() < moment ? 'later' : 'open'
}

/** One calm sentence for wherever the slot is mentioned. */
export function describeStatus(schedule: ReviewSchedule, now: Date, doneThisWeek: boolean): string {
  const at = formatTime(schedule.time)
  if (doneThisWeek) {
    const next = new Date(scheduledMoment(schedule, now))
    next.setDate(next.getDate() + 7)
    return `Done this week ✓ Next: ${next.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })} at ${at}`
  }
  const phase = reviewPhase(schedule, now, false)
  const moment = effectiveMoment(schedule, now)
  if (phase === 'today') {
    return now.getTime() < moment ? `Today at ${at}` : `It's review time — the slot you set aside (${at})`
  }
  if (phase === 'open') return `Still open this week — your slot was ${DAY_NAMES[schedule.day]} at ${at}`
  return `Next: ${new Date(moment).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })} at ${at}`
}

interface PromptState {
  /** Which week this belongs to; a new week starts fresh. */
  week: number
  /** The workday the user already answered the prompt (startOfWorkday, not midnight). */
  handledDay?: number
  snoozeUntil?: number
  /** "Not this week." */
  skipped?: boolean
}

export function readPromptState(week: number): PromptState {
  try {
    const raw = JSON.parse(localStorage.getItem(PROMPT_KEY) ?? 'null')
    if (raw && raw.week === week) return raw as PromptState
  } catch {
    // Fresh state.
  }
  return { week }
}

function writePromptState(state: PromptState) {
  try {
    localStorage.setItem(PROMPT_KEY, JSON.stringify(state))
  } catch {
    // Worst case the prompt shows once more.
  }
  notify()
}

/** Asked once on the day, once the hour has come — not before, not on other days, not after it's answered or done. */
export function shouldPromptReview(
  schedule: ReviewSchedule | null,
  now: Date,
  doneThisWeek: boolean,
  state: PromptState,
): boolean {
  if (!schedule || doneThisWeek || state.skipped) return false
  const t = now.getTime()
  const moment = effectiveMoment(schedule, now)
  if (t < moment) return false
  if (startOfDayOf(moment) !== startOfDayOf(t)) return false
  if (state.handledDay === startOfWorkday(t)) return false
  if (state.snoozeUntil !== undefined && t < state.snoozeUntil) return false
  return true
}

/** "Start my review": it has been answered for today, so it won't ask again if the review is left unfinished. */
export function markReviewPromptHandled(now: Date) {
  const week = startOfReviewWeek(now)
  writePromptState({ ...readPromptState(week), handledDay: startOfWorkday(now.getTime()) })
}

export function snoozeReviewPrompt(now: Date, minutes = 60) {
  const week = startOfReviewWeek(now)
  writePromptState({ ...readPromptState(week), snoozeUntil: now.getTime() + minutes * 60 * 1000 })
}

/** "Not this week": no penalty, and it comes back next week as usual. */
export function skipReviewThisWeek(now: Date) {
  const week = startOfReviewWeek(now)
  writePromptState({ ...readPromptState(week), skipped: true })
}
