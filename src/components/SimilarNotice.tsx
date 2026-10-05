import { useState, type ReactNode } from 'react'
import type { ExistingMatch } from '../lib/sweepDuplicates'

/**
 * A calm heads-up that something like this is already in the system. It only suggests, and "It's different" always
 * hides it. What it offers depends on what it found:
 *  - a project (with `onAddToProject`): this is probably a step for that project — "Yes, add it to that project";
 *  - anything else (with `onSame`): probably the same thing — "Same thing — discard this new one".
 * Without either handler it's just a quiet line.
 */
export function SimilarNotice({
  match,
  onSame,
  onAddToProject,
  className = '',
}: {
  match: ExistingMatch | undefined
  onSame?: () => void
  /** Offered only when the match is an active project. */
  onAddToProject?: () => void
  className?: string
}) {
  const [dismissed, setDismissed] = useState<string | null>(null)
  if (!match || dismissed === match.title) return null

  const asProjectStep = match.kind === 'project' && match.projectActive && onAddToProject
  const action = asProjectStep ? onAddToProject : match.kind === 'action' ? onSame : undefined

  let message: ReactNode
  if (asProjectStep) {
    message = match.projectStalled ? (
      <>
        <span className="font-medium text-neutral-100">“{match.title}”</span> is a project with no next action yet. This
        could be it.
      </>
    ) : (
      <>
        This could be a next step for your project{' '}
        <span className="font-medium text-neutral-100">“{match.title}”</span>.
      </>
    )
  } else {
    message = (
      <>
        Looks like you already have <span className="font-medium text-neutral-100">“{match.title}”</span> {match.label}.
      </>
    )
  }

  const actionLabel = asProjectStep
    ? match.projectStalled
      ? "Yes, make it that project's next action"
      : 'Yes, add it to that project'
    : 'Same thing — discard this new one'

  return (
    <div className={`rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-neutral-300 ${className}`}>
      {message}
      {action && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
          <button
            onClick={action}
            title={
              asProjectStep
                ? `Links what you just captured to “${match.title}”, then you choose how it gets done.`
                : `Moves what you just captured to the trash. “${match.title}” stays as it is.`
            }
            className="font-medium text-amber-300 hover:text-amber-200"
          >
            {actionLabel}
          </button>
          <button onClick={() => setDismissed(match.title)} className="text-neutral-400 hover:text-neutral-200">
            It's different
          </button>
        </div>
      )}
    </div>
  )
}
