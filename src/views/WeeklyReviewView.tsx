import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { db } from '../db/db'
import type { WeeklyReview, WeeklyReviewChecklistItem } from '../db/types'

const TEMPLATE: Omit<WeeklyReviewChecklistItem, 'done'>[] = [
  { key: 'collect', label: 'Collect loose papers, notes, and stray ideas into the Inbox' },
  { key: 'inbox-zero', label: 'Process the Inbox down to zero' },
  { key: 'next-actions', label: 'Review the Next Actions list — cross off done items, add anything missing' },
  { key: 'previous-calendar', label: "Scan last week's calendar for stray follow-ups" },
  { key: 'upcoming-calendar', label: 'Scan the upcoming calendar for prep work or conflicts' },
  { key: 'waiting-for', label: 'Review Waiting For — follow up on anything overdue' },
  { key: 'projects', label: 'Review every active Project — does each still have a next action?' },
  { key: 'someday-maybe', label: 'Review Someday/Maybe — anything ready to activate, or ready to drop?' },
  { key: 'areas-of-focus', label: 'Scan Areas of Focus — is anything being neglected?' },
  { key: 'creative', label: 'Any new projects, ideas, or commitments to capture?' },
]

function startOfWeek(d: Date) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = (day + 6) % 7 // days since Monday
  date.setDate(date.getDate() - diff)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export function WeeklyReviewView() {
  const [weekStart] = useState(() => startOfWeek(new Date()))
  const review = useLiveQuery(
    () => db.weeklyReviews.where('date').equals(weekStart).first(),
    [weekStart],
  )

  const ensureReview = async (): Promise<WeeklyReview> => {
    if (review) return review
    const fresh: WeeklyReview = {
      id: uuid(),
      date: weekStart,
      checklist: TEMPLATE.map((t) => ({ ...t, done: false })),
    }
    await db.weeklyReviews.add(fresh)
    return fresh
  }

  const toggle = async (key: string) => {
    const r = await ensureReview()
    const checklist = r.checklist.map((c) => (c.key === key ? { ...c, done: !c.done } : c))
    const allDone = checklist.every((c) => c.done)
    await db.weeklyReviews.put({
      ...r,
      checklist,
      completedAt: allDone ? Date.now() : undefined,
    })
  }

  const checklist = review?.checklist ?? TEMPLATE.map((t) => ({ ...t, done: false }))
  const doneCount = checklist.filter((c) => c.done).length

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-neutral-100">Weekly Review</h1>
      <p className="mb-6 text-sm text-neutral-500">
        The habit that keeps the whole system trustworthy. Set aside time weekly and work through this list.
      </p>

      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
        <div
          className="h-full bg-emerald-600 transition-all"
          style={{ width: `${(doneCount / checklist.length) * 100}%` }}
        />
      </div>
      <div className="mb-6 text-xs text-neutral-500">
        {doneCount} / {checklist.length} complete this week
        {review?.completedAt && <span className="ml-2 text-emerald-400">— review complete ✓</span>}
      </div>

      <div className="flex flex-col divide-y divide-neutral-900">
        {checklist.map((c) => (
          <label key={c.key} className="flex items-center gap-3 py-3">
            <input
              type="checkbox"
              checked={c.done}
              onChange={() => toggle(c.key)}
              className="h-4 w-4 accent-emerald-600"
            />
            <span className={`text-sm ${c.done ? 'text-neutral-500 line-through' : 'text-neutral-100'}`}>
              {c.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
