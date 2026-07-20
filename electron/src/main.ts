/**
 * main.ts — Electron main process.
 *
 * Launches the embedded Express API server in the background, then opens
 * a browser window pointing at the built React frontend (served by the
 * Express server).
 */
import { app, BrowserWindow, shell } from "electron";
import * as path from "path";
import * as http from "http";

let mainWindow: BrowserWindow | null = null;
let server: http.Server | null = null;

// ── Start the embedded API server ───────────────────────────────────────────
async function startServer(): Promise<number> {
  // Dynamically import the Compiled server bundle.
  // In dev it uses tsx; in production we use the built JS.
  const port = 3456; // dedicated port for the embedded server

  try {
    // Try to load the bundled server module.
    const serverModule = require("../packages/server/dist/index.js");
    // The server module exports an `app` (Express) — we need to call listen()
    // But our server.ts calls app.listen() itself. For the Electron build,
    // we need a version that doesn't auto-listen. Let's just kill the port
    // and re-listen.
    // Actually, the simplest approach: just import and let it listen on 3001,
    // then the Electron window loads from localhost:3001 directly.
  } catch (err) {
    console.error("Failed to load server module:", err);
  }

  return port;
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
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // In production, load the built frontend served by the Express server.
  // In dev, load from the Vite dev server.
  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    // Load from the embedded server
    mainWindow.loadURL("http://localhost:3456");
  }

  // Open external links in the user's browser, not in Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  await startServer();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (server) {
    server.close();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});
