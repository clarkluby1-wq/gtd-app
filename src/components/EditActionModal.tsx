import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import { createProjectFromAction, updateAction } from '../db/operations'
import type { Action, ActionStatus, EnergyLevel } from '../db/types'
import { formatShortDate, parseLocalDate, startOfToday } from '../lib/date'
import { followUpPending, waitingStartedAt } from '../lib/waiting'
import { FollowUpDatePicker } from './FollowUpDatePicker'

/** "Added Sep 1 · Waiting since Sep 10 · Followed up Sep 15, Sep 22" — everything you might want to recall about a task, in one line. */
function historyLine(a: Action): string {
  const parts = [`Added ${formatShortDate(a.createdAt)}`]
  if (a.status === 'waiting') parts.push(`Waiting since ${formatShortDate(waitingStartedAt(a))}`)
  if (a.status === 'waiting' && followUpPending(a)) parts.push(`Check back ${formatShortDate(a.followUpDate!)}`)
  const followUps = a.followUps ?? []
  if (followUps.length) {
    const shown = followUps.slice(-6).map(formatShortDate).join(', ')
    parts.push(`Followed up ${followUps.length > 6 ? '… ' : ''}${shown}`)
  }
  if (a.completedAt) parts.push(`Done ${formatShortDate(a.completedAt)}`)
  return parts.join(' · ')
}

type EditType = 'next' | 'waiting' | 'someday' | 'scheduled'

const TYPES: { key: EditType; label: string; status: ActionStatus }[] = [
  { key: 'next', label: 'Next Action', status: 'next' },
  { key: 'waiting', label: 'Waiting For', status: 'waiting' },
  { key: 'someday', label: 'Someday', status: 'someday' },
  { key: 'scheduled', label: 'Scheduled', status: 'scheduled' },
]

function statusToType(status: ActionStatus): EditType {
  if (status === 'waiting') return 'waiting'
  if (status === 'someday') return 'someday'
  if (status === 'scheduled') return 'scheduled'
  return 'next'
}

function toDateInputValue(ts?: number) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function EditActionModal({ action, onClose }: { action: Action; onClose: () => void }) {
  const contexts = useLiveQuery(() => db.contexts.orderBy('order').toArray())
  const projects = useLiveQuery(() => db.projects.where('status').equals('active').toArray())
  const areas = useLiveQuery(() => db.areasOfFocus.orderBy('order').toArray())
  // Same count the star on a Next Actions row uses, minus this action, so the cap can never disagree with it.
  const otherPinnedCount = useLiveQuery(
    async () =>
      (await db.actions.where('status').equals('next').toArray()).filter(
        (a) => a.id !== action.id && a.bigThreeDate === startOfToday(),
      ).length,
    [action.id],
  )

  const [title, setTitle] = useState(action.title)
  const [type, setType] = useState<EditType>(statusToType(action.status))
  const [contextId, setContextId] = useState(action.contextId ?? '')
  const [energy, setEnergy] = useState<EnergyLevel | undefined>(action.energy)
  const [timeEstimateMin, setTimeEstimateMin] = useState(action.timeEstimateMin?.toString() ?? '')
  const [dueDate, setDueDate] = useState(toDateInputValue(action.dueDate))
  const [waitingOn, setWaitingOn] = useState(action.waitingOn ?? '')
  const [followUpDate, setFollowUpDate] = useState(toDateInputValue(action.followUpDate))
  const [scheduledDate, setScheduledDate] = useState(toDateInputValue(action.scheduledDate))
  const [projectId, setProjectId] = useState(action.projectId ?? '')
  // "This has grown into a project": makes a new project right here and links this action to it as its first step.
  const [makingProject, setMakingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectOutcome, setNewProjectOutcome] = useState('')
  const [newProjectArea, setNewProjectArea] = useState('')
  const [madeProject, setMadeProject] = useState<string | null>(null)
  const [notes, setNotes] = useState(action.notes ?? '')
  const [bigThree, setBigThree] = useState(action.bigThreeDate === startOfToday())
  const bigThreeFull = (otherPinnedCount ?? 0) >= 3

  const createProject = async () => {
    const name = newProjectName.trim()
    if (!name) return
    const project = await createProjectFromAction(action.id, {
      title: name,
      outcome: newProjectOutcome,
      areaOfFocusId: newProjectArea || undefined,
    })
    setProjectId(project.id)
    setMadeProject(project.title)
    setMakingProject(false)
  }

  const save = async () => {
    const status = TYPES.find((t) => t.key === type)!.status
    // Fields not relevant to the current type are kept, not wiped — switching tabs while
    // deciding shouldn't silently lose what you already typed under another type. They're
    // simply unused until (if ever) that type is selected again.
    await updateAction(action.id, {
      title: title.trim() || action.title,
      status,
      projectId: projectId || undefined,
      contextId: contextId || undefined,
      energy,
      timeEstimateMin: timeEstimateMin ? Number(timeEstimateMin) : undefined,
      dueDate: dueDate ? parseLocalDate(dueDate) : undefined,
      waitingOn: waitingOn.trim() || undefined,
      followUpDate: followUpDate ? parseLocalDate(followUpDate) : undefined,
      scheduledDate: scheduledDate ? parseLocalDate(scheduledDate) : undefined,
      notes: notes.trim() || undefined,
      // Only a Next Action can be a Short List pick; leaving Next (or unticking) releases the slot.
      bigThreeDate: type === 'next' && bigThree ? startOfToday() : undefined,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-100 shadow-xl">
        <div className="border-b border-neutral-800 px-5 py-3 text-xs uppercase tracking-wide text-neutral-500">
          Edit
        </div>

        <div className="flex-1 overflow-y-auto p-5">

        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mb-1 w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm font-medium outline-none"
        />
        <div className="mb-3 text-xs text-neutral-500">{historyLine(action)}</div>

        <div className="mb-3 flex gap-1">
          {TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => setType(t.key)}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${
                type === t.key ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-col gap-1.5">
          <label className="text-xs text-neutral-500">Project</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
          >
            <option value="">No project</option>
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          {madeProject && (
            <p className="text-xs text-emerald-400">✓ New project “{madeProject}” created. This action is its first step.</p>
          )}

          {!makingProject && !madeProject && (
            <button
              type="button"
              onClick={() => {
                setNewProjectName(title.trim())
                setMakingProject(true)
              }}
              className="self-start text-xs text-emerald-400 hover:text-emerald-300"
            >
              {action.projectId ? '＋ Make this its own project' : '＋ Turn this into a new project'}
            </button>
          )}

          {makingProject && (
            <div className="mt-1 flex flex-col gap-2 rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-3">
              <div className="text-sm font-medium text-neutral-100">Turn this into a project</div>
              <p className="text-xs text-neutral-400">
                A project is an outcome that takes more than one step. This action stays, as its first next action.
              </p>
              <label className="text-xs text-neutral-500">Project name</label>
              <input
                autoFocus
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
              />
              <label className="text-xs text-neutral-500">What does "done" look like? (optional)</label>
              <textarea
                value={newProjectOutcome}
                onChange={(e) => setNewProjectOutcome(e.target.value)}
                rows={2}
                className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
              />
              <label className="text-xs text-neutral-500">Area of Focus (optional)</label>
              <select
                value={newProjectArea}
                onChange={(e) => setNewProjectArea(e.target.value)}
                className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
              >
                <option value="">No area yet</option>
                {areas?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={!newProjectName.trim()}
                  onClick={() => void createProject()}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
                >
                  Create project
                </button>
                <button
                  type="button"
                  onClick={() => setMakingProject(false)}
                  className="text-xs text-neutral-500 hover:text-neutral-300"
                >
                  Never mind
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <label className="text-xs text-neutral-500">Description — notes, correspondence, backup detail</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Optional — paste relevant context here, keep the title itself scannable"
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
          />

          {type === 'next' && (
            <>
              <button
                type="button"
                onClick={() => setBigThree((v) => !v)}
                disabled={!bigThree && bigThreeFull}
                title={bigThreeFull && !bigThree ? "Today's Short List is full — unpin one first" : undefined}
                className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
                  bigThree
                    ? 'border border-amber-500/40 bg-amber-500/15 text-amber-300'
                    : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
                }`}
              >
                <span>{bigThree ? "★ On today's Short List" : "☆ Add to today's Short List"}</span>
                <span className="text-xs font-normal text-neutral-500">
                  {bigThreeFull && !bigThree ? 'Full — 3 of 3 used' : 'Pinned to the top today'}
                </span>
              </button>

              <label className="text-xs text-neutral-500">Context</label>
              <select
                value={contextId}
                onChange={(e) => setContextId(e.target.value)}
                className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
              >
                <option value="">No context</option>
                {contexts?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <label className="text-xs text-neutral-500">Energy required</label>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as EnergyLevel[]).map((e) => (
                  <button
                    key={e}
                    onClick={() => setEnergy(energy === e ? undefined : e)}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
                      energy === e ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-200'
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>

              <label className="text-xs text-neutral-500">Time estimate (minutes)</label>
              <input
                type="number"
                min={0}
                value={timeEstimateMin}
                onChange={(e) => setTimeEstimateMin(e.target.value)}
                className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
              />

              <label className="text-xs text-neutral-500">Due date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
              />
            </>
          )}

          {type === 'waiting' && (
            <>
              <label className="text-xs text-neutral-500">Waiting on whom?</label>
              <input
                value={waitingOn}
                onChange={(e) => setWaitingOn(e.target.value)}
                className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
              />
              <FollowUpDatePicker value={followUpDate} onChange={setFollowUpDate} />
            </>
          )}

          {type === 'scheduled' && (
            <>
              <label className="text-xs text-neutral-500">Scheduled date</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
              />
            </>
          )}
        </div>
        </div>

        <div className="flex justify-between border-t border-neutral-800 px-5 py-3">
          <button onClick={onClose} className="text-xs text-neutral-500 hover:text-neutral-300">
            Cancel
          </button>
          <button
            onClick={save}
            className="rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
