import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { clearFlowStep, readFlowStep, saveFlowStep } from '../lib/flowResume'
import { db } from '../db/db'
import { CommitmentsStep } from '../components/CommitmentsStep'
import { FollowUpControl } from '../components/FollowUpControl'
import { OpenPickRow } from '../components/OpenPickRow'
import { StickyNav } from '../components/StickyNav'
import { TaskRow } from '../components/TaskRow'
import { pinToBigThree } from '../db/operations'
import { startOfDay, startOfToday, startOfWorkday } from '../lib/date'
import { useSomedayProjectIds } from '../lib/useSomedayProjectIds'
import { describeStatus } from '../lib/reviewSchedule'
import { useReviewStatus } from '../lib/useReviewStatus'
import { isSnoozed, needsNudge, waitingStartedAt } from '../lib/waiting'
import { SHORT_LIST_MAX, useActiveTodayPins, useTodayPinCount, useYesterdaysOpenPicks } from '../lib/shortList'
import type { Action } from '../db/types'

type Step = 'commitments' | 'today' | 'inbox' | 'waiting' | 'shortlist' | 'go'

const STEPS: { key: Step; label: string }[] = [
  { key: 'commitments', label: 'Commitments' },
  { key: 'today', label: 'Today' },
  { key: 'inbox', label: 'Inbox' },
  { key: 'waiting', label: 'Waiting For' },
  { key: 'shortlist', label: 'Short List' },
  { key: 'go', label: 'Go' },
]

type PickSort = 'deadlines' | 'oldest' | 'newest'

const PICK_SORT_OPTIONS: { value: PickSort; label: string }[] = [
  { value: 'deadlines', label: 'Sort: Deadlines first' },
  { value: 'oldest', label: 'Sort: Oldest first' },
  { value: 'newest', label: 'Sort: Newest first' },
]

// Remembered, so a morning routine doesn't start from scratch.
const PICK_SORT_KEY = 'gtd.startDay.pickSort'

function readPickSort(): PickSort {
  try {
    const saved = localStorage.getItem(PICK_SORT_KEY)
    return PICK_SORT_OPTIONS.some((o) => o.value === saved) ? (saved as PickSort) : 'deadlines'
  } catch {
    return 'deadlines'
  }
}

function savePickSort(sort: PickSort) {
  try {
    localStorage.setItem(PICK_SORT_KEY, sort)
  } catch {
    // Not remembering is fine; it just starts on "Deadlines first" next time.
  }
}

/** Enough to choose from without turning the pick into a scroll; the rest is one click away. */
const PICK_PREVIEW = 8
const NUDGE_PREVIEW = 5

/**
 * A short, skippable walk through the start of a day: what you've committed to (your calendars), what's tied to
 * today in here, what's waiting to be sorted, who needs a nudge, then choosing a Short List. Nothing here is required — every step can be skipped, and the
 * steps are also reachable directly from the trail at the top.
 */
export function StartDayView({
  onOpenProject,
  onProcessInbox,
  onViewInbox,
  onFocus,
  onViewToday,
  onViewNextActions,
  onViewWaitingFor,
  onViewWhatNow,
  onViewCalendar,
  onViewWeeklyReview,
  onViewSomeday,
}: {
  onOpenProject: (projectId: string) => void
  /** Jumps straight into the guided "process one at a time" flow — the Inbox step's own button. */
  onProcessInbox: () => void
  /** Just opens the Inbox to look through, same as Next Actions does — no processing forced. */
  onViewInbox: () => void
  onFocus: () => void
  /** Back to the Today home screen — the natural "I'm done here" exit once you've been through this. */
  onViewToday: () => void
  onViewNextActions: () => void
  onViewWaitingFor: () => void
  onViewWhatNow: () => void
  onViewCalendar: () => void
  onViewWeeklyReview: () => void
  /** Just opens Someday / Maybe to look through — nothing forced. */
  onViewSomeday: () => void
}) {
  // Picks up where you left off if you stepped out to the Inbox or Calendar and came back (today only).
  const [startedAt] = useState<Step>(() => {
    const saved = readFlowStep('startday')
    return STEPS.some((s) => s.key === saved) ? (saved as Step) : 'commitments'
  })
  const [step, setStep] = useState<Step>(startedAt)
  useEffect(() => saveFlowStep('startday', step), [step])
  const [justFollowedUp, setJustFollowedUp] = useState<Set<string>>(new Set())
  const [showAllPicks, setShowAllPicks] = useState(false)
  const [pickSort, setPickSort] = useState(readPickSort)

  const scheduled = useLiveQuery(() => db.actions.where('status').equals('scheduled').toArray())
  const nexts = useLiveQuery(() => db.actions.where('status').equals('next').toArray())
  const waiting = useLiveQuery(() => db.actions.where('status').equals('waiting').toArray())
  const inboxCount = useLiveQuery(() => db.actions.where('status').equals('inbox').count())
  const somedayProjectIds = useSomedayProjectIds()
  const review = useReviewStatus()
  const yesterdaysPicksRaw = useYesterdaysOpenPicks()
  // The real Short List, across every status it can come from — not just what's picked below, which is Next
  // Actions only. Keeps the count and cap honest with what Next Actions / Waiting For / Calendar already show.
  const pinnedTodayCount = useTodayPinCount()
  const activeShortList = useActiveTodayPins()

  // Calendar-real today, for grouping items that carry an actual scheduled/due date below.
  const today = startOfToday()
  const tomorrow = (() => {
    const d = new Date(today)
    d.setDate(d.getDate() + 1)
    return startOfDay(d.getTime())
  })()
  const dayAfter = (() => {
    const d = new Date(tomorrow)
    d.setDate(d.getDate() + 1)
    return startOfDay(d.getTime())
  })()
  // Your workday (4:30am-anchored), for anything about the Short List — working past midnight shouldn't reset it.
  const workdayToday = startOfWorkday()

  const notParked = (a: Action) => !a.projectId || !somedayProjectIds.has(a.projectId)
  const yesterdaysPicks = (yesterdaysPicksRaw ?? []).filter(notParked)

  // The day a scheduled or deadline item is tied to. A Next Action only counts when it has a real due date.
  const dayOf = (a: Action) => (a.status === 'scheduled' ? a.scheduledDate : a.dueDate)

  const dated = useMemo(() => {
    const items = [...(scheduled ?? []), ...(nexts ?? []).filter((a) => a.dueDate != null)]
      .filter(notParked)
      .filter((a) => dayOf(a) !== undefined)
      .sort((a, b) => dayOf(a)! - dayOf(b)! || a.order - b.order)
    return {
      earlier: items.filter((a) => dayOf(a)! < today),
      today: items.filter((a) => dayOf(a)! >= today && dayOf(a)! < tomorrow),
      tomorrow: items.filter((a) => dayOf(a)! >= tomorrow && dayOf(a)! < dayAfter),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduled, nexts, somedayProjectIds, today, tomorrow, dayAfter])

  const nudges = useMemo(
    () =>
      (waiting ?? [])
        .filter(notParked)
        .filter((a) => needsNudge(a) || (justFollowedUp.has(a.id) && !isSnoozed(a)))
        .sort((a, b) => waitingStartedAt(a) - waitingStartedAt(b)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [waiting, somedayProjectIds, justFollowedUp],
  )

  const picks = useMemo(
    () =>
      (nexts ?? [])
        .filter(notParked)
        // Starring one pops it straight to the top, whatever the sort, so the choice is visible right away. Below
        // that it follows the chosen sort: deadlines first (soonest, then your own order), or oldest / newest captured.
        .sort(
          (a, b) =>
            Number(b.bigThreeDate === workdayToday) - Number(a.bigThreeDate === workdayToday) ||
            (pickSort === 'oldest'
              ? a.createdAt - b.createdAt
              : pickSort === 'newest'
                ? b.createdAt - a.createdAt
                : Number(b.dueDate != null) - Number(a.dueDate != null) ||
                  (a.dueDate ?? 0) - (b.dueDate ?? 0) ||
                  a.order - b.order),
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nexts, somedayProjectIds, workdayToday, pickSort],
  )
  const atCap = (pinnedTodayCount ?? 0) >= SHORT_LIST_MAX
  // The preview never hides something already chosen — moot now that starring pops it to the top, but stays
  // as a safety net if the preview count were ever smaller than the Short List cap.
  const shownPicks = showAllPicks ? picks : picks.filter((a, i) => i < PICK_PREVIEW || a.bigThreeDate === workdayToday)

  const stepIndex = STEPS.findIndex((s) => s.key === step)
  const goNext = () => setStep(STEPS[Math.min(stepIndex + 1, STEPS.length - 1)].key)
  const goBack = () => setStep(STEPS[Math.max(stepIndex - 1, 0)].key)

  const heading = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-neutral-100">Start My Day</h1>
      <p className="mb-4 text-sm text-neutral-500">
        {heading}. A quick look before you dive in — skip anything, and come back whenever.
      </p>

      {startedAt !== 'commitments' && step === startedAt && (
        <p className="-mt-2 mb-3 text-xs text-neutral-500">
          Picked up where you left off.{' '}
          <button onClick={() => setStep('commitments')} className="text-emerald-400 hover:text-emerald-300">
            Start over
          </button>
        </p>
      )}

      <div className="mb-3 flex flex-wrap gap-x-1 gap-y-1 text-xs">
        {STEPS.map((s, i) => (
          <span key={s.key} className="flex items-center">
            <button
              onClick={() => setStep(s.key)}
              className={
                s.key === step ? 'font-medium text-emerald-400' : 'text-neutral-500 hover:text-neutral-300'
              }
            >
              {s.label}
            </button>
            {i < STEPS.length - 1 && <span className="mx-1.5 text-neutral-700">→</span>}
          </span>
        ))}
      </div>

      <StickyNav>
        {stepIndex > 0 ? (
          <button onClick={goBack} className="text-sm text-neutral-400 hover:text-neutral-200">
            ← Back
          </button>
        ) : (
          <span />
        )}
        <span className="text-xs text-neutral-500">
          {STEPS[stepIndex].label} · {stepIndex + 1} of {STEPS.length}
        </span>
        {step !== 'go' ? (
          <button
            onClick={goNext}
            className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Next →
          </button>
        ) : (
          <span />
        )}
      </StickyNav>

      {step === 'commitments' && (
        <Screen question="What have you committed to today?">
          <CommitmentsStep />
        </Screen>
      )}

      {step === 'today' && (
        <Screen question="What's already tied to today in here?">
          {(review.phase === 'today' || review.phase === 'open') && review.schedule && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-neutral-100">Weekly Review</div>
                <div className="text-xs text-neutral-400">{describeStatus(review.schedule, review.now, false)}</div>
              </div>
              <button
                onClick={onViewWeeklyReview}
                className="shrink-0 rounded-md bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-emerald-600 hover:text-white"
              >
                Open it
              </button>
            </div>
          )}
          {dated.today.length === 0 && dated.earlier.length === 0 ? (
            <Calm>Nothing is tied to a day today. Open space.</Calm>
          ) : (
            <>
              {dated.today.length > 0 && (
                <Group label="Today" tone="text-sky-400">
                  {dated.today.map((a) => (
                    <TaskRow key={a.id} action={a} showProject onOpenProject={onOpenProject} />
                  ))}
                </Group>
              )}
              {dated.earlier.length > 0 && (
                <Group label="From earlier — still open" tone="text-amber-500">
                  {dated.earlier.map((a) => (
                    <TaskRow key={a.id} action={a} showProject onOpenProject={onOpenProject} />
                  ))}
                </Group>
              )}
            </>
          )}
          {dated.tomorrow.length > 0 && (
            <p className="mt-4 text-xs text-neutral-500">
              Tomorrow: {dated.tomorrow.slice(0, 3).map((a) => a.title).join(' · ')}
              {dated.tomorrow.length > 3 && ` · +${dated.tomorrow.length - 3} more`}
            </p>
          )}
          <p className="mt-4 text-xs text-neutral-500">
            Anything time-specific hiding in{' '}
            <button onClick={onViewNextActions} className="text-emerald-400 hover:text-emerald-300">
              Next Actions
            </button>{' '}
            or the{' '}
            <button onClick={onViewInbox} className="text-emerald-400 hover:text-emerald-300">
              Inbox
            </button>
            ? Give it a date and it'll show up here.
          </p>
          <button onClick={onViewCalendar} className="mt-4 text-xs text-neutral-500 hover:text-neutral-300">
            See the whole Calendar →
          </button>
        </Screen>
      )}

      {step === 'inbox' && (
        <Screen question="Anything waiting to be sorted?">
          {inboxCount === undefined ? null : inboxCount === 0 ? (
            <Calm>Your Inbox is clear. ✓</Calm>
          ) : (
            <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
              <div className="mb-1 text-2xl font-semibold text-neutral-100">{inboxCount}</div>
              <p className="mb-4 text-sm text-neutral-400">
                {inboxCount === 1 ? 'thing is' : 'things are'} waiting. Sort them now, one after another, or leave
                them — they're safe.
              </p>
              <button
                onClick={onProcessInbox}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                Sort them now
              </button>
              <p className="mt-3 text-xs text-neutral-600">
                This takes you to your Inbox. Start My Day is in the menu whenever you want to come back.
              </p>
            </div>
          )}
        </Screen>
      )}

      {step === 'waiting' && (
        <Screen question="Is anyone due a nudge?">
          {nudges.length === 0 ? (
            <Calm>Nobody's overdue for a follow-up. ✓</Calm>
          ) : (
            <>
              <div className="flex flex-col divide-y divide-neutral-900">
                {nudges.slice(0, NUDGE_PREVIEW).map((a) => (
                  <TaskRow
                    key={a.id}
                    action={a}
                    showProject
                    showWaitingClock
                    onOpenProject={onOpenProject}
                    extraAction={
                      <FollowUpControl
                        action={a}
                        onLogged={() => setJustFollowedUp((prev) => new Set(prev).add(a.id))}
                      />
                    }
                  />
                ))}
              </div>
              {nudges.length > NUDGE_PREVIEW && (
                <button onClick={onViewWaitingFor} className="mt-3 text-xs text-neutral-500 hover:text-neutral-300">
                  +{nudges.length - NUDGE_PREVIEW} more in Waiting For →
                </button>
              )}
            </>
          )}
          <button
            onClick={onViewSomeday}
            className="mt-5 rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-800"
          >
            🌙 Browse Someday / Maybe →
          </button>
        </Screen>
      )}

      {step === 'shortlist' && (
        <Screen question="What are the few things you want to move today?">
          <p className="mb-3 text-xs text-neutral-500">
            Pick up to {SHORT_LIST_MAX} — {pinnedTodayCount ?? 0} of {SHORT_LIST_MAX} chosen. Optional; you can also
            decide later from Next Actions.
          </p>

          {yesterdaysPicks.length > 0 && (
            <div className="mb-4 rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                Yesterday's picks, still open
              </h3>
              <div className="flex flex-col divide-y divide-neutral-900">
                {yesterdaysPicks.map((a) => (
                  <OpenPickRow
                    key={a.id}
                    action={a}
                    actionLabel="Pull into today"
                    onAction={() => pinToBigThree(a.id)}
                    disabled={atCap}
                    actionTitle={atCap ? "Today's Short List is full — remove one first" : 'Pull into today'}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-neutral-600">Nothing to do here — leave them be and they'll quietly stop showing.</p>
            </div>
          )}

          {picks.length === 0 ? (
            <Calm>No Next Actions yet. Sorting your Inbox will fill this in.</Calm>
          ) : (
            <>
              <select
                value={pickSort}
                onChange={(e) => {
                  const next = e.target.value as PickSort
                  setPickSort(next)
                  savePickSort(next)
                }}
                aria-label="Sort Next Actions"
                className="mb-2 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200"
              >
                {PICK_SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <div className="flex flex-col divide-y divide-neutral-900">
                {shownPicks.map((a) => (
                  <TaskRow
                    key={a.id}
                    action={a}
                    showProject
                    showBigThreePin
                    pinnedTodayCount={pinnedTodayCount}
                    onOpenProject={onOpenProject}
                  />
                ))}
              </div>
              {picks.length > shownPicks.length && (
                <button
                  onClick={() => setShowAllPicks(true)}
                  className="mt-3 text-xs text-neutral-500 hover:text-neutral-300"
                >
                  Show all {picks.length} Next Actions
                </button>
              )}
            </>
          )}
        </Screen>
      )}

      {step === 'go' && (
        <Screen question="That's the setup. Ready?">
          <div className="mb-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <h2 className="mb-2 text-sm font-medium text-neutral-300">Today's Short List</h2>
            {(activeShortList ?? []).length === 0 ? (
              <p className="text-sm text-neutral-500">Nothing chosen — that's fine. You can still pick as you go.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {(activeShortList ?? []).map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-sm text-neutral-100">
                    <span className="text-amber-400">★</span>
                    <span className="truncate">{a.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                clearFlowStep('startday')
                onViewToday()
              }}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Go to Today →
            </button>
            <button
              onClick={onFocus}
              title="One task at a time, nothing else in view"
              className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
            >
              Start focusing
            </button>
          </div>
          <button onClick={onViewWhatNow} className="mt-4 text-xs text-neutral-500 hover:text-neutral-300">
            Not sure? Ask What Now?
          </button>
          <button onClick={onViewNextActions} className="mt-1 block text-xs text-neutral-500 hover:text-neutral-300">
            Or browse all Next Actions
          </button>
        </Screen>
      )}

    </div>
  )
}

function Screen({ question, children }: { question: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-4 text-lg font-medium text-neutral-100">{question}</h2>
      {children}
    </div>
  )
}

function Group({ label, tone, children }: { label: string; tone: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <div className={`mb-1 text-xs font-medium ${tone}`}>{label}</div>
      <div className="flex flex-col divide-y divide-neutral-900">{children}</div>
    </div>
  )
}

function Calm({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-800 p-6 text-center text-sm text-neutral-500">
      {children}
    </div>
  )
}
