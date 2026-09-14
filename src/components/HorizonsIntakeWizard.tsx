import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { db } from '../db/db'
import { createGoal, createVision, updatePurpose } from '../db/horizons'

type Step = 'intro' | 'areas' | 'goals' | 'vision' | 'purpose' | 'done'

const STEPS: Step[] = ['areas', 'goals', 'vision', 'purpose']

export function HorizonsIntakeWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>('intro')
  const areas = useLiveQuery(() => db.areasOfFocus.orderBy('order').toArray())

  const [newArea, setNewArea] = useState('')
  const [goalDrafts, setGoalDrafts] = useState<Record<string, string>>({})
  const [visionStatement, setVisionStatement] = useState('')
  const [purposeStatement, setPurposeStatement] = useState('')
  const [principlesText, setPrinciplesText] = useState('')

  const stepIndex = STEPS.indexOf(step)

  const addArea = async () => {
    if (!newArea.trim()) return
    const count = await db.areasOfFocus.count()
    await db.areasOfFocus.add({ id: uuid(), name: newArea.trim(), order: count })
    setNewArea('')
  }

  const goNext = async () => {
    if (step === 'goals') {
      for (const [areaOfFocusId, title] of Object.entries(goalDrafts)) {
        if (title.trim()) {
          await createGoal({ title: title.trim(), areaOfFocusId })
        }
      }
    }
    if (step === 'vision' && visionStatement.trim()) {
      await createVision({ statement: visionStatement.trim() })
    }
    if (step === 'purpose') {
      const principles = principlesText
        .split('\n')
        .map((p) => p.trim())
        .filter(Boolean)
      await updatePurpose({ statement: purposeStatement.trim(), principles })
    }

    const next = STEPS[stepIndex + 1]
    setStep(next ?? 'done')
  }

  const goBack = () => {
    if (stepIndex > 0) setStep(STEPS[stepIndex - 1])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-xl border border-neutral-800 bg-neutral-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-3">
          <span className="text-xs uppercase tracking-wide text-neutral-500">Set Up Your Horizons</span>
          <button onClick={onClose} className="text-xs text-neutral-500 hover:text-neutral-300">
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'intro' && (
            <div>
              <h2 className="mb-3 text-lg font-medium text-neutral-100">
                Let's build up your Horizons of Focus
              </h2>
              <p className="mb-4 text-sm text-neutral-400">
                We'll start concrete and climb: first the roles you're already juggling (Areas of Focus), then
                what you want from each in the next year or two (Goals), then the bigger picture (Vision), and
                finally why any of it matters (Purpose). Skip anything — you can always come back.
              </p>
              <button
                onClick={() => setStep('areas')}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                Let's go →
              </button>
            </div>
          )}

          {step === 'areas' && (
            <div>
              <h2 className="mb-1 text-lg font-medium text-neutral-100">Areas of Focus</h2>
              <p className="mb-4 text-sm text-neutral-400">
                Horizon 2 — the ongoing roles you maintain standards for. Here's a starter set; edit it so it
                actually matches your life.
              </p>
              <div className="mb-3 flex flex-col gap-1">
                {areas?.map((a) => (
                  <div key={a.id} className="rounded-md bg-neutral-800 px-3 py-2 text-sm text-neutral-200">
                    {a.name}
                  </div>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void addArea()
                }}
                className="flex gap-2"
              >
                <input
                  value={newArea}
                  onChange={(e) => setNewArea(e.target.value)}
                  placeholder="Add another area…"
                  className="flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
                />
                <button type="submit" className="rounded-md bg-neutral-800 px-3 py-2 text-xs text-neutral-200 hover:bg-emerald-600 hover:text-white">
                  Add
                </button>
              </form>
            </div>
          )}

          {step === 'goals' && (
            <div>
              <h2 className="mb-1 text-lg font-medium text-neutral-100">Goals</h2>
              <p className="mb-4 text-sm text-neutral-400">
                Horizon 3 — for each area, what would you like to accomplish in the next 1-2 years? Leave any
                blank if nothing comes to mind yet.
              </p>
              <div className="flex flex-col gap-3">
                {areas?.map((a) => (
                  <div key={a.id}>
                    <label className="mb-1 block text-xs text-neutral-500">{a.name}</label>
                    <input
                      value={goalDrafts[a.id] ?? ''}
                      onChange={(e) => setGoalDrafts((prev) => ({ ...prev, [a.id]: e.target.value }))}
                      placeholder={`A 1-2 year goal for ${a.name}…`}
                      className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'vision' && (
            <div>
              <h2 className="mb-1 text-lg font-medium text-neutral-100">Vision</h2>
              <p className="mb-4 text-sm text-neutral-400">
                Horizon 4 — 3-5 years from now, if things went wildly well, what would your life look like? Be
                vivid; you can add more specific, per-area visions later.
              </p>
              <textarea
                autoFocus
                value={visionStatement}
                onChange={(e) => setVisionStatement(e.target.value)}
                rows={5}
                placeholder="In 3-5 years…"
                className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
              />
            </div>
          )}

          {step === 'purpose' && (
            <div>
              <h2 className="mb-1 text-lg font-medium text-neutral-100">Purpose & Principles</h2>
              <p className="mb-4 text-sm text-neutral-400">
                Horizon 5 — why does any of this matter? And what are the standards you won't compromise, no
                matter the pressure?
              </p>
              <textarea
                value={purposeStatement}
                onChange={(e) => setPurposeStatement(e.target.value)}
                rows={3}
                placeholder="The deeper reason behind it all…"
                className="mb-3 w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
              />
              <label className="mb-1 block text-xs text-neutral-500">Principles (one per line)</label>
              <textarea
                value={principlesText}
                onChange={(e) => setPrinciplesText(e.target.value)}
                rows={3}
                placeholder={'e.g. Family comes before work emergencies\nNever compromise on sleep'}
                className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
              />
            </div>
          )}

          {step === 'done' && (
            <div>
              <h2 className="mb-3 text-lg font-medium text-neutral-100">Your Horizons are set</h2>
              <p className="mb-4 text-sm text-neutral-400">
                Nothing here is permanent — revisit any level whenever it stops feeling true, especially during a
                Weekly Review. You'll find them all under "Horizons of Focus" in the sidebar.
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

        {step !== 'intro' && step !== 'done' && (
          <div className="flex items-center justify-between border-t border-neutral-800 px-5 py-3">
            <button onClick={goBack} className="text-xs text-neutral-500 hover:text-neutral-300">
              ← Back
            </button>
            <div className="flex gap-1">
              {STEPS.map((s) => (
                <span
                  key={s}
                  className={`h-1.5 w-6 rounded-full ${s === step ? 'bg-emerald-500' : 'bg-neutral-700'}`}
                />
              ))}
            </div>
            <button
              onClick={goNext}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
            >
              {stepIndex === STEPS.length - 1 ? 'Finish' : 'Next →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
