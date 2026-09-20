import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../db/db'
import { getReviewSchedule, REVIEW_SCHEDULE_CHANGED, reviewPhase, startOfReviewWeek } from './reviewSchedule'

/**
 * Where this week's Weekly Review stands against the slot the user chose. Re-checks every minute, when you return to
 * the tab, and whenever the slot or a prompt answer changes — so "today" rolls over on its own.
 */
export function useReviewStatus() {
  const [schedule, setSchedule] = useState(getReviewSchedule)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const refresh = () => {
      setSchedule(getReviewSchedule())
      setNow(new Date())
    }
    const interval = setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener(REVIEW_SCHEDULE_CHANGED, refresh)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener(REVIEW_SCHEDULE_CHANGED, refresh)
    }
  }, [])

  const weekStart = startOfReviewWeek(now)
  // A count (not the record) so "still loading" is distinguishable from "not done": undefined vs 0.
  const completedCount = useLiveQuery(
    () =>
      db.weeklyReviews
        .where('date')
        .equals(weekStart)
        .filter((r) => !!r.completedAt)
        .count(),
    [weekStart],
  )
  const loaded = completedCount !== undefined
  const doneThisWeek = (completedCount ?? 0) > 0

  return {
    schedule,
    now,
    weekStart,
    loaded,
    doneThisWeek,
    phase: loaded ? reviewPhase(schedule, now, doneThisWeek) : ('none' as const),
  }
}
