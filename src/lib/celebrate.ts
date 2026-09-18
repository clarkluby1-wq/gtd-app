import confetti from 'canvas-confetti'

export type CelebrationLevel = 'full' | 'subtle' | 'off'
export type CelebrationTier = 'normal' | 'big'
/** Viewport pixel coordinates the effect radiates from — where the user just clicked. */
export type Origin = { x: number; y: number }

const STORAGE_KEY = 'gtd.celebration'
const PALETTE = ['#34d399', '#6ee7b7', '#fbbf24', '#fb923c', '#f472b6']

export function getCelebrationLevel(): CelebrationLevel {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'subtle' || stored === 'off' ? stored : 'full'
  } catch {
    return 'full'
  }
}

export function setCelebrationLevel(level: CelebrationLevel) {
  try {
    localStorage.setItem(STORAGE_KEY, level)
  } catch {
    // Preference just won't persist; the default still works.
  }
}

export function originOf(el: Element): Origin {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

/** A brief check-in-a-ring where the click happened. Independent of the row, which usually unmounts the instant the action is done. */
function ringPulse({ x, y }: Origin) {
  const ring = document.createElement('div')
  ring.className = 'celebrate-ring'
  ring.textContent = '✓'
  ring.style.left = `${x}px`
  ring.style.top = `${y}px`
  ring.setAttribute('aria-hidden', 'true')
  document.body.appendChild(ring)
  ring.addEventListener('animationend', () => ring.remove(), { once: true })
  setTimeout(() => ring.remove(), 1000)
}

/**
 * Full: a ring plus a small confetti burst on every completion, a bigger burst for milestones.
 * Subtle: just the ring, with confetti reserved for milestones.
 * Off: nothing. Confetti also skips itself when the OS asks for reduced motion.
 */
export function celebrate(origin: Origin, tier: CelebrationTier = 'normal') {
  const level = getCelebrationLevel()
  if (level === 'off') return

  ringPulse(origin)
  if (level === 'subtle' && tier === 'normal') return

  const big = tier === 'big'
  const shared = {
    origin: { x: origin.x / window.innerWidth, y: origin.y / window.innerHeight },
    colors: PALETTE,
    ticks: big ? 160 : 110,
    zIndex: 60,
    disableForReducedMotion: true,
  }
  confetti({
    ...shared,
    particleCount: big ? 90 : 28,
    spread: big ? 90 : 60,
    startVelocity: big ? 42 : 26,
    scalar: big ? 1 : 0.8,
  })
  if (big) {
    setTimeout(() => confetti({ ...shared, particleCount: 60, spread: 120, startVelocity: 30, scalar: 0.9 }), 160)
  }
}
