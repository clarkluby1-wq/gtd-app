import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { db } from '../db/db'
import {
  clarifyAsNextAction,
  clarifyAsProject,
  clarifyAsReference,
  clarifyAsScheduled,
  clarifyAsWaitingFor,
  doItNow,
  sendToSomeday,
  trashItem,
} from '../db/operations'
import type { Action, EnergyLevel, Project } from '../db/types'
import { celebrateCompletion } from '../lib/celebrateCompletion'
import { parseLocalDate } from '../lib/date'

/** One-tap picks that line up with the "≤ 15 / 30 / 1 hour" filters, so nobody has to type a number. */
const TIME_CHIPS: { minutes: number; label: string }[] = [
  { minutes: 5, label: '5 min' },
  { minutes: 15, label: '15 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 hr' },
]

// Inbox processing usually comes in batches ("ten @computer items in a row"), so the last context is preselected.
const LAST_CONTEXT_KEY = 'gtd.lastContextId'

function readLastContextId(): string | undefined {
  try {
    return localStorage.getItem(LAST_CONTEXT_KEY) || undefined
  } catch {
    return undefined
  }
}

function rememberContextId(id: string | undefined) {
  try {
    if (id) localStorage.setItem(LAST_CONTEXT_KEY, id)
    else localStorage.removeItem(LAST_CONTEXT_KEY)
  } catch {
    // Not remembering is fine; the picker just starts empty next time.
  }
}

type Step =
  | 'actionable'
  | 'notActionable'
  | 'twoMinute'
  | 'doingItNow'
  | 'delegate'
  | 'singleOrProject'
  | 'dateSpecific'
  | 'assignNextAction'
  | 'defineProject'

const STEP_QUESTION: Record<Step, string> = {
  actionable: 'Is it actionable — does it require you to do something?',
  notActionable: "It's not actionable. What should happen to it?",
  twoMinute: 'Will doing it take less than two minutes?',
  doingItNow: 'Go do it now — mark it done when you actually finish.',
  delegate: 'Are you the right person to do this?',
  singleOrProject: 'Can it be done in one step, or does it need more than one action?',
  dateSpecific: 'Does this need to happen on a specific day, or is it just the next time you get to it?',
  assignNextAction: 'Anything that will help you pick this up later? All optional.',
  defineProject: 'Define the project.',
}

const TWO_MINUTES = 120

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function ClarifyModal({ item, onClose }: { item: Action; onClose: () => void }) {
  const [step, setStep] = useState<Step>('actionable')
  const contexts = useLiveQuery(() => db.contexts.orderBy('order').toArray())
  const areas = useLiveQuery(() => db.areasOfFocus.orderBy('order').toArray())
  const goals = useLiveQuery(() => db.goals.where('status').equals('active').toArray())
  const projects = useLiveQuery(() => db.projects.where('status').equals('active').toArray())

  const [contextId, setContextId] = useState<string | undefined>(readLastContextId)
  const [contextTouched, setContextTouched] = useState(false)
  const [linkedProjectId, setLinkedProjectId] = useState<string | undefined>()
  const [energy, setEnergy] = useState<EnergyLevel | undefined>()
  const [timeEstimateMin, setTimeEstimateMin] = useState<number | undefined>()
  const [dueDate, setDueDate] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [waitingOn, setWaitingOn] = useState('')
  const [projectTitle, setProjectTitle] = useState(item.title)
  const [outcome, setOutcome] = useState('')
  const [areaOfFocusId, setAreaOfFocusId] = useState<string | undefined>()
  const [goalId, setGoalId] = useState<string | undefined>()
  const [firstActionTitle, setFirstActionTitle] = useState('')
  const [projectCommitment, setProjectCommitment] = useState<'now' | 'someday'>('now')
  const [secondsLeft, setSecondsLeft] = useState(TWO_MINUTES)
  const [paused, setPaused] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // A remembered context may have been deleted since; never save (or show) one that no longer exists.
  const activeContextId = contextId && contexts?.some((c) => c.id === contextId) ? contextId : undefined
  const contextIsRemembered = !contextTouched && activeContextId !== undefined
  const pickContext = (id: string) => {
    setContextId(id || undefined)
    setContextTouched(true)
  }
  const projectTitleOf = (id?: string) => projects?.find((p) => p.id === id)?.title

  const finish = async (action: () => Promise<unknown>) => {
    await action()
    onClose()
  }

  const stopInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const runInterval = () => {
    stopInterval()
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0))
    }, 1000)
  }

  const startTimer = () => {
    setSecondsLeft(TWO_MINUTES)
    setPaused(false)
    setStep('doingItNow')
    runInterval()
  }

  const togglePause = () => {
    if (paused) {
      setPaused(false)
      runInterval()
    } else {
      setPaused(true)
      stopInterval()
    }
  }

  const markDoneNow = (from: Element) => {
    void celebrateCompletion(item, from)
    void finish(() => doItNow(item.id))
  }

  /** Not confirmed done at the 2-minute mark — don't lose it, just route it into the normal system. */
  const sendToNextActions = () => finish(() => clarifyAsNextAction(item.id, {}))

  useEffect(() => {
    return () => stopInterval()
  }, [])

  useEffect(() => {
    if (secondsLeft === 0) stopInterval()
  }, [secondsLeft])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-100 shadow-xl">
        <div className="border-b border-neutral-800 px-5 py-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Clarify</div>
          <div className="mt-1 text-lg font-medium">{item.title}</div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
        <div className="mb-4 text-sm text-neutral-400">{STEP_QUESTION[step]}</div>

        {step === 'actionable' && (
          <div className="flex gap-2">
            <Btn onClick={() => setStep('notActionable')}>No</Btn>
            <Btn primary onClick={() => setStep('twoMinute')}>
              Yes
            </Btn>
          </div>
        )}

        {step === 'notActionable' && (
          <div className="flex flex-col gap-2">
            <Btn onClick={() => finish(() => trashItem(item.id))}>🗑 Trash it</Btn>
            <Btn onClick={() => finish(() => sendToSomeday(item.id))}>🌙 Someday / Maybe</Btn>
            <Btn onClick={() => finish(() => clarifyAsReference(item.id, { title: item.title }))}>
              📎 File as Reference
            </Btn>
            <div className="my-1 text-center text-xs text-neutral-600">
              — or already waiting on someone for this? —
            </div>
            <input
              value={waitingOn}
              onChange={(e) => setWaitingOn(e.target.value)}
              placeholder="Who is it waiting on?"
              className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
            />
            <Btn
              disabled={!waitingOn.trim()}
              onClick={() => finish(() => clarifyAsWaitingFor(item.id, waitingOn.trim()))}
            >
              ⏳ Confirm — Waiting For {waitingOn.trim() || '…'}
            </Btn>
          </div>
        )}

        {step === 'twoMinute' && (
          <div className="flex gap-2">
            <Btn primary onClick={startTimer}>
              Yes — do it now
            </Btn>
            <Btn onClick={() => setStep('delegate')}>No</Btn>
          </div>
        )}

        {step === 'doingItNow' && (
          <div className="flex flex-col items-center gap-4 py-2">
            <div
              className={`text-5xl font-semibold tabular-nums ${
                secondsLeft === 0 ? 'text-amber-400' : paused ? 'text-neutral-500' : 'text-emerald-400'
              }`}
            >
              {formatCountdown(secondsLeft)}
            </div>

            {secondsLeft > 0 ? (
              <>
                <p className="text-center text-xs text-neutral-500">
                  {paused ? "Paused — resume when you're back on it." : 'Go do it — this stays open until you mark it done.'}
                </p>
                <div className="flex w-full gap-2">
                  <Btn onClick={togglePause}>{paused ? '▶ Resume' : '⏸ Pause'}</Btn>
                  <Btn primary onClick={(e) => markDoneNow(e.currentTarget)}>
                    ✓ Mark Done
                  </Btn>
                </div>
              </>
            ) : (
              <>
                <p className="text-center text-xs text-neutral-500">Time's up — did you finish it?</p>
                <div className="flex w-full gap-2">
                  <Btn onClick={sendToNextActions}>Not yet → Next Actions</Btn>
                  <Btn primary onClick={(e) => markDoneNow(e.currentTarget)}>
                    ✓ Yes, it's done
                  </Btn>
                </div>
              </>
            )}
          </div>
        )}

        {step === 'delegate' && (
          <div className="flex flex-col gap-3">
            <Btn onClick={() => setStep('singleOrProject')}>Yes, I'll do it myself</Btn>
            <Btn onClick={() => finish(() => sendToSomeday(item.id))}>Not sure yet — decide later</Btn>
            <div className="my-1 text-center text-xs text-neutral-600">— or delegate it —</div>
            <input
              value={waitingOn}
              onChange={(e) => setWaitingOn(e.target.value)}
              placeholder="Who is it delegated to?"
              className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
            />
            <MoreOptions summary={projectTitleOf(linkedProjectId)}>
              <ProjectSelect value={linkedProjectId} onChange={setLinkedProjectId} projects={projects} />
            </MoreOptions>
            <Btn
              primary
              disabled={!waitingOn.trim()}
              onClick={() => finish(() => clarifyAsWaitingFor(item.id, waitingOn.trim(), linkedProjectId))}
            >
              Confirm — Waiting For {waitingOn.trim() || '…'}
            </Btn>
          </div>
        )}

        {step === 'singleOrProject' && (
          <div className="flex gap-2">
            <Btn primary onClick={() => setStep('dateSpecific')}>
              One step
            </Btn>
            <Btn onClick={() => setStep('defineProject')}>Multiple steps (project)</Btn>
          </div>
        )}

        {step === 'dateSpecific' && (
          <div className="flex flex-col gap-3">
            <Btn onClick={() => setStep('assignNextAction')}>Next time I get to it</Btn>
            <div className="my-1 text-center text-xs text-neutral-600">— or schedule it —</div>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
            />
            <MoreOptions summary={projectTitleOf(linkedProjectId)}>
              <ProjectSelect value={linkedProjectId} onChange={setLinkedProjectId} projects={projects} />
            </MoreOptions>
            <Btn
              primary
              disabled={!scheduledDate}
              onClick={() =>
                finish(() => clarifyAsScheduled(item.id, parseLocalDate(scheduledDate), linkedProjectId))
              }
            >
              Confirm — schedule for {scheduledDate || '…'}
            </Btn>
          </div>
        )}

        {step === 'assignNextAction' && (
          <div className="flex flex-col gap-3">
            <label className="text-xs text-neutral-500">Context</label>
            <select
              value={activeContextId ?? ''}
              onChange={(e) => pickContext(e.target.value)}
              className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
            >
              <option value="">No context</option>
              {contexts?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {contextIsRemembered && (
              <p className="-mt-2 text-xs text-neutral-600">Same as your last item — change it if this one's different.</p>
            )}

            <label className="text-xs text-neutral-500">Energy needed</label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as EnergyLevel[]).map((e) => (
                <Btn key={e} primary={energy === e} onClick={() => setEnergy(energy === e ? undefined : e)}>
                  {e}
                </Btn>
              ))}
            </div>

            <label className="text-xs text-neutral-500">Time needed</label>
            <div className="flex gap-2">
              {TIME_CHIPS.map((t) => (
                <Btn
                  key={t.minutes}
                  primary={timeEstimateMin === t.minutes}
                  onClick={() => setTimeEstimateMin(timeEstimateMin === t.minutes ? undefined : t.minutes)}
                >
                  {t.label}
                </Btn>
              ))}
            </div>

            <MoreOptions
              summary={[dueDate && `due ${dueDate}`, projectTitleOf(linkedProjectId)].filter(Boolean).join(', ')}
            >
              <label className="text-xs text-neutral-500">Due date (optional — a real deadline)</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
              />
              <ProjectSelect value={linkedProjectId} onChange={setLinkedProjectId} projects={projects} />
            </MoreOptions>

            <Btn
              primary
              onClick={() => {
                rememberContextId(activeContextId)
                void finish(() =>
                  clarifyAsNextAction(item.id, {
                    contextId: activeContextId,
                    energy,
                    timeEstimateMin,
                    dueDate: dueDate ? parseLocalDate(dueDate) : undefined,
                    projectId: linkedProjectId,
                  }),
                )
              }}
            >
              Add to Next Actions
            </Btn>
          </div>
        )}

        {step === 'defineProject' && (
          <div className="flex flex-col gap-3">
            <label className="text-xs text-neutral-500">Project title</label>
            <input
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
            />
            <label className="text-xs text-neutral-500">
              Outcome — what does "done" look like when this is successfully complete?
            </label>
            <textarea
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              rows={2}
              className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
            />

            <label className="text-xs text-neutral-500">When do you want to commit to this?</label>
            <div className="flex gap-2">
              <Btn primary={projectCommitment === 'now'} onClick={() => setProjectCommitment('now')}>
                Now
              </Btn>
              <Btn primary={projectCommitment === 'someday'} onClick={() => setProjectCommitment('someday')}>
                Someday / Maybe
              </Btn>
            </div>

            <label className="text-xs text-neutral-500">Area of Focus (optional)</label>
            <select
              value={areaOfFocusId ?? ''}
              onChange={(e) => {
                setAreaOfFocusId(e.target.value || undefined)
                setGoalId(undefined)
              }}
              className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
            >
              <option value="">None</option>
              {areas?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {areaOfFocusId && (
              <>
                <label className="text-xs text-neutral-500">Which Goal does this serve? (optional)</label>
                <select
                  value={goalId ?? ''}
                  onChange={(e) => setGoalId(e.target.value || undefined)}
                  className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
                >
                  <option value="">None</option>
                  {goals
                    ?.filter((g) => g.areaOfFocusId === areaOfFocusId)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.title}
                      </option>
                    ))}
                </select>
              </>
            )}
            {projectCommitment === 'now' ? (
              <>
                <label className="text-xs text-neutral-500">
                  What's the very next physical action to move this forward?
                </label>
                <input
                  value={firstActionTitle}
                  onChange={(e) => setFirstActionTitle(e.target.value)}
                  className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
                />
                <label className="text-xs text-neutral-500">Context for that action (optional)</label>
                <select
                  value={activeContextId ?? ''}
                  onChange={(e) => pickContext(e.target.value)}
                  className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
                >
                  <option value="">No context</option>
                  {contexts?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {contextIsRemembered && (
                  <p className="-mt-2 text-xs text-neutral-600">
                    Same as your last item — change it if this one's different.
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-neutral-600">
                No next action needed yet — this parks the project on Someday/Maybe until you're ready to plan it.
              </p>
            )}
            <Btn
              primary
              disabled={!projectTitle.trim() || (projectCommitment === 'now' && !firstActionTitle.trim())}
              onClick={() => {
                if (projectCommitment === 'now') rememberContextId(activeContextId)
                void finish(() =>
                  clarifyAsProject(item.id, {
                    title: projectTitle.trim(),
                    outcome: outcome.trim(),
                    areaOfFocusId,
                    goalId,
                    status: projectCommitment === 'now' ? 'active' : 'someday',
                    firstActionTitle: projectCommitment === 'now' ? firstActionTitle.trim() : undefined,
                    contextId: projectCommitment === 'now' ? activeContextId : undefined,
                  }),
                )
              }}
            >
              {projectCommitment === 'now' ? 'Create Project' : 'Park in Someday / Maybe'}
            </Btn>
          </div>
        )}
        </div>

        <div className="flex justify-between border-t border-neutral-800 px-5 py-3">
          <button onClick={onClose} className="text-xs text-neutral-500 hover:text-neutral-300">
            Cancel
          </button>
          {step !== 'actionable' && (
            <button
              onClick={() => {
                stopInterval()
                setStep('actionable')
              }}
              className="text-xs text-neutral-500 hover:text-neutral-300"
            >
              Restart
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Collapsed by default; if anything inside is already set, it opens and the toggle names what's set so nothing hides silently. */
function MoreOptions({ summary, children }: { summary?: string; children: ReactNode }) {
  const [open, setOpen] = useState(!!summary)
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="self-start text-xs text-neutral-500 hover:text-neutral-300"
      >
        {open ? '▾' : '▸'} More options
        {summary && !open ? <span className="text-emerald-500"> · {summary}</span> : null}
      </button>
      {open && children}
    </div>
  )
}

function ProjectSelect({
  value,
  onChange,
  projects,
}: {
  value: string | undefined
  onChange: (id: string | undefined) => void
  projects: Project[] | undefined
}) {
  return (
    <>
      <label className="text-xs text-neutral-500">Part of an existing project? (optional)</label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
      >
        <option value="">No project</option>
        {projects?.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </select>
    </>
  )
}

function Btn({
  children,
  onClick,
  primary,
  disabled,
}: {
  children: ReactNode
  onClick: (e: MouseEvent<HTMLButtonElement>) => void
  primary?: boolean
  disabled?: boolean
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
        primary ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
      }`}
    >
      {children}
    </button>
  )
}
