import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { db } from '../db/db'
import { getLastBackupAt } from '../db/backup'
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

  const activeProjects = useLiveQuery(() => db.projects.where('status').equals('active').toArray())
  const areas = useLiveQuery(() => db.areasOfFocus.toArray())
  const orphanedProjects = activeProjects?.filter((p) => !p.areaOfFocusId && !p.goalId) ?? []
  const neglectedAreas =
    areas?.filter((a) => !activeProjects?.some((p) => p.areaOfFocusId === a.id)) ?? []

  const lastBackupAt = getLastBackupAt()
  const daysSinceBackup = lastBackupAt ? Math.floor((Date.now() - lastBackupAt) / (1000 * 60 * 60 * 24)) : null

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

      {(orphanedProjects.length > 0 || neglectedAreas.length > 0 || daysSinceBackup === null || daysSinceBackup > 14) && (
        <div className="mb-6 flex flex-col gap-2 rounded-lg border border-amber-900/50 bg-amber-950/20 p-4 text-sm">
          {orphanedProjects.length > 0 && (
            <div className="text-amber-300">
              ⚠ {orphanedProjects.length} active project{orphanedProjects.length > 1 ? 's' : ''} not linked to
              any Area of Focus or Goal: {orphanedProjects.map((p) => p.title).join(', ')}
            </div>
          )}
          {neglectedAreas.length > 0 && (
            <div className="text-amber-300">
              ⚠ No active projects in: {neglectedAreas.map((a) => a.name).join(', ')}
            </div>
          )}
          {(daysSinceBackup === null || daysSinceBackup > 14) && (
            <div className="text-amber-300">
              ⚠ {daysSinceBackup === null ? "You've never backed up" : `Last backup was ${daysSinceBackup} days ago`}
              — everything is stored only in this browser.
            </div>
          )}
        </div>
      )}

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
