import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { clearFlowStep, readFlowStep, saveFlowStep } from '../lib/flowResume'
import { db } from '../db/db'
import { OpenPickRow } from '../components/OpenPickRow'
import { ShortListLine } from '../components/ShortListLine'
import { StickyNav } from '../components/StickyNav'
import { TaskRow } from '../components/TaskRow'
import { captureToInbox, pinToBigThree } from '../db/operations'
import { nextWorkdayStart, startOfDay, startOfToday, startOfWorkday } from '../lib/date'
import { useSomedayProjectIds } from '../lib/useSomedayProjectIds'
import { SHORT_LIST_MAX, useActiveTodayPins, useTodayPinCount } from '../lib/shortList'
import type { Action } from '../db/types'

type Step = 'inbox' | 'tomorrow' | 'shortlist' | 'capture' | 'done'

const STEPS: { key: Step; label: string }[] = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'shortlist', label: 'Short List' },
  { key: 'capture', label: 'Capture' },
  { key: 'done', label: 'Done' },
]

const PICK_PREVIEW = 8

/**
 * The evening counterpart to Start My Day: close out today and decide tomorrow's approach the night before,
 * rather than the morning of. Nothing here is required — every step can be skipped, and the steps are also
 * reachable directly from the trail at the top.
 */
export function EndDayView({
  onOpenProject,
  onProcessInbox,
  onViewInbox,
  onViewToday,
  onViewNextActions,
  onViewCalendar,
}: {
  onOpenProject: (projectId: string) => void
  /** Jumps straight into the guided "process one at a time" flow — the Inbox step's own button. */
  onProcessInbox: () => void
  /** Just opens the Inbox to look through, same as Next Actions does — no processing forced. */
  onViewInbox: () => void
  /** Back to the Today home screen — the natural "I'm done here" exit once you've closed out. */
  onViewToday: () => void
  onViewNextActions: () => void
  onViewCalendar: () => void
}) {
  // Picks up where you left off if you stepped out to the Inbox or Calendar and came back (today only).
  const [startedAt] = useState<Step>(() => {
    const saved = readFlowStep('endday')
    return STEPS.some((s) => s.key === saved) ? (saved as Step) : 'inbox'
  })
  const [step, setStep] = useState<Step>(startedAt)
  useEffect(() => saveFlowStep('endday', step), [step])
  const [showAllPicks, setShowAllPicks] = useState(false)
  const [captureValue, setCaptureValue] = useState('')
  const [captured, setCaptured] = useState<string[]>([])

  const inboxCount = useLiveQuery(() => db.actions.where('status').equals('inbox').count())
  const nexts = useLiveQuery(() => db.actions.where('status').equals('next').toArray())
  const scheduled = useLiveQuery(() => db.actions.where('status').equals('scheduled').toArray())
  const somedayProjectIds = useSomedayProjectIds()
  const doneToday = useLiveQuery(() =>
    db.actions
      .where('status')
      .equals('done')
      .filter((a) => (a.completedAt ?? 0) >= startOfWorkday())
      .count(),
  )

  // What's already pinned for today, so an unfinished one can be offered forward instead of quietly dropped.
  const todaysOpenPicksRaw = useActiveTodayPins()
  // Tomorrow's workday start — the same "your day" boundary the Short List always uses, not literal midnight.
  const tomorrowWorkday = nextWorkdayStart()
  const tomorrowPinnedCount = useTodayPinCount(undefined, tomorrowWorkday)
  const tomorrowActivePins = useActiveTodayPins(undefined, tomorrowWorkday)

  // Calendar-real tomorrow, for grouping items that carry an actual scheduled/due date.
  const todayCal = startOfToday()
  const tomorrowCal = (() => {
    const d = new Date(todayCal)
    d.setDate(d.getDate() + 1)
    return startOfDay(d.getTime())
  })()
  const dayAfterCal = (() => {
    const d = new Date(tomorrowCal)
    d.setDate(d.getDate() + 1)
    return startOfDay(d.getTime())
  })()
  const twoDaysOutCal = (() => {
    const d = new Date(dayAfterCal)
    d.setDate(d.getDate() + 1)
    return startOfDay(d.getTime())
  })()

  const notParked = (a: Action) => !a.projectId || !somedayProjectIds.has(a.projectId)
  const todaysOpenPicks = (todaysOpenPicksRaw ?? []).filter(notParked)

  // The day a scheduled or deadline item is tied to. A Next Action only counts when it has a real due date.
  const dayOf = (a: Action) => (a.status === 'scheduled' ? a.scheduledDate : a.dueDate)

  const dated = useMemo(() => {
    const items = [...(scheduled ?? []), ...(nexts ?? []).filter((a) => a.dueDate != null)]
      .filter(notParked)
      .filter((a) => dayOf(a) !== undefined)
      .sort((a, b) => dayOf(a)! - dayOf(b)! || a.order - b.order)
    return {
      tomorrow: items.filter((a) => dayOf(a)! >= tomorrowCal && dayOf(a)! < dayAfterCal),
      dayAfter: items.filter((a) => dayOf(a)! >= dayAfterCal && dayOf(a)! < twoDaysOutCal),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduled, nexts, somedayProjectIds, tomorrowCal, dayAfterCal, twoDaysOutCal])

  const picks = useMemo(
    () =>
      (nexts ?? [])
        .filter(notParked)
        // Already chosen for tomorrow pops to the top, same as Start My Day does for today.
        .sort(
          (a, b) =>
            Number(b.bigThreeDate === tomorrowWorkday) - Number(a.bigThreeDate === tomorrowWorkday) ||
            Number(b.dueDate != null) - Number(a.dueDate != null) || (a.dueDate ?? 0) - (b.dueDate ?? 0) || a.order - b.order,
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nexts, somedayProjectIds, tomorrowWorkday],
  )
  const atCapTomorrow = (tomorrowPinnedCount ?? 0) >= SHORT_LIST_MAX
  const shownPicks = showAllPicks ? picks : picks.filter((a, i) => i < PICK_PREVIEW || a.bigThreeDate === tomorrowWorkday)

  const stepIndex = STEPS.findIndex((s) => s.key === step)
  const goNext = () => setStep(STEPS[Math.min(stepIndex + 1, STEPS.length - 1)].key)
  const goBack = () => setStep(STEPS[Math.max(stepIndex - 1, 0)].key)

  const heading = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  const submitCapture = () => {
    const title = captureValue.trim()
    if (!title) return
    setCaptureValue('')
    void captureToInbox(title).then(() => setCaptured((prev) => [...prev, title]))
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-neutral-100">End My Day</h1>
      <p className="mb-4 text-sm text-neutral-500">
        {heading}. Close out today and decide tomorrow's approach tonight — skip anything, and come back whenever.
      </p>

      {startedAt !== 'inbox' && step === startedAt && (
        <p className="-mt-2 mb-3 text-xs text-neutral-500">
          Picked up where you left off.{' '}
          <button onClick={() => setStep('inbox')} className="text-emerald-400 hover:text-emerald-300">
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
        {step !== 'done' ? (
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

      {step === 'inbox' && (
        <Screen question="Anything still waiting to be sorted?">
          {inboxCount === undefined ? null : inboxCount === 0 ? (
            <Calm>Your Inbox is clear. ✓</Calm>
          ) : (
            <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
              <div className="mb-1 text-2xl font-semibold text-neutral-100">{inboxCount}</div>
              <p className="mb-4 text-sm text-neutral-400">
                {inboxCount === 1 ? 'thing is' : 'things are'} waiting. Clear it now, or leave it — it's safe
                overnight.
              </p>
              <button
                onClick={onProcessInbox}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                Sort them now
              </button>
              <p className="mt-3 text-xs text-neutral-600">
                This takes you to your Inbox. End My Day is in the menu whenever you want to come back.
              </p>
            </div>
          )}
        </Screen>
      )}

      {step === 'tomorrow' && (
        <Screen question="What's already tied to tomorrow?">
          {dated.tomorrow.length === 0 ? (
            <Calm>Nothing tied to tomorrow yet. Open space.</Calm>
          ) : (
            <Group label="Tomorrow" tone="text-sky-400">
              {dated.tomorrow.map((a) => (
                <TaskRow key={a.id} action={a} showProject onOpenProject={onOpenProject} />
              ))}
            </Group>
          )}
          {dated.dayAfter.length > 0 && (
            <p className="mt-4 text-xs text-neutral-500">
              Day after: {dated.dayAfter.slice(0, 3).map((a) => a.title).join(' · ')}
              {dated.dayAfter.length > 3 && ` · +${dated.dayAfter.length - 3} more`}
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

      {step === 'shortlist' && (
        <Screen question="What are the few things you want tomorrow to lead with?">
          <p className="mb-3 text-xs text-neutral-500">
            Pick up to {SHORT_LIST_MAX} — {tomorrowPinnedCount ?? 0} of {SHORT_LIST_MAX} chosen. Optional; you can
            still decide in the morning instead.
          </p>

          {todaysOpenPicks.length > 0 && (
            <div className="mb-4 rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                Today's picks, still open
              </h3>
              <div className="flex flex-col divide-y divide-neutral-900">
                {todaysOpenPicks.map((a) => (
                  <OpenPickRow
                    key={a.id}
                    action={a}
                    actionLabel="Carry into tomorrow"
                    onAction={() => pinToBigThree(a.id, tomorrowWorkday)}
                    disabled={atCapTomorrow}
                    actionTitle={atCapTomorrow ? "Tomorrow's Short List is full — remove one first" : 'Carry into tomorrow'}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-neutral-600">
                Leave it be and it'll just stay on today's list until it rolls off tomorrow.
              </p>
            </div>
          )}

          {picks.length === 0 ? (
            <Calm>No Next Actions yet. Sorting your Inbox will fill this in.</Calm>
          ) : (
            <>
              <div className="flex flex-col divide-y divide-neutral-900">
                {shownPicks.map((a) => (
                  <TaskRow
                    key={a.id}
                    action={a}
                    showProject
                    showBigThreePin
                    pinnedTodayCount={tomorrowPinnedCount}
                    pinDate={tomorrowWorkday}
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

      {step === 'capture' && (
        <Screen question="Anything else on your mind before you close out?">
          <p className="mb-3 text-xs text-neutral-500">
            Get it out of your head — nothing here needs deciding tonight. It'll be waiting in your Inbox.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submitCapture()
            }}
            className="flex gap-2"
          >
            <input
              autoFocus
              value={captureValue}
              onChange={(e) => setCaptureValue(e.target.value)}
              placeholder="Type it and hit Enter"
              className="flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
            />
            <button
              type="submit"
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Add
            </button>
          </form>
          {captured.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1">
              {captured.map((t, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-neutral-400">
                  <span className="text-emerald-500">✓</span>
                  <span className="truncate">{t}</span>
                </li>
              ))}
            </ul>
          )}
        </Screen>
      )}

      {step === 'done' && (
        <Screen question="That's a wrap.">
          {doneToday !== undefined && <p className="mb-4 text-sm text-neutral-400">{doneToday} done today.</p>}
          <div className="mb-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <h2 className="mb-2 text-sm font-medium text-neutral-300">Tomorrow's Short List</h2>
            {(tomorrowActivePins ?? []).length === 0 ? (
              <p className="text-sm text-neutral-500">
                Nothing chosen — that's fine. Start My Day tomorrow can pick it up instead.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {(tomorrowActivePins ?? []).map((a) => (
                  <ShortListLine key={a.id} action={a} />
                ))}
              </ul>
            )}
          </div>
          <button
            onClick={() => {
              clearFlowStep('endday')
              onViewToday()
            }}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Done for today →
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
