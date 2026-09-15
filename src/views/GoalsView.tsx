import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { createGoal, deleteGoal, updateGoal } from '../db/horizons'
import type { Goal } from '../db/types'

export function GoalsView() {
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
      targetDate: targetDate ? new Date(targetDate).getTime() : undefined,
    })
    setTitle('')
    setAreaOfFocusId('')
    setVisionId('')
    setTargetDate('')
    setCreating(false)
  }

  const activeGoals = goals?.filter((g) => g.status === 'active') ?? []

  return (
    <div className="mx-auto max-w-2xl p-6">
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
          <GoalRow key={g.id} goal={g} areaName={areas?.find((a) => a.id === g.areaOfFocusId)?.name} />
        ))}
      </div>
    </div>
  )
}

function GoalRow({ goal, areaName }: { goal: Goal; areaName?: string }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  return (
    <div className="group flex items-start justify-between rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div>
        <div className="text-sm font-medium text-neutral-100">{goal.title}</div>
        <div className="mt-1 flex gap-3 text-xs text-neutral-500">
          {areaName && <span className="text-emerald-400">{areaName}</span>}
          {goal.targetDate && <span>by {new Date(goal.targetDate).toLocaleDateString()}</span>}
        </div>
      </div>
      <div className="flex gap-2 opacity-0 group-hover:opacity-100">
        <button
          onClick={() => updateGoal(goal.id, { status: 'achieved' })}
          className="text-xs text-emerald-400 hover:text-emerald-300"
        >
          Achieved
        </button>
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
