import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'fs/promises'
import { initDB, insertSeries, insertEpisode, getAllLibraryData } from './database'
import { fetchAnimeMetadata, delay } from './jikan'
import { parseFilename } from '../src/utils/parser'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

ipcMain.handle('dialog:openDirectory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  if (canceled) {
    return null
  }
  return filePaths[0]
})

ipcMain.handle('db:getLibrary', () => {
  return getAllLibraryData()
})

ipcMain.handle('files:scan', async (_, dirPath) => {
  async function getFiles(dir: string): Promise<string[]> {
    const dirents = await fs.readdir(dir, { withFileTypes: true })
    const files = await Promise.all(dirents.map((dirent) => {
      const res = path.join(dir, dirent.name)
      return dirent.isDirectory() ? getFiles(res) : res
    }))
    return files.flat() as string[]
  }

  try {
    const allFiles = await getFiles(dirPath)
    const videoFiles = allFiles.filter((file) => /\.(mkv|mp4|avi|ts)$/i.test(path.extname(file)))

    const seriesToFetch = new Map<number, string>()

    for (const file of videoFiles) {
      const filename = path.basename(file)
      const parsed = parseFilename(filename)

      const seasonInt = parseInt(parsed.season)
      const searchTitle = seasonInt > 1 
        ? `${parsed.title} Season ${seasonInt}` 
        : parsed.title

      const seriesData = insertSeries(searchTitle)
      insertEpisode(seriesData.id, parsed.season, parsed.episode, file)

      if (seriesData.needsFetch) {
        seriesToFetch.set(seriesData.id, searchTitle)
      }
    }

    ;(async () => {
      for (const [id, title] of seriesToFetch.entries()) {
        await fetchAnimeMetadata(id, title)
        await delay(1500) 
      }
    })()

    return getAllLibraryData()
  } catch (error) {
    console.error("Scanning Error:", error)
    return []
  }
})

function createWindow() {
  win = new BrowserWindow({
    width: 900,
    height: 670,
    title: 'OtakuVault',
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    },
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  initDB()
  createWindow()
})