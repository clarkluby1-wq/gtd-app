import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { db } from '../db/db'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { createGoal, deleteGoal, updateGoal } from '../db/horizons'
import { parseLocalDate, toDateInputValue } from '../lib/date'
import type { Goal, Vision } from '../db/types'

export function GoalsView({
  editGoalId,
  onBackToProject,
}: {
  /** A goal to open straight into edit mode, e.g. when arriving from a project's "ladders up to" link. */
  editGoalId?: string | null
  onBackToProject?: () => void
}) {
  const goals = useLiveQuery(() => db.goals.orderBy('createdAt').toArray())
  const areas = useLiveQuery(() => db.areasOfFocus.orderBy('order').toArray())
  const visions = useLiveQuery(() => db.visions.toArray())

  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [areaOfFocusId, setAreaOfFocusId] = useState('')
  const [visionId, setVisionId] = useState('')
  const [targetDate, setTargetDate] = useState('')

  const create = async () => {
    if (!title.trim() || !areaOfFocusId) return
    await createGoal({
      title: title.trim(),
      areaOfFocusId,
      visionId: visionId || undefined,
      targetDate: targetDate ? parseLocalDate(targetDate) : undefined,
    })
    setTitle('')
    setAreaOfFocusId('')
    setVisionId('')
    setTargetDate('')
    setCreating(false)
  }

  // A deep-linked goal is shown even if it's no longer active, so the link never lands on a page that lacks it.
  const activeGoals = goals?.filter((g) => g.status === 'active' || g.id === editGoalId) ?? []

  return (
    <div className="mx-auto max-w-2xl p-6">
      {onBackToProject && (
        <button onClick={onBackToProject} className="mb-4 text-xs text-neutral-500 hover:text-neutral-300">
          ← Back to project
        </button>
      )}
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-100">Goals</h1>
        <button
          onClick={() => setCreating((v) => !v)}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
        >
          + Add Goal
        </button>
      </div>
      <p className="mb-6 text-sm text-neutral-500">
        Horizon 3 (30,000 ft) — what you want to accomplish in the next 1-2 years, within a specific Area of
        Focus. Concrete enough to know when you've hit it.
      </p>

      {creating && (
        <div className="mb-6 flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Goal title"
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
          />
          <select
            value={areaOfFocusId}
            onChange={(e) => setAreaOfFocusId(e.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
          >
            <option value="">Which Area of Focus?</option>
            {areas?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select
            value={visionId}
            onChange={(e) => setVisionId(e.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
          >
            <option value="">No linked Vision</option>
            {visions?.map((v) => (
              <option key={v.id} value={v.id}>
                {v.statement.slice(0, 60)}
                {v.statement.length > 60 ? '…' : ''}
              </option>
            ))}
          </select>
          <label className="text-xs text-neutral-500">Target date (optional)</label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
          />
          <button
            onClick={create}
            disabled={!title.trim() || !areaOfFocusId}
            className="self-start rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      )}

      {activeGoals.length === 0 && !creating && (
        <div className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
          No active goals yet.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {activeGoals.map((g) => (
          <GoalRow
            key={g.id}
            goal={g}
            areaName={areas?.find((a) => a.id === g.areaOfFocusId)?.name}
            visions={visions}
            startEditing={g.id === editGoalId}
          />
        ))}
      </div>
    </div>
  )
}

function GoalRow({
  goal,
  areaName,
  visions,
  startEditing,
}: {
  goal: Goal
  areaName?: string
  visions?: Vision[]
  startEditing: boolean
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [editing, setEditing] = useState(startEditing)
  const [title, setTitle] = useState(goal.title)
  const [visionId, setVisionId] = useState(goal.visionId ?? '')
  const [targetDate, setTargetDate] = useState(toDateInputValue(goal.targetDate))
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (startEditing) rowRef.current?.scrollIntoView({ block: 'center' })
  }, [startEditing])

  const startEdit = () => {
    setTitle(goal.title)
    setVisionId(goal.visionId ?? '')
    setTargetDate(toDateInputValue(goal.targetDate))
    setEditing(true)
  }

  const save = async () => {
    const trimmed = title.trim()
    if (!trimmed) return
    await updateGoal(goal.id, {
      title: trimmed,
      visionId: visionId || undefined,
      targetDate: targetDate ? parseLocalDate(targetDate) : undefined,
    })
    setEditing(false)
  }

  if (editing) {
    return (
      <div ref={rowRef} className="flex flex-col gap-2 rounded-lg border border-emerald-800 bg-neutral-900 p-4">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save()
            if (e.key === 'Escape') setEditing(false)
          }}
          placeholder="Goal title"
          className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
        />
        {areaName && (
          <div className="text-xs text-neutral-500">
            Area of Focus: <span className="text-emerald-400">{areaName}</span>
          </div>
        )}
        <select
          value={visionId}
          onChange={(e) => setVisionId(e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
        >
          <option value="">No linked Vision</option>
          {visions?.map((v) => (
            <option key={v.id} value={v.id}>
              {v.statement.slice(0, 60)}
              {v.statement.length > 60 ? '…' : ''}
            </option>
          ))}
        </select>
        <label className="text-xs text-neutral-500">Target date (optional)</label>
        <input
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
        />
        <div className="flex gap-2">
          <button
            onClick={() => void save()}
            disabled={!title.trim()}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            Save
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-700"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={rowRef}
      className="group flex items-start justify-between rounded-lg border border-neutral-800 bg-neutral-900 p-4"
    >
      <div className="min-w-0 flex-1 cursor-pointer" onClick={startEdit}>
        <div className="flex items-center gap-2 text-sm font-medium text-neutral-100 hover:underline">
          {goal.title}
          <span className="text-xs text-neutral-600" aria-hidden>
            ✏️
          </span>
          {goal.status !== 'active' && (
            <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs font-normal text-neutral-400 no-underline">
              {goal.status}
            </span>
          )}
        </div>
        <div className="mt-1 flex gap-3 text-xs text-neutral-500">
          {areaName && <span className="text-emerald-400">{areaName}</span>}
          {goal.targetDate && <span>by {new Date(goal.targetDate).toLocaleDateString()}</span>}
        </div>
      </div>
      <div className="flex gap-2 touch-reveal">
        {goal.status === 'active' && (
          <button
            onClick={() => updateGoal(goal.id, { status: 'achieved' })}
            className="text-xs text-emerald-400 hover:text-emerald-300"
          >
            Achieved
          </button>
        )}
        <button onClick={() => setConfirmingDelete(true)} className="text-xs text-neutral-600 hover:text-red-400">
          ✕
        </button>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          message={`Delete the goal "${goal.title}"? This can't be undone.`}
          onConfirm={() => {
            deleteGoal(goal.id)
            setConfirmingDelete(false)
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  )
}
