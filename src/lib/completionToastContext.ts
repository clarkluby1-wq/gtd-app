import { createContext, useContext } from 'react'
import type { Action } from '../db/types'

export interface CompletionToastCtx {
  /** `celebrateOnDismiss` holds the confetti until the "what's next?" prompt is answered, instead of firing on completion. */
  notify: (action: Action, opts?: { celebrateOnDismiss?: boolean }) => void
}

export const CompletionToastContext = createContext<CompletionToastCtx | null>(null)

export function useCompletionToast() {
  const ctx = useContext(CompletionToastContext)
  if (!ctx) throw new Error('useCompletionToast must be used within CompletionToastProvider')
  return ctx
}
