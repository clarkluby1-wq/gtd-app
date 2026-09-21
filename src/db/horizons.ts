import { v4 as uuid } from 'uuid'
import { db } from './db'
import { pickPurpose } from './dedupe'
import type { Goal, Purpose, Vision } from './types'

/** The Purpose row (there is one). Found rather than looked up by a fixed id, so it works on every device. */
export async function getPurpose(): Promise<Purpose | undefined> {
  return pickPurpose(await db.purposes.toArray())
}

export async function updatePurpose(changes: { statement?: string; principles?: string[] }) {
  const purpose = await getPurpose()
  if (!purpose) return
  await db.purposes.update(purpose.id, { ...changes, updatedAt: Date.now() })
}

export async function createVision(opts: { statement: string; areaOfFocusId?: string }) {
  const vision: Vision = {
    id: uuid(),
    statement: opts.statement,
    areaOfFocusId: opts.areaOfFocusId,
    createdAt: Date.now(),
  }
  await db.visions.add(vision)
  return vision
}

export async function updateVision(id: string, changes: Partial<Vision>) {
  await db.visions.update(id, changes)
}

export async function deleteVision(id: string) {
  await db.transaction('rw', db.visions, db.goals, async () => {
    await db.goals.where('visionId').equals(id).modify({ visionId: undefined })
    await db.visions.delete(id)
  })
}

export async function createGoal(opts: {
  title: string
  description?: string
  targetDate?: number
  areaOfFocusId: string
  visionId?: string
}) {
  const goal: Goal = {
    id: uuid(),
    title: opts.title,
    description: opts.description,
    targetDate: opts.targetDate,
    areaOfFocusId: opts.areaOfFocusId,
    visionId: opts.visionId,
    status: 'active',
    createdAt: Date.now(),
  }
  await db.goals.add(goal)
  return goal
}

export async function updateGoal(id: string, changes: Partial<Goal>) {
  await db.goals.update(id, changes)
}

export async function deleteGoal(id: string) {
  await db.transaction('rw', db.goals, db.projects, async () => {
    await db.projects.where('goalId').equals(id).modify({ goalId: undefined })
    await db.goals.delete(id)
  })
}
