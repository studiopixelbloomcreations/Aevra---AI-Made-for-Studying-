# Windows Test Build Guide (Beginner)

This guide turns your AI project into a desktop Windows test app using Electron.

## 1) Install requirements

1. Install Node.js LTS from `https://nodejs.org`.
2. Open PowerShell in your project folder.
3. Install dependencies:

```powershell
npm install
```

## 2) Run the desktop test app

From project root:

```powershell
npm run desktop
```

By default, it loads local `index.html` from this repository.

If you want to load your deployed site instead:

```powershell
$env:APP_START_URL="https://officialtutorai.netlify.app/"; npm run desktop
```

## 3) What desktop mode adds

Desktop mode exposes secure APIs to the web UI through `window.DesktopAssistant`:

- creator-approved system actions
- creator-approved evolution proposal flow
- local audit logging

All actions still require explicit approvals.

## 4) Supported assistant actions now

- Open File Explorer (`open_file_explorer`)
- Open Maps link (`directions_home`)
- Connect Spotify link (`connect_spotify`)
- Open Spotify Liked Songs (`play_spotify_liked`)

When requested, desktop app shows a creator approval dialog.

## 5) Evolution manager (creator gate)

The desktop runtime tracks interaction deltas.  
Every threshold (default: 100 lines equivalent), it creates a pending evolution proposal.

You can inspect proposals through the preload API:

- `DesktopAssistant.listEvolution()`
- `DesktopAssistant.approveEvolution(proposalId)`

This is a controlled scaffold for your test workflow (proposal -> approval -> external patch pipeline).

## 6) Runtime storage location

Desktop runtime store is saved in Electron user data folder:

- `desktop_runtime_store.json`

It contains:

- line counter
- proposal list
- audit log

## 7) Security model used

- Browser renderer is sandboxed
- `contextIsolation: true`
- No `nodeIntegration` in renderer
- Native actions only through allowlisted IPC handlers
- Creator confirmation dialog before action execution

## 8) Next recommended steps

1. Add a dedicated Creator panel in UI to view/approve proposals.
2. Add cryptographic signing for action payloads.
3. Add action scopes (filesystem/apps/network/media) with toggles.
4. Add automated test runner before marking proposals "ready to apply".
