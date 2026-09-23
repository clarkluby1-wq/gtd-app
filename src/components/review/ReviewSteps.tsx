import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { db } from '../../db/db'
import {
  addActionToProject,
  captureToInbox,
  completeProject,
  deleteAction,
  deleteProject,
  updateProject,
} from '../../db/operations'
import { createBackup, backupAgeLabel, getLastBackupAt, isBackupDue } from '../../db/backup'
import { setReviewItemDone, setReviewSubDone, toggleReviewSub } from '../../db/weeklyReview'
import { getHiddenInboxKeys, setHiddenInboxKeys } from '../../lib/weeklyReviewTemplate'
import { formatShortDate, startOfToday, startOfWorkday } from '../../lib/date'
import { isProjectStalled, stalledMessage } from '../../lib/projectHealth'
import { staleNextActions } from '../../lib/staleness'
import { useSomedayProjectIds } from '../../lib/useSomedayProjectIds'
import { needsNudge, waitingStartedAt } from '../../lib/waiting'
import type { Action, Project, WeeklyReviewChecklistItem } from '../../db/types'
import { ClarifyModal } from '../ClarifyModal'
import { ConfirmDialog } from '../ConfirmDialog'
import { FollowUpControl } from '../FollowUpControl'
import { InboxProcessor } from '../InboxProcessor'
import { TaskRow } from '../TaskRow'

const DAY = 24 * 60 * 60 * 1000

// ---------- small shared pieces ----------

function List({ children }: { children: ReactNode }) {
  return <div className="flex flex-col divide-y divide-neutral-900">{children}</div>
}

function Calm({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-800 p-6 text-center text-sm text-neutral-500">
      {children}
    </div>
  )
}

function Good({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-sm text-emerald-400">✓ {children}</p>
}

function Label({ children, tone = 'text-neutral-400' }: { children: ReactNode; tone?: string }) {
  return <div className={`mb-1.5 text-xs font-medium ${tone}`}>{children}</div>
}

function MoreLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className="mt-3 text-xs text-neutral-500 hover:text-neutral-300">
      {children}
    </button>
  )
}

/** A field for getting things out of your head. Everything goes to the Inbox — sorting comes later. */
function CaptureBox({ placeholder }: { placeholder: string }) {
  const [value, setValue] = useState('')
  const [added, setAdded] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = () => {
    const title = value.trim()
    if (!title) return
    setValue('')
    setAdded((prev) => [...prev, title])
    void captureToInbox(title)
    inputRef.current?.focus()
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="mb-3 flex gap-2"
      >
        <input
          ref={inputRef}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
        />
        <button
          type="submit"
          className="rounded-md bg-neutral-800 px-3 py-2 text-xs text-neutral-200 hover:bg-emerald-600 hover:text-white"
        >
          Add
        </button>
      </form>
      {added.length > 0 && (
        <div className="flex flex-col gap-1">
          {added.slice(-6).map((title, i) => (
            <div key={`${i}-${title}`} className="truncate rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-neutral-300">
              ✓ {title}
            </div>
          ))}
          <p className="mt-1 text-xs text-neutral-500">
            {added.length} added to your Inbox
            {added.length > 6 ? ` (showing the last 6)` : ''}.
          </p>
        </div>
      )}
    </div>
  )
}

function MindSweepButton({ onStartMindSweep }: { onStartMindSweep: () => void }) {
  return (
    <button
      onClick={onStartMindSweep}
      className="mt-4 rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800"
    >
      🧹 Want prompts? Do a Mind Sweep
    </button>
  )
}

function useNotParked() {
  const somedayProjectIds = useSomedayProjectIds()
  return (a: { projectId?: string }) => !a.projectId || !somedayProjectIds.has(a.projectId)
}

// ---------- Wins ----------

/** One finished thing. Long titles wrap instead of being cut off — they're the point. */
function WinRow({ icon, iconTone, title, meta }: { icon: string; iconTone: string; title: string; meta?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-md bg-neutral-900 px-3 py-2 text-sm text-neutral-200">
      <span className={`mt-px shrink-0 ${iconTone}`}>{icon}</span>
      <span className="min-w-0 flex-1 break-words">{title}</span>
      {meta && <span className="shrink-0 pt-px text-xs text-neutral-500">{meta}</span>}
    </div>
  )
}

const WIN_PREVIEW = 5

/**
 * What you got done since the last review. Leads with everything that was on your Short List — the things you
 * decided mattered most, day by day — then finished projects, then the rest.
 */
export function WinsStep({ since }: { since: number }) {
  const done = useLiveQuery(
    () =>
      db.actions
        .where('status')
        .equals('done')
        .filter((a) => (a.completedAt ?? 0) >= since)
        .toArray(),
    [since],
  )
  const projects = useLiveQuery(
    () =>
      db.projects
        .where('status')
        .equals('completed')
        .filter((p) => (p.completedAt ?? 0) >= since)
        .toArray(),
    [since],
  )
  const captured = useLiveQuery(() => db.captureEvents.where('createdAt').aboveOrEqual(since).count(), [since])
  const [showAllProjects, setShowAllProjects] = useState(false)
  const [showAllOthers, setShowAllOthers] = useState(false)

  if (done === undefined) return null

  const newestFirst = [...done].sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
  // A finished action keeps the day it was on the Short List, so this is exactly "what you called important".
  const starred = newestFirst.filter((a) => a.bigThreeDate !== undefined)
  const others = newestFirst.filter((a) => a.bigThreeDate === undefined)

  const days = new Map<number, Action[]>()
  for (const a of [...starred].reverse()) days.set(a.bigThreeDate!, [...(days.get(a.bigThreeDate!) ?? []), a])
  const starredDays = [...days.entries()].sort((a, b) => b[0] - a[0])

  const finishedProjects = [...(projects ?? [])].sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
  const today = startOfWorkday()
  const dayLabel = (day: number) =>
    day === today ? 'Today' : new Date(day).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })

  if (newestFirst.length === 0 && finishedProjects.length === 0) {
    return <Calm>A quiet stretch — that's okay. Let's get the next one set up.</Calm>
  }

  return (
    <div>
      {starred.length > 0 ? (
        <section className="mb-7 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="mb-4 flex items-baseline gap-3">
            <span className="text-3xl font-semibold text-amber-300">★ {starred.length}</span>
            <span className="text-sm text-neutral-300">
              from your Short List — the things you said mattered most
            </span>
          </div>
          {starredDays.map(([day, items]) => (
            <div key={day} className="mb-4 last:mb-0">
              <div className="mb-1.5 text-xs font-medium text-amber-400/80">{dayLabel(day)}</div>
              <div className="flex flex-col gap-1.5">
                {items.map((a) => (
                  <WinRow key={a.id} icon="★" iconTone="text-amber-400" title={a.title} />
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : (
        <p className="mb-6 text-xs text-neutral-500">
          Star up to three things each day and they'll gather here — proof of what you decided mattered most.
        </p>
      )}

      {finishedProjects.length > 0 && (
        <section className="mb-7">
          <div className="mb-2 flex items-baseline gap-3">
            <span className="text-2xl font-semibold text-neutral-100">🏁 {finishedProjects.length}</span>
            <span className="text-sm text-neutral-400">
              {finishedProjects.length === 1 ? 'project finished' : 'projects finished'}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {(showAllProjects ? finishedProjects : finishedProjects.slice(0, WIN_PREVIEW)).map((p) => (
              <WinRow
                key={p.id}
                icon="🏁"
                iconTone=""
                title={p.title}
                meta={p.completedAt ? formatShortDate(p.completedAt) : undefined}
              />
            ))}
          </div>
          {finishedProjects.length > WIN_PREVIEW && (
            <MoreLink onClick={() => setShowAllProjects((v) => !v)}>
              {showAllProjects ? 'Show fewer' : `Show all ${finishedProjects.length}`}
            </MoreLink>
          )}
        </section>
      )}

      {others.length > 0 && (
        <section className="mb-6">
          <div className="mb-2 flex items-baseline gap-3">
            <span className="text-2xl font-semibold text-neutral-100">{others.length}</span>
            <span className="text-sm text-neutral-400">
              {starred.length > 0 ? 'other things finished' : others.length === 1 ? 'thing finished' : 'things finished'}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {(showAllOthers ? others : others.slice(0, WIN_PREVIEW)).map((a) => (
              <WinRow key={a.id} icon="✓" iconTone="text-emerald-500" title={a.title} />
            ))}
          </div>
          {others.length > WIN_PREVIEW && (
            <MoreLink onClick={() => setShowAllOthers((v) => !v)}>
              {showAllOthers ? 'Show fewer' : `Show all ${others.length}`}
            </MoreLink>
          )}
        </section>
      )}

      {(captured ?? 0) > 0 && (
        <p className="text-xs text-neutral-500">
          You also captured {captured} thing{captured === 1 ? '' : 's'} so they weren't rattling around in your head.
        </p>
      )}
    </div>
  )
}

// ---------- Get Clear ----------

export function CollectStep({ onStartMindSweep }: { onStartMindSweep: () => void }) {
  return (
    <div>
      <CaptureBox placeholder="Type anything on your mind, press Enter…" />
      <MindSweepButton onStartMindSweep={onStartMindSweep} />
    </div>
  )
}

export function InboxStep({ weekStart, checklist }: { weekStart: number; checklist: WeeklyReviewChecklistItem[] }) {
  const inbox = useLiveQuery(() => db.actions.where('status').equals('inbox').sortBy('order'))
  const [processing, setProcessing] = useState(false)
  const [hidden, setHidden] = useState(getHiddenInboxKeys)
  const item = checklist.find((c) => c.key === 'inbox-zero')
  const appDone = item?.subItems?.find((s) => s.key === 'app-inbox')?.done ?? false
  const count = inbox?.length

  // This app's inbox ticks itself the moment it reaches zero.
  useEffect(() => {
    if (count === 0 && !appDone) void setReviewSubDone(weekStart, 'inbox-zero', 'app-inbox', true)
  }, [count, appDone, weekStart])

  const outside = (item?.subItems ?? []).filter((s) => s.key !== 'app-inbox')
  const others = outside.filter((s) => !hidden.has(s.key))
  const hiddenCount = outside.length - others.length

  /** "I don't have this one" — leaves it off the list for good, and counts it as done so it never blocks the step. */
  const hide = (key: string) => {
    const next = new Set(hidden).add(key)
    setHiddenInboxKeys(next)
    setHidden(next)
    void setReviewSubDone(weekStart, 'inbox-zero', key, true)
  }
  const restoreHidden = () => {
    const keys = outside.filter((s) => hidden.has(s.key)).map((s) => s.key)
    setHiddenInboxKeys(new Set())
    setHidden(new Set())
    for (const key of keys) void setReviewSubDone(weekStart, 'inbox-zero', key, false)
  }

  return (
    <div>
      <div className="mb-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        {count === undefined ? null : count === 0 ? (
          <p className="text-sm text-emerald-400">✓ This app's Inbox is at zero.</p>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-2xl font-semibold text-neutral-100">{count}</div>
              <div className="text-xs text-neutral-500">in this app's Inbox</div>
            </div>
            <button
              onClick={() => setProcessing(true)}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Process inbox
            </button>
          </div>
        )}
      </div>

      <Label>And the ones outside it — tick each as you clear it:</Label>
      <div className="flex flex-col gap-2">
        {others.map((s) => (
          <div key={s.key} className="flex items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-3 text-sm text-neutral-200">
              <input
                type="checkbox"
                checked={s.done}
                onChange={() => void toggleReviewSub(weekStart, 'inbox-zero', s.key)}
                className="h-4 w-4 accent-emerald-600"
              />
              <span className={s.done ? 'text-neutral-500 line-through' : ''}>{s.label}</span>
            </label>
            <button
              onClick={() => hide(s.key)}
              title="Leave this off my list for good"
              className="shrink-0 text-xs text-neutral-600 hover:text-neutral-300"
            >
              don't have this
            </button>
          </div>
        ))}
      </div>
      {hiddenCount > 0 && (
        <MoreLink onClick={restoreHidden}>
          Show the {hiddenCount} I left off
        </MoreLink>
      )}

      {processing && <InboxProcessor items={inbox ?? []} onEnd={() => setProcessing(false)} />}
    </div>
  )
}

// ---------- Get Current ----------

export function NextActionsStep() {
  const nexts = useLiveQuery(() => db.actions.where('status').equals('next').toArray())
  const somedayProjectIds = useSomedayProjectIds()
  const notParked = useNotParked()
  const [showAll, setShowAll] = useState(false)

  const all = useMemo(
    () => (nexts ?? []).filter(notParked).sort((a, b) => a.order - b.order),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nexts, somedayProjectIds],
  )
  const stale = useMemo(
    () =>
      staleNextActions(nexts ?? [], somedayProjectIds)
        .sort((a, b) => b.days - a.days)
        .map((x) => x.action),
    [nexts, somedayProjectIds],
  )

  if (nexts === undefined) return null
  if (all.length === 0) return <Calm>No Next Actions right now.</Calm>

  const shown = showAll ? all : stale
  return (
    <div>
      {!showAll && (
        <>
          {stale.length === 0 ? (
            <Good>Nothing stale — every Next Action has been touched this week.</Good>
          ) : (
            <Label tone="text-amber-400">Untouched for over a week · {stale.length}</Label>
          )}
        </>
      )}
      {shown.length > 0 && (
        <List>
          {shown.map((a) => (
            <TaskRow key={a.id} action={a} showProject />
          ))}
        </List>
      )}
      <MoreLink onClick={() => setShowAll((v) => !v)}>
        {showAll ? 'Show only the stale ones' : `Show all ${all.length} Next Actions`}
      </MoreLink>
    </div>
  )
}

export function PreviousCalendarStep() {
  const scheduled = useLiveQuery(() => db.actions.where('status').equals('scheduled').toArray())
  const nexts = useLiveQuery(() => db.actions.where('status').equals('next').toArray())
  const notParked = useNotParked()
  const today = startOfToday()

  if (scheduled === undefined || nexts === undefined) return null
  const dayOf = (a: Action) => (a.status === 'scheduled' ? a.scheduledDate : a.dueDate)
  const leftover = [...scheduled, ...nexts.filter((a) => a.dueDate != null)]
    .filter(notParked)
    .filter((a) => dayOf(a) !== undefined && dayOf(a)! < today)
    .sort((a, b) => dayOf(a)! - dayOf(b)!)

  return leftover.length === 0 ? (
    <Good>Nothing left over from before.</Good>
  ) : (
    <div>
      <Label tone="text-amber-400">Still open · {leftover.length}</Label>
      <List>
        {leftover.map((a) => (
          <TaskRow key={a.id} action={a} showProject />
        ))}
      </List>
      <p className="mt-3 text-xs text-neutral-500">Tick it off if it happened, or tap it to move it to a new day.</p>
    </div>
  )
}

export function UpcomingCalendarStep() {
  const scheduled = useLiveQuery(() => db.actions.where('status').equals('scheduled').toArray())
  const nexts = useLiveQuery(() => db.actions.where('status').equals('next').toArray())
  const notParked = useNotParked()
  const today = startOfToday()

  if (scheduled === undefined || nexts === undefined) return null
  const dayOf = (a: Action) => (a.status === 'scheduled' ? a.scheduledDate : a.dueDate)
  const upcoming = [...scheduled, ...nexts.filter((a) => a.dueDate != null)]
    .filter(notParked)
    .filter((a) => dayOf(a) !== undefined && dayOf(a)! >= today && dayOf(a)! < today + 14 * DAY)
    .sort((a, b) => dayOf(a)! - dayOf(b)!)

  if (upcoming.length === 0) return <Calm>Nothing on the calendar for the next two weeks — open space.</Calm>

  const groups = new Map<number, Action[]>()
  for (const a of upcoming) {
    const day = new Date(dayOf(a)!).setHours(0, 0, 0, 0)
    groups.set(day, [...(groups.get(day) ?? []), a])
  }
  return (
    <div>
      {[...groups.entries()].map(([day, items]) => (
        <div key={day} className="mb-4">
          <Label tone="text-sky-400">
            {new Date(day).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </Label>
          <List>
            {items.map((a) => (
              <TaskRow key={a.id} action={a} showProject />
            ))}
          </List>
        </div>
      ))}
    </div>
  )
}

export function WaitingStep() {
  const waiting = useLiveQuery(() => db.actions.where('status').equals('waiting').toArray())
  const notParked = useNotParked()
  const [justFollowedUp, setJustFollowedUp] = useState<Set<string>>(new Set())

  if (waiting === undefined) return null
  const active = waiting.filter(notParked)
  const nudges = active
    .filter((a) => needsNudge(a) || justFollowedUp.has(a.id))
    .sort((a, b) => waitingStartedAt(a) - waitingStartedAt(b))
  const quiet = active.length - nudges.length

  return (
    <div>
      {nudges.length === 0 ? (
        <Good>Nobody's overdue for a follow-up.</Good>
      ) : (
        <>
          <Label tone="text-amber-400">Due a nudge · {nudges.filter((a) => needsNudge(a)).length}</Label>
          <List>
            {nudges.map((a) => (
              <TaskRow
                key={a.id}
                action={a}
                showProject
                showWaitingClock
                extraAction={
                  <FollowUpControl
                    action={a}
                    onLogged={() => setJustFollowedUp((prev) => new Set(prev).add(a.id))}
                  />
                }
              />
            ))}
          </List>
        </>
      )}
      {quiet > 0 && (
        <p className="mt-3 text-xs text-neutral-500">
          {quiet} other{quiet === 1 ? ' is' : 's are'} waiting, but not due yet.
        </p>
      )}
    </div>
  )
}

export function ProjectsStep() {
  const projects = useLiveQuery(() => db.projects.where('status').equals('active').toArray())
  const actions = useLiveQuery(() => db.actions.toArray())
  const [fixed, setFixed] = useState<Record<string, string>>({})

  if (projects === undefined || actions === undefined) return null
  const stalled = projects.filter((p) => isProjectStalled(p, actions))
  const visible = projects.filter((p) => stalled.some((s) => s.id === p.id) || fixed[p.id])
  const moving = projects.length - stalled.length

  if (projects.length === 0) return <Calm>No active projects right now.</Calm>

  return (
    <div>
      {stalled.length === 0 ? (
        <Good>Every project has a next step.</Good>
      ) : (
        <Label tone="text-amber-400">Need a next step · {stalled.length}</Label>
      )}
      <div className="flex flex-col gap-2">
        {visible.map((p) => (
          <StalledProject
            key={p.id}
            project={p}
            allDone={(() => {
              const mine = actions.filter((a) => a.projectId === p.id)
              return mine.length > 0 && mine.every((a) => a.status === 'done')
            })()}
            addedTitle={fixed[p.id]}
            onAdded={(title) => setFixed((prev) => ({ ...prev, [p.id]: title }))}
          />
        ))}
      </div>
      {moving > 0 && stalled.length > 0 && (
        <p className="mt-3 text-xs text-neutral-500">
          {moving} other project{moving === 1 ? ' is' : 's are'} moving.
        </p>
      )}
    </div>
  )
}

function StalledProject({
  project,
  allDone,
  addedTitle,
  onAdded,
}: {
  project: Project
  allDone: boolean
  addedTitle?: string
  onAdded: (title: string) => void
}) {
  const [text, setText] = useState('')

  const add = async () => {
    const title = text.trim()
    if (!title) return
    setText('')
    await addActionToProject(project.id, title)
    onAdded(title)
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
      <div className="text-sm font-medium text-neutral-100">{project.title}</div>
      {addedTitle ? (
        <p className="mt-1 text-xs text-emerald-400">✓ Next action added: {addedTitle}</p>
      ) : (
        <>
          <p className="mb-2 mt-0.5 text-xs text-amber-400/90">{stalledMessage(allDone)}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void add()
            }}
            className="flex gap-2"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What's the very next step?"
              className="flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm outline-none"
            />
            <button
              type="submit"
              disabled={!text.trim()}
              className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 hover:bg-emerald-600 hover:text-white disabled:opacity-40"
            >
              Add
            </button>
          </form>
          {allDone && (
            <button
              onClick={() => void completeProject(project.id)}
              className="mt-2 text-xs text-emerald-400 hover:text-emerald-300"
            >
              Or mark the project complete →
            </button>
          )}
        </>
      )}
    </div>
  )
}

export function BackupStep({ weekStart }: { weekStart: number }) {
  const [last, setLast] = useState(getLastBackupAt())
  const due = isBackupDue(last)

  const backUp = async () => {
    await createBackup()
    setLast(getLastBackupAt())
    await setReviewItemDone(weekStart, 'backup', true)
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <p className={`mb-1 text-sm ${due ? 'text-amber-400' : 'text-emerald-400'}`}>
        {last === null ? "You haven't backed up yet." : `Last backup: ${backupAgeLabel(last)}.`}
        {last !== null && !due && ' ✓'}
      </p>
      <p className="mb-3 text-xs text-neutral-500">
        Your browser saves it to your Downloads folder unless you told it to ask where.
      </p>
      <button
        onClick={() => void backUp()}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
      >
        Back up now
      </button>
    </div>
  )
}

// ---------- Get Creative ----------

type SomedayItem =
  | { kind: 'action'; id: string; order: number; action: Action }
  | { kind: 'project'; id: string; order: number; project: Project }

const SOMEDAY_PREVIEW = 8

export function SomedayStep() {
  const actions = useLiveQuery(() => db.actions.where('status').equals('someday').toArray())
  const projects = useLiveQuery(() => db.projects.where('status').equals('someday').toArray())
  const [kept, setKept] = useState<Set<string>>(new Set())
  const [showAll, setShowAll] = useState(false)
  const [clarifying, setClarifying] = useState<Action | null>(null)
  const [deleting, setDeleting] = useState<SomedayItem | null>(null)

  const items = useMemo<SomedayItem[]>(
    () =>
      [
        ...(actions ?? []).map((action): SomedayItem => ({ kind: 'action', id: action.id, order: action.order, action })),
        ...(projects ?? []).map(
          (project): SomedayItem => ({ kind: 'project', id: project.id, order: project.order ?? project.createdAt, project }),
        ),
      ]
        .filter((i) => !kept.has(i.id))
        .sort((a, b) => a.order - b.order),
    [actions, projects, kept],
  )

  if (actions === undefined || projects === undefined) return null
  if (items.length === 0) {
    return kept.size > 0 ? <Good>That's all of them.</Good> : <Calm>Nothing parked here.</Calm>
  }

  const shown = showAll ? items : items.slice(0, SOMEDAY_PREVIEW)
  const btn = 'rounded-md bg-neutral-800 px-2 py-1 text-xs'

  return (
    <div>
      <Label>
        {items.length} parked
      </Label>
      <List>
        {shown.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0 flex-1 truncate text-sm text-neutral-100">
              {item.kind === 'project' ? '📁 ' : ''}
              {item.kind === 'project' ? item.project.title : item.action.title}
            </span>
            <div className="flex shrink-0 gap-1.5">
              <button
                onClick={() =>
                  item.kind === 'project' ? void updateProject(item.project.id, { status: 'active' }) : setClarifying(item.action)
                }
                title="Bring it back to life"
                className={`${btn} text-neutral-300 hover:bg-emerald-600 hover:text-white`}
              >
                Activate
              </button>
              <button
                onClick={() => setKept((prev) => new Set(prev).add(item.id))}
                title="Leave it parked"
                className={`${btn} text-neutral-400 hover:bg-neutral-700`}
              >
                Keep
              </button>
              <button
                onClick={() => setDeleting(item)}
                title="No longer something you want to do"
                className={`${btn} text-neutral-500 hover:bg-red-600/80 hover:text-white`}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </List>
      {!showAll && items.length > SOMEDAY_PREVIEW && (
        <MoreLink onClick={() => setShowAll(true)}>Show the other {items.length - SOMEDAY_PREVIEW}</MoreLink>
      )}

      {clarifying && <ClarifyModal item={clarifying} onClose={() => setClarifying(null)} />}
      {deleting && (
        <ConfirmDialog
          message={
            deleting.kind === 'project'
              ? `Delete project "${deleting.project.title}" and all its actions? This can't be undone.`
              : `Delete "${deleting.action.title}"? This can't be undone.`
          }
          onConfirm={() => {
            const item = deleting
            setDeleting(null)
            if (item.kind === 'project') void deleteProject(item.project.id)
            else void deleteAction(item.action.id)
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}

export function AreasStep() {
  const areas = useLiveQuery(() => db.areasOfFocus.orderBy('order').toArray())
  const projects = useLiveQuery(() => db.projects.where('status').equals('active').toArray())

  if (areas === undefined || projects === undefined) return null
  if (areas.length === 0) return <Calm>No Areas of Focus set up yet.</Calm>

  return (
    <div>
      <List>
        {areas.map((area) => {
          const count = projects.filter((p) => p.areaOfFocusId === area.id).length
          return (
            <div key={area.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-sm text-neutral-100">{area.name}</span>
              <span className={`text-xs ${count === 0 ? 'text-amber-400/90' : 'text-neutral-500'}`}>
                {count === 0 ? 'quiet this week' : `${count} active project${count === 1 ? '' : 's'}`}
              </span>
            </div>
          )
        })}
      </List>
      <p className="mt-3 text-xs text-neutral-500">
        Anything you'd like to start in a quiet area? You can capture it on the next step.
      </p>
    </div>
  )
}

export function CreativeStep({ onStartMindSweep }: { onStartMindSweep: () => void }) {
  return (
    <div>
      <CaptureBox placeholder="A new project, an idea, something you'd love to make happen…" />
      <MindSweepButton onStartMindSweep={onStartMindSweep} />
    </div>
  )
}

// ---------- Recap ----------

export function RecapStep({
  since,
  checklist,
  labelFor,
  onJump,
}: {
  since: number
  checklist: WeeklyReviewChecklistItem[]
  labelFor: (key: string) => string
  onJump: (key: string) => void
}) {
  const done = useLiveQuery(
    () =>
      db.actions
        .where('status')
        .equals('done')
        .filter((a) => (a.completedAt ?? 0) >= since)
        .count(),
    [since],
  )
  const captured = useLiveQuery(() => db.captureEvents.where('createdAt').aboveOrEqual(since).count(), [since])
  const followUps = useLiveQuery(
    async () =>
      (await db.actions.toArray()).reduce((n, a) => n + (a.followUps ?? []).filter((t) => t >= since).length, 0),
    [since],
  )
  const inbox = useLiveQuery(() => db.actions.where('status').equals('inbox').count())
  const projects = useLiveQuery(() => db.projects.where('status').equals('active').toArray())
  const actions = useLiveQuery(() => db.actions.toArray())

  if (done === undefined || projects === undefined || actions === undefined) return null
  const stalled = projects.filter((p) => isProjectStalled(p, actions)).length
  const notDone = checklist.filter((c) => !(c.subItems ? c.subItems.every((s) => s.done) : c.done))

  const line = (good: boolean, text: string) => (
    <li className={`flex gap-2 text-sm ${good ? 'text-neutral-100' : 'text-neutral-300'}`}>
      <span className={good ? 'text-emerald-500' : 'text-amber-400'}>{good ? '✓' : '•'}</span>
      <span>{text}</span>
    </li>
  )

  return (
    <div>
      <ul className="mb-5 flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        {line(true, done === 0 ? 'A quiet week — and you still showed up to review it.' : `Finished ${done} thing${done === 1 ? '' : 's'}`)}
        {(captured ?? 0) > 0 && line(true, `Captured ${captured} thing${captured === 1 ? '' : 's'} out of your head`)}
        {(followUps ?? 0) > 0 && line(true, `Followed up on ${followUps} waiting item${followUps === 1 ? '' : 's'}`)}
        {inbox === 0 ? line(true, 'Inbox at zero') : line(false, `${inbox} still in the Inbox`)}
        {stalled === 0 ? line(true, 'Every project has a next step') : line(false, stalled === 1 ? '1 project still needs a next step' : `${stalled} projects still need a next step`)}
      </ul>

      {notDone.length > 0 && (
        <div>
          <Label>
            Skipped for now · {notDone.length} — you can still finish, or go back to any of them:
          </Label>
          <div className="flex flex-wrap gap-2">
            {notDone.map((c) => (
              <button
                key={c.key}
                onClick={() => onJump(c.key)}
                className="rounded-full bg-neutral-800 px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-700"
              >
                {labelFor(c.key)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
