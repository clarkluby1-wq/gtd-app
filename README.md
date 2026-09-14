# GTD

A personal Getting Things Done app: capture, clarify, organize, and engage — with a
weekly review and a light touch of the Horizons of Focus.

Local-first: all data lives in the browser's IndexedDB (via Dexie). No server, no account.

## Workflow implemented

- **Capture** — a persistent quick-add bar dumps anything into the Inbox.
- **Clarify** — process each inbox item through the standard decision tree: actionable?
  the 2-minute rule, delegate vs. do it yourself, single action vs. project, date-specific
  vs. next time you get to it.
- **Organize** — Next Actions (by context/energy/time), Projects (with a defined outcome
  and linked actions), Waiting For, Someday/Maybe, Calendar.
- **Engage** — filter Next Actions by context, energy, and time available.
- **Areas of Focus** — Horizon 3: ongoing responsibilities that projects can anchor to.
- **Weekly Review** — a checklist to keep the whole system trustworthy.

## Development

```bash
npm install
npm run dev
```

## Ideas for next iterations

- Reference material storage (notes/links filed during clarify)
- Higher horizons: Goals (30k), Vision (40k), Purpose & Principles (50k)
- Natural Planning Model workspace for defining a new project
- Recurring/repeating actions
- Export/import (backup, since data is local-only)
- Keyboard-only capture (global shortcut) and command palette
