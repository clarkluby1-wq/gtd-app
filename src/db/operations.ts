import { v4 as uuid } from 'uuid'
import { db } from './db'
import { startOfToday } from '../lib/date'
import type { Action, ActionStatus, EnergyLevel, Project, ProjectStatus } from './types'

/** Capture: add a raw, unprocessed item to the inbox. No decisions made yet. */
export async function captureToInbox(title: string) {
  const now = Date.now()
  const action: Action = {
    id: uuid(),
    title: title.trim(),
    status: 'inbox',
    createdAt: now,
    touchedAt: now,
    order: now,
  }
  // The capture-event record is permanent and never touched again, regardless
  // of what later happens to the action (clarified, converted, deleted) — it's
  // what "items captured today" counts against.
  await db.transaction('rw', db.actions, db.captureEvents, async () => {
    await db.actions.add(action)
    await db.captureEvents.add({ id: uuid(), createdAt: now })
  })
  return action
}

async function nextOrder() {
  return Date.now()
}

/** Clarify: mark an inbox item done immediately (the 2-minute rule). */
export async function doItNow(actionId: string) {
  const now = Date.now()
  await db.actions.update(actionId, { status: 'done', completedAt: now, clarifiedAt: now, touchedAt: now })
}

export async function trashItem(actionId: string) {
  const now = Date.now()
  await db.actions.update(actionId, { status: 'trash', clarifiedAt: now, touchedAt: now })
}

export async function sendToSomeday(actionId: string) {
  const now = Date.now()
  await db.actions.update(actionId, { status: 'someday', clarifiedAt: now, touchedAt: now })
}

/** Clarify into reference material: file it away and remove it from the inbox. */
export async function clarifyAsReference(actionId: string, opts: { title: string; content?: string }) {
  await db.transaction('rw', db.actions, db.references, async () => {
    await db.references.add({
      id: uuid(),
      title: opts.title,
      content: opts.content,
      createdAt: Date.now(),
    })
    await db.actions.delete(actionId)
  })
}

/** Clarify into a single next action with a context (and optional metadata). */
export async function clarifyAsNextAction(
  actionId: string,
  opts: { contextId?: string; energy?: EnergyLevel; timeEstimateMin?: number; dueDate?: number },
) {
  const now = Date.now()
  await db.actions.update(actionId, {
    status: 'next',
    clarifiedAt: now,
    touchedAt: now,
    order: await nextOrder(),
    ...opts,
  })
}

/** Clarify into a scheduled (calendar) item for a specific date. */
export async function clarifyAsScheduled(actionId: string, scheduledDate: number) {
  const now = Date.now()
  await db.actions.update(actionId, {
    status: 'scheduled',
    scheduledDate,
    clarifiedAt: now,
    touchedAt: now,
    order: await nextOrder(),
  })
}

/** Clarify into a delegated item, waiting on someone else. */
export async function clarifyAsWaitingFor(actionId: string, waitingOn: string) {
  const now = Date.now()
  await db.actions.update(actionId, {
    status: 'waiting',
    waitingOn,
    clarifiedAt: now,
    touchedAt: now,
    order: await nextOrder(),
  })
}

/**
 * Clarify into a project: the inbox item becomes the project's definition,
 * and a fresh next action is created and linked to it.
 */
export async function clarifyAsProject(
  actionId: string,
  opts: {
    title: string
    outcome: string
    areaOfFocusId?: string
    goalId?: string
    firstActionTitle: string
    contextId?: string
  },
) {
  const now = Date.now()
  const project: Project = {
    id: uuid(),
    title: opts.title,
    outcome: opts.outcome,
    status: 'active',
    areaOfFocusId: opts.areaOfFocusId,
    goalId: opts.goalId,
    createdAt: now,
    order: now,
  }
  await db.projects.add(project)

  const firstAction: Action = {
    id: uuid(),
    title: opts.firstActionTitle,
    status: 'next',
    projectId: project.id,
    contextId: opts.contextId,
    createdAt: now,
    clarifiedAt: now,
    touchedAt: now,
    order: now,
  }
  await db.actions.add(firstAction)

  // The original inbox capture is now reference material describing the project; remove it.
  await db.actions.delete(actionId)

  return { project, firstAction }
}

/** Create a project directly (not from an inbox item) — used by Quick Create and the NPM Deep Plan workspace. */
export async function createProject(opts: {
  title: string
  outcome: string
  status?: ProjectStatus
  areaOfFocusId?: string
  goalId?: string
  planning?: Project['planning']
  firstActions?: { title: string; contextId?: string }[]
}) {
  const now = Date.now()
  const project: Project = {
    id: uuid(),
    title: opts.title,
    outcome: opts.outcome,
    status: opts.status ?? 'active',
    areaOfFocusId: opts.areaOfFocusId,
    goalId: opts.goalId,
    planning: opts.planning,
    createdAt: now,
    order: now,
  }
  await db.projects.add(project)

  for (const action of opts.firstActions ?? []) {
    if (!action.title.trim()) continue
    await addActionToProject(project.id, action.title.trim(), { contextId: action.contextId })
  }

  return project
}

export async function completeAction(actionId: string) {
  const now = Date.now()
  await db.actions.update(actionId, { status: 'done', completedAt: now, touchedAt: now })
}

export async function reopenAction(actionId: string, status: ActionStatus = 'next') {
  await db.actions.update(actionId, { status, completedAt: undefined, touchedAt: Date.now() })
}

export async function updateAction(actionId: string, changes: Partial<Action>) {
  await db.actions.update(actionId, { ...changes, touchedAt: Date.now() })
}

export async function deleteAction(actionId: string) {
  await db.actions.delete(actionId)
}

/** Pin an action as one of today's Big Three. Caller is responsible for enforcing the 3-item cap. */
export async function pinToBigThree(actionId: string) {
  await db.actions.update(actionId, { bigThreeDate: startOfToday(), touchedAt: Date.now() })
}

export async function unpinFromBigThree(actionId: string) {
  await db.actions.update(actionId, { bigThreeDate: undefined, touchedAt: Date.now() })
}

/** Create an action, optionally tied to a project — the general form behind addActionToProject and follow-up capture. */
export async function createAction(opts: {
  title: string
  projectId?: string
  contextId?: string
  status?: ActionStatus
  waitingOn?: string
  scheduledDate?: number
}) {
  const now = Date.now()
  const action: Action = {
    id: uuid(),
    title: opts.title,
    status: opts.status ?? 'next',
    projectId: opts.projectId,
    contextId: opts.contextId,
    waitingOn: opts.waitingOn,
    scheduledDate: opts.scheduledDate,
    createdAt: now,
    clarifiedAt: now,
    touchedAt: now,
    order: now,
  }
  await db.actions.add(action)
  return action
}

export async function addActionToProject(
  projectId: string,
  title: string,
  opts: {
    contextId?: string
    status?: ActionStatus
    waitingOn?: string
    scheduledDate?: number
  } = {},
) {
  return createAction({ ...opts, title, projectId })
}

export async function updateProject(projectId: string, changes: Partial<Project>) {
  await db.projects.update(projectId, changes)
}

export async function completeProject(projectId: string) {
  await db.projects.update(projectId, { status: 'completed' as ProjectStatus, completedAt: Date.now() })
}

export async function deleteProject(projectId: string) {
  await db.transaction('rw', db.projects, db.actions, async () => {
    await db.actions.where('projectId').equals(projectId).delete()
    await db.projects.delete(projectId)
  })
}
