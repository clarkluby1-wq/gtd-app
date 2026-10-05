import { useSyncExternalStore } from 'react'

export interface UndoSnack {
  id: number
  message: string
  undo: () => void
}

const SHOW_FOR_MS = 8000

let current: UndoSnack | null = null
let counter = 0
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

function set(next: UndoSnack | null) {
  current = next
  listeners.forEach((l) => l())
}

/** A brief "Undo" for something just done that can't otherwise be reversed. Replaces any one still showing. */
export function showUndo(message: string, undo: () => void) {
  clearTimeout(timer)
  const snack = { id: ++counter, message, undo }
  set(snack)
  timer = setTimeout(() => {
    if (current?.id === snack.id) set(null)
  }, SHOW_FOR_MS)
}

export function dismissUndo() {
  clearTimeout(timer)
  set(null)
}

export function useUndoSnack(): UndoSnack | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
}
