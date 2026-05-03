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
      file_path TEXT,
      UNIQUE(series_id, season, episode), 
      FOREIGN KEY(series_id) REFERENCES series(id) ON DELETE CASCADE
    );
  `)

  try {
    db.exec(`ALTER TABLE series ADD COLUMN is_favorite BOOLEAN DEFAULT 0;`)
  } catch (err) { /* Column already exists */ }

  try {
    db.exec(`ALTER TABLE series ADD COLUMN user_rating INTEGER DEFAULT 0;`)
  } catch (err) { /* Column already exists */ }

  try {
    db.exec(`ALTER TABLE episodes ADD COLUMN is_watched BOOLEAN DEFAULT 0;`)
  } catch (err) { /* Column already exists */ }

  console.log('SQLite Database initialized at:', dbPath)
}

export function insertSeries(title: string) {
  const existing = db.prepare(`SELECT id, mal_id FROM series WHERE title = ?`).get(title) as { id: number, mal_id: number | null } | undefined
  
  if (existing) {
    return { id: existing.id, needsFetch: existing.mal_id === null }
  }

  const stmt = db.prepare(`INSERT INTO series (title) VALUES (?)`)
  const result = stmt.run(title)
  
  return { id: result.lastInsertRowid as number, needsFetch: true }
}

export function insertEpisode(seriesId: number, season: string, episode: string, filePath: string) {
  const stmt = db.prepare(`
    INSERT INTO episodes (series_id, season, episode, file_path) 
    VALUES (?, ?, ?, ?)
    ON CONFLICT(series_id, season, episode) DO UPDATE SET file_path=excluded.file_path
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

export function toggleFavorite(id: number) {
  const current = db.prepare(`SELECT is_favorite FROM series WHERE id = ?`).get(id) as { is_favorite: number };
  if (current) {
    const newVal = current.is_favorite ? 0 : 1;
    db.prepare(`UPDATE series SET is_favorite = ? WHERE id = ?`).run(newVal, id);
    return newVal;
  }
  return 0;
}

export function toggleWatched(id: number) {
  const current = db.prepare(`SELECT is_watched FROM episodes WHERE id = ?`).get(id) as { is_watched: number };
  if (current) {
    const newVal = current.is_watched ? 0 : 1;
    db.prepare(`UPDATE episodes SET is_watched = ? WHERE id = ?`).run(newVal, id);
    return newVal;
  }
  return 0;
}

export function updateRating(id: number, score: number) {
  db.prepare(`UPDATE series SET user_rating = ? WHERE id = ?`).run(score, id);
}

export function getAllEpisodesForCleanup() {
  return db.prepare(`SELECT id, file_path FROM episodes`).all() as { id: number, file_path: string }[];
}

export function removeMissingEpisodes(missingIds: number[]) {
  if (missingIds.length === 0) return;
  const placeholders = missingIds.map(() => '?').join(',');
  db.prepare(`DELETE FROM episodes WHERE id IN (${placeholders})`).run(...missingIds);
  
  db.prepare(`DELETE FROM series WHERE id NOT IN (SELECT DISTINCT series_id FROM episodes)`).run();
}

export function nukeDatabase() {
  db.exec(`
    PRAGMA foreign_keys = OFF;
    DROP TABLE IF EXISTS episodes;
    DROP TABLE IF EXISTS series;
    PRAGMA foreign_keys = ON;
  `);
  initDB();
}

export function updateWatchedStatus(ids: number[], isWatched: number) {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`UPDATE episodes SET is_watched = ? WHERE id IN (${placeholders})`).run(isWatched, ...ids);
}