import { reloadToLatest, useNewVersion } from '../lib/useNewVersion'

/** Appears when a newer version of the app has been published. It never reloads on its own, so nothing you're typing is lost. */
export function UpdateBar() {
  const latest = useNewVersion()
  if (!latest) return null

  return (
    <div
      role="status"
      className="fixed left-1/2 top-[max(env(safe-area-inset-top),0.5rem)] z-[80] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-4 rounded-lg border border-emerald-700 bg-neutral-900 px-4 py-2.5 text-sm text-neutral-100 shadow-xl"
    >
      <span>A new version is ready.</span>
      <button onClick={() => reloadToLatest(latest)} className="shrink-0 font-medium text-emerald-400 hover:text-emerald-300">
        Update now
      </button>
    </div>
  )
}
