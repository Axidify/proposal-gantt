# SVAR React Gantt — extension points

**Pinned version:** `@svar-ui/react-gantt@2.7.1` (exact; no caret in `package.json`)

Proposal Gantt extends SVAR beyond props/CSS theming. Treat any minor/patch upgrade as a **manual regression pass** using the checklist at the end of this doc.

---

## Components and imports

| Import | Usage |
|--------|--------|
| `Gantt`, `Willow` | Chart shell in `GanttView.tsx` |
| `IApi` | Type for `init` callback and custom column cells (`AddRowCell`, `MilestoneToggleCell`) |
| `@svar-ui/react-gantt/all.css` | Base styles (loaded once in `GanttView`) |

---

## `IApi` surface we rely on

### `init(api)` registration (`lib/gantt/apiHandlers.ts`, `hooks/useGanttApi.ts`)

| Method | Purpose |
|--------|---------|
| `api.intercept('add-task', …)` | Inject ids, modes, default start/duration for add-row and SVAR add |
| `api.intercept('update-task', …)` | Milestone normalization; capture pre-edit snapshot |
| `api.intercept('add-link', …)` | FS-only links via `addFsDependency` |
| `api.intercept('delete-link', …)` | Serialize links back to document state |
| `api.on('drag-task', …)` | Distinguish bar move vs resize (`width` changes) |
| `api.on('update-task', …)` | Drop-only sync (`syncFromApi`) |
| `api.on(…)` | `add-task`, `delete-task`, `update-link`, `delete-link`, `copy-task`, `move-task` → sync |
| `api.exec('update-task', …)` | Push scheduled dates back to chart after FS cascade |
| `api.exec('add-task', …)` | Called from `AddRowCell` |
| `api.serialize({ data: 'tasks' \| 'links' })` | Read chart state after edits |

### Link type

We only create **finish-to-start** links: `type: 'e2s'` (`FS_LINK_TYPE` in `dependencies.ts`).

---

## DOM/CSS coupling (high risk on upgrade)

Custom code queries or styles these SVAR classes:

| Class / attribute | Where | Why |
|-------------------|-------|-----|
| `.wx-bar`, `[data-task-id]` | `useDragToLink.ts` | Custom link-mode corner drag |
| `.wx-link`, `.wx-left`, `.wx-right`, `.wx-target` | `app.css`, `useDragToLink.ts` | Link handle hit targets and visuals |
| `.wx-grid`, `.wx-cell`, `.wx-editor-cell` | `app.css` | Inline editor styling |
| `.wx-row` | `app.css` | Show add-row / milestone buttons on hover |
| `.wx-content.wx-text`, `.wx-reorder-task` | `app.css` | Row drag cursor vs text select |
| `.wx-links` | (rendered by SVAR) | Dependency arrows — verify after zoom/config changes |

**Rule:** Prefer `.proposal-gantt-theme` as the outer scope for overrides. Do not set `position: relative` on `.wx-link` (breaks SVAR absolute positioning).

---

## Props we pass to `<Gantt />`

`tasks`, `links`, `scales`, `columns`, `start`, `end`, `zoom`, `autoScale={false}`, `weekStart={1}`, `init`

Column extensions: `milestone-toggle`, `add-task` (custom React cells).

---

## Upgrade checklist

1. Bump pinned version in `package.json`; `npm install`; commit lockfile.
2. `npm test` and `npm run build`.
3. Manual smoke in dev:
   - Add task / add phase (grid `+` buttons)
   - Drag bar (move + resize left edge)
   - Reparent row in grid
   - Link mode corner drag → FS dependency
   - Relative ↔ calendar mode toggle
   - Zoom presets + Fit
4. Inspect dependency arrows (`.wx-links` SVG) at day/week/month zoom.
5. Re-read SVAR changelog for renames to `intercept` events, `serialize` shape, or `.wx-*` classes.

---

## Future adapter (optional)

If we outgrow SVAR, the boundary to replace is:

- `lib/gantt/sync.ts` — document ↔ chart task arrays
- `lib/gantt/apiHandlers.ts` — event wiring
- `lib/gantt/columns.ts` — grid columns
- `hooks/useDragToLink.ts` — link UI overlay

Domain scheduling stays in `lib/dependencies.ts`.
