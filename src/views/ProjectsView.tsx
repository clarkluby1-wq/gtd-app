import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import { v4 as uuid } from 'uuid'
import { DeepPlanModal } from '../components/DeepPlanModal'
import type { Project } from '../db/types'

export function ProjectsView({ onOpen }: { onOpen: (projectId: string) => void }) {
  const projects = useLiveQuery(() => db.projects.where('status').equals('active').sortBy('createdAt'))
  const allActions = useLiveQuery(() => db.actions.toArray())
  const [creating, setCreating] = useState(false)
  const [deepPlanning, setDeepPlanning] = useState(false)
  const [title, setTitle] = useState('')
  const [outcome, setOutcome] = useState('')
  const [status, setStatus] = useState<'active' | 'someday'>('active')

  const progress = (projectId: string) => {
    const items = allActions?.filter((a) => a.projectId === projectId) ?? []
    const done = items.filter((a) => a.status === 'done').length
    return { done, total: items.length }
  }

  const createProject = async () => {
    if (!title.trim()) return
    const project: Project = {
      id: uuid(),
      title: title.trim(),
      outcome: outcome.trim(),
      status,
      createdAt: Date.now(),
    }
    await db.projects.add(project)
    setTitle('')
    setOutcome('')
    setCreating(false)
    if (status === 'active') onOpen(project.id)
    setStatus('active')
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="flex items-center gap-1.5 text-xl font-semibold text-neutral-100">
          Projects
          <span
            title="Your Projects list should only contain things you're genuinely resourcing right now, so it stays trustworthy and doesn't create guilt/noise from stuff you're not really moving on."
            className="cursor-help text-sm text-neutral-500 hover:text-neutral-300"
          >
            ⓘ
          </span>
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setDeepPlanning(true)}
            className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700"
            title="Walk through Purpose, Vision, Brainstorm, Organize, and Next Actions"
          >
            🧭 Deep Plan
          </button>
          <button
            onClick={() => setCreating((v) => !v)}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
          >
            + New Project
          </button>
        </div>
      </div>
      <p className="mb-6 text-sm text-neutral-500">
        Any outcome that requires more than one action. Each project needs a defined outcome and a next action.
      </p>

      {creating && (
        <div className="mb-6 flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Project title"
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
          />
          <textarea
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            rows={2}
            placeholder='Outcome — what does "done" look like?'
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
          />
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setStatus('active')}
              className={`flex-1 rounded-md px-3 py-2 text-xs font-medium ${
                status === 'active' ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'
              }`}
            >
              Active — committed now
            </button>
            <button
              type="button"
              onClick={() => setStatus('someday')}
              className={`flex-1 rounded-md px-3 py-2 text-xs font-medium ${
                status === 'someday' ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300'
              }`}
            >
              Someday — not committed yet
            </button>
          </div>
          <button
            onClick={createProject}
            className="self-start rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
          >
            Create
          </button>
        </div>
      )}

      {projects?.length === 0 && !creating && (
        <div className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
          No active projects yet.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {projects?.map((p) => {
          const { done, total } = progress(p.id)
          return (
            <button
              key={p.id}
              onClick={() => onOpen(p.id)}
              className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-left hover:border-neutral-700"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-neutral-100">{p.title}</span>
                <span className="text-xs text-neutral-500">
                  {done}/{total}
                </span>
              </div>
              {p.outcome && <p className="mt-1 truncate text-sm text-neutral-500">{p.outcome}</p>}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                <div
                  className="h-full bg-emerald-600"
                  style={{ width: total ? `${(done / total) * 100}%` : '0%' }}
                />
              </div>
            </button>
          )
        })}
      </div>

      {deepPlanning && (
        <DeepPlanModal
          onClose={() => setDeepPlanning(false)}
          onCreated={(projectId) => {
            setDeepPlanning(false)
            onOpen(projectId)
          }}
        />
      )}
    </div>
  )
}
