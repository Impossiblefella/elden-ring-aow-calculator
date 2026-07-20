/**
 * main.cjs — Electron main process (CommonJS for Electron).
 *
 * Spawns the bundled Express server as a child process, waits for it
 * to be ready, then opens a single browser window pointing at it.
 *
 * SAFETY: Single-instance lock + no-retry-on-failure.
 *
 * AUTO-UPDATE: Uses electron-updater to check GitHub Releases for new
 * versions. On update-available, downloads in background and installs
 * on quit. In dev mode, auto-update is skipped.
 */
const { app, BrowserWindow, shell, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");

const SERVER_PORT = 3456;
let mainWindow = null;
let serverProcess = null;
let isQuitting = false;

// ── AUTO-UPDATER ──────────────────────────────────────────────────────────────
// electron-updater checks the GitHub releases feed for a latest.yml file.
// In dev mode (!app.isPackaged), we skip auto-update entirely.
let autoUpdater = null;
try {
  if (app.isPackaged) {
    autoUpdater = require("electron-updater").autoUpdater;
  }
} catch (e) {
  console.log("[updater] electron-updater not available, skipping:", e.message);
}

if (autoUpdater) {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnQuit = true;

  autoUpdater.on("checking-for-update", () => {
    console.log("[updater] Checking for updates...");
  });
  autoUpdater.on("update-available", (info) => {
    console.log("[updater] Update available:", info.version);
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Update Available",
        message: `Version ${info.version} is available.`,
        detail: "It will be downloaded in the background and installed when you close the app.",
        buttons: ["OK"],
      });
    }
  });
  autoUpdater.on("update-not-available", (info) => {
    console.log("[updater] Up to date:", info.version);
  });
  autoUpdater.on("download-progress", (progress) => {
    console.log(`[updater] Downloading: ${Math.round(progress.percent)}%`);
  });
  autoUpdater.on("update-downloaded", (info) => {
    console.log("[updater] Update downloaded:", info.version);
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Update Ready",
        message: `Version ${info.version} has been downloaded.`,
        detail: "The update will be installed when you close the app.",
        buttons: ["OK"],
      }).then(({ response }) => {
        // response 0 = "OK" — user acknowledged. Exit to install.
        isQuitting = true;
        autoUpdater.quitAndInstall();
      });
    } else {
      isQuitting = true;
      autoUpdater.quitAndInstall();
    }
  });
  autoUpdater.on("error", (err) => {
    console.error("[updater] Error:", err.message);
  });
}

// ── SINGLE INSTANCE LOCK ─────────────────────────────────────────────────────
// This is THE most important guard: prevents multiple instances from spawning.
const gotSingleLock = app.requestSingleInstanceLock();
if (!gotSingleLock) {
  // Another instance is already running — exit immediately.
  console.log("Another instance is already running. Exiting.");
  app.quit();
  process.exit(0);
}

app.on("second-instance", () => {
  // Someone tried to open a second instance — just focus the existing window.
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// ── Check if server is responding ───────────────────────────────────────────
function waitForServer(port, retries = 60) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      const req = http.get(`http://localhost:${port}/api/health`, (res) => {
        if (res.statusCode === 200) resolve();
        else retry();
      });
      req.on("error", () => retry());
      req.setTimeout(1000, () => { req.destroy(); retry(); });
    };
    const retry = () => {
      if (++attempts >= retries) reject(new Error("Server failed to start"));
      else setTimeout(check, 500);
    };
    check();
  });
}

// ── Start the embedded Express server (ONCE — no retries) ───────────────────
function startServer() {
  // In a packaged app, server-bundle.cjs is in resources/app.asar.unpacked/server-bundle.cjs
  // In dev, it's at electron/server-bundle.cjs
  const isDev = !app.isPackaged;
  let serverPath;

  if (isDev) {
    serverPath = path.join(__dirname, "..", "server-bundle.cjs");
  } else {
    // Packaged: resourcesPath is the resources/ folder in win-unpacked
    serverPath = path.join(process.resourcesPath, "app.asar.unpacked", "server-bundle.cjs");
  }

  console.log("Starting server from:", serverPath);
  if (!require("fs").existsSync(serverPath)) {
    console.error("Server bundle NOT FOUND at:", serverPath);
    return Promise.reject(new Error("Server bundle not found: " + serverPath));
  }

  serverProcess = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      PORT: String(SERVER_PORT),
      HOST: "127.0.0.1",
      // Don't inherit the Electron-specific env that could cause weirdness
      ELECTRON_RUN_AS_NODE: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: false,
  });

  serverProcess.stdout?.on("data", (data) => console.log("[server]", data.toString().trim()));
  serverProcess.stderr?.on("data", (data) => console.error("[server]", data.toString().trim()));

  serverProcess.on("error", (err) => {
    console.error("Server process error:", err);
  });

  serverProcess.on("exit", (code, signal) => {
    console.log(`Server process exited with code ${code} signal ${signal}`);
    serverProcess = null;
    // If the server dies unexpectedly WHILE running, show an error dialog
    // but don't try to restart it (avoids the infinite-loop bug).
    if (!isQuitting && mainWindow) {
      dialog.showErrorBox(
        "Server stopped",
        "The embedded server stopped unexpectedly. The app will close."
      );
      app.quit();
    }
  });

  return waitForServer(SERVER_PORT).catch((err) => {
    console.error("Server startup failed:", err.message);
    throw err;
  });
}

// ── Create the main window ───────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "Elden Ring AoW Damage Calculator",
    backgroundColor: "#1a1a2e",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

// ── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  try {
    await startServer();
  } catch (err) {
    // Server failed — show a clear error and QUIT. Do NOT retry. Do NOT spawn windows.
    dialog.showErrorBox(
      "Failed to start",
      `The server could not start:\n\n${err.message}\n\nThe app will now close.`
    );
    app.quit();
    return;
  }

  if (mainWindow === null) createWindow();

  // Check for updates after the window is up (only in packaged builds).
  if (autoUpdater) {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.error("[updater] Check failed:", err.message);
    });
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  isQuitting = true;
  if (serverProcess) {
    try { serverProcess.kill(); } catch (e) {}
    serverProcess = null;
  }
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  isQuitting = true;
  if (serverProcess) {
    try { serverProcess.kill(); } catch (e) {}
    serverProcess = null;
  }
});

// Never let multiple windows spawn. If someone tries, single-instance-lock handles it.
app.on("browser-window-created", () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length > 1) {
    console.warn("Multiple windows detected — closing extras.");
    allWindows.slice(1).forEach((w) => w.close());
  }
});
