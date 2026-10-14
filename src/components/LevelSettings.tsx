import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'
import { FEATURES, LEVEL_INFO, setFeature, setLevel, useFeatures } from '../lib/levels'

/** Settings card: how much of GTD you see, with per-feature switches. Hiding never touches your data. */
export function LevelSettings() {
  const { level, has } = useFeatures()
  const [fineTune, setFineTune] = useState(false)

  // What's tucked away right now, so a hidden thing never feels like a lost thing.
  const hidden = useLiveQuery(async () => {
    const counts: string[] = []
    const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
    if (!has('calendar')) {
      const n = await db.actions.where('status').equals('scheduled').count()
      if (n > 0) counts.push(plural(n, 'Scheduled item', 'Scheduled items'))
    }
    if (!has('horizons')) {
      const goals = await db.goals.count()
      if (goals > 0) counts.push(plural(goals, 'Goal', 'Goals'))
      const visions = await db.visions.count()
      if (visions > 0) counts.push(plural(visions, 'Vision', 'Visions'))
    }
    return counts
  }, [has])

  return (
    <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="mb-2 font-medium text-neutral-100">How much GTD</div>
      <p className="mb-3 text-sm text-neutral-500">
        Choose how much of the system you see. Hiding something never deletes it — your things stay saved and come
        back when you switch it on again. Stored on this device only.
      </p>

      <div className="flex flex-wrap gap-2">
        {LEVEL_INFO.map((l) => (
          <button
            key={l.level}
            onClick={() => setLevel(l.level)}
            title={l.detail}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              level === l.level ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            {l.label}
          </button>
        ))}
        {level === 'custom' && (
          <span className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white">Custom</span>
        )}
      </div>
      <p className="mt-2 text-xs text-neutral-600">
        {level === 'custom'
          ? 'Your own mix of features.'
          : LEVEL_INFO.find((l) => l.level === level)?.detail ?? ''}
      </p>

      <button
        onClick={() => setFineTune((v) => !v)}
        aria-expanded={fineTune}
        className="mt-3 text-xs text-neutral-400 hover:text-neutral-200"
      >
        {fineTune ? '▾ Hide the switches' : '▸ Choose feature by feature'}
      </button>

      {fineTune && (
        <div className="mt-2 flex flex-col divide-y divide-neutral-800 rounded-md border border-neutral-800">
          {FEATURES.map((f) => (
            <label key={f.key} className="flex cursor-pointer items-start gap-3 px-3 py-2">
              <input
                type="checkbox"
                checked={has(f.key)}
                onChange={(e) => setFeature(f.key, e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm text-neutral-200">{f.label}</span>
                <span className="block text-xs text-neutral-500">{f.hint}</span>
              </span>
            </label>
          ))}
        </div>
      )}

      {hidden && hidden.length > 0 && (
        <p className="mt-3 text-xs text-amber-400/90">
          Saved but hidden right now: {hidden.join(', ')}. Anything due or scheduled for today still shows on Today.
        </p>
      )}
    </div>
  )
}
