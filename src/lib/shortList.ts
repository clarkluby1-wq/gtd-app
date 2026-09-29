import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { previousWorkdayStart, startOfWorkday } from './date'
import type { Action } from '../db/types'

/**
 * Today's Short List, kept in one place so every screen that shows or edits it agrees. A pin isn't limited to Next
 * Actions: a Waiting For you're chasing today or a Scheduled item on today's calendar can matter just as much, so
 * any of the three can hold one of the slots. Someday items can't — they're not committed to yet.
 */

/** How many things can be on today's Short List at once. Every cap check and every line of wording comes from here. */
export const SHORT_LIST_MAX = 5

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
/** The limit spelled out for copy ("Pick up to five"), derived so it can never disagree with SHORT_LIST_MAX. */
export const SHORT_LIST_MAX_WORD = NUMBER_WORDS[SHORT_LIST_MAX] ?? String(SHORT_LIST_MAX)

/** Everything pinned for a day, whatever it is now — including something already finished. Defaults to today;
 *  pass a different workday start (e.g. nextWorkdayStart()) to read tomorrow's picks instead, as End My Day does. */
export function useTodayShortList(date: number = startOfWorkday()): Action[] | undefined {
  return useLiveQuery(() => db.actions.filter((a) => a.bigThreeDate === date).toArray(), [date])
}

/** The pins that still count against the cap. Finishing one frees its slot back up for the rest of the day. */
export function useActiveTodayPins(excludeId?: string, date?: number): Action[] | undefined {
  const list = useTodayShortList(date)
  return list?.filter((a) => a.id !== excludeId && a.status !== 'done' && a.status !== 'trash')
}

/** How many of the SHORT_LIST_MAX slots are in use right now. */
export function useTodayPinCount(excludeId?: string, date?: number): number | undefined {
  return useActiveTodayPins(excludeId, date)?.length
}

/**
 * Yesterday's picks that are still open — the list clears every workday so nothing lingers making you feel
 * behind, but this surfaces what didn't get finished as an informed *option*, not a carried-over obligation.
 * Pull one back in, or ignore it entirely; either way it quietly stops showing once the next workday starts.
 */
export function useYesterdaysOpenPicks(): Action[] | undefined {
  const yesterday = previousWorkdayStart()
  return useLiveQuery(
    () =>
      db.actions
        .filter((a) => a.bigThreeDate === yesterday && a.status !== 'done' && a.status !== 'trash')
        .toArray(),
    [yesterday],
  )
}
