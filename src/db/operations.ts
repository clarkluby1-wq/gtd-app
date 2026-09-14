import { v4 as uuid } from 'uuid'
import { db } from './db'
import type { Action, ActionStatus, EnergyLevel, Project, ProjectStatus } from './types'

/** Capture: add a raw, unprocessed item to the inbox. No decisions made yet. */
export async function captureToInbox(title: string) {
  const now = Date.now()
  const action: Action = {
    id: uuid(),
    title: title.trim(),
    status: 'inbox',
    createdAt: now,
    order: now,
  }
  await db.actions.add(action)
  return action
}

async function nextOrder() {
  return Date.now()
}

/** Clarify: mark an inbox item done immediately (the 2-minute rule). */
export async function doItNow(actionId: string) {
  await db.actions.update(actionId, { status: 'done', completedAt: Date.now(), clarifiedAt: Date.now() })
}

export async function trashItem(actionId: string) {
  await db.actions.update(actionId, { status: 'trash', clarifiedAt: Date.now() })
}

export async function sendToSomeday(actionId: string) {
  await db.actions.update(actionId, { status: 'someday', clarifiedAt: Date.now() })
}

/** Clarify into a single next action with a context (and optional metadata). */
export async function clarifyAsNextAction(
  actionId: string,
  opts: { contextId?: string; energy?: EnergyLevel; timeEstimateMin?: number; dueDate?: number },
) {
  await db.actions.update(actionId, {
    status: 'next',
    clarifiedAt: Date.now(),
    order: await nextOrder(),
    ...opts,
  })
}

/** Clarify into a scheduled (calendar) item for a specific date. */
export async function clarifyAsScheduled(actionId: string, scheduledDate: number) {
  await db.actions.update(actionId, {
    status: 'scheduled',
    scheduledDate,
    clarifiedAt: Date.now(),
    order: await nextOrder(),
  })
}

/** Clarify into a delegated item, waiting on someone else. */
export async function clarifyAsWaitingFor(actionId: string, waitingOn: string) {
  await db.actions.update(actionId, {
    status: 'waiting',
    waitingOn,
    clarifiedAt: Date.now(),
    order: await nextOrder(),
  })
}

/**
 * Clarify into a project: the inbox item becomes the project's definition,
 * and a fresh next action is created and linked to it.
 */
export async function clarifyAsProject(
  actionId: string,
  opts: { title: string; outcome: string; areaOfFocusId?: string; firstActionTitle: string; contextId?: string },
) {
  const now = Date.now()
  const project: Project = {
    id: uuid(),
    title: opts.title,
    outcome: opts.outcome,
    status: 'active',
    areaOfFocusId: opts.areaOfFocusId,
    createdAt: now,
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
    order: now,
  }
  await db.actions.add(firstAction)

  // The original inbox capture is now reference material describing the project; remove it.
  await db.actions.delete(actionId)

  return { project, firstAction }
}

export async function completeAction(actionId: string) {
  await db.actions.update(actionId, { status: 'done', completedAt: Date.now() })
}

export async function reopenAction(actionId: string, status: ActionStatus = 'next') {
  await db.actions.update(actionId, { status, completedAt: undefined })
}

export async function updateAction(actionId: string, changes: Partial<Action>) {
  await db.actions.update(actionId, changes)
}

export async function deleteAction(actionId: string) {
  await db.actions.delete(actionId)
}

export async function addActionToProject(
  projectId: string,
  title: string,
  opts: { contextId?: string; status?: ActionStatus } = {},
) {
  const now = Date.now()
  const action: Action = {
    id: uuid(),
    title,
    status: opts.status ?? 'next',
    projectId,
    contextId: opts.contextId,
    createdAt: now,
    clarifiedAt: now,
    order: now,
  }
  await db.actions.add(action)
  return action
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
