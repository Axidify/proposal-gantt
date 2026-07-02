# Electron security baseline

Proposal Gantt is a **local-first desktop app** with no remote code execution. This doc records the Phase A security posture.

---

## Renderer hardening (`src/main/index.ts`)

| Setting | Value | Notes |
|---------|-------|-------|
| `sandbox` | `true` | Renderer runs without Node integration |
| `contextIsolation` | `true` | Preload is the only bridge to main |
| `nodeIntegration` | `false` | Explicit; default is false in modern Electron |
| `webSecurity` | default (`true`) | Standard Chromium same-origin rules |

External links open via `shell.openExternal`; `setWindowOpenHandler` denies in-window navigation.

---

## Preload audit (`src/preload/index.ts`)

**Exposed globals (via `contextBridge` only):**

| Global | API | IPC channel | Risk |
|--------|-----|-------------|------|
| `window.electron` | `@electron-toolkit/preload` helpers | toolkit-defined | Low — curated wrappers |
| `window.api.openFile` | Native open dialog + read | `dialog:open` | User-picked path only |
| `window.api.saveFile` | Native save dialog + write | `dialog:save` | User-picked path only |
| `window.api.exportFile` | Export dialog + binary write | `dialog:export` | User-picked path only |

**Not exposed:** raw `ipcRenderer`, `fs`, `path`, `require`, or arbitrary channel invoke.

The non-isolated fallback branch was removed; the app requires `contextIsolation: true`.

---

## Main process IPC (`src/main/index.ts`)

Handlers are fixed-purpose:

- `dialog:open` — read single user-selected file as UTF-8
- `dialog:save` — write UTF-8 to user path (or save-as)
- `dialog:export` — decode base64 data URL and write PNG/PDF

No `eval`, no shell execution, no arbitrary file paths from renderer without dialog.

---

## Follow-ups (post–Phase A)

- Content-Security-Policy for renderer (if we add remote assets)
- Code signing + auto-update (Phase D)
- Optional crash reporting (opt-in)
