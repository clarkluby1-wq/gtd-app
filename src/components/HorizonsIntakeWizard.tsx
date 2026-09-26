import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { db } from '../db/db'
import { createGoal, createVision, getPurpose, updateGoal, updatePurpose, updateVision } from '../db/horizons'

type Step = 'intro' | 'areas' | 'goals' | 'vision' | 'purpose' | 'done'

const STEPS: Step[] = ['areas', 'goals', 'vision', 'purpose']

/** One line in an Area's goal list. `id` appears once it's saved; `saved` is the title as stored. */
interface GoalRow {
  key: string
  id?: string
  text: string
  saved: string
  /** Rows you add yourself take the cursor straight away; rows that were already there don't. */
  autoFocus?: boolean
}

const blankRow = (autoFocus = false): GoalRow => ({ key: uuid(), text: '', saved: '', autoFocus })

export function HorizonsIntakeWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>('intro')
  const areas = useLiveQuery(() => db.areasOfFocus.orderBy('order').toArray())
  const purpose = useLiveQuery(() => getPurpose())
  const visions = useLiveQuery(() => db.visions.toArray())
  const goals = useLiveQuery(() => db.goals.toArray())

  const [newArea, setNewArea] = useState('')
  // Every Area holds a list of goals, not just one — same as the Goals screen.
  const [goalRows, setGoalRows] = useState<Record<string, GoalRow[]>>({})
  // Rows whose first save is still in flight, so tabbing away twice can't create the same goal twice.
  const savingRows = useRef(new Set<string>())
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

    // Every active goal in each Area (oldest first), plus one empty line if there are none yet.
    const nextRows: Record<string, GoalRow[]> = {}
    for (const area of areas) {
      const mine = goals
        .filter((g) => g.areaOfFocusId === area.id && g.status === 'active')
        .sort((a, b) => a.createdAt - b.createdAt)
      nextRows[area.id] = mine.length
        ? mine.map((g) => ({ key: g.id, id: g.id, text: g.title, saved: g.title }))
        : [blankRow()]
    }
    setGoalRows(nextRows)

    setSeeded(true)
  }, [seeded, areas, purpose, visions, goals])

  const addArea = async () => {
    if (!newArea.trim()) return
    const count = await db.areasOfFocus.count()
    const id = uuid()
    await db.areasOfFocus.add({ id, name: newArea.trim(), order: count })
    setGoalRows((prev) => ({ ...prev, [id]: [blankRow()] }))
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

  const patchGoalRow = (areaId: string, key: string, patch: Partial<GoalRow>) =>
    setGoalRows((prev) => ({
      ...prev,
      [areaId]: (prev[areaId] ?? []).map((r) => (r.key === key ? { ...r, ...patch } : r)),
    }))

  const addGoalRow = (areaId: string) =>
    setGoalRows((prev) => ({ ...prev, [areaId]: [...(prev[areaId] ?? []), blankRow(true)] }))

  /** Create-once-then-update, per line. Saves on blur, so closing the wizard mid-step never loses anything. */
  const saveGoalRow = (areaId: string, row: GoalRow) => {
    const trimmed = row.text.trim()
    if (row.id) {
      // A saved goal is never left untitled — clearing the line just puts its title back. Removing a goal
      // is done on the Goals screen, where it asks first.
      if (!trimmed) patchGoalRow(areaId, row.key, { text: row.saved })
      else if (trimmed !== row.saved) {
        void updateGoal(row.id, { title: trimmed })
        patchGoalRow(areaId, row.key, { saved: trimmed })
      }
      return
    }
    if (!trimmed || savingRows.current.has(row.key)) return
    savingRows.current.add(row.key)
    void createGoal({ title: trimmed, areaOfFocusId: areaId }).then((g) => {
      savingRows.current.delete(row.key)
      patchGoalRow(areaId, row.key, { id: g.id, saved: trimmed })
    })
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
              <p className="mb-1 text-xs text-neutral-600">Saves as you go — safe to close anytime.</p>
              <p className="mb-4 text-xs text-neutral-600">
                Keep each goal short — one to three per area is plenty, and an area can stay empty. Add detail
                later on the Goals screen.
              </p>
              <div className="flex flex-col gap-4">
                {areas?.map((a) => {
                  const rows = goalRows[a.id] ?? []
                  const lastIsEmpty = rows.length > 0 && !rows[rows.length - 1].text.trim()
                  return (
                    <div key={a.id}>
                      <label className="mb-1 block text-xs text-neutral-500">{a.name}</label>
                      <div className="flex flex-col gap-2">
                        {rows.map((r, i) => (
                          <input
                            key={r.key}
                            autoFocus={r.autoFocus}
                            value={r.text}
                            onChange={(e) => patchGoalRow(a.id, r.key, { text: e.target.value })}
                            onBlur={() => saveGoalRow(a.id, r)}
                            onKeyDown={(e) => {
                              // Enter saves this one and opens the next line, so several goals flow without the mouse.
                              if (e.key !== 'Enter') return
                              e.preventDefault()
                              saveGoalRow(a.id, r)
                              if (i === rows.length - 1 && r.text.trim()) addGoalRow(a.id)
                            }}
                            placeholder={i === 0 ? `A 1-2 year goal for ${a.name}…` : `Another goal for ${a.name}…`}
                            className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none"
                          />
                        ))}
                      </div>
                      {/* Always here, so every area looks the same. With an empty line already open there's nothing to
                          add yet, so it just takes you to that line rather than piling up blanks. */}
                      <button
                        onClick={(e) => {
                          if (!lastIsEmpty) return addGoalRow(a.id)
                          const inputs = e.currentTarget.parentElement?.querySelectorAll('input')
                          inputs?.[inputs.length - 1]?.focus()
                        }}
                        className="mt-1.5 text-xs text-neutral-500 hover:text-neutral-300"
                      >
                        + {rows.length === 0 ? 'Add a goal' : 'Add another'}
                      </button>
                    </div>
                  )
                })}
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
