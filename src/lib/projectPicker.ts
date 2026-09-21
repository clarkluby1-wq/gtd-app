import type { ProjectStatus } from '../db/types'
import { meaningfulWords } from './similar'

export interface PickerProject {
  id: string
  title: string
  status: ProjectStatus
}

/** Score a project needs to be worth suggesting. A word unique to one or two projects counts for a lot; "house" barely counts. */
const SUGGEST_THRESHOLD = 0.5

/**
 * Active projects a task might belong to, judged by the meaningful words it shares with the project's title. A shared
 * word counts for less the more projects contain it, so a rare word ("smoke") suggests, and a generic one ("house")
 * doesn't. At most `max`, best first. It only suggests — nothing is chosen for you.
 */
export function suggestProjects(taskTitle: string, projects: PickerProject[], max = 3): PickerProject[] {
  const mine = meaningfulWords(taskTitle)
  if (mine.size === 0) return []

  const active = projects.filter((p) => p.status === 'active')
  const words = new Map(active.map((p) => [p.id, meaningfulWords(p.title)]))
  const scores = new Map<string, number>()

  for (const word of mine) {
    const holders = active.filter((p) => words.get(p.id)!.has(word))
    for (const p of holders) scores.set(p.id, (scores.get(p.id) ?? 0) + 1 / holders.length)
  }

  return active
    .filter((p) => (scores.get(p.id) ?? 0) >= SUGGEST_THRESHOLD)
    .sort((a, b) => scores.get(b.id)! - scores.get(a.id)! || a.title.localeCompare(b.title))
    .slice(0, max)
}

/** Projects whose title contains every word you typed. Active ones first, then those that start with what you typed. */
export function searchProjects(query: string, projects: PickerProject[]): PickerProject[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []
  return projects
    .filter((p) => {
      const title = p.title.toLowerCase()
      return tokens.every((t) => title.includes(t))
    })
    .sort(
      (a, b) =>
        Number(b.status === 'active') - Number(a.status === 'active') ||
        Number(b.title.toLowerCase().startsWith(tokens[0])) - Number(a.title.toLowerCase().startsWith(tokens[0])) ||
        a.title.localeCompare(b.title),
    )
}

/** Alphabetical, ignoring case — for the "browse everything" list. */
export function sortAlphabetically(projects: PickerProject[]): PickerProject[] {
  return [...projects].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
}

/** The projects you've most recently put something into (created or touched), newest first. */
export function recentProjectIds(
  actions: { projectId?: string; touchedAt?: number; createdAt: number }[],
  max = 4,
): string[] {
  const latest = new Map<string, number>()
  for (const a of actions) {
    if (!a.projectId) continue
    const at = a.touchedAt ?? a.createdAt
    if (at > (latest.get(a.projectId) ?? 0)) latest.set(a.projectId, at)
  }
  return [...latest.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([id]) => id)
}
