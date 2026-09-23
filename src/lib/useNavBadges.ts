import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { startOfWorkday } from './date'
import { useSomedayProjectIds } from './useSomedayProjectIds'

/** The small counts shown next to menu items — shared by the desktop sidebar and the mobile tab bar, so they can never disagree. */
export function useNavBadges() {
  const somedayProjectIds = useSomedayProjectIds()
  const inboxCount = useLiveQuery(() => db.actions.where('status').equals('inbox').count())
  const nextActions = useLiveQuery(() => db.actions.where('status').equals('next').toArray())
  const waitingActions = useLiveQuery(() => db.actions.where('status').equals('waiting').toArray())
  const doneActions = useLiveQuery(() => db.actions.where('status').equals('done').toArray())
  const completedTodayCount = doneActions?.filter((a) => (a.completedAt ?? 0) >= startOfWorkday()).length
  const notParked = (a: { projectId?: string }) => !a.projectId || !somedayProjectIds.has(a.projectId)
  return {
    inbox: inboxCount,
    next: nextActions?.filter(notParked).length,
    waiting: waitingActions?.filter(notParked).length,
    completedToday: completedTodayCount,
  }
}
