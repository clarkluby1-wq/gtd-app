import { useState } from 'react'
import { useCompletionToast } from '../lib/completionToastContext'
import type { Action } from '../db/types'
import { ClarifyModal } from './ClarifyModal'

/**
 * Works through inbox items one after another, top to bottom: finishing one opens the next. Skipped items simply stay
 * in the Inbox. Mount it to start; it calls `onEnd` (with how many were processed) when the queue runs out or you
 * stop. While a "what's next?" card is open the next item waits, so there is only ever one demand at a time.
 */
export function InboxProcessor({ items, onEnd }: { items: Action[]; onEnd: (processed: number) => void }) {
  const { blocked } = useCompletionToast()
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set())
  const [processedCount, setProcessedCount] = useState(0)

  const queue = items.filter((i) => !skippedIds.has(i.id))
  const current = blocked ? undefined : queue[0]

  const finishedCurrent = () => {
    const processed = processedCount + 1
    setProcessedCount(processed)
    if (queue.length <= 1) onEnd(processed)
  }
  const skipCurrent = () => {
    if (!current) return
    setSkippedIds(new Set(skippedIds).add(current.id))
    if (queue.length <= 1) onEnd(processedCount)
  }

  if (!current) return null
  return (
    <ClarifyModal
      key={current.id}
      item={current}
      onClose={() => onEnd(processedCount)}
      queue={{ left: queue.length, onSkip: skipCurrent, onFinished: finishedCurrent }}
    />
  )
}
