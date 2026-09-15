import { useState, type ReactNode } from 'react'
import { CompletionToastContext } from '../lib/completionToastContext'
import { CompletionToast } from './CompletionToast'
import type { Action } from '../db/types'

export function CompletionToastProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Action[]>([])

  const notify = (action: Action) => {
    setPending((prev) => [...prev, action])
  }

  const dismiss = (id: string) => {
    setPending((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <CompletionToastContext.Provider value={{ notify }}>
      {children}
      <div className="pointer-events-none fixed inset-0 z-40 flex flex-col items-center justify-center gap-2">
        {pending.map((action) => (
          <div key={action.id} className="pointer-events-auto">
            <CompletionToast completedAction={action} onDismiss={() => dismiss(action.id)} />
          </div>
        ))}
      </div>
    </CompletionToastContext.Provider>
  )
}
