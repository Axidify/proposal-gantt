# Proposal Gantt

A desktop app for pre-sales teams to create beautiful Gantt charts for client proposals.

## Features

- **Interactive Gantt editor** — drag tasks, edit inline, phases, milestones, and dependencies
- **Proposal metadata** — client name, title, prepared-by, date, and footnotes
- **Templates** — software implementation and consulting engagement starters
- **Save & open** — `.pgantt` JSON project files
- **Export** — PNG or PDF for dropping into proposals and slide decks
- **Themes** — accent colors tuned for client-facing deliverables

## Tech stack

- **Electron** — cross-platform desktop (macOS & Windows)
- **React + TypeScript + Vite**
- **SVAR React Gantt** — MIT-licensed Gantt component

## Getting started

```bash
npm install
npm run dev
```

## Build installers

```bash
npm run dist        # current platform
npm run dist:mac    # macOS .dmg
npm run dist:win    # Windows installer
```

## Project files

Proposals are saved as `.pgantt` (JSON) with metadata, tasks, and dependency links. You can version-control them or share between team members.

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| ⌘/Ctrl + N | New proposal |
| ⌘/Ctrl + O | Open file |
| ⌘/Ctrl + S | Save |
