"use strict";
const electron = require("electron");
const api = {
  selectFolder: () => electron.ipcRenderer.invoke("dialog:openDirectory"),
  scanFiles: (path) => electron.ipcRenderer.invoke("files:scan", path)
};
electron.contextBridge.exposeInMainWorld("api", api);
