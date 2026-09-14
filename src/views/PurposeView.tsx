import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import { PURPOSE_ID, updatePurpose } from '../db/horizons'
import type { Purpose } from '../db/types'

export function PurposeView() {
  const purpose = useLiveQuery(() => db.purposes.get(PURPOSE_ID))
  if (!purpose) return null
  // Keying by id (stable, singleton) means this only mounts once purpose loads,
  // so its local state can seed directly from props with no sync effect needed.
  return <PurposeEditor key={purpose.id} purpose={purpose} />
}

function PurposeEditor({ purpose }: { purpose: Purpose }) {
  const [statement, setStatement] = useState(purpose.statement)
  const [principles, setPrinciples] = useState<string[]>(purpose.principles)
  const [newPrinciple, setNewPrinciple] = useState('')

  const save = (nextStatement: string, nextPrinciples: string[]) => {
    void updatePurpose({ statement: nextStatement, principles: nextPrinciples })
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-neutral-100">Purpose & Principles</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Horizon 5 (50,000 ft) — why any of this matters, and the values that shape every decision below it. This
        is the least likely to change; revisit it rarely, deliberately.
      </p>

      <label className="mb-1 block text-xs text-neutral-500">Why do you do what you do?</label>
      <textarea
        value={statement}
        onChange={(e) => setStatement(e.target.value)}
        onBlur={() => save(statement, principles)}
        rows={4}
        placeholder="What's the deeper reason behind your work, your relationships, how you spend your time…"
        className="mb-6 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none"
      />

      <label className="mb-1 block text-xs text-neutral-500">
        Principles — the standards you won't compromise, whatever the pressure
      </label>
      <div className="mb-2 flex flex-col gap-2">
        {principles.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-neutral-500">·</span>
            <span className="flex-1 text-sm text-neutral-200">{p}</span>
            <button
              onClick={() => {
                const next = principles.filter((_, idx) => idx !== i)
                setPrinciples(next)
                save(statement, next)
              }}
              className="text-neutral-600 hover:text-red-400"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!newPrinciple.trim()) return
          const next = [...principles, newPrinciple.trim()]
          setPrinciples(next)
          setNewPrinciple('')
          save(statement, next)
        }}
        className="flex gap-2"
      >
        <input
          value={newPrinciple}
          onChange={(e) => setNewPrinciple(e.target.value)}
          placeholder="Add a principle…"
          className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none"
        />
        <button type="submit" className="rounded-md bg-neutral-800 px-3 py-2 text-xs text-neutral-200 hover:bg-emerald-600 hover:text-white">
          Add
        </button>
      </form>
    </div>
  )
}
