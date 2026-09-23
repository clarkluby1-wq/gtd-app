import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { previousWorkdayStart, startOfWorkday } from './date'
import type { Action } from '../db/types'

/**
 * Today's Short List, kept in one place so every screen that shows or edits it agrees. A pin isn't limited to Next
 * Actions: a Waiting For you're chasing today or a Scheduled item on today's calendar can matter just as much, so
 * any of the three can hold one of the three slots. Someday items can't — they're not committed to yet.
 */

/** Everything pinned for today, whatever it is now — including something you already finished today. */
export function useTodayShortList(): Action[] | undefined {
  const today = startOfWorkday()
  return useLiveQuery(() => db.actions.filter((a) => a.bigThreeDate === today).toArray(), [today])
}

/** The pins that still count against the cap. Finishing one frees its slot back up for the rest of the day. */
export function useActiveTodayPins(excludeId?: string): Action[] | undefined {
  const list = useTodayShortList()
  return list?.filter((a) => a.id !== excludeId && a.status !== 'done' && a.status !== 'trash')
}

/** How many of the 3 slots are in use right now. */
export function useTodayPinCount(excludeId?: string): number | undefined {
  return useActiveTodayPins(excludeId)?.length
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
