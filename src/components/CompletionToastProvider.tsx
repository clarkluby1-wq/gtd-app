import { useState, type ReactNode } from 'react'
import { CompletionToastContext, type CompletionToastCtx } from '../lib/completionToastContext'
import { CompletionToast } from './CompletionToast'
import type { Action } from '../db/types'

interface PendingToast {
  action: Action
  celebrateOnDismiss: boolean
}

export function CompletionToastProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingToast[]>([])
  const [nudgeCount, setNudgeCount] = useState(0)

  const notify: CompletionToastCtx['notify'] = (action, opts) => {
    setNudgeCount(0)
    setPending((prev) => [...prev, { action, celebrateOnDismiss: opts?.celebrateOnDismiss ?? false }])
  }

  const dismiss = (id: string) => {
    setPending((prev) => prev.filter((p) => p.action.id !== id))
  }

  const nudge = () => setNudgeCount((n) => n + 1)

  return (
    <CompletionToastContext.Provider value={{ notify, blocked: pending.length > 0, nudge }}>
      {children}
      {/* Above the Clarify modal (z-50), so a pending card is never hidden behind it. Below the celebration effects (z-60). */}
      <div className="pointer-events-none fixed inset-0 z-[55] flex flex-col items-center justify-center gap-2">
        {pending.map(({ action, celebrateOnDismiss }) => (
          <div key={action.id} className="pointer-events-auto">
            <CompletionToast
              completedAction={action}
              celebrateOnDismiss={celebrateOnDismiss}
              nudgeCount={nudgeCount}
              onDismiss={() => dismiss(action.id)}
            />
          </div>
        ))}
      </div>
    </CompletionToastContext.Provider>
  )
}
