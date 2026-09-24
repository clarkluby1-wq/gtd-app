import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { db } from '../db/db'
import { ProjectPicker } from './ProjectPicker'
import {
  clarifyAsNextAction,
  clarifyAsProject,
  clarifyAsReference,
  clarifyAsScheduled,
  clarifyAsWaitingFor,
  doItNow,
  sendToSomeday,
  trashItem,
  unpinFromBigThree,
  updateAction,
  type FirstActionSpec,
} from '../db/operations'
import type { Action, EnergyLevel, ProjectStatus } from '../db/types'
import { FollowUpDatePicker } from './FollowUpDatePicker'
import { celebrateCompletion } from '../lib/celebrateCompletion'
import { useCompletionToast } from '../lib/completionToastContext'
import { formatTimeOfDay, parseLocalDate, parseLocalDateTime, startOfWorkday } from '../lib/date'
import { useActiveTodayPins } from '../lib/shortList'

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
  | 'singleOrProject'
  | 'defineProject'
  | 'howDone'
  | 'doingItNow'
  | 'delegate'
  | 'schedule'
  | 'assignNextAction'

/** The steps that clarify one next action — the item itself, or a new project's first action. */
const ACTION_STEPS: Step[] = ['howDone', 'doingItNow', 'delegate', 'schedule', 'assignNextAction']

function stepQuestion(step: Step, isProject: boolean): string {
  switch (step) {
    case 'actionable':
      return 'Is it actionable — does it require you to do something?'
    case 'notActionable':
      return "It's not actionable. What should happen to it?"
    case 'singleOrProject':
      return 'Can it be done in one step, or does it need more than one action?'
    case 'defineProject':
      return 'Define the project and its very next action.'
    case 'howDone':
      return isProject ? 'How will that first action get done?' : 'How will this get done?'
    case 'doingItNow':
      return 'Go do it now — mark it done when you actually finish.'
    case 'delegate':
      return "Who's going to do it?"
    case 'schedule':
      return 'Which day (and time, if it matters) does it need to happen?'
    case 'assignNextAction':
      return 'Anything that will help you pick this up later? All optional.'
  }
}

const TWO_MINUTES = 120

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Set when items are being worked through one after another ("Process inbox"), rather than one-off. */
export type ClarifyQueue = {
  /** How many are still waiting, including this one. */
  left: number
  /** Leave this one where it is and move on. */
  onSkip: () => void
  /** Called after this item was saved; the caller brings up the next one. */
  onFinished: () => void
}

export function ClarifyModal({ item, onClose, queue }: { item: Action; onClose: () => void; queue?: ClarifyQueue }) {
  const [step, setStep] = useState<Step>('actionable')
  const [history, setHistory] = useState<Step[]>([])
  const [kind, setKind] = useState<'single' | 'project'>('single')
  const { notify } = useCompletionToast()
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
  const [scheduledTime, setScheduledTime] = useState('')
  // A dated item is still "a call" or "an errand". Unlike Next Actions this starts empty — it isn't a batch to sort by place.
  const [scheduleContextId, setScheduleContextId] = useState('')
  const [waitingOn, setWaitingOn] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')

  // "This one matters today": puts the next action on today's Short List. With three already there, you pick one to swap
  // out — from any kind of pin, since a Waiting For or Scheduled item can hold a slot too.
  const shortListNow = useActiveTodayPins()
  const [wantsShortList, setWantsShortList] = useState(false)
  const [choosingSwap, setChoosingSwap] = useState(false)
  const [replaceId, setReplaceId] = useState<string | undefined>()
  const shortListFull = (shortListNow?.length ?? 0) >= 3
  const replacing = shortListNow?.find((a) => a.id === replaceId)
  // The captured wording is often a rough note ("need to get Steve to do Sunday's game, need to message him").
  // It can be reworded right here, into a clear next action, and everything after uses the new wording.
  const [title, setTitle] = useState(item.title)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(item.title)
  const titleSaveRef = useRef<Promise<unknown>>(Promise.resolve())
  const titleInputRef = useRef<HTMLTextAreaElement>(null)
  // Enter and losing focus both finish the edit; this makes sure it only happens once.
  const titleEditingRef = useRef(false)
  // Details that don't belong in a scannable title. Saved to the item as you go (like the reword), so nothing typed is lost.
  const [notes, setNotes] = useState(item.notes ?? '')
  const [notesOpen, setNotesOpen] = useState(Boolean(item.notes))
  const savedNotesRef = useRef(item.notes ?? '')
  const [projectTitle, setProjectTitle] = useState(item.title)
  const [outcome, setOutcome] = useState('')
  const [areaOfFocusId, setAreaOfFocusId] = useState<string | undefined>()
  const [goalId, setGoalId] = useState<string | undefined>()
  const [firstActionTitle, setFirstActionTitle] = useState('')
  const [projectCommitment, setProjectCommitment] = useState<'now' | 'someday'>('now')
  const [secondsLeft, setSecondsLeft] = useState(TWO_MINUTES)
  const [paused, setPaused] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const submittingRef = useRef(false)

  const isProject = kind === 'project'
  /** What the action steps are about: the item itself, or the project's first action. */
  const actionTitle = isProject ? firstActionTitle.trim() : title

  const startEditingTitle = () => {
    titleEditingRef.current = true
    setTitleDraft(title)
    setEditingTitle(true)
  }
  const cancelTitleEdit = () => {
    titleEditingRef.current = false
    setTitleDraft(title)
    setEditingTitle(false)
  }
  /** Saves as you go (like renaming in the Inbox), so stopping or skipping later never loses the rewording. */
  const commitTitle = () => {
    if (!titleEditingRef.current) return
    titleEditingRef.current = false
    setEditingTitle(false)
    const trimmed = titleDraft.trim()
    if (!trimmed || trimmed === title) return
    setTitle(trimmed)
    // A project title that was never changed follows the reworded item.
    setProjectTitle((prev) => (prev === title ? trimmed : prev))
    titleSaveRef.current = updateAction(item.id, { title: trimmed })
  }

  const flushNotes = async () => {
    const trimmed = notes.trim()
    if (trimmed === savedNotesRef.current.trim()) return
    savedNotesRef.current = trimmed
    await updateAction(item.id, { notes: trimmed || undefined })
  }

  // A remembered context may have been deleted since; never save (or show) one that no longer exists.
  const activeContextId = contextId && contexts?.some((c) => c.id === contextId) ? contextId : undefined
  const contextIsRemembered = !contextTouched && activeContextId !== undefined
  const pickContext = (id: string) => {
    setContextId(id || undefined)
    setContextTouched(true)
  }
  const projectTitleOf = (id?: string) => projects?.find((p) => p.id === id)?.title

  const go = (next: Step) => {
    setHistory((h) => [...h, step])
    setStep(next)
  }

  const goBack = () => {
    const previous = history[history.length - 1]
    if (!previous) return
    stopInterval()
    setStep(previous)
    setHistory(history.slice(0, -1))
  }

  const restart = () => {
    stopInterval()
    setStep('actionable')
    setHistory([])
  }

  /** Runs a save once, then closes. The guard stops a double-click from creating a project twice. */
  const finish = async (action: () => Promise<unknown>) => {
    if (submittingRef.current) return
    submittingRef.current = true
    try {
      await titleSaveRef.current
      await flushNotes()
      await action()
      if (queue) queue.onFinished()
      else onClose()
    } catch (err) {
      submittingRef.current = false
      throw err
    }
  }

  const saveProject = (status: ProjectStatus, firstAction?: FirstActionSpec) =>
    clarifyAsProject(item.id, {
      title: projectTitle.trim(),
      outcome: outcome.trim(),
      notes: notes.trim() || undefined,
      areaOfFocusId,
      goalId,
      status,
      firstAction,
    })

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
    go('doingItNow')
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
    if (!isProject) {
      void celebrateCompletion({ ...item, title }, from)
      void finish(() => doItNow(item.id))
      return
    }
    // A project needs a next action, so the completion toast asks "what's next?" and can close it out.
    void finish(async () => {
      const { firstAction } = await saveProject('active', { title: actionTitle, status: 'done' })
      if (firstAction) {
        notify(firstAction)
        void celebrateCompletion(firstAction, from)
      }
    })
  }

  /** Not confirmed done at the 2-minute mark — don't lose it, just route it into the normal system. */
  const sendToNextActions = () =>
    finish(() =>
      isProject ? saveProject('active', { title: actionTitle, status: 'next' }) : clarifyAsNextAction(item.id, {}),
    )

  const confirmDelegate = () => {
    const checkBack = followUpDate ? parseLocalDate(followUpDate) : undefined
    return finish(() =>
      isProject
        ? saveProject('active', {
            title: actionTitle,
            status: 'waiting',
            waitingOn: waitingOn.trim(),
            followUpDate: checkBack,
          })
        : clarifyAsWaitingFor(item.id, waitingOn.trim(), linkedProjectId, checkBack),
    )
  }

  /** Undecided who does it: park the whole thing. On a project, the typed first action stays inside it. */
  const notSureWhoDoesIt = () =>
    finish(() => (isProject ? saveProject('someday', { title: actionTitle, status: 'someday' }) : sendToSomeday(item.id)))

  const confirmSchedule = () =>
    finish(() =>
      isProject
        ? saveProject('active', {
            title: actionTitle,
            status: 'scheduled',
            scheduledDate: parseLocalDateTime(scheduledDate, scheduledTime || undefined),
            contextId: scheduleContextId || undefined,
          })
        : clarifyAsScheduled(
            item.id,
            parseLocalDateTime(scheduledDate, scheduledTime || undefined),
            linkedProjectId,
            scheduleContextId || undefined,
          ),
    )

  const confirmNextAction = () => {
    rememberContextId(activeContextId)
    const details = {
      contextId: activeContextId,
      energy,
      timeEstimateMin,
      dueDate: dueDate ? parseLocalDate(dueDate) : undefined,
      bigThreeDate: wantsShortList ? startOfWorkday() : undefined,
    }
    // Only swap something out if the list is still full right now — it may have freed up while you were deciding.
    const swapOut = wantsShortList && shortListFull ? replaceId : undefined
    void finish(async () => {
      if (isProject) await saveProject('active', { title: actionTitle, status: 'next', ...details })
      else await clarifyAsNextAction(item.id, { ...details, projectId: linkedProjectId })
      if (swapOut) await unpinFromBigThree(swapOut)
    })
  }

  const clearShortList = () => {
    setWantsShortList(false)
    setChoosingSwap(false)
    setReplaceId(undefined)
  }

  useEffect(() => {
    return () => stopInterval()
  }, [])

  // Put the cursor at the end, ready to tweak the wording rather than retype it.
  useEffect(() => {
    if (!editingTitle) return
    const el = titleInputRef.current
    el?.focus()
    el?.setSelectionRange(el.value.length, el.value.length)
  }, [editingTitle])

  useEffect(() => {
    if (secondsLeft === 0) stopInterval()
  }, [secondsLeft])

  const projectNote = (where: string) =>
    isProject ? (
      <p className="text-xs text-neutral-600">
        Creates the project “{projectTitle.trim()}” and puts its first action {where}.
      </p>
    ) : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-100 shadow-xl">
        <div className="border-b border-neutral-800 px-5 py-3">
          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-neutral-500">
            <span>Clarify</span>
            {queue && <span className="normal-case tracking-normal">{queue.left} left</span>}
          </div>
          {editingTitle ? (
            <textarea
              ref={titleInputRef}
              rows={2}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  commitTitle()
                }
                if (e.key === 'Escape') cancelTitleEdit()
              }}
              className="mt-1 w-full resize-none rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-base font-medium text-neutral-100 outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={startEditingTitle}
              title="Reword it — make it a clear next action"
              className="group mt-1 flex w-full items-start justify-between gap-3 text-left text-lg font-medium"
            >
              <span>{title}</span>
              <span className="mt-1.5 shrink-0 text-xs font-normal text-neutral-500 group-hover:text-neutral-200">
                ✎ Reword
              </span>
            </button>
          )}
          {notesOpen ? (
            <textarea
              autoFocus={!item.notes}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => void flushNotes()}
              placeholder="Notes — details, steps, reminders. Keep the title short and put the rest here."
              className="mt-2 max-h-40 w-full resize-y rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm text-neutral-200 outline-none placeholder:text-neutral-500"
            />
          ) : (
            <button
              type="button"
              onClick={() => setNotesOpen(true)}
              className="mt-1 text-xs text-neutral-500 hover:text-neutral-300"
            >
              ＋ Add notes (optional)
            </button>
          )}
          {isProject && ACTION_STEPS.includes(step) && (
            <div className="mt-1 text-xs text-neutral-500">
              First action: <span className="text-neutral-300">{actionTitle}</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-4 text-sm text-neutral-400">{stepQuestion(step, isProject)}</div>

          {step === 'actionable' && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Btn primary onClick={() => go('singleOrProject')}>
                  Yes
                </Btn>
                <Btn onClick={() => go('notActionable')}>No</Btn>
              </div>
              <button
                onClick={() => finish(() => sendToSomeday(item.id))}
                className="self-start text-xs text-neutral-500 hover:text-neutral-300"
              >
                🌙 Already know it's not for now — send straight to Someday/Maybe
              </button>
            </div>
          )}

          {step === 'notActionable' && (
            <div className="flex flex-col gap-2">
              <Btn onClick={() => finish(() => trashItem(item.id))}>🗑 Trash it</Btn>
              <Btn onClick={() => finish(() => sendToSomeday(item.id))}>🌙 Someday / Maybe</Btn>
              <Btn onClick={() => finish(() => clarifyAsReference(item.id, { title, content: notes.trim() || undefined }))}>
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

          {step === 'singleOrProject' && (
            <div className="flex gap-2">
              <Btn
                primary
                onClick={() => {
                  setKind('single')
                  go('howDone')
                }}
              >
                One step
              </Btn>
              <Btn
                onClick={() => {
                  setKind('project')
                  go('defineProject')
                }}
              >
                Multiple steps (project)
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
                  <Btn
                    primary
                    disabled={!projectTitle.trim() || !firstActionTitle.trim()}
                    onClick={() => go('howDone')}
                  >
                    Next →
                  </Btn>
                </>
              ) : (
                <>
                  <p className="text-xs text-neutral-600">
                    No next action needed yet — this parks the project on Someday/Maybe until you're ready to plan it.
                  </p>
                  <Btn primary disabled={!projectTitle.trim()} onClick={() => finish(() => saveProject('someday'))}>
                    Park in Someday / Maybe
                  </Btn>
                </>
              )}
            </div>
          )}

          {step === 'howDone' && (
            <div className="flex flex-col gap-2">
              <Btn onClick={startTimer}>⏱ Do it now — under 2 minutes</Btn>
              <Btn onClick={() => go('delegate')}>👤 Someone else does it</Btn>
              <Btn onClick={() => go('schedule')}>📅 On a specific day and/or time</Btn>
              <Btn primary onClick={() => go('assignNextAction')}>
                ✅ Next time I get to it
              </Btn>
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
                    {paused
                      ? "Paused — resume when you're back on it."
                      : 'Go do it — this stays open until you mark it done.'}
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
              <input
                autoFocus
                value={waitingOn}
                onChange={(e) => setWaitingOn(e.target.value)}
                placeholder="Who is it delegated to?"
                className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
              />
              <FollowUpDatePicker value={followUpDate} onChange={setFollowUpDate} />
              {!isProject && (
                <MoreOptions summary={projectTitleOf(linkedProjectId)}>
                  <ProjectSelect value={linkedProjectId} onChange={setLinkedProjectId} title={title} />
                </MoreOptions>
              )}
              {projectNote('in Waiting For')}
              <Btn primary disabled={!waitingOn.trim()} onClick={confirmDelegate}>
                Confirm — Waiting For {waitingOn.trim() || '…'}
              </Btn>
              <div className="my-1 text-center text-xs text-neutral-600">— not sure who'll do it yet? —</div>
              <Btn onClick={notSureWhoDoesIt}>Not sure yet — decide later</Btn>
            </div>
          )}

          {step === 'schedule' && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
                />
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  aria-label="Time — optional, only if it truly has to happen then"
                  className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
                />
              </div>
              {contexts && contexts.length > 0 && (
                <select
                  value={scheduleContextId}
                  onChange={(e) => setScheduleContextId(e.target.value)}
                  aria-label="Context (optional)"
                  className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
                >
                  <option value="">Context — optional (a call, an errand…)</option>
                  {contexts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              {!isProject && (
                <MoreOptions summary={projectTitleOf(linkedProjectId)}>
                  <ProjectSelect value={linkedProjectId} onChange={setLinkedProjectId} title={title} />
                </MoreOptions>
              )}
              {projectNote('on the Calendar')}
              <Btn primary disabled={!scheduledDate} onClick={confirmSchedule}>
                Confirm — schedule for {scheduledDate || '…'}
                {scheduledDate && scheduledTime ? ` at ${formatTimeOfDay(parseLocalDateTime(scheduledDate, scheduledTime))}` : ''}
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
                <p className="-mt-2 text-xs text-neutral-600">
                  Same as your last item — change it if this one's different.
                </p>
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

              {choosingSwap ? (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                  <p className="mb-2 text-sm text-neutral-200">
                    Today's Short List already has three. Swap one out for this?
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {shortListNow?.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => {
                          setReplaceId(a.id)
                          setWantsShortList(true)
                          setChoosingSwap(false)
                        }}
                        className="truncate rounded-md bg-neutral-800 px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-700"
                      >
                        Replace “{a.title}”
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setChoosingSwap(false)}
                    className="mt-2 text-xs text-neutral-500 hover:text-neutral-300"
                  >
                    Never mind
                  </button>
                </div>
              ) : wantsShortList ? (
                <button
                  onClick={clearShortList}
                  title="Take it off the Short List"
                  className="flex items-center justify-between gap-3 rounded-md border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-left text-sm font-medium text-amber-300"
                >
                  <span>
                    {replacing && shortListFull
                      ? `★ On today's Short List — replaces “${replacing.title}”`
                      : "★ On today's Short List"}
                  </span>
                  <span className="shrink-0 text-xs font-normal text-neutral-500">tap to undo</span>
                </button>
              ) : (
                <button
                  onClick={() => (shortListFull ? setChoosingSwap(true) : setWantsShortList(true))}
                  className="flex items-center justify-between gap-3 rounded-md bg-neutral-800 px-3 py-2 text-left text-sm font-medium text-neutral-200 hover:bg-neutral-700"
                >
                  <span>☆ Add to today's Short List</span>
                  <span className="shrink-0 text-xs font-normal text-neutral-500">what matters most today</span>
                </button>
              )}

              <MoreOptions
                summary={[dueDate && `due ${dueDate}`, !isProject && projectTitleOf(linkedProjectId)]
                  .filter(Boolean)
                  .join(', ')}
              >
                <label className="text-xs text-neutral-500">Due date (optional — a real deadline)</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
                />
                {!isProject && (
                  <ProjectSelect value={linkedProjectId} onChange={setLinkedProjectId} title={title} />
                )}
              </MoreOptions>

              {projectNote('in Next Actions')}
              <Btn primary onClick={confirmNextAction}>
                {isProject ? 'Create project' : 'Add to Next Actions'}
              </Btn>
            </div>
          )}
        </div>

        <div className="flex justify-between border-t border-neutral-800 px-5 py-3">
          <button
            onClick={() => void flushNotes().then(onClose)}
            className="text-xs text-neutral-500 hover:text-neutral-300"
          >
            {queue ? 'Stop for now' : 'Cancel'}
          </button>
          <div className="flex gap-4">
            {queue && (
              <button
                onClick={() => void flushNotes().then(queue.onSkip)}
                title="Leave it in the Inbox and go to the next one"
                className="text-xs text-neutral-400 hover:text-neutral-200"
              >
                Skip →
              </button>
            )}
            {history.length > 0 && (
              <button onClick={goBack} className="text-xs text-neutral-500 hover:text-neutral-300">
                ← Back
              </button>
            )}
            {step !== 'actionable' && (
              <button onClick={restart} className="text-xs text-neutral-500 hover:text-neutral-300">
                Restart
              </button>
            )}
          </div>
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
  title,
}: {
  value: string | undefined
  onChange: (id: string | undefined) => void
  /** The item's wording, used to suggest projects. */
  title: string
}) {
  return (
    <>
      <label className="text-xs text-neutral-500">Part of an existing project? (optional)</label>
      <ProjectPicker value={value} onChange={onChange} title={title} />
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
