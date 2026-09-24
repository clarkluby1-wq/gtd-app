import { v4 as uuid } from 'uuid'
import { db } from './db'
import { startOfWorkday } from '../lib/date'
import type { DueReminder } from '../lib/reminders'
import type { Action, ActionStatus, EnergyLevel, Project, ProjectStatus, ReminderState } from './types'

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

/** Clarify: mark an inbox item done immediately (the 2-minute rule, or the Inbox "already handled" shortcut). Always from status 'inbox'. */
export async function doItNow(actionId: string) {
  const now = Date.now()
  await db.actions.update(actionId, {
    status: 'done',
    completedAt: now,
    clarifiedAt: now,
    touchedAt: now,
    previousStatus: 'inbox',
  })
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
  opts: {
    contextId?: string
    energy?: EnergyLevel
    timeEstimateMin?: number
    dueDate?: number
    projectId?: string
    /** Start-of-day timestamp to put it on today's Short List straight away. */
    bigThreeDate?: number
  },
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
export async function clarifyAsScheduled(actionId: string, scheduledDate: number, projectId?: string, contextId?: string) {
  const now = Date.now()
  await db.actions.update(actionId, {
    status: 'scheduled',
    scheduledDate,
    projectId,
    contextId,
    clarifiedAt: now,
    touchedAt: now,
    order: await nextOrder(),
  })
}

/** Clarify into a delegated item, waiting on someone else. */
export async function clarifyAsWaitingFor(actionId: string, waitingOn: string, projectId?: string, followUpDate?: number) {
  const now = Date.now()
  await db.actions.update(actionId, {
    status: 'waiting',
    waitingOn,
    waitingSince: now,
    followUpDate,
    projectId,
    clarifiedAt: now,
    touchedAt: now,
    order: await nextOrder(),
  })
}

/** A new project's first action, already run through the same checks as any other next action. */
export interface FirstActionSpec {
  title: string
  status: 'next' | 'waiting' | 'scheduled' | 'done' | 'someday'
  contextId?: string
  energy?: EnergyLevel
  timeEstimateMin?: number
  dueDate?: number
  waitingOn?: string
  followUpDate?: number
  scheduledDate?: number
  /** Start-of-day timestamp to put it on today's Short List straight away. */
  bigThreeDate?: number
}

/**
 * Clarify into a project: the inbox item becomes the project's definition,
 * and (when given) its first action is created and linked to it.
 *
 * The first action can land anywhere a next action can — Next Actions, Waiting For, the Calendar, or
 * already done (a two-minute first step). It's omitted when parking the project on Someday/Maybe,
 * since GTD reserves "next action" for things you've actually committed to move on.
 * One transaction, so a failure can't leave a project without its action or a leftover inbox item.
 */
export async function clarifyAsProject(
  actionId: string,
  opts: {
    title: string
    outcome: string
    /** Notes typed while clarifying. The inbox item is removed, so they move onto the project. */
    notes?: string
    areaOfFocusId?: string
    goalId?: string
    status?: ProjectStatus
    firstAction?: FirstActionSpec
  },
) {
  const now = Date.now()
  const project: Project = {
    id: uuid(),
    title: opts.title,
    outcome: opts.outcome,
    notes: opts.notes,
    status: opts.status ?? 'active',
    areaOfFocusId: opts.areaOfFocusId,
    goalId: opts.goalId,
    createdAt: now,
    order: now,
  }

  let firstAction: Action | undefined
  const spec = opts.firstAction
  if (spec?.title.trim()) {
    firstAction = {
      id: uuid(),
      title: spec.title.trim(),
      status: spec.status,
      projectId: project.id,
      contextId: spec.contextId,
      energy: spec.energy,
      timeEstimateMin: spec.timeEstimateMin,
      dueDate: spec.dueDate,
      waitingOn: spec.waitingOn,
      followUpDate: spec.followUpDate,
      scheduledDate: spec.scheduledDate,
      bigThreeDate: spec.bigThreeDate,
      createdAt: now,
      clarifiedAt: now,
      touchedAt: now,
      order: now,
      ...(spec.status === 'waiting' ? { waitingSince: now } : {}),
      ...(spec.status === 'done' ? { completedAt: now, previousStatus: 'next' as const } : {}),
    }
  }

  await db.transaction('rw', db.projects, db.actions, async () => {
    await db.projects.add(project)
    if (firstAction) await db.actions.add(firstAction)
    // The original inbox capture is now reference material describing the project; remove it.
    await db.actions.delete(actionId)
  })

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

/**
 * A next action grew into something bigger: make a project for it and keep the action as the project's first step.
 * One transaction, so there's never a project without the link or a link without the project.
 */
export async function createProjectFromAction(
  actionId: string,
  opts: { title: string; outcome: string; areaOfFocusId?: string },
): Promise<Project> {
  const now = Date.now()
  const project: Project = {
    id: uuid(),
    title: opts.title.trim(),
    outcome: opts.outcome.trim(),
    status: 'active',
    areaOfFocusId: opts.areaOfFocusId,
    createdAt: now,
    order: now,
  }
  await db.transaction('rw', db.projects, db.actions, async () => {
    await db.projects.add(project)
    await db.actions.update(actionId, { projectId: project.id, touchedAt: now })
  })
  return project
}

export async function completeAction(actionId: string) {
  const now = Date.now()
  const current = await db.actions.get(actionId)
  await db.actions.update(actionId, {
    status: 'done',
    completedAt: now,
    touchedAt: now,
    previousStatus: current?.status,
  })
}

/**
 * Reopen a done action. With no explicit status, restores whatever status it had right before
 * completion (falling back to 'next' for older records that predate previousStatus tracking).
 */
export async function reopenAction(actionId: string, status?: ActionStatus) {
  let resolvedStatus = status
  if (!resolvedStatus) {
    const current = await db.actions.get(actionId)
    resolvedStatus = current?.previousStatus ?? 'next'
  }
  await db.actions.update(actionId, {
    status: resolvedStatus,
    completedAt: undefined,
    previousStatus: undefined,
    touchedAt: Date.now(),
  })
}

export async function updateAction(actionId: string, changes: Partial<Action>) {
  const now = Date.now()
  // Only a real move *into* Waiting For starts the follow-up clock — saving an edit to something already waiting must not reset it.
  const becomingWaiting = changes.status === 'waiting' && (await db.actions.get(actionId))?.status !== 'waiting'
  await db.actions.update(actionId, { ...changes, ...(becomingWaiting ? { waitingSince: now } : {}), touchedAt: now })
}

/**
 * Mark pop-up reminders as dealt with. `remindOnDay` applies to "tomorrow" items only: it asks for the same window
 * again on the day itself. Deliberately doesn't touch `touchedAt`, so acknowledging a reminder isn't an "edit".
 */
export async function acknowledgeReminders(items: DueReminder[], remindOnDay: boolean) {
  await db.transaction('rw', db.actions, async () => {
    for (const { action, kind } of items) {
      const current = await db.actions.get(action.id)
      if (current?.scheduledDate === undefined) continue
      const previous = current.reminder?.forDate === current.scheduledDate ? current.reminder : undefined
      const next: ReminderState = { ...previous, forDate: current.scheduledDate }
      // "now" (the exact-time ping) is independent of the day-level heads-up flow below — dealing with
      // one shouldn't mark the other as handled.
      if (kind === 'now') next.atTimeDone = true
      else if (kind === 'tomorrow') {
        next.headsUpDone = true
        next.remindOnDay = remindOnDay
      } else {
        next.headsUpDone = true
        next.dayOfDone = true
      }
      await db.actions.update(action.id, { reminder: next })
    }
  })
}

/** Record that you followed up with whoever this is waiting on (a reminder, a nudge, a call). */
export async function logFollowUp(actionId: string) {
  const now = Date.now()
  await db.transaction('rw', db.actions, async () => {
    const action = await db.actions.get(actionId)
    if (!action) return
    await db.actions.update(actionId, { followUps: [...(action.followUps ?? []), now], touchedAt: now })
  })
}

/** Take back the most recent follow-up, e.g. logged by mistake. */
export async function undoLastFollowUp(actionId: string) {
  await db.transaction('rw', db.actions, async () => {
    const action = await db.actions.get(actionId)
    if (!action?.followUps?.length) return
    const remaining = action.followUps.slice(0, -1)
    await db.actions.update(actionId, { followUps: remaining.length ? remaining : undefined, touchedAt: Date.now() })
  })
}

export async function deleteAction(actionId: string) {
  await db.actions.delete(actionId)
}

/** Put back an action exactly as it was — the "Undo" for a delete the user just made. */
export async function restoreAction(action: Action) {
  await db.actions.put(action)
}

/** Add an action to today's Short List. Caller is responsible for enforcing the 3-item cap. */
export async function pinToBigThree(actionId: string) {
  await db.actions.update(actionId, { bigThreeDate: startOfWorkday(), touchedAt: Date.now() })
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
    ...(opts.status === 'waiting' ? { waitingSince: now } : {}),
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
