import type { WeeklyReviewChecklistItem } from '../db/types'

export type ReviewPhase = 'clear' | 'current' | 'creative'

interface TemplateItem {
  key: string
  phase: ReviewPhase
  label: string
  subItems?: { key: string; label: string }[]
}

/** The review's steps. The guided walkthrough and the overview checklist both read and write these same items. */
export const TEMPLATE: TemplateItem[] = [
  { key: 'collect', phase: 'clear', label: 'Collect loose papers, notes, and stray ideas into the Inbox' },
  {
    key: 'inbox-zero',
    phase: 'clear',
    label: "Clear every inbox to zero — not just this app's",
    subItems: [
      { key: 'app-inbox', label: "This app's Inbox" },
      { key: 'email', label: 'Email' },
      { key: 'physical', label: 'Physical inbox / desk / mail' },
      { key: 'notes', label: 'Notes app' },
      { key: 'messaging', label: 'Other messaging (Slack, texts, voicemail…)' },
    ],
  },
  {
    key: 'next-actions',
    phase: 'current',
    label: 'Review the Next Actions list — cross off done items, add anything missing',
  },
  { key: 'previous-calendar', phase: 'current', label: "Scan last week's calendar for stray follow-ups" },
  { key: 'upcoming-calendar', phase: 'current', label: 'Scan the upcoming calendar for prep work or conflicts' },
  { key: 'waiting-for', phase: 'current', label: 'Review Waiting For — follow up on anything overdue, then click "Followed up"' },
  { key: 'projects', phase: 'current', label: 'Review every active Project — does each still have a next action?' },
  { key: 'backup', phase: 'current', label: 'Back up your data — one click keeps a safe copy' },
  {
    key: 'someday-maybe',
    phase: 'creative',
    label: 'Review Someday/Maybe — anything ready to activate, or ready to drop?',
  },
  { key: 'areas-of-focus', phase: 'creative', label: 'Scan Areas of Focus — is anything being neglected?' },
  { key: 'creative', phase: 'creative', label: 'Any new projects, ideas, or commitments to capture?' },
]

export const PHASES: { key: ReviewPhase; label: string; blurb: string }[] = [
  { key: 'clear', label: 'Get Clear', blurb: 'Empty your head and every inbox — nothing hidden, nothing forgotten.' },
  { key: 'current', label: 'Get Current', blurb: "Bring every list up to date with what's actually true right now." },
  { key: 'creative', label: 'Get Creative', blurb: "Look up and out — what haven't you captured yet?" },
]

export const PHASE_BY_KEY: Record<string, ReviewPhase> = Object.fromEntries(TEMPLATE.map((t) => [t.key, t.phase]))

export function isItemDone(item: WeeklyReviewChecklistItem) {
  return item.subItems ? item.subItems.every((s) => s.done) : item.done
}

/** Merge a saved checklist (possibly from an older template shape) onto the current template. */
export function normalizeChecklist(saved: WeeklyReviewChecklistItem[] | undefined): WeeklyReviewChecklistItem[] {
  const savedByKey = new Map((saved ?? []).map((c) => [c.key, c]))
  return TEMPLATE.map((t) => {
    const existing = savedByKey.get(t.key)
    if (!t.subItems) {
      return { key: t.key, label: t.label, done: existing?.done ?? false }
    }
    const existingSubByKey = new Map((existing?.subItems ?? []).map((s) => [s.key, s]))
    const subItems = t.subItems.map((s) => ({
      key: s.key,
      label: s.label,
      done: existingSubByKey.get(s.key)?.done ?? false,
    }))
    return { key: t.key, label: t.label, done: subItems.every((s) => s.done), subItems }
  })
}
