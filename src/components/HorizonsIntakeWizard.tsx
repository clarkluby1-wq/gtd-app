import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { db } from '../db/db'
import { createGoal, createVision, getPurpose, updateGoal, updatePurpose, updateVision } from '../db/horizons'

type Step = 'intro' | 'areas' | 'goals' | 'vision' | 'purpose' | 'done'

const STEPS: Step[] = ['areas', 'goals', 'vision', 'purpose']

export function HorizonsIntakeWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>('intro')
  const areas = useLiveQuery(() => db.areasOfFocus.orderBy('order').toArray())
  const purpose = useLiveQuery(() => getPurpose())
  const visions = useLiveQuery(() => db.visions.toArray())
  const goals = useLiveQuery(() => db.goals.toArray())

  const [newArea, setNewArea] = useState('')
  const [goalDrafts, setGoalDrafts] = useState<Record<string, string>>({})
  const [goalIds, setGoalIds] = useState<Record<string, string>>({})
  const [visionId, setVisionId] = useState<string | undefined>()
  const [visionStatement, setVisionStatement] = useState('')
  const [purposeStatement, setPurposeStatement] = useState('')
  const [principlesText, setPrinciplesText] = useState('')
  const [seeded, setSeeded] = useState(false)

  const stepIndex = STEPS.indexOf(step)

  // Pre-fill every field from whatever's already saved, once, the first time everything has
  // loaded — so reopening the wizard after a previous pass (or after using the Horizons views
  // directly) shows what's actually there instead of blank inputs implying nothing was kept.
  useEffect(() => {
    if (seeded || !areas || !purpose || !visions || !goals) return

    setPurposeStatement(purpose.statement)
    setPrinciplesText(purpose.principles.join('\n'))

    const overarchingVision = visions.find((v) => !v.areaOfFocusId)
    if (overarchingVision) {
      setVisionId(overarchingVision.id)
      setVisionStatement(overarchingVision.statement)
    }

    const nextGoalIds: Record<string, string> = {}
    const nextGoalDrafts: Record<string, string> = {}
    for (const area of areas) {
      const existing = goals.find((g) => g.areaOfFocusId === area.id)
      if (existing) {
        nextGoalIds[area.id] = existing.id
        nextGoalDrafts[area.id] = existing.title
      }
    }
    setGoalIds(nextGoalIds)
    setGoalDrafts(nextGoalDrafts)

    setSeeded(true)
  }, [seeded, areas, purpose, visions, goals])

  const addArea = async () => {
    if (!newArea.trim()) return
    const count = await db.areasOfFocus.count()
    await db.areasOfFocus.add({ id: uuid(), name: newArea.trim(), order: count })
    setNewArea('')
  }

  /** Saves immediately on blur, same as the standalone Purpose page — closing the wizard mid-step never loses this. */
  const savePurpose = (nextStatement: string, nextPrinciplesText: string) => {
    const principles = nextPrinciplesText
      .split('\n')
      .map((p) => p.trim())
      .filter(Boolean)
    void updatePurpose({ statement: nextStatement.trim(), principles })
  }

  /** Update the existing overarching vision in place once created, rather than creating a new one on every blur. */
  const saveVision = (nextStatement: string) => {
    const trimmed = nextStatement.trim()
    if (visionId) {
      void updateVision(visionId, { statement: trimmed })
    } else if (trimmed) {
      void createVision({ statement: trimmed }).then((v) => setVisionId(v.id))
    }
  }

  /** Same create-once-then-update pattern per area. */
  const saveGoal = (areaId: string, nextTitle: string) => {
    const trimmed = nextTitle.trim()
    const existingId = goalIds[areaId]
    if (existingId) {
      void updateGoal(existingId, { title: trimmed })
    } else if (trimmed) {
      void createGoal({ title: trimmed, areaOfFocusId: areaId }).then((g) =>
        setGoalIds((prev) => ({ ...prev, [areaId]: g.id })),
      )
    }
  }

  const goNext = () => {
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
              <h2 className="mb-2 text-lg font-medium text-neutral-100">
                Let's build up your Horizons of Focus
              </h2>
              <div className="mb-3 text-sm text-neutral-500">Areas → Goals → Vision → Purpose</div>
              <p className="mb-4 text-sm text-neutral-400">
                About 5 minutes. Skip anything — you can always come back.
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
              <div className="mb-1 flex items-center gap-2">
                <h2 className="text-lg font-medium text-neutral-100">Areas of Focus</h2>
                <span className="text-xs text-neutral-600">20k ft</span>
              </div>
              <p className="mb-4 text-sm text-neutral-400">
                The roles you're already juggling. Edit this starter set to fit your life.
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
              <div className="mb-1 flex items-center gap-2">
                <h2 className="text-lg font-medium text-neutral-100">Goals</h2>
                <span className="text-xs text-neutral-600">30k ft</span>
              </div>
              <p className="mb-1 text-sm text-neutral-400">
                What do you want from each area in the next year or two?
              </p>
              <p className="mb-4 text-xs text-neutral-600">Saves as you go — safe to close anytime.</p>
              <div className="flex flex-col gap-3">
                {areas?.map((a) => (
                  <div key={a.id}>
                    <label className="mb-1 block text-xs text-neutral-500">{a.name}</label>
                    <input
                      value={goalDrafts[a.id] ?? ''}
                      onChange={(e) => setGoalDrafts((prev) => ({ ...prev, [a.id]: e.target.value }))}
                      onBlur={(e) => saveGoal(a.id, e.target.value)}
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
              <div className="mb-1 flex items-center gap-2">
                <h2 className="text-lg font-medium text-neutral-100">Vision</h2>
                <span className="text-xs text-neutral-600">40k ft</span>
              </div>
              <p className="mb-1 text-sm text-neutral-400">
                3-5 years from now, if it all went wildly well — what would it look like?
              </p>
              <p className="mb-4 text-xs text-neutral-600">Saves as you go — safe to close anytime.</p>
              <textarea
                autoFocus
                value={visionStatement}
                onChange={(e) => setVisionStatement(e.target.value)}
                onBlur={() => saveVision(visionStatement)}
                rows={5}
                placeholder="In 3-5 years…"
                className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
              />
            </div>
          )}

          {step === 'purpose' && (
            <div>
              <div className="mb-1 flex items-center gap-2">
                <h2 className="text-lg font-medium text-neutral-100">Purpose & Principles</h2>
                <span className="text-xs text-neutral-600">50k ft</span>
              </div>
              <p className="mb-1 text-sm text-neutral-400">Why does any of this matter?</p>
              <p className="mb-4 text-xs text-neutral-600">Saves as you go — safe to close anytime.</p>
              <textarea
                value={purposeStatement}
                onChange={(e) => setPurposeStatement(e.target.value)}
                onBlur={() => savePurpose(purposeStatement, principlesText)}
                rows={3}
                placeholder="The deeper reason behind it all…"
                className="mb-3 w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
              />
              <label className="mb-1 block text-xs text-neutral-500">Principles (one per line)</label>
              <textarea
                value={principlesText}
                onChange={(e) => setPrinciplesText(e.target.value)}
                onBlur={() => savePurpose(purposeStatement, principlesText)}
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
                Nothing's permanent — revisit anytime from "Horizons of Focus" in the sidebar.
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
