import { v4 as uuid } from 'uuid'
import { db } from './db'
import type { WeeklyReview, WeeklyReviewChecklistItem } from './types'
import { isItemDone, normalizeChecklist } from '../lib/weeklyReviewTemplate'

/**
 * Everything that saves progress on this week's review. The guided walkthrough and the overview checklist both go
 * through here, so they always agree. Each call is one transaction, so two quick taps can't create two records.
 */

async function ensureReview(weekStart: number): Promise<WeeklyReview> {
  const existing = await db.weeklyReviews.where('date').equals(weekStart).first()
  if (existing) return existing
  const fresh: WeeklyReview = { id: uuid(), date: weekStart, checklist: normalizeChecklist(undefined) }
  await db.weeklyReviews.add(fresh)
  return fresh
}

/**
 * Once a review has been finished it stays finished — ticking or unticking a step afterward doesn't reopen it.
 * It also counts as finished the moment every step is done.
 */
async function saveChecklist(review: WeeklyReview, checklist: WeeklyReviewChecklistItem[], changes: Partial<WeeklyReview> = {}) {
  const allDone = checklist.every(isItemDone)
  await db.weeklyReviews.put({
    ...review,
    ...changes,
    checklist,
    completedAt: allDone ? (review.completedAt ?? Date.now()) : review.completedAt,
  })
}

export async function toggleReviewItem(weekStart: number, key: string) {
  await db.transaction('rw', db.weeklyReviews, async () => {
    const review = await ensureReview(weekStart)
    const checklist = normalizeChecklist(review.checklist).map((c) => (c.key === key ? { ...c, done: !c.done } : c))
    await saveChecklist(review, checklist)
  })
}

export async function setReviewItemDone(weekStart: number, key: string, done: boolean) {
  await db.transaction('rw', db.weeklyReviews, async () => {
    const review = await ensureReview(weekStart)
    const current = normalizeChecklist(review.checklist)
    if (current.find((c) => c.key === key)?.done === done) return
    const checklist = current.map((c) => (c.key === key ? { ...c, done } : c))
    await saveChecklist(review, checklist)
  })
}

export async function setReviewSubDone(weekStart: number, parentKey: string, subKey: string, done: boolean) {
  await db.transaction('rw', db.weeklyReviews, async () => {
    const review = await ensureReview(weekStart)
    const checklist = normalizeChecklist(review.checklist).map((c) => {
      if (c.key !== parentKey || !c.subItems) return c
      const subItems = c.subItems.map((s) => (s.key === subKey ? { ...s, done } : s))
      return { ...c, subItems, done: subItems.every((s) => s.done) }
    })
    await saveChecklist(review, checklist)
  })
}

export async function toggleReviewSub(weekStart: number, parentKey: string, subKey: string) {
  const review = await db.weeklyReviews.where('date').equals(weekStart).first()
  const current = normalizeChecklist(review?.checklist)
    .find((c) => c.key === parentKey)
    ?.subItems?.find((s) => s.key === subKey)?.done
  await setReviewSubDone(weekStart, parentKey, subKey, !current)
}

/** Remember where the guided walkthrough is, so it can be paused and picked up again. */
export async function saveGuidedStep(weekStart: number, step: string | undefined) {
  await db.transaction('rw', db.weeklyReviews, async () => {
    const review = await ensureReview(weekStart)
    await db.weeklyReviews.put({ ...review, checklist: normalizeChecklist(review.checklist), guidedStep: step })
  })
}

/** "Finish my review": done means you walked through it, even if a step was skipped. */
export async function finishReview(weekStart: number) {
  await db.transaction('rw', db.weeklyReviews, async () => {
    const review = await ensureReview(weekStart)
    await db.weeklyReviews.put({
      ...review,
      checklist: normalizeChecklist(review.checklist),
      completedAt: review.completedAt ?? Date.now(),
      guidedStep: undefined,
    })
  })
}
