# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install   # install Electron
npm start     # launch the app (electron .)
```

No lint, test, or build scripts are configured.

## Architecture

Electron app split across the standard two-process model:

- **`main.js`** — main process. Creates a single 400×560 non-resizable `BrowserWindow` with `titleBarStyle: 'hiddenInset'`, listens on the `notify` IPC channel and emits native `Notification`s. `window-all-closed` always calls `app.quit()` (no macOS exception) so closing the window terminates `npm start`.
- **`index.html`** — markup + CSS only. Loads `render.js`. Contains the SVG circle whose `r` attribute must match `RING_RADIUS` in `render.js`.
- **`render.js`** — renderer process. All timer state and DOM updates live here. Uses `require('electron').ipcRenderer` (enabled by `nodeIntegration: true, contextIsolation: false` in `main.js`).

### Timer state machine (`render.js`)

- `ticker` (the `setInterval` handle) is the single source of truth for "is running" — `null` means stopped. Do not reintroduce a parallel `running` boolean.
- `tickOrigin = { at: Date.now(), left: timeLeft }` is captured on each start/resume. `tick()` derives `timeLeft` from wall-clock elapsed time (`Date.now() - tickOrigin.at`), not from counting tick callbacks. This must stay this way: combined with `backgroundThrottling: false` in `main.js`, it's what keeps the timer accurate when the window loses focus — Chromium otherwise throttles `setInterval` in background tabs and the count drifts.
- `tick()` updates only the time label and ring offset for performance; full UI sync goes through `render()`, which is called on mode changes and user actions.
- `sessionDone()` advances `mode` per the pomodoro rule: every 4th completed work session goes to `long_break`, others to `short_break`; breaks always return to `work`.

### Constants that must stay in sync

- `RING_RADIUS` in `render.js` ↔ `r` attribute of `#ring-progress` in `index.html`.
- Mode keys (`work`, `short_break`, `long_break`) are shared across `THEMES` and `DURATIONS`; adding a mode requires both.

## Conventions

- UI copy and code comments are in Chinese — match the existing style.
- Colors are defined once in `THEMES` (per-mode accent) and in `index.html` CSS (background, button, text). The warm-light palette (`#F7F2EC` background, `#C65A4A` work accent) is intentional; mode is distinguished by ring/label color only, not by background.
