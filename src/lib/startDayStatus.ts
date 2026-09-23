import { startOfWorkday } from './date'

const KEY = 'gtd.startDay.reachedGoDay'

/** Marks today's workday as having reached the end of the guided Start My Day walkthrough. */
export function markStartDayReachedGo(now: number = Date.now()) {
  try {
    localStorage.setItem(KEY, String(startOfWorkday(now)))
  } catch {
    // Worst case the Today screen just asks again — harmless.
  }
}

/** Whether the walkthrough has already been carried through to its last step today (this workday). */
export function hasReachedGoToday(now: number = Date.now()): boolean {
  try {
    return localStorage.getItem(KEY) === String(startOfWorkday(now))
  } catch {
    return false
  }
}
