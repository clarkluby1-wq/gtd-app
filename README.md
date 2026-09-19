# GTD

A personal Getting Things Done app: capture, clarify, organize, and engage — with the
full Horizons of Focus stack, a Natural Planning Model workspace, recurring actions,
reference storage, and a weekly review.

Local-first: all data lives in the browser's IndexedDB (via Dexie). No server, no account.

## Workflow implemented

- **Capture** — a persistent quick-add bar dumps anything into the Inbox.
- **Clarify** — process each inbox item through the standard decision tree. Actionable?
  If not: trash, Someday/Maybe, Reference, or Waiting For. If so: one step, or a project
  (outcome plus its very next action)? Then the next action — the item itself, or the
  project's first — gets one choice: do it now (under 2 minutes), someone else does it
  (Waiting For), a specific day (Calendar), or next time you get to it (Next Actions).
- **Organize** — Next Actions (by context/energy/time), Projects (with a defined outcome
  and linked actions), Waiting For, Someday/Maybe, Calendar, Reference.
- **Engage** — filter Next Actions by context, energy, and time available.
- **Horizons of Focus** — the full stack: Purpose & Principles (50k), Vision (40k),
  Goals (30k), Areas of Focus (20k). A guided bottom-up intake wizard (Areas → Goals →
  Vision → Purpose) helps set them up; each level stays editable afterward. Alignment
  is informational only (breadcrumbs, Weekly Review flags) — it never auto-prioritizes
  Next Actions, in keeping with GTD's context/energy/time-driven engage step.
- **Natural Planning Model** — an optional "Deep Plan" workspace alongside quick project
  creation: Purpose → Outcome Visioning → Brainstorm → Organize → Next Actions.
- **Recurring actions** — fixed-calendar templates (daily/weekly/monthly) that generate
  Calendar occurrences automatically.
- **Weekly Review** — a checklist, plus flags for orphaned projects, neglected Areas of
  Focus, and overdue backups.
- **Backup/restore** — export everything to a JSON file, or restore from one, in Settings.

## Development

```bash
npm install
npm run dev
```

## Publishing

Pushing to `main` builds the app and deploys it to GitHub Pages automatically
(`.github/workflows/deploy.yml`). The hosted copy is just the static app — everyone who opens it
gets their own private, empty database in their own browser, so nobody's data is ever shared.
Use Settings → Download backup to keep a copy of your own data.

## Ideas for next iterations

- Keyboard-only capture (global shortcut) and command palette
- Interval-after-completion recurrence (for habits, vs. fixed-calendar)
- Per-viewer computed priority score (currently deliberately omitted)
- Richer reference material (attachments, tags, full-text search)
