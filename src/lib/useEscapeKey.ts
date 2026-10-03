import { useEffect, useRef } from 'react'

// Open windows in the order they opened. Esc only ever closes the newest, so a confirm box on top of the Edit window
// closes alone, and a field that already handles Esc itself (and says so with preventDefault) is left to it.
const open: Array<() => void> = []

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || e.defaultPrevented) return
  open[open.length - 1]?.()
}

/** Esc runs `onEscape` — the same thing the window's Cancel / Close button does. */
export function useEscapeKey(onEscape: () => void, enabled = true) {
  const latest = useRef(onEscape)
  latest.current = onEscape

  useEffect(() => {
    if (!enabled) return
    const entry = () => latest.current()
    open.push(entry)
    if (open.length === 1) window.addEventListener('keydown', onKeyDown)
    return () => {
      open.splice(open.indexOf(entry), 1)
      if (open.length === 0) window.removeEventListener('keydown', onKeyDown)
    }
  }, [enabled])
}
