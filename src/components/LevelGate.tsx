import { useEffect, useState } from 'react'
import { db } from '../db/db'
import { LEVEL_INFO, setLevel, useFeatures } from '../lib/levels'

/**
 * The one-time "How much GTD do you want?" question, for a brand-new install. A browser that already holds your
 * things (every install from before levels existed) is quietly set to Full, so nothing disappears on you.
 */
export function LevelGate() {
  const { decided } = useFeatures()
  const [ask, setAsk] = useState(false)

  useEffect(() => {
    if (decided) return
    let live = true
    void Promise.all([db.actions.count(), db.projects.count()]).then(([actions, projects]) => {
      if (!live) return
      if (actions + projects > 0) setLevel('full')
      else setAsk(true)
    })
    return () => {
      live = false
    }
  }, [decided])

  if (decided || !ask) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-black/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="How much GTD do you want?"
        className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900 p-5 text-neutral-100 shadow-xl"
      >
        <h2 className="text-lg font-semibold">How much GTD do you want?</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Pick what feels right for now. You can change it any time in Settings, and nothing you add is ever lost
          when you do.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {LEVEL_INFO.map((l) => (
            <button
              key={l.level}
              onClick={() => setLevel(l.level)}
              className="rounded-lg border border-neutral-700 px-4 py-3 text-left hover:border-emerald-600 hover:bg-neutral-800"
            >
              <div className="text-sm font-medium text-neutral-100">
                {l.label} <span className="font-normal text-neutral-500">— {l.summary}</span>
              </div>
              <div className="mt-0.5 text-xs text-neutral-400">{l.detail}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
