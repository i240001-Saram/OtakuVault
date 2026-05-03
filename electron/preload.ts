import { ipcRenderer, contextBridge } from 'electron'

const api = {
  selectFolder: () => ipcRenderer.invoke('dialog:openDirectory'),
  scanFiles: (path: string) => ipcRenderer.invoke('files:scan', path),
  getLibrary: () => ipcRenderer.invoke('db:getLibrary'),
  onMetadataUpdate: (callback: () => void) => {
    ipcRenderer.removeAllListeners('metadata-updated')
    ipcRenderer.on('metadata-updated', () => callback())
  },
  toggleFavorite: (id: number) => ipcRenderer.invoke('db:toggleFavorite', id),
  toggleWatched: (id: number) => ipcRenderer.invoke('db:toggleWatched', id),
  updateRating: (id: number, score: number) => ipcRenderer.invoke('db:updateRating', id, score),
  cleanLibrary: () => ipcRenderer.invoke('db:cleanLibrary'),
  nukeDatabase: () => ipcRenderer.invoke('db:nukeDatabase'),
  saveSettings: (path: string) => ipcRenderer.invoke('app:saveSettings', path),
  updateWatchedStatus: (ids: number[], status: number) => ipcRenderer.invoke('db:updateWatchedStatus', ids, status),
  playVideo: (path: string) => ipcRenderer.invoke('app:playVideo', path)
}

contextBridge.exposeInMainWorld('api', api)