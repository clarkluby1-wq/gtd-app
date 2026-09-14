import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import { createProject } from '../db/operations'

type Step = 'purpose' | 'vision' | 'brainstorm' | 'organize' | 'actions'

const STEPS: Step[] = ['purpose', 'vision', 'brainstorm', 'organize', 'actions']

const STEP_TITLE: Record<Step, string> = {
  purpose: 'Purpose & Principles',
  vision: 'Outcome Visioning',
  brainstorm: 'Brainstorm',
  organize: 'Organize',
  actions: 'Next Actions',
}

const STEP_PROMPT: Record<Step, string> = {
  purpose: 'Why are you doing this? What would make it worth the effort?',
  vision: 'Picture it finished, and gone well. What does that look like, sound like, feel like?',
  brainstorm: "Capture everything that comes to mind — no judgment, no order, no filtering yet.",
  organize: 'Now sort the mess above: what are the pieces, what order do they go in, what matters most?',
  actions: "What's the very next physical action? Add as many as you're ready to commit to.",
}

export function DeepPlanModal({ onClose, onCreated }: { onClose: () => void; onCreated: (projectId: string) => void }) {
  const [step, setStep] = useState<Step>('purpose')
  const areas = useLiveQuery(() => db.areasOfFocus.orderBy('order').toArray())
  const goals = useLiveQuery(() => db.goals.where('status').equals('active').toArray())

  const [title, setTitle] = useState('')
  const [purpose, setPurpose] = useState('')
  const [outcome, setOutcome] = useState('')
  const [brainstorm, setBrainstorm] = useState('')
  const [organized, setOrganized] = useState('')
  const [areaOfFocusId, setAreaOfFocusId] = useState<string | undefined>()
  const [goalId, setGoalId] = useState<string | undefined>()
  const [actions, setActions] = useState<string[]>([''])

  const stepIndex = STEPS.indexOf(step)

  const create = async () => {
    const project = await createProject({
      title: title.trim() || 'Untitled Project',
      outcome: outcome.trim(),
      areaOfFocusId,
      goalId,
      planning: { purpose: purpose.trim(), brainstorm: brainstorm.trim(), organized: organized.trim() },
      firstActionTitles: actions,
    })
    onCreated(project.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-xl border border-neutral-800 bg-neutral-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-3">
          <span className="text-xs uppercase tracking-wide text-neutral-500">
            Natural Planning · {STEP_TITLE[step]}
          </span>
          <button onClick={onClose} className="text-xs text-neutral-500 hover:text-neutral-300">
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'purpose' && (
            <div>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Project title"
                className="mb-4 w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-base font-medium outline-none"
              />
              <p className="mb-2 text-sm text-neutral-400">{STEP_PROMPT.purpose}</p>
              <textarea
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
              />
            </div>
          )}

          {step === 'vision' && (
            <div>
              <p className="mb-2 text-sm text-neutral-400">{STEP_PROMPT.vision}</p>
              <textarea
                autoFocus
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                rows={5}
                placeholder={'This becomes the project\'s "outcome" — what does done look like?'}
                className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
              />
            </div>
          )}

          {step === 'brainstorm' && (
            <div>
              <p className="mb-2 text-sm text-neutral-400">{STEP_PROMPT.brainstorm}</p>
              <textarea
                autoFocus
                value={brainstorm}
                onChange={(e) => setBrainstorm(e.target.value)}
                rows={8}
                placeholder={'One idea per line…\nDoesn\'t need to make sense yet.'}
                className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
              />
            </div>
          )}

          {step === 'organize' && (
            <div>
              <p className="mb-2 text-sm text-neutral-400">{STEP_PROMPT.organize}</p>
              {brainstorm && (
                <div className="mb-3 rounded-md bg-neutral-800/50 p-3 text-xs text-neutral-500 whitespace-pre-wrap">
                  {brainstorm}
                </div>
              )}
              <textarea
                autoFocus
                value={organized}
                onChange={(e) => setOrganized(e.target.value)}
                rows={6}
                placeholder={'Group into components, sequence, or priority…'}
                className="mb-4 w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
              />
              <label className="mb-1 block text-xs text-neutral-500">Area of Focus (optional)</label>
              <select
                value={areaOfFocusId ?? ''}
                onChange={(e) => {
                  setAreaOfFocusId(e.target.value || undefined)
                  setGoalId(undefined)
                }}
                className="mb-3 w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
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
                  <label className="mb-1 block text-xs text-neutral-500">Goal this serves (optional)</label>
                  <select
                    value={goalId ?? ''}
                    onChange={(e) => setGoalId(e.target.value || undefined)}
                    className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
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
            </div>
          )}

          {step === 'actions' && (
            <div>
              <p className="mb-2 text-sm text-neutral-400">{STEP_PROMPT.actions}</p>
              <div className="flex flex-col gap-2">
                {actions.map((a, i) => (
                  <input
                    key={i}
                    autoFocus={i === actions.length - 1}
                    value={a}
                    onChange={(e) => setActions((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                    placeholder={`Next action ${i + 1}`}
                    className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
                  />
                ))}
              </div>
              <button
                onClick={() => setActions((prev) => [...prev, ''])}
                className="mt-2 text-xs text-neutral-500 hover:text-neutral-300"
              >
                + add another
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-neutral-800 px-5 py-3">
          <button
            onClick={() => (stepIndex > 0 ? setStep(STEPS[stepIndex - 1]) : onClose())}
            className="text-xs text-neutral-500 hover:text-neutral-300"
          >
            {stepIndex > 0 ? '← Back' : 'Cancel'}
          </button>
          <div className="flex gap-1">
            {STEPS.map((s) => (
              <span key={s} className={`h-1.5 w-6 rounded-full ${s === step ? 'bg-emerald-500' : 'bg-neutral-700'}`} />
            ))}
          </div>
          <button
            onClick={() =>
              stepIndex === STEPS.length - 1 ? void create() : setStep(STEPS[stepIndex + 1])
            }
            disabled={step === 'purpose' && !title.trim()}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            {stepIndex === STEPS.length - 1 ? 'Create Project' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}
