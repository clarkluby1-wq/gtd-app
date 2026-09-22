import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { TaskRow } from '../components/TaskRow'
import { useSomedayProjectIds } from '../lib/useSomedayProjectIds'
import { useTodayPinCount } from '../lib/shortList'
import { followUpPending } from '../lib/waiting'
import type { Action } from '../db/types'

/** The day an item sits on the Calendar: a scheduled item's date, or the day you chose to check back on a Waiting For. */
const calendarDay = (a: Action) => (a.status === 'waiting' ? a.followUpDate! : a.scheduledDate!)

function groupByDay(actions: Action[]) {
  const groups = new Map<string, Action[]>()
  for (const a of actions) {
    const key = new Date(calendarDay(a)).toDateString()
    groups.set(key, [...(groups.get(key) ?? []), a])
  }
  return [...groups.entries()].sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
}

export function CalendarView({ onOpenProject }: { onOpenProject: (projectId: string) => void }) {
  const scheduled = useLiveQuery(() => db.actions.where('status').equals('scheduled').sortBy('scheduledDate'))
  // A Waiting For with a check-back date you chose shows up on that day too. It stays in Waiting For as well.
  const checkBacks = useLiveQuery(() => db.actions.where('status').equals('waiting').filter(followUpPending).toArray())
  const withDue = useLiveQuery(() =>
    db.actions
      .filter((a) => a.status === 'next' && a.dueDate != null)
      .sortBy('dueDate'),
  )
  const somedayProjectIds = useSomedayProjectIds()
  const notParked = (a: Action) => !a.projectId || !somedayProjectIds.has(a.projectId)
  // A dated item is still something you can flag as mattering today.
  const pinnedTodayCount = useTodayPinCount()

  const groups = scheduled ? groupByDay([...scheduled.filter(notParked), ...(checkBacks ?? []).filter(notParked)]) : []
  const dueFiltered = withDue?.filter(notParked) ?? []

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-neutral-100">Calendar</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Hard landscape — things tied to a specific day. Keep this list short; it's not a place to dump next actions.
        Days you chose to check back on a Waiting For show up here too.
      </p>

      {groups.length === 0 && (
        <div className="mb-6 rounded-lg border border-dashed border-neutral-800 p-6 text-center text-sm text-neutral-500">
          Nothing scheduled.
        </div>
      )}

      {groups.map(([day, items]) => (
        <div key={day} className="mb-4">
          <div className="mb-1 text-xs font-medium text-sky-400">
            {new Date(day).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
          <div className="flex flex-col divide-y divide-neutral-900">
            {items.map((a) => (
              <TaskRow
                key={a.id}
                action={a}
                showProject
                showWaitingClock={a.status === 'waiting'}
                showBigThreePin
                pinnedTodayCount={pinnedTodayCount}
                onOpenProject={onOpenProject}
              />
            ))}
          </div>
        </div>
      ))}

      {!!dueFiltered.length && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-medium text-amber-500">Upcoming Deadlines</h2>
          <div className="flex flex-col divide-y divide-neutral-900">
            {dueFiltered.map((a) => (
              <TaskRow key={a.id} action={a} showProject showBigThreePin pinnedTodayCount={pinnedTodayCount} onOpenProject={onOpenProject} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
