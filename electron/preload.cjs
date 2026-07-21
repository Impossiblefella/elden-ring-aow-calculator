/**
 * preload.cjs — Preload script that safely exposes updater controls to the
 * renderer process via the "erApp" global. Context isolation is ON, so this
 * is the only bridge between main and renderer.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("erApp", {
  // Returns { ok, currentVersion, updateAvailable, updateVersion, downloaded }
  checkForUpdates: () => ipcRenderer.invoke("updater:check"),
  // Returns the app version string (e.g. "1.0.2")
  getVersion: () => ipcRenderer.invoke("app:get-version"),
  // Returns the game patch version (e.g. "1.14")
  getPatch: () => ipcRenderer.invoke("app:get-patch"),
  // Opens the GitHub repo in the user's browser
  openRepo: () => ipcRenderer.invoke("app:open-repo"),
});
