import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { db } from '../../db/db'
import { getLastBackupAt, isBackupDue } from '../../db/backup'
import { finishReview, saveGuidedStep, setReviewItemDone } from '../../db/weeklyReview'
import { celebrate, originOf } from '../../lib/celebrate'
import { formatShortDate } from '../../lib/date'
import { describeStatus, getReviewSchedule } from '../../lib/reviewSchedule'
import { isItemDone, normalizeChecklist, type ReviewPhase } from '../../lib/weeklyReviewTemplate'
import type { ViewKey } from '../Sidebar'
import type { WeeklyReview } from '../../db/types'
import {
  AreasStep,
  BackupStep,
  CollectStep,
  CreativeStep,
  InboxStep,
  NextActionsStep,
  PreviousCalendarStep,
  ProjectsStep,
  RecapStep,
  SomedayStep,
  UpcomingCalendarStep,
  WaitingStep,
  WinsStep,
} from './ReviewSteps'

const DAY = 24 * 60 * 60 * 1000

type StepKey =
  | 'intro'
  | 'wins'
  | 'collect'
  | 'inbox-zero'
  | 'gate-clear'
  | 'next-actions'
  | 'previous-calendar'
  | 'upcoming-calendar'
  | 'waiting-for'
  | 'projects'
  | 'backup'
  | 'gate-current'
  | 'someday-maybe'
  | 'areas-of-focus'
  | 'creative'
  | 'recap'

type Section = 'start' | 'wins' | ReviewPhase | 'recap'

interface FlowStep {
  key: StepKey
  section: Section
}

/** The walkthrough, in order. The keys that match a checklist item save their progress there. */
const FLOW: FlowStep[] = [
  { key: 'intro', section: 'start' },
  { key: 'wins', section: 'wins' },
  { key: 'collect', section: 'clear' },
  { key: 'inbox-zero', section: 'clear' },
  { key: 'gate-clear', section: 'clear' },
  { key: 'next-actions', section: 'current' },
  { key: 'previous-calendar', section: 'current' },
  { key: 'upcoming-calendar', section: 'current' },
  { key: 'waiting-for', section: 'current' },
  { key: 'projects', section: 'current' },
  { key: 'backup', section: 'current' },
  { key: 'gate-current', section: 'current' },
  { key: 'someday-maybe', section: 'creative' },
  { key: 'areas-of-focus', section: 'creative' },
  { key: 'creative', section: 'creative' },
  { key: 'recap', section: 'recap' },
]

const STRIP: { section: Section; label: string }[] = [
  { section: 'wins', label: 'Wins' },
  { section: 'clear', label: 'Clear' },
  { section: 'current', label: 'Current' },
  { section: 'creative', label: 'Creative' },
  { section: 'recap', label: 'Recap' },
]

const COPY: Record<StepKey, { question: string; hint?: string; short?: string }> = {
  intro: { question: "Ready to check that you're on track?" },
  wins: { question: 'First, look what you got done.', hint: 'The last seven days. Give yourself the credit.' },
  collect: {
    question: 'Anything loose in your head or on your desk?',
    hint: "Type it in — don't sort it now. It all goes to your Inbox.",
    short: 'Collect',
  },
  'inbox-zero': { question: 'Get every inbox to zero.', hint: "This app's, and the ones outside it.", short: 'Inboxes' },
  'gate-clear': { question: 'Get Clear ✓' },
  'next-actions': {
    question: 'Is your Next Actions list still true?',
    hint: 'Cross off anything already done. Delete what is no longer real.',
    short: 'Next Actions',
  },
  'previous-calendar': {
    question: 'Anything left over from before?',
    hint: 'Past appointments and deadlines that still need a follow-up.',
    short: 'Past calendar',
  },
  'upcoming-calendar': {
    question: "What's coming up in the next two weeks?",
    hint: 'Anything to prepare for? Anything colliding?',
    short: 'Upcoming calendar',
  },
  'waiting-for': { question: "Who's gone quiet?", hint: 'A nudge now saves a scramble later.', short: 'Waiting For' },
  projects: {
    question: 'Does every project have a next step?',
    hint: 'A project with no next action stalls.',
    short: 'Projects',
  },
  backup: {
    question: 'Keep a safe copy.',
    hint: 'Everything lives in this browser, so a backup is your safety net.',
    short: 'Backup',
  },
  'gate-current': { question: 'Get Current ✓' },
  'someday-maybe': {
    question: 'Anything ready to wake up — or let go?',
    hint: 'Activate it, keep it parked, or delete it.',
    short: 'Someday / Maybe',
  },
  'areas-of-focus': {
    question: 'Is any part of your life being neglected?',
    hint: 'It is fine for an area to be quiet — just make it a choice.',
    short: 'Areas of Focus',
  },
  creative: {
    question: 'Any new projects, ideas, or commitments?',
    hint: "This is the courageous part. Capture anything you'd love to make happen.",
    short: 'New ideas',
  },
  recap: { question: 'Your week in review.' },
}

/** Steps that count as done when you press "Looks good". The others save their own progress. */
const DONE_ON_NEXT = new Set<StepKey>([
  'collect',
  'next-actions',
  'previous-calendar',
  'upcoming-calendar',
  'waiting-for',
  'projects',
  'someday-maybe',
  'areas-of-focus',
  'creative',
])

const firstIndexOf = (section: Section) => FLOW.findIndex((s) => s.section === section)
const lastIndexOf = (section: Section) => FLOW.map((s) => s.section).lastIndexOf(section)

export function GuidedReview({
  weekStart,
  review,
  onExit,
  onNavigate,
  onStartMindSweep,
}: {
  weekStart: number
  review: WeeklyReview | undefined
  onExit: () => void
  onNavigate: (view: ViewKey) => void
  onStartMindSweep: () => void
}) {
  const [index, setIndex] = useState(0)
  const [finished, setFinished] = useState(false)
  // Set when you jump back to a skipped step from the recap, so finishing it takes you straight back there.
  const [returnToRecap, setReturnToRecap] = useState(false)
  const [openedAt] = useState(() => Date.now())
  const allReviews = useLiveQuery(() => db.weeklyReviews.toArray())

  // Wins and the recap look back to the last review you finished (at most 30 days), or a week if this is your first.
  const lastReviewAt = useMemo(() => {
    const times = (allReviews ?? []).filter((r) => r.date < weekStart && r.completedAt).map((r) => r.completedAt!)
    return times.length ? Math.max(...times) : undefined
  }, [allReviews, weekStart])
  const since = lastReviewAt !== undefined ? Math.max(lastReviewAt, openedAt - 30 * DAY) : openedAt - 7 * DAY
  const winsHint =
    lastReviewAt === undefined
      ? 'The last seven days. Give yourself the credit.'
      : lastReviewAt < openedAt - 30 * DAY
        ? "It's been a while — here's the last 30 days. Give yourself the credit."
        : `Since your last review on ${formatShortDate(lastReviewAt)}. Give yourself the credit.`

  const checklist = useMemo(() => normalizeChecklist(review?.checklist), [review])
  const step = FLOW[index]
  const savedIndex = FLOW.findIndex((s) => s.key === review?.guidedStep)

  // Wait for the past reviews to load so the look-back window doesn't change under you.
  if (allReviews === undefined) return null

  const recapIndex = FLOW.length - 1

  const go = (to: number) => {
    const target = Math.max(0, Math.min(FLOW.length - 1, to))
    if (target === recapIndex) setReturnToRecap(false)
    setIndex(target)
    void saveGuidedStep(weekStart, FLOW[target].key)
  }

  /** Forward: the next step, or straight back to the recap if that is where you came from. */
  const forward = () => go(returnToRecap ? recapIndex : index + 1)

  const next = async () => {
    if (DONE_ON_NEXT.has(step.key)) await setReviewItemDone(weekStart, step.key, true)
    if (step.key === 'backup' && !isBackupDue(getLastBackupAt())) await setReviewItemDone(weekStart, 'backup', true)
    forward()
  }

  const jumpToItem = (key: string) => {
    const target = FLOW.findIndex((s) => s.key === key)
    if (target < 0) return
    setReturnToRecap(step.key === 'recap')
    go(target)
  }

  const isGate = step.key === 'gate-clear' || step.key === 'gate-current'
  const canSkip = !['intro', 'wins', 'recap'].includes(step.key) && !isGate

  // ---- the finished screen ----
  if (finished) {
    const schedule = getReviewSchedule()
    return (
      <Frame stripIndex={FLOW.length} onPause={onExit} onJump={() => {}}>
        <div className="py-8 text-center">
          <div className="mb-2 text-4xl" aria-hidden>
            🎉
          </div>
          <h1 className="mb-2 text-2xl font-semibold text-neutral-100">Review complete</h1>
          <p className="mb-1 text-sm text-neutral-400">Your system is current, and so are you.</p>
          {schedule && (
            <p className="mb-6 text-xs text-neutral-500">{describeStatus(schedule, new Date(), true)}</p>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={() => onNavigate('startday')}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Start planning my days →
            </button>
            <button
              onClick={onExit}
              className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
            >
              Close
            </button>
          </div>
        </div>
      </Frame>
    )
  }

  // ---- the intro ----
  if (step.key === 'intro') {
    const canResume = savedIndex > 1
    return (
      <Frame stripIndex={index} onPause={onExit} onJump={go}>
        <div className="py-6">
          <h1 className="mb-2 text-2xl font-semibold text-neutral-100">{COPY.intro.question}</h1>
          <p className="mb-2 text-sm text-neutral-400">
            This is the part of GTD that keeps everything else trustworthy. One step at a time — nothing to hold in your
            head.
          </p>
          <p className="mb-6 text-xs text-neutral-500">You can pause whenever you like. Your place is saved.</p>
          <div className="flex flex-wrap gap-2">
            {canResume ? (
              <>
                <button
                  onClick={() => go(savedIndex)}
                  className="rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  Pick up where I left off
                </button>
                <button
                  onClick={() => go(1)}
                  className="rounded-md border border-neutral-700 px-5 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800"
                >
                  Start from the beginning
                </button>
              </>
            ) : (
              <button
                onClick={() => go(1)}
                className="rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
              >
                Let's go →
              </button>
            )}
          </div>
        </div>
      </Frame>
    )
  }

  // ---- a phase gate: a short moment, not a screen of work ----
  if (isGate) {
    return (
      <Frame stripIndex={index} onPause={onExit} onJump={go}>
        <Gate kind={step.key === 'gate-clear' ? 'clear' : 'current'} onContinue={() => go(index + 1)} />
      </Frame>
    )
  }

  // ---- a normal step ----
  const copy = COPY[step.key]
  const inSection = FLOW.map((s, i) => ({ s, i })).filter(({ s }) => s.section === step.section && !s.key.startsWith('gate'))
  const positionInSection = inSection.findIndex(({ i }) => i === index) + 1
  const isRecap = step.key === 'recap'

  return (
    <Frame stripIndex={index} onPause={onExit} onJump={go}>
      <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">
        {sectionName(step.section)}
        {inSection.length > 1 && !isRecap ? ` · ${positionInSection} of ${inSection.length}` : ''}
      </div>
      <h1 className="mb-1 text-2xl font-semibold text-neutral-100">{copy.question}</h1>
      {(step.key === 'wins' ? winsHint : copy.hint) ? (
        <p className="mb-5 text-sm text-neutral-500">{step.key === 'wins' ? winsHint : copy.hint}</p>
      ) : (
        <div className="mb-5" />
      )}

      <div className="mb-8">
        <StepBody
          stepKey={step.key}
          weekStart={weekStart}
          since={since}
          checklist={checklist}
          onStartMindSweep={onStartMindSweep}
          onJumpToItem={jumpToItem}
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-neutral-900 pt-4">
        <button
          onClick={() => go(index - 1)}
          disabled={index <= 1}
          className="text-xs text-neutral-500 hover:text-neutral-300 disabled:opacity-30"
        >
          ← Back
        </button>
        <div className="flex items-center gap-4">
          {canSkip && (
            <button onClick={forward} className="text-xs text-neutral-500 hover:text-neutral-300">
              Skip for now
            </button>
          )}
          {isRecap ? (
            <FinishButton
              onFinish={async (el) => {
                await finishReview(weekStart)
                celebrate(originOf(el), 'big')
                setFinished(true)
              }}
            />
          ) : (
            <button
              onClick={() => void next()}
              className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              {step.key === 'collect' || step.key === 'creative' || step.key === 'wins' || step.key === 'inbox-zero'
                ? 'Next →'
                : 'Looks good — next →'}
            </button>
          )}
        </div>
      </div>
    </Frame>
  )
}

function sectionName(section: Section): string {
  switch (section) {
    case 'wins':
      return 'Your wins'
    case 'clear':
      return 'Get Clear'
    case 'current':
      return 'Get Current'
    case 'creative':
      return 'Get Creative'
    case 'recap':
      return 'Recap'
    default:
      return ''
  }
}

function FinishButton({ onFinish }: { onFinish: (el: HTMLButtonElement) => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      disabled={busy}
      onClick={(e) => {
        setBusy(true)
        void onFinish(e.currentTarget)
      }}
      className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
    >
      Finish my review
    </button>
  )
}

function StepBody({
  stepKey,
  weekStart,
  since,
  checklist,
  onStartMindSweep,
  onJumpToItem,
}: {
  stepKey: StepKey
  weekStart: number
  since: number
  checklist: ReturnType<typeof normalizeChecklist>
  onStartMindSweep: () => void
  onJumpToItem: (key: string) => void
}) {
  switch (stepKey) {
    case 'wins':
      return <WinsStep since={since} />
    case 'collect':
      return <CollectStep onStartMindSweep={onStartMindSweep} />
    case 'inbox-zero':
      return <InboxStep weekStart={weekStart} checklist={checklist} />
    case 'next-actions':
      return <NextActionsStep />
    case 'previous-calendar':
      return <PreviousCalendarStep />
    case 'upcoming-calendar':
      return <UpcomingCalendarStep />
    case 'waiting-for':
      return <WaitingStep />
    case 'projects':
      return <ProjectsStep />
    case 'backup':
      return <BackupStep weekStart={weekStart} />
    case 'someday-maybe':
      return <SomedayStep />
    case 'areas-of-focus':
      return <AreasStep />
    case 'creative':
      return <CreativeStep onStartMindSweep={onStartMindSweep} />
    case 'recap':
      return (
        <RecapStep
          since={since}
          checklist={checklist.filter((c) => !isItemDone(c))}
          labelFor={(key) => COPY[key as StepKey]?.short ?? key}
          onJump={onJumpToItem}
        />
      )
    default:
      return null
  }
}

/** The frame around every screen: the title, the progress strip, and a way to pause. */
function Frame({
  stripIndex,
  onPause,
  onJump,
  children,
}: {
  stripIndex: number
  onPause: () => void
  onJump: (index: number) => void
  children: ReactNode
}) {
  const currentSection = FLOW[Math.min(stripIndex, FLOW.length - 1)].section
  const finished = stripIndex >= FLOW.length

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-8 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs">
          {STRIP.map((s, i) => {
            const done = finished || lastIndexOf(s.section) < stripIndex
            const active = !finished && currentSection === s.section
            return (
              <span key={s.section} className="flex items-center">
                <button
                  onClick={() => onJump(firstIndexOf(s.section))}
                  className={`flex items-center gap-1.5 rounded-full px-2 py-1 ${
                    active ? 'bg-emerald-600/20 text-emerald-300' : done ? 'text-emerald-500' : 'text-neutral-600 hover:text-neutral-400'
                  }`}
                >
                  <span aria-hidden>{done ? '●' : active ? '◐' : '○'}</span>
                  {s.label}
                </button>
                {i < STRIP.length - 1 && <span className="text-neutral-800">—</span>}
              </span>
            )
          })}
        </div>
        <button onClick={onPause} className="shrink-0 text-xs text-neutral-500 hover:text-neutral-300">
          {finished ? 'Close' : '⏸ Pause'}
        </button>
      </div>
      {children}
    </div>
  )
}

/** A short pause between phases: what you just did, and one button to carry on. */
function Gate({ kind, onContinue }: { kind: 'clear' | 'current'; onContinue: () => void }) {
  const inbox = useLiveQuery(() => db.actions.where('status').equals('inbox').count())

  // A small burst when the phase closes — the confetti setting still decides how much.
  useEffect(() => {
    celebrate({ x: window.innerWidth / 2, y: window.innerHeight / 3 }, 'normal')
  }, [])

  const message =
    kind === 'clear'
      ? inbox === 0
        ? 'Your head is out on the page, and your Inbox is at zero.'
        : `Your head is out on the page. ${inbox ?? ''} left in the Inbox — that's okay, they're safe.`
      : 'Your lists match reality again.'

  return (
    <div className="py-8 text-center">
      <div className="mb-2 text-3xl text-emerald-400" aria-hidden>
        ✓
      </div>
      <h1 className="mb-2 text-2xl font-semibold text-neutral-100">{kind === 'clear' ? 'Get Clear' : 'Get Current'} — done</h1>
      <p className="mb-6 text-sm text-neutral-400">{message}</p>
      <button
        onClick={onContinue}
        className="rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
      >
        {kind === 'clear' ? 'On to Get Current →' : 'On to Get Creative →'}
      </button>
    </div>
  )
}
