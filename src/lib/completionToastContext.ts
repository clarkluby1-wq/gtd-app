import { createContext, useContext } from 'react'
import type { Action } from '../db/types'

export interface CompletionToastCtx {
  notify: (action: Action) => void
}

export const CompletionToastContext = createContext<CompletionToastCtx | null>(null)

export function useCompletionToast() {
  const ctx = useContext(CompletionToastContext)
  if (!ctx) throw new Error('useCompletionToast must be used within CompletionToastProvider')
  return ctx
}
