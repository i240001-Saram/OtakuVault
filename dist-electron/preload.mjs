"use strict";
const electron = require("electron");
const api = {
  selectFolder: () => electron.ipcRenderer.invoke("dialog:openDirectory"),
  scanFiles: (path) => electron.ipcRenderer.invoke("files:scan", path),
  getLibrary: () => electron.ipcRenderer.invoke("db:getLibrary")
};
electron.contextBridge.exposeInMainWorld("api", api);
