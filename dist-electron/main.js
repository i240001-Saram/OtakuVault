import { app, ipcMain, dialog, BrowserWindow } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "fs/promises";
import Database from "better-sqlite3";
import { Buffer } from "node:buffer";
let db;
function initDB() {
  const dbPath = path.join(app.getPath("userData"), "otakuvault.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS series (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT UNIQUE,
      mal_id INTEGER,
      poster_url TEXT,
      synopsis TEXT,
      genres TEXT,
      score REAL
    );

    CREATE TABLE IF NOT EXISTS episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      series_id INTEGER,
      season TEXT,
      episode TEXT,
      episode_title TEXT,
      file_path TEXT UNIQUE,
      FOREIGN KEY(series_id) REFERENCES series(id) ON DELETE CASCADE
    );
  `);
  console.log("SQLite Database initialized at:", dbPath);
}
function insertSeries(title) {
  const stmt = db.prepare(`INSERT OR IGNORE INTO series (title) VALUES (?)`);
  const result = stmt.run(title);
  if (result.changes === 0) {
    const existing = db.prepare(`SELECT id, mal_id FROM series WHERE title = ?`).get(title);
    return { id: existing.id, needsFetch: existing.mal_id === null };
  }
  return { id: result.lastInsertRowid, needsFetch: true };
}
function insertEpisode(seriesId, season, episode, filePath) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO episodes (series_id, season, episode, file_path) 
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(seriesId, season, episode, filePath);
}
function getAllLibraryData() {
  const seriesStmt = db.prepare(`SELECT * FROM series ORDER BY title ASC`);
  const allSeries = seriesStmt.all();
  const episodeStmt = db.prepare(`SELECT * FROM episodes WHERE series_id = ? ORDER BY season ASC, episode ASC`);
  return allSeries.map((series) => ({
    ...series,
    episodes: episodeStmt.all(series.id)
  }));
}
function updateSeriesMetadata(id, data) {
  const stmt = db.prepare(`
    UPDATE series 
    SET mal_id = ?, poster_url = ?, synopsis = ?, genres = ?, score = ?
    WHERE id = ?
  `);
  stmt.run(data.mal_id, data.poster_url, data.synopsis, data.genres, data.score, id);
}
function updateEpisodeTitle(seriesId, episodeNum, title) {
  const stmt = db.prepare(`UPDATE episodes SET episode_title = ? WHERE series_id = ? AND episode = ?`);
  stmt.run(title, seriesId, episodeNum);
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function fetchAnimeMetadata(seriesId, title) {
  var _a, _b, _c, _d;
  try {
    console.log(`Fetching metadata for: ${title}...`);
    const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=10`;
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 429) {
        console.log(`Rate limited on ${title}! Waiting 2 seconds...`);
        await delay(2e3);
        return fetchAnimeMetadata(seriesId, title);
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (data.data && data.data.length > 0) {
      let bestMatch = data.data[0];
      const searchStr = title.toLowerCase().trim();
      let validMatches = data.data.filter((item) => {
        const t1 = (item.title || "").toLowerCase();
        const t2 = (item.title_english || "").toLowerCase();
        const synonyms = (item.title_synonyms || []).map((s) => s.toLowerCase());
        return t1 === searchStr || t2 === searchStr || synonyms.includes(searchStr);
      });
      if (validMatches.length === 0) {
        validMatches = data.data.filter((item) => {
          const t1 = (item.title || "").toLowerCase();
          const t2 = (item.title_english || "").toLowerCase();
          return t1.includes(searchStr) || t2.includes(searchStr);
        });
      }
      if (validMatches.length > 0) {
        bestMatch = validMatches.reduce((prev, current) => {
          return prev.members > current.members ? prev : current;
        });
      }
      const mal_id = bestMatch.mal_id;
      const targetImageUrl = ((_b = (_a = bestMatch.images) == null ? void 0 : _a.jpg) == null ? void 0 : _b.large_image_url) || ((_d = (_c = bestMatch.images) == null ? void 0 : _c.jpg) == null ? void 0 : _d.image_url) || "";
      let offlinePosterBase64 = "";
      if (targetImageUrl) {
        try {
          console.log(`Downloading poster: ${bestMatch.title}...`);
          const imgResponse = await fetch(targetImageUrl);
          if (imgResponse.ok) {
            const arrayBuffer = await imgResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            offlinePosterBase64 = `data:image/jpeg;base64,${buffer.toString("base64")}`;
          }
        } catch (imgError) {
          console.error(`Failed to download poster for ${bestMatch.title}:`, imgError);
        }
      }
      const metadata = {
        mal_id,
        poster_url: offlinePosterBase64,
        synopsis: bestMatch.synopsis || "No synopsis available.",
        genres: bestMatch.genres ? bestMatch.genres.map((g) => g.name).join(", ") : "",
        score: bestMatch.score || 0
      };
      updateSeriesMetadata(seriesId, metadata);
      console.log(`Success: Downloaded and saved data for ${bestMatch.title}`);
      await delay(1500);
      const epUrl = `https://api.jikan.moe/v4/anime/${mal_id}/episodes`;
      const epResponse = await fetch(epUrl);
      if (epResponse.ok) {
        const epData = await epResponse.json();
        if (epData.data) {
          for (const ep of epData.data) {
            const epNumStr = ep.mal_id.toString().padStart(2, "0");
            updateEpisodeTitle(seriesId, epNumStr, ep.title);
          }
          console.log(`Success: Downloaded episode titles for ${bestMatch.title}`);
        }
      }
    } else {
      console.log(`No results found on MyAnimeList for: ${title}`);
    }
  } catch (error) {
    console.error(`Failed to fetch data for ${title}:`, error);
  }
}
function parseFilename(filename) {
  const original = filename;
  let name = filename;
  name = name.replace(/[\[\(].*?[\]\)]/g, "");
  name = name.replace(/\b(1080p|720p|480p|2160p|4k)\b/gi, "");
  name = name.replace(/\b(x264|x265|hevc|10bit|8bit)\b/gi, "");
  name = name.replace(/\.[^/.]+$/, "");
  name = name.replace(/_/g, " ");
  name = name.trim();
  let title = name;
  let season = "01";
  let episode = "??";
  const regexSeason = /Season\s+(\d+).*?(?:Episode\s+|-\s+)(\d+(?:\.\d+)?)/i;
  const regexStandard = /S(\d+)\s*E(\d+(?:\.\d+)?)/i;
  const regexDash = /\s-\s(\d+(?:\.\d+)?)/;
  const regexEpisode = /Episode\s+(\d+(?:\.\d+)?)/i;
  const regexSpecial = /[- ]\s*(Bonus|OVA|Special|OAD|Movie|Extra|Omake|Recap)/i;
  const matchSeason = name.match(regexSeason);
  const matchStandard = name.match(regexStandard);
  const matchDash = name.match(regexDash);
  const matchEpisode = name.match(regexEpisode);
  const matchSpecial = name.match(regexSpecial);
  if (matchSeason) {
    season = matchSeason[1].padStart(2, "0");
    episode = matchSeason[2];
    title = name.substring(0, matchSeason.index).trim();
  } else if (matchStandard) {
    season = matchStandard[1].padStart(2, "0");
    episode = matchStandard[2];
    title = name.substring(0, matchStandard.index).trim();
  } else if (matchDash) {
    episode = matchDash[1];
    title = name.substring(0, matchDash.index).trim();
  } else if (matchEpisode) {
    episode = matchEpisode[1];
    title = name.substring(0, matchEpisode.index).trim();
  } else if (matchSpecial) {
    episode = matchSpecial[1];
    title = name.substring(0, matchSpecial.index).trim();
  } else {
    const dashIndex = name.indexOf(" - ");
    if (dashIndex !== -1) {
      title = name.substring(0, dashIndex).trim();
      episode = name.substring(dashIndex + 3).trim();
    }
  }
  if (!isNaN(parseFloat(episode))) {
    if (!episode.includes(".")) {
      episode = episode.padStart(2, "0");
    }
  }
  title = title.replace(/[-.]$/, "").trim();
  title = title.replace(/\./g, " ").trim();
  if (!title) title = name;
  return { original, title, season, episode };
}
createRequire(import.meta.url);
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
ipcMain.handle("dialog:openDirectory", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openDirectory"]
  });
  if (canceled) {
    return null;
  }
  return filePaths[0];
});
ipcMain.handle("db:getLibrary", () => {
  return getAllLibraryData();
});
ipcMain.handle("files:scan", async (_, dirPath) => {
  async function getFiles(dir) {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map((dirent) => {
      const res = path.join(dir, dirent.name);
      return dirent.isDirectory() ? getFiles(res) : res;
    }));
    return files.flat();
  }
  try {
    const allFiles = await getFiles(dirPath);
    const videoFiles = allFiles.filter((file) => /\.(mkv|mp4|avi|ts)$/i.test(path.extname(file)));
    const seriesToFetch = /* @__PURE__ */ new Map();
    for (const file of videoFiles) {
      const filename = path.basename(file);
      const parsed = parseFilename(filename);
      const seasonInt = parseInt(parsed.season);
      const searchTitle = seasonInt > 1 ? `${parsed.title} Season ${seasonInt}` : parsed.title;
      const seriesData = insertSeries(searchTitle);
      insertEpisode(seriesData.id, parsed.season, parsed.episode, file);
      if (seriesData.needsFetch) {
        seriesToFetch.set(seriesData.id, searchTitle);
      }
    }
    ;
    (async () => {
      for (const [id, title] of seriesToFetch.entries()) {
        await fetchAnimeMetadata(id, title);
        await delay(1500);
      }
    })();
    return getAllLibraryData();
  } catch (error) {
    console.error("Scanning Error:", error);
    return [];
  }
});
function createWindow() {
  win = new BrowserWindow({
    width: 900,
    height: 670,
    title: "OtakuVault",
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(() => {
  initDB();
  createWindow();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
