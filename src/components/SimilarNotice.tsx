import { useState } from 'react'
import type { Candidate } from '../lib/similar'

/**
 * A calm heads-up that something like this is already in the system. It only suggests: with `onSame` it offers to drop
 * this one, and "It's different" always hides it. Without `onSame` it's just a quiet line.
 */
export function SimilarNotice({
  match,
  onSame,
  sameLabel = 'Same thing — remove this one',
  className = '',
}: {
  match: Candidate | undefined
  onSame?: () => void
  sameLabel?: string
  className?: string
}) {
  const [dismissed, setDismissed] = useState<string | null>(null)
  if (!match || dismissed === match.title) return null

  return (
    <div className={`rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-neutral-300 ${className}`}>
      Looks like you already have <span className="font-medium text-neutral-100">“{match.title}”</span> {match.label}.
      {onSame && (
        <div className="mt-1.5 flex items-center gap-4">
          <button onClick={onSame} className="font-medium text-amber-300 hover:text-amber-200">
            {sameLabel}
          </button>
          <button onClick={() => setDismissed(match.title)} className="text-neutral-400 hover:text-neutral-200">
            It's different
          </button>
        </div>
      )}
    </div>
  )
}
