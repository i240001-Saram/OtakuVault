import { ipcRenderer, contextBridge } from 'electron'

const api = {
  selectFolder: () => ipcRenderer.invoke('dialog:openDirectory'),
  scanFiles: (path: string) => ipcRenderer.invoke('files:scan', path),
  getLibrary: () => ipcRenderer.invoke('db:getLibrary'),
}

contextBridge.exposeInMainWorld('api', api)