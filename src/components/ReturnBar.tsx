/**
 * A slim way back to a guided flow you stepped out of (Start My Day, End My Day, the Weekly Review), shown on whatever
 * screen you jumped to. One tap returns to the same place; ✕ lets it go.
 */
export function ReturnBar({ label, onReturn, onDismiss }: { label: string; onReturn: () => void; onDismiss: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-emerald-900/40 bg-emerald-950/30 px-4 py-2 text-xs">
      <button onClick={onReturn} className="font-medium text-emerald-400 hover:text-emerald-300">
        ← Back to {label}
      </button>
      <button
        onClick={onDismiss}
        aria-label={`Dismiss — stay out of ${label}`}
        title="Dismiss"
        className="text-neutral-500 hover:text-neutral-300"
      >
        ✕
      </button>
    </div>
  )
}
