import { useState } from 'react'
import { captureToInbox, deleteAction } from '../db/operations'
import type { Action } from '../db/types'

interface MindSweepCategory {
  key: string
  title: string
  prompts: string[]
}

// Based on the GTD guided mind sweep: https://institutesuccess.com/articles/leadership/gtd-guided-mind-sweep
const CATEGORIES: MindSweepCategory[] = [
  { key: 'top-of-mind', title: 'Top of Mind', prompts: ["What's on your mind right now?", 'What has your attention?'] },
  {
    key: 'calendar',
    title: 'Your Calendar',
    prompts: [
      'Anything you need to follow up on?',
      'Any unfinished projects?',
      'Anything you need to prepare for — critical deliverables?',
      'Important meetings?',
    ],
  },
  {
    key: 'conversations',
    title: 'Conversations & People',
    prompts: [
      "Any recent conversations or run-ins that weren't on your calendar but created a follow-up?",
      "Someone you told you'd get back to?",
    ],
  },
  {
    key: 'time-away',
    title: 'Upcoming Time Away',
    prompts: [
      'Any vacation or travel coming up?',
      'Anything to prepare or delegate before you go?',
      'Anything with family that needs attention?',
    ],
  },
  { key: 'events', title: 'Events & Occasions', prompts: ['Birthdays', 'School events', 'Celebrations', 'Appointments'] },
  {
    key: 'workspace',
    title: 'Your Workspace',
    prompts: [
      'Papers with unfinished tasks?',
      'Equipment that needs service?',
      'Supplies to reorder?',
      'Anything on the whiteboard?',
    ],
  },
  {
    key: 'home',
    title: 'Your Home',
    prompts: ['Things to fix', 'Calls to make', 'Projects half-done', 'Seasonal tasks creeping up'],
  },
  {
    key: '30000ft',
    title: 'The 30,000-Foot View',
    prompts: [
      'Longer-range plans?',
      'A degree or certification you want to pursue?',
      'Long-term initiatives at work?',
      'Personal or financial goals?',
    ],
  },
  {
    key: 'projects',
    title: 'Projects',
    prompts: ['Every project you have going, at work and at home.', "What's the next action that would move each one forward?"],
  },
  {
    key: 'anything-else',
    title: 'Anything Else?',
    prompts: [
      'Any open loops, commitments, or opportunities?',
      'A new client to reach out to?',
      'A potential hire?',
      "Someone you've been meaning to reconnect with?",
    ],
  },
]

type Phase = 'intro' | 'sweep' | 'done'

export function MindSweepWizard({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [categoryIndex, setCategoryIndex] = useState(0)
  const [draft, setDraft] = useState('')
  const [capturedByCategory, setCapturedByCategory] = useState<Record<string, Action[]>>({})

  const category = CATEGORIES[categoryIndex]
  const captured = capturedByCategory[category?.key] ?? []
  const totalCaptured = Object.values(capturedByCategory).reduce((sum, items) => sum + items.length, 0)

  const addItem = () => {
    const title = draft.trim()
    if (!title) return
    setDraft('')
    void captureToInbox(title).then((action) => {
      setCapturedByCategory((prev) => ({ ...prev, [category.key]: [...(prev[category.key] ?? []), action] }))
    })
  }

  const removeItem = async (id: string) => {
    await deleteAction(id)
    setCapturedByCategory((prev) => ({
      ...prev,
      [category.key]: (prev[category.key] ?? []).filter((a) => a.id !== id),
    }))
  }

  const goNext = () => {
    if (categoryIndex < CATEGORIES.length - 1) setCategoryIndex(categoryIndex + 1)
    else setPhase('done')
  }

  const goBack = () => {
    if (categoryIndex > 0) setCategoryIndex(categoryIndex - 1)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-xl border border-neutral-800 bg-neutral-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-3">
          <span className="text-xs uppercase tracking-wide text-neutral-500">
            Mind Sweep{totalCaptured > 0 ? ` · ${totalCaptured} captured` : ''}
          </span>
          <button onClick={onClose} className="text-xs text-neutral-500 hover:text-neutral-300">
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {phase === 'intro' && (
            <div>
              <h2 className="mb-3 text-lg font-medium text-neutral-100">Clear your head</h2>
              <p className="mb-4 text-sm text-neutral-400">
                A mind sweep walks through {CATEGORIES.length} areas of your life and work, prompting anything
                that's quietly taking up mental space. Don't overthink it and don't filter — if it crosses your
                mind, capture it. Everything you add here goes straight to your Inbox to process later. Takes
                5-30 minutes.
              </p>
              <button
                onClick={() => setPhase('sweep')}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                Let's go →
              </button>
            </div>
          )}

          {phase === 'sweep' && (
            <div>
              <h2 className="mb-1 text-lg font-medium text-neutral-100">{category.title}</h2>
              <ul className="mb-4 flex flex-col gap-1 text-sm text-neutral-400">
                {category.prompts.map((p) => (
                  <li key={p}>• {p}</li>
                ))}
              </ul>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void addItem()
                }}
                className="mb-3 flex gap-2"
              >
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void addItem()
                    }
                  }}
                  placeholder="Type what comes to mind, press Enter…"
                  className="flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
                />
                <button
                  type="submit"
                  className="rounded-md bg-neutral-800 px-3 py-2 text-xs text-neutral-200 hover:bg-emerald-600 hover:text-white"
                >
                  Add
                </button>
              </form>

              {captured.length > 0 && (
                <div className="flex flex-col gap-1">
                  {captured.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between gap-2 rounded-md bg-neutral-800 px-3 py-1.5 text-sm text-neutral-200"
                    >
                      <span className="truncate">{a.title}</span>
                      <button
                        onClick={() => void removeItem(a.id)}
                        className="shrink-0 text-neutral-500 hover:text-red-400"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {phase === 'done' && (
            <div>
              <h2 className="mb-3 text-lg font-medium text-neutral-100">Mind swept</h2>
              <p className="mb-4 text-sm text-neutral-400">
                {totalCaptured === 0
                  ? "Nothing surfaced this time — that's fine too, your head was already clear."
                  : `You captured ${totalCaptured} item${totalCaptured === 1 ? '' : 's'} into your Inbox. Head there next to clarify each one.`}
              </p>
              <button
                onClick={onClose}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                Done
              </button>
            </div>
          )}
        </div>

        {phase === 'sweep' && (
          <div className="flex items-center justify-between border-t border-neutral-800 px-5 py-3">
            <button
              onClick={goBack}
              disabled={categoryIndex === 0}
              className="text-xs text-neutral-500 hover:text-neutral-300 disabled:opacity-30"
            >
              ← Back
            </button>
            <span className="text-xs text-neutral-500">
              {categoryIndex + 1} / {CATEGORIES.length}
            </span>
            <button
              onClick={goNext}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
            >
              {categoryIndex === CATEGORIES.length - 1 ? 'Finish' : 'Next →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
