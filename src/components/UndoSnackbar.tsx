import { dismissUndo, useUndoSnack } from '../lib/undoSnack'

/** The brief "Undo" bar (see showUndo). Sits above the phone's tab bar, and above everything else on screen. */
export function UndoSnackbar() {
  const snack = useUndoSnack()
  if (!snack) return null

  return (
    <div
      role="status"
      className="fixed bottom-24 left-1/2 z-[70] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-4 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm text-neutral-100 shadow-xl md:bottom-6"
    >
      <span className="truncate">{snack.message}</span>
      <button
        onClick={() => {
          snack.undo()
          dismissUndo()
        }}
        className="shrink-0 font-medium text-emerald-400 hover:text-emerald-300"
      >
        Undo
      </button>
    </div>
  )
}
