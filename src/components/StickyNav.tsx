import type { ReactNode } from 'react'

/**
 * The Back / Next row of a step-by-step flow, stuck to the top of the screen so it's always in reach — on a long
 * step you never scroll to the bottom just to move on. Spans the page width and sits over whatever scrolls beneath.
 */
export function StickyNav({ children }: { children: ReactNode }) {
  return (
    <div className="sticky top-0 z-10 -mx-6 mb-5 flex items-center justify-between gap-3 border-b border-neutral-900 bg-neutral-950/95 px-6 py-2 backdrop-blur">
      {children}
    </div>
  )
}
