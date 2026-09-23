import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { BigThree } from '../components/BigThree'
import { useTodayShortList } from '../lib/shortList'
import { TaskRow } from '../components/TaskRow'
import { startOfDay, startOfToday } from '../lib/date'
import { describeStatus } from '../lib/reviewSchedule'
import { useReviewStatus } from '../lib/useReviewStatus'
import { useSomedayProjectIds } from '../lib/useSomedayProjectIds'
import { hasReachedGoToday } from '../lib/startDayStatus'
import type { Action } from '../db/types'

/**
 * "Today" — the home base for the day: what you're committed to (the Short List), what's tied to today on the
 * calendar, and a door into the guided Start My Day routine for anyone who wants that fuller walk-through. Nothing
 * here is a separate list — every item shown also lives in Next Actions or the Calendar; this is just today's slice.
 */
export function TodayHomeView({
  onOpenProject,
  onStartDay,
  onViewNextActions,
  onViewCalendar,
  onViewReport,
  onViewWeeklyReview,
}: {
  onOpenProject: (projectId: string) => void
  onStartDay: () => void
  onViewNextActions: () => void
  onViewCalendar: () => void
  onViewReport: () => void
  onViewWeeklyReview: () => void
}) {
  const today = startOfToday()
  const review = useReviewStatus()
  const somedayProjectIds = useSomedayProjectIds()
  // Once you've already been through the guided walkthrough today, leading with it again reads as "didn't I
  // just do this?" — so the Short List takes the prime spot instead, and Start Your Day becomes a quiet revisit.
  const alreadyStarted = hasReachedGoToday()
  const notParked = (a: Action) => !a.projectId || !somedayProjectIds.has(a.projectId)

  // Not just Next Actions — a pinned Waiting For or Scheduled item is just as much today's short list.
  const shortListRaw = useTodayShortList()
  const shortList = (shortListRaw ?? []).filter((a) => notParked(a))
  const scheduled = useLiveQuery(() => db.actions.where('status').equals('scheduled').toArray())
  const withDue = useLiveQuery(() => db.actions.filter((a) => a.status === 'next' && a.dueDate != null).toArray())

  const tomorrow = startOfDay(today + 24 * 60 * 60 * 1000)
  const onCalendarToday = [...(scheduled ?? []), ...(withDue ?? [])]
    .filter(notParked)
    .filter((a) => (a.status === 'scheduled' ? a.scheduledDate! : a.dueDate!) >= today && (a.status === 'scheduled' ? a.scheduledDate! : a.dueDate!) < tomorrow)
    .sort((a, b) => a.order - b.order)

  if (shortListRaw === undefined || scheduled === undefined || withDue === undefined) return null

  const heading = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold text-neutral-100">Today</h1>
        <span className="text-sm text-neutral-500">{heading}</span>
      </div>

      {(review.phase === 'today' || review.phase === 'open') && review.schedule && (
        <button
          onClick={onViewWeeklyReview}
          className="mb-4 flex w-full items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left hover:border-amber-500/50"
        >
          <div className="min-w-0">
            <div className="text-sm font-medium text-neutral-100">Weekly Review</div>
            <div className="text-xs text-neutral-400">{describeStatus(review.schedule, review.now, false)}</div>
          </div>
          <span className="shrink-0 text-xs text-neutral-400">Open →</span>
        </button>
      )}

      {!alreadyStarted && (
        <button
          onClick={onStartDay}
          className="mb-6 flex w-full items-center justify-between gap-3 rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-4 py-4 text-left hover:border-emerald-700"
        >
          <div>
            <div className="font-medium text-neutral-100">Start your day →</div>
            <div className="text-sm text-neutral-500">A quick guided look before you dive in</div>
          </div>
          <span className="text-2xl" aria-hidden>
            ☀️
          </span>
        </button>
      )}

      <BigThree actions={shortList} onViewNextActions={onViewNextActions} onOpenProject={onOpenProject} />

      {alreadyStarted && (
        <button onClick={onStartDay} className="mb-6 mt-2 text-xs text-neutral-500 hover:text-neutral-300">
          ↻ Revisit Start My Day
        </button>
      )}

      <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="mb-2 text-sm font-medium text-neutral-300">On your calendar today</h2>
        {onCalendarToday.length === 0 ? (
          <p className="text-sm text-neutral-500">Nothing tied to today.</p>
        ) : (
          <div className="flex flex-col divide-y divide-neutral-900">
            {onCalendarToday.map((a) => (
              <TaskRow key={a.id} action={a} showProject onOpenProject={onOpenProject} />
            ))}
          </div>
        )}
        <button onClick={onViewCalendar} className="mt-3 text-xs text-neutral-500 hover:text-neutral-300">
          See the whole Calendar →
        </button>
      </div>

      <button onClick={onViewReport} className="text-sm text-emerald-400 hover:text-emerald-300">
        See what I've done →
      </button>
    </div>
  )
}
