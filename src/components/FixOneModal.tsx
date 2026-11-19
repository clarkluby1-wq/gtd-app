import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import { completeProject } from '../db/operations'
import { isProjectStalled } from '../lib/projectHealth'
import { useEscapeKey } from '../lib/useEscapeKey'
import { AddAndClarify } from './AddAndClarify'
import { ExistingActionPicker } from './ExistingActionPicker'

/**
 * Fix the projects that have nothing in motion, one at a time — no pile, no count. It shows one project and asks for
 * its very next step (through the same Clarify walkthrough as everywhere else); once it's fixed the next one appears.
 * "Not now" moves past a project without changing it.
 */
export function FixOneModal({ onClose }: { onClose: () => void }) {
  const projects = useLiveQuery(() => db.projects.where('status').equals('active').sortBy('createdAt'))
  const actions = useLiveQuery(() => db.actions.toArray())
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [choosingExisting, setChoosingExisting] = useState(false)
  useEscapeKey(onClose)

  if (!projects || !actions) return null
  const current = projects.find((p) => isProjectStalled(p, actions) && !skipped.has(p.id))
  const stalledLeft = projects.some((p) => isProjectStalled(p, actions))
  const items = current ? actions.filter((a) => a.projectId === current.id) : []
  const allDone = items.length > 0 && items.every((a) => a.status === 'done')

  const skip = () => {
    if (!current) return
    setChoosingExisting(false)
    setSkipped((prev) => new Set(prev).add(current.id))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl bg-neutral-900 text-neutral-100 shadow-xl">
        <div className="px-6 pt-5 text-sm text-neutral-400">
          Give a project its first step
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
          {current ? (
            <>
              <div>
                <h2 className="text-lg font-semibold">{current.title}</h2>
                {current.outcome && <p className="mt-1 text-sm text-neutral-500">{current.outcome}</p>}
              </div>
              <p className="text-sm text-amber-300/80">
                {allDone ? "Everything here is done. Finish the project, or add what's next." : 'Nothing is in motion yet.'}
              </p>

              <div>
                <label className="mb-1 block text-xs text-neutral-500">What's the very next step?</label>
                <AddAndClarify placeholder="Type the next step…" projectId={current.id} />
                {choosingExisting ? (
                  <ExistingActionPicker
                    key={current.id}
                    project={current}
                    onLinked={() => setChoosingExisting(false)}
                    onClose={() => setChoosingExisting(false)}
                  />
                ) : (
                  <button
                    onClick={() => setChoosingExisting(true)}
                    className="mt-2 text-xs text-neutral-400 hover:text-neutral-200"
                  >
                    Or use an existing action →
                  </button>
                )}
              </div>

              {allDone && (
                <button
                  onClick={() => void completeProject(current.id)}
                  className="self-start rounded-full bg-emerald-600/15 px-4 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-600 hover:text-white"
                >
                  ✓ Finish this project
                </button>
              )}
            </>
          ) : (
            <p className="py-6 text-center text-sm text-emerald-400">
              {stalledLeft ? "That's all for now — the rest can wait. ✓" : 'Every project has something in motion. ✓'}
            </p>
          )}
        </div>

        <div className="flex justify-between px-6 pb-5 pt-2">
          <button onClick={onClose} className="text-xs text-neutral-500 hover:text-neutral-300">
            Close
          </button>
          {current && (
            <button onClick={skip} className="text-xs text-neutral-400 hover:text-neutral-200">
              Not now — next one →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
