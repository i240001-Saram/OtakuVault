import Database from 'better-sqlite3'
import path from 'node:path'
import { app } from 'electron'

let db: Database.Database

export function initDB() {
  const dbPath = path.join(app.getPath('userData'), 'otakuvault.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

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
  `)
  console.log('SQLite Database initialized at:', dbPath)
}

export function insertSeries(title: string) {
  const stmt = db.prepare(`INSERT OR IGNORE INTO series (title) VALUES (?)`)
  const result = stmt.run(title)
  
  if (result.changes === 0) {
    const existing = db.prepare(`SELECT id, mal_id FROM series WHERE title = ?`).get(title) as { id: number, mal_id: number | null }
    return { id: existing.id, needsFetch: existing.mal_id === null }
  }
  
  return { id: result.lastInsertRowid as number, needsFetch: true }
}

export function insertEpisode(seriesId: number, season: string, episode: string, filePath: string) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO episodes (series_id, season, episode, file_path) 
    VALUES (?, ?, ?, ?)
  `)
  stmt.run(seriesId, season, episode, filePath)
}

export function getAllLibraryData() {
  const seriesStmt = db.prepare(`SELECT * FROM series ORDER BY title ASC`)
  const allSeries = seriesStmt.all() as any[]
  const episodeStmt = db.prepare(`SELECT * FROM episodes WHERE series_id = ? ORDER BY season ASC, episode ASC`)
  
  return allSeries.map(series => ({
    ...series,
    episodes: episodeStmt.all(series.id)
  }))
}

export function updateSeriesMetadata(id: number, data: { mal_id: number, poster_url: string, synopsis: string, genres: string, score: number }) {
  const stmt = db.prepare(`
    UPDATE series 
    SET mal_id = ?, poster_url = ?, synopsis = ?, genres = ?, score = ?
    WHERE id = ?
  `)
  stmt.run(data.mal_id, data.poster_url, data.synopsis, data.genres, data.score, id)
}

export function updateEpisodeTitle(seriesId: number, episodeNum: string, title: string) {
  const stmt = db.prepare(`UPDATE episodes SET episode_title = ? WHERE series_id = ? AND episode = ?`)
  stmt.run(title, seriesId, episodeNum)
}