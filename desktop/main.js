const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const { autoUpdater } = require("electron-updater");

const DEFAULT_START_URL = "https://officialtutorai.netlify.app/";
const EVOLUTION_THRESHOLD = 100;

let mainWindow = null;
let updateNoticeShown = false;

function getStorePath() {
  return path.join(app.getPath("userData"), "desktop_runtime_store.json");
}

function loadStore() {
  const p = getStorePath();
  try {
    if (!fs.existsSync(p)) {
      return {
        line_counter: 0,
        evolution_threshold: EVOLUTION_THRESHOLD,
        proposals: [],
        audit: [],
      };
    }
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch (e) {
    return {
      line_counter: 0,
      evolution_threshold: EVOLUTION_THRESHOLD,
      proposals: [],
      audit: [],
    };
  }
}

function saveStore(store) {
  const p = getStorePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(store, null, 2), "utf-8");
}

function pushAudit(store, item) {
  const row = Object.assign({ at: new Date().toISOString() }, item || {});
  store.audit = Array.isArray(store.audit) ? store.audit : [];
  store.audit.push(row);
  if (store.audit.length > 1000) store.audit = store.audit.slice(-1000);
}

function getStartTarget() {
  const envUrl = String(process.env.APP_START_URL || "").trim();
  if (envUrl) return { type: "url", value: envUrl };
  return { type: "url", value: DEFAULT_START_URL };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 760,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const target = getStartTarget();
  if (target.type === "file") {
    mainWindow.loadFile(target.value);
  } else {
    mainWindow.loadURL(target.value);
  }
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    if (mainWindow && !updateNoticeShown) {
      mainWindow.webContents.send("desktop:update-status", { state: "checking" });
    }
  });

  autoUpdater.on("update-available", (info) => {
    if (mainWindow) {
      mainWindow.webContents.send("desktop:update-status", {
        state: "available",
        version: info && info.version ? String(info.version) : "",
      });
    }
  });

  autoUpdater.on("update-not-available", () => {
    if (mainWindow) {
      mainWindow.webContents.send("desktop:update-status", { state: "not-available" });
    }
  });

  autoUpdater.on("error", (err) => {
    if (mainWindow) {
      mainWindow.webContents.send("desktop:update-status", {
        state: "error",
        message: String((err && err.message) || err || "unknown"),
      });
    }
  });

  autoUpdater.on("update-downloaded", async (info) => {
    const v = info && info.version ? String(info.version) : "new";
    const approved = await promptCreatorApproval(
      "Update downloaded",
      `Version ${v} is ready.\nInstall now and restart app?`
    );
    if (approved) {
      autoUpdater.quitAndInstall();
    }
  });
}

function promptCreatorApproval(title, detail) {
  return dialog
    .showMessageBox(mainWindow, {
      type: "question",
      buttons: ["Allow", "Deny"],
      defaultId: 0,
      cancelId: 1,
      title,
      message: title,
      detail: String(detail || ""),
      noLink: true,
    })
    .then((r) => r.response === 0);
}

function executeAllowedAction(action) {
  return new Promise((resolve) => {
    if (!action || !action.type) return resolve({ ok: false, error: "Invalid action" });

    if (action.type === "open_file_explorer") {
      return exec("explorer.exe", (err) => {
        resolve(err ? { ok: false, error: err.message } : { ok: true });
      });
    }

    if (action.type === "directions_home" && action.maps_url) {
      return shell.openExternal(String(action.maps_url)).then(() => resolve({ ok: true })).catch((e) => resolve({ ok: false, error: e.message }));
    }

    if (action.type === "connect_spotify") {
      const u = action.oauth_url || "https://open.spotify.com/";
      return shell.openExternal(String(u)).then(() => resolve({ ok: true })).catch((e) => resolve({ ok: false, error: e.message }));
    }

    if (action.type === "play_spotify_liked") {
      const u = action.spotify_url || "https://open.spotify.com/collection/tracks";
      return shell.openExternal(String(u)).then(() => resolve({ ok: true })).catch((e) => resolve({ ok: false, error: e.message }));
    }

    resolve({ ok: false, error: `Unsupported action: ${action.type}` });
  });
}

ipcMain.handle("assistant:get_capabilities", async () => {
  return {
    ok: true,
    desktop: true,
    can_open_explorer: true,
    can_open_urls: true,
    creator_approval_required: true,
    evolution_threshold: EVOLUTION_THRESHOLD,
  };
});

ipcMain.handle("assistant:execute_action", async (_event, action) => {
  const store = loadStore();
  const label = action && action.type ? String(action.type) : "unknown_action";
  const approved = await promptCreatorApproval(
    `Creator approval required: ${label}`,
    `Requested desktop action:\n${JSON.stringify(action || {}, null, 2)}`
  );
  if (!approved) {
    pushAudit(store, { kind: "action_denied", action: label, payload: action || {} });
    saveStore(store);
    return { ok: false, denied: true, error: "Creator denied action" };
  }

  const result = await executeAllowedAction(action || {});
  pushAudit(store, { kind: "action_executed", action: label, payload: action || {}, result });
  saveStore(store);
  return result;
});

ipcMain.handle("evolution:report_delta", async (_event, payload) => {
  const lines = Math.max(0, Number((payload && payload.lines) || 0));
  if (!Number.isFinite(lines) || lines <= 0) return { ok: true, triggered: false };

  const store = loadStore();
  const threshold = Number(store.evolution_threshold || EVOLUTION_THRESHOLD);
  store.line_counter = Number(store.line_counter || 0) + lines;
  let triggered = false;

  while (store.line_counter >= threshold) {
    store.line_counter -= threshold;
    triggered = true;
    const proposal = {
      id: `proposal_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      at: new Date().toISOString(),
      status: "pending_creator_approval",
      trigger_lines: threshold,
      context: payload && payload.context ? String(payload.context).slice(0, 500) : "",
      note: "AI requested an evolution cycle after threshold activity.",
    };
    store.proposals = Array.isArray(store.proposals) ? store.proposals : [];
    store.proposals.push(proposal);
    pushAudit(store, { kind: "evolution_triggered", proposal_id: proposal.id, trigger_lines: threshold });
  }

  saveStore(store);
  return { ok: true, triggered, line_counter: store.line_counter };
});

ipcMain.handle("evolution:list", async () => {
  const store = loadStore();
  return {
    ok: true,
    line_counter: Number(store.line_counter || 0),
    threshold: Number(store.evolution_threshold || EVOLUTION_THRESHOLD),
    proposals: Array.isArray(store.proposals) ? store.proposals.slice(-100) : [],
  };
});

ipcMain.handle("evolution:audit", async () => {
  const store = loadStore();
  return {
    ok: true,
    audit: Array.isArray(store.audit) ? store.audit.slice(-300) : [],
  };
});

ipcMain.handle("evolution:approve", async (_event, proposalId) => {
  const store = loadStore();
  const proposals = Array.isArray(store.proposals) ? store.proposals : [];
  const idx = proposals.findIndex((p) => p && p.id === proposalId);
  if (idx < 0) return { ok: false, error: "Proposal not found" };

  const approved = await promptCreatorApproval(
    "Approve evolution proposal",
    `Proposal ID: ${proposalId}\nThis marks the proposal as approved for your external patch pipeline.`
  );
  if (!approved) return { ok: false, denied: true, error: "Creator denied proposal approval" };

  proposals[idx].status = "creator_approved";
  proposals[idx].approved_at = new Date().toISOString();
  store.proposals = proposals;
  pushAudit(store, { kind: "evolution_approved", proposal_id: proposalId });
  saveStore(store);
  return { ok: true, proposal: proposals[idx] };
});

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();
  autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
