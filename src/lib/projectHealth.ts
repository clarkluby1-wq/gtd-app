import type { Action, Project } from '../db/types'

/** A project with no 'next' status action can't actually move forward — the classic stalled-project trap. */
export function lacksNextAction(project: Project, actions: Action[]): boolean {
  return !actions.some((a) => a.projectId === project.id && a.status === 'next')
}
