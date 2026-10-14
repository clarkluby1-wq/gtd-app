import type { Action, Project } from '../db/types'

/**
 * A project with no 'next' action, nothing 'waiting' on someone else and nothing 'scheduled' has no forward
 * motion at all — the classic stalled-project trap. Waiting on someone else, or a dated step that's booked
 * (a visit, a call, an appointment), still counts as moving forward.
 */
export function isProjectStalled(project: Project, actions: Action[]): boolean {
  return !actions.some(
    (a) => a.projectId === project.id && (a.status === 'next' || a.status === 'waiting' || a.status === 'scheduled'),
  )
}

/** What to tell someone about a stalled project: it either never got going, or every action is done and it was never closed out. */
export function stalledMessage(allActionsDone: boolean): string {
  return allActionsDone
    ? "Everything's done. Complete it, or add a next action."
    : 'Nothing next, waiting or scheduled. Add a next action.'
}
