import { useEffect, useState } from 'react'

declare const __BUILD_ID__: string

/**
 * Whether a newer version of the app has been published than the one running. A Home Screen app on iPhone can hold on to
 * an old copy for a long time, so on launch, and each time you come back to the app, this asks the server (bypassing
 * every cache) for the latest build id. Only meaningful in a published build — it's quiet in development.
 */
export function useNewVersion(): string | undefined {
  const [latest, setLatest] = useState<string>()

  useEffect(() => {
    if (!import.meta.env.PROD) return
    const check = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' })
        const { id } = (await res.json()) as { id?: string }
        if (id && id !== __BUILD_ID__) setLatest(id)
      } catch {
        // Offline or the file isn't there — nothing to say.
      }
    }
    void check()
    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
  }, [])

  return latest
}

/** Reload onto the newest copy. The changed address skips any saved copy of the page itself. */
export function reloadToLatest(id: string) {
  location.replace(`${location.pathname}?v=${id}`)
}
