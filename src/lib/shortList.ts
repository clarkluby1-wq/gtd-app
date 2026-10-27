import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { setShortListOrder } from '../db/operations'
import { startOfWorkday } from './date'
import { useDragReorder } from './useDragReorder'
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

/** A pick's place in the list: its own Short List position, or (for older picks) when it was captured. */
export const shortListKey = (a: Action): number => a.shortListOrder ?? a.order

/** Picks in the order you put them — the one order every screen shows. */
export const sortShortList = (actions: Action[]): Action[] => [...actions].sort((a, b) => shortListKey(a) - shortListKey(b))

/** Everything on the Short List for a day, in your order — including a pick finished that day. Defaults to
 *  today; pass a different workday start (e.g. nextWorkdayStart()) to read tomorrow's picks instead, as End My Day does. */
export function useTodayShortList(date: number = startOfWorkday()): Action[] | undefined {
  return useLiveQuery(
    () => db.actions.filter((a) => isOnShortList(a, date)).toArray().then(sortShortList),
    [date],
  )
}

/** Drag-to-reorder for a list of Short List picks (already in order): writes only the dragged pick's position. */
export function useShortListDrag(items: Action[]) {
  return useDragReorder(
    items.map((a) => ({ id: a.id, order: shortListKey(a) })),
    (id, order) => void setShortListOrder(id, order),
  )
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
 * Starred means starred until you un-star it: a pick stays on the Short List day after day, so you never have to
 * remember what you chose yesterday. bigThreeDate is the day it was starred. A pick dated for a later day (chosen
 * in End My Day for tomorrow) waits for that day. Someday, trashed and unsorted items never count, and a finished
 * pick only counts on the day it was finished.
 */
export function isOnShortList(a: Action, date: number = startOfWorkday()): boolean {
  if (a.bigThreeDate === undefined || a.bigThreeDate > date) return false
  if (a.status === 'trash' || a.status === 'someday' || a.status === 'inbox') return false
  if (a.status === 'done') return (a.completedAt ?? 0) >= date
  return true
}

/** Open picks that were starred on an earlier day and are still waiting — what Start My Day shows as carried over. */
export function useCarriedOverPicks(): Action[] | undefined {
  const today = startOfWorkday()
  return useLiveQuery(
    () => db.actions.filter((a) => a.status !== 'done' && isOnShortList(a, today) && a.bigThreeDate! < today).toArray(),
    [today],
  )
}
