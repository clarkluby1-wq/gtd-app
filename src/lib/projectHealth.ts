import type { Action, Project } from '../db/types'

/**
 * A project with no 'next' action and nothing 'waiting' on someone else has no forward motion at
 * all — the classic stalled-project trap. Waiting on someone else still counts as moving forward.
 */
export function isProjectStalled(project: Project, actions: Action[]): boolean {
  return !actions.some((a) => a.projectId === project.id && (a.status === 'next' || a.status === 'waiting'))
}
