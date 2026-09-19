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

  const notify: CompletionToastCtx['notify'] = (action, opts) => {
    setPending((prev) => [...prev, { action, celebrateOnDismiss: opts?.celebrateOnDismiss ?? false }])
  }

  const dismiss = (id: string) => {
    setPending((prev) => prev.filter((p) => p.action.id !== id))
  }

  return (
    <CompletionToastContext.Provider value={{ notify }}>
      {children}
      <div className="pointer-events-none fixed inset-0 z-40 flex flex-col items-center justify-center gap-2">
        {pending.map(({ action, celebrateOnDismiss }) => (
          <div key={action.id} className="pointer-events-auto">
            <CompletionToast
              completedAction={action}
              celebrateOnDismiss={celebrateOnDismiss}
              onDismiss={() => dismiss(action.id)}
            />
          </div>
        ))}
      </div>
    </CompletionToastContext.Provider>
  )
}
