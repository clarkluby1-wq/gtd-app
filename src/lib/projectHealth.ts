import type { Action, Project } from '../db/types'

/**
 * A project with no 'next' action and nothing 'waiting' on someone else has no forward motion at
 * all — the classic stalled-project trap. Waiting on someone else still counts as moving forward.
 */
export function isProjectStalled(project: Project, actions: Action[]): boolean {
  return !actions.some((a) => a.projectId === project.id && (a.status === 'next' || a.status === 'waiting'))
}

/** What to tell someone about a stalled project: it either never got going, or every action is done and it was never closed out. */
export function stalledMessage(allActionsDone: boolean): string {
  return allActionsDone
    ? "Everything's done. Complete it, or add a next action."
    : 'Nothing next or pending. Add a next action.'
}
