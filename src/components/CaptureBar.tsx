import { useRef, useState } from 'react'
import { captureToInbox } from '../db/operations'
import { useCompletionToast } from '../lib/completionToastContext'

export function CaptureBar() {
  const { blocked } = useCompletionToast()
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = () => {
    const title = value.trim()
    if (!title) return
    setValue('')
    inputRef.current?.focus()
    void captureToInbox(title)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
      // Capture is the one thing that stays open while a "what's next?" card is waiting, so it sits above the shield.
      className={`flex items-center gap-2 border-b border-neutral-800 bg-neutral-900 px-4 py-3 ${
        blocked ? 'relative z-[56]' : ''
      }`}
    >
      <span className="text-neutral-500">+</span>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            submit()
          }
        }}
        placeholder="Capture anything on your mind… (Enter to add to Inbox)"
        className="flex-1 bg-transparent text-sm text-neutral-100 placeholder-neutral-500 outline-none"
      />
      <button
        type="submit"
        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
      >
        Capture
      </button>
    </form>
  )
}
