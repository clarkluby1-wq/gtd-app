import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import { addActionToProject, completeProject, deleteProject, updateProject } from '../db/operations'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { TaskRow } from '../components/TaskRow'
import { parseLocalDate } from '../lib/date'
import type { ActionStatus } from '../db/types'

type NewActionType = 'next' | 'waiting' | 'someday' | 'scheduled'

const NEW_ACTION_TYPES: { key: NewActionType; label: string; status: ActionStatus; placeholder: string }[] = [
  { key: 'next', label: 'Next Action', status: 'next', placeholder: 'Add a next action for this project…' },
  { key: 'waiting', label: 'Waiting For', status: 'waiting', placeholder: 'What are you waiting for?' },
  { key: 'someday', label: 'Someday', status: 'someday', placeholder: 'Add a someday/maybe idea for this project…' },
  { key: 'scheduled', label: 'Scheduled', status: 'scheduled', placeholder: 'What needs to happen on a specific day?' },
]

export function ProjectDetailView({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const project = useLiveQuery(() => db.projects.get(projectId), [projectId])
  const actions = useLiveQuery(() => db.actions.where('projectId').equals(projectId).sortBy('createdAt'), [
    projectId,
  ])
  const areas = useLiveQuery(() => db.areasOfFocus.orderBy('order').toArray())
  const goals = useLiveQuery(() => db.goals.where('status').equals('active').toArray())
  const linkedGoal = useLiveQuery(
    () => (project?.goalId ? db.goals.get(project.goalId) : undefined),
    [project?.goalId],
  )
  const linkedVision = useLiveQuery(
    () => (linkedGoal?.visionId ? db.visions.get(linkedGoal.visionId) : undefined),
    [linkedGoal?.visionId],
  )
  const contexts = useLiveQuery(() => db.contexts.orderBy('order').toArray())
  const [showPlanning, setShowPlanning] = useState(false)

  const [newAction, setNewAction] = useState('')
  const [newActionType, setNewActionType] = useState<NewActionType>('next')
  const [newActionContextId, setNewActionContextId] = useState('')
  const [newActionWaitingOn, setNewActionWaitingOn] = useState('')
  const [newActionScheduledDate, setNewActionScheduledDate] = useState('')
  const [editingOutcome, setEditingOutcome] = useState(false)
  const [outcomeDraft, setOutcomeDraft] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  if (!project) return null

  const saveTitle = () => {
    setEditingTitle(false)
    const trimmed = titleDraft.trim()
    if (trimmed && trimmed !== project.title) {
      updateProject(projectId, { title: trimmed })
    }
  }

  const open = actions?.filter((a) => a.status !== 'done') ?? []
  const done = actions?.filter((a) => a.status === 'done') ?? []

  return (
    <div className="mx-auto max-w-2xl p-6">
      <button onClick={onBack} className="mb-4 text-xs text-neutral-500 hover:text-neutral-300">
        ← Back to Projects
      </button>

      <div className="mb-1 flex items-center justify-between gap-3">
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveTitle()
              if (e.key === 'Escape') setEditingTitle(false)
            }}
            className="flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-xl font-semibold text-neutral-100 outline-none"
          />
        ) : (
          <h1
            onClick={() => {
              setTitleDraft(project.title)
              setEditingTitle(true)
            }}
            className="flex items-center gap-2 cursor-pointer text-xl font-semibold text-neutral-100 hover:underline"
          >
            {project.title}
            {project.status === 'someday' && (
              <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs font-normal text-neutral-400 no-underline">
                🌙 Someday
              </span>
            )}
          </h1>
        )}
        <div className="flex shrink-0 gap-2">
          {project.status === 'someday' ? (
            <button
              onClick={() => updateProject(projectId, { status: 'active' })}
              className="rounded-md bg-emerald-600/20 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-600 hover:text-white"
            >
              Activate
            </button>
          ) : (
            <button
              onClick={() => updateProject(projectId, { status: 'someday' })}
              className="rounded-md bg-neutral-800 px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-700"
              title="Not committed to this right now — park it without deleting it"
            >
              🌙 Move to Someday
            </button>
          )}
          <button
            onClick={() => completeProject(projectId).then(onBack)}
            className="rounded-md bg-emerald-600/20 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-600 hover:text-white"
          >
            Mark complete
          </button>
          <button
            onClick={() => setConfirmingDelete(true)}
            className="rounded-md bg-neutral-800 px-2 py-1 text-xs text-neutral-400 hover:bg-red-600/80 hover:text-white"
          >
            Delete
          </button>
        </div>
      </div>

      {editingOutcome ? (
        <div className="mb-4 flex flex-col gap-2">
          <textarea
            autoFocus
            value={outcomeDraft}
            onChange={(e) => setOutcomeDraft(e.target.value)}
            rows={2}
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
          />
          <button
            onClick={() => {
              updateProject(projectId, { outcome: outcomeDraft })
              setEditingOutcome(false)
            }}
            className="self-start rounded-md bg-emerald-600 px-3 py-1 text-xs text-white"
          >
            Save
          </button>
        </div>
      ) : (
        <p
          onClick={() => {
            setOutcomeDraft(project.outcome)
            setEditingOutcome(true)
          }}
          className="mb-4 cursor-pointer text-sm text-neutral-400 hover:text-neutral-300"
        >
          {project.outcome || 'Click to define what "done" looks like for this project…'}
        </p>
      )}

      <div className="mb-2 flex flex-wrap gap-2">
        <select
          value={project.areaOfFocusId ?? ''}
          onChange={(e) =>
            updateProject(projectId, { areaOfFocusId: e.target.value || undefined, goalId: undefined })
          }
          className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300"
        >
          <option value="">No Area of Focus</option>
          {areas?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        {project.areaOfFocusId && (
          <select
            value={project.goalId ?? ''}
            onChange={(e) => updateProject(projectId, { goalId: e.target.value || undefined })}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300"
          >
            <option value="">No Goal</option>
            {goals
              ?.filter((g) => g.areaOfFocusId === project.areaOfFocusId)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
          </select>
        )}
      </div>

      {(linkedGoal || linkedVision) && (
        <div className="mb-4 flex flex-wrap items-center gap-1 text-xs text-neutral-500">
          <span>↳ ladders up to:</span>
          {linkedGoal && <span className="text-amber-300">🎯 {linkedGoal.title}</span>}
          {linkedVision && <span className="text-neutral-400">→ 🔭 {linkedVision.statement.slice(0, 40)}…</span>}
        </div>
      )}

      {project.planning && (project.planning.purpose || project.planning.brainstorm || project.planning.organized) && (
        <div className="mb-4">
          <button
            onClick={() => setShowPlanning((v) => !v)}
            className="text-xs text-neutral-500 hover:text-neutral-300"
          >
            {showPlanning ? '▾' : '▸'} Natural Planning notes
          </button>
          {showPlanning && (
            <div className="mt-2 flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 text-sm">
              {project.planning.purpose && (
                <div>
                  <div className="text-xs text-neutral-500">Purpose</div>
                  <p className="text-neutral-300">{project.planning.purpose}</p>
                </div>
              )}
              {project.planning.brainstorm && (
                <div>
                  <div className="text-xs text-neutral-500">Brainstorm</div>
                  <p className="whitespace-pre-wrap text-neutral-400">{project.planning.brainstorm}</p>
                </div>
              )}
              {project.planning.organized && (
                <div>
                  <div className="text-xs text-neutral-500">Organized</div>
                  <p className="whitespace-pre-wrap text-neutral-300">{project.planning.organized}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!newAction.trim()) return
          if (newActionType === 'waiting' && !newActionWaitingOn.trim()) return
          if (newActionType === 'scheduled' && !newActionScheduledDate) return

          const status = NEW_ACTION_TYPES.find((t) => t.key === newActionType)!.status
          addActionToProject(projectId, newAction.trim(), {
            status,
            contextId: newActionType === 'next' ? newActionContextId || undefined : undefined,
            waitingOn: newActionType === 'waiting' ? newActionWaitingOn.trim() : undefined,
            scheduledDate:
              newActionType === 'scheduled' ? parseLocalDate(newActionScheduledDate) : undefined,
          })

          setNewAction('')
          setNewActionContextId('')
          setNewActionWaitingOn('')
          setNewActionScheduledDate('')
        }}
        className="mb-4 flex flex-col gap-2"
      >
        <div className="flex gap-1">
          {NEW_ACTION_TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setNewActionType(t.key)}
              className={`rounded-md px-2 py-1 text-xs ${
                newActionType === t.key ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newAction}
            onChange={(e) => setNewAction(e.target.value)}
            placeholder={NEW_ACTION_TYPES.find((t) => t.key === newActionType)!.placeholder}
            className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none"
          />

          {newActionType === 'next' && (
            <select
              value={newActionContextId}
              onChange={(e) => setNewActionContextId(e.target.value)}
              className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-2 text-xs text-neutral-300"
            >
              <option value="">No context</option>
              {contexts?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          {newActionType === 'waiting' && (
            <input
              value={newActionWaitingOn}
              onChange={(e) => setNewActionWaitingOn(e.target.value)}
              placeholder="Waiting on whom?"
              className="w-40 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-2 text-xs text-neutral-300 outline-none"
            />
          )}

          {newActionType === 'scheduled' && (
            <input
              type="date"
              value={newActionScheduledDate}
              onChange={(e) => setNewActionScheduledDate(e.target.value)}
              className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-2 text-xs text-neutral-300 outline-none"
            />
          )}

          <button
            type="submit"
            className="rounded-md bg-neutral-800 px-3 py-2 text-xs text-neutral-200 hover:bg-emerald-600 hover:text-white"
          >
            Add
          </button>
        </div>
      </form>

      <div className="flex flex-col divide-y divide-neutral-900">
        {open.map((a) => (
          <TaskRow key={a.id} action={a} />
        ))}
      </div>

      {!!done.length && (
        <>
          <h2 className="mb-2 mt-6 text-xs uppercase tracking-wide text-neutral-600">Completed</h2>
          <div className="flex flex-col divide-y divide-neutral-900 opacity-60">
            {done.map((a) => (
              <TaskRow key={a.id} action={a} />
            ))}
          </div>
        </>
      )}

      {confirmingDelete && (
        <ConfirmDialog
          message={`Delete project "${project.title}" and all its actions? This can't be undone.`}
          onConfirm={() => {
            setConfirmingDelete(false)
            deleteProject(projectId).then(onBack)
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  )
}
