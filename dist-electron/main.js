import { app as D, ipcMain as m, dialog as K, shell as Q, BrowserWindow as j } from "electron";
import { fileURLToPath as q } from "node:url";
import p from "node:path";
import M from "fs/promises";
import J from "better-sqlite3";
import { Buffer as Z } from "node:buffer";
let a;
function B() {
  const s = p.join(D.getPath("userData"), "otakuvault.db");
  a = new J(s), a.pragma("journal_mode = WAL"), a.exec(`
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
  `);
  try {
    a.exec("ALTER TABLE series ADD COLUMN is_favorite BOOLEAN DEFAULT 0;");
  } catch {
  }
  try {
    a.exec("ALTER TABLE series ADD COLUMN user_rating INTEGER DEFAULT 0;");
  } catch {
  }
  try {
    a.exec("ALTER TABLE episodes ADD COLUMN is_watched BOOLEAN DEFAULT 0;");
  } catch {
  }
  console.log("SQLite Database initialized at:", s);
}
function ee(s) {
  const e = a.prepare("SELECT id, mal_id FROM series WHERE title = ?").get(s);
  return e ? { id: e.id, needsFetch: e.mal_id === null } : { id: a.prepare("INSERT INTO series (title) VALUES (?)").run(s).lastInsertRowid, needsFetch: !0 };
}
function te(s, e, t, i) {
  a.prepare(`
    INSERT INTO episodes (series_id, season, episode, file_path) 
    VALUES (?, ?, ?, ?)
    ON CONFLICT(series_id, season, episode) DO UPDATE SET file_path=excluded.file_path
  `).run(s, e, t, i);
}
function I() {
  const e = a.prepare("SELECT * FROM series ORDER BY title ASC").all(), t = a.prepare("SELECT * FROM episodes WHERE series_id = ? ORDER BY season ASC, episode ASC");
  return e.map((i) => ({
    ...i,
    episodes: t.all(i.id)
  }));
}
function se(s, e) {
  a.prepare(`
    UPDATE series 
    SET mal_id = ?, poster_url = ?, synopsis = ?, genres = ?, score = ?
    WHERE id = ?
  `).run(e.mal_id, e.poster_url, e.synopsis, e.genres, e.score, s);
}
function ie(s, e, t) {
  a.prepare("UPDATE episodes SET episode_title = ? WHERE series_id = ? AND episode = ?").run(t, s, e);
}
function ae(s) {
  const e = a.prepare("SELECT is_favorite FROM series WHERE id = ?").get(s);
  if (e) {
    const t = e.is_favorite ? 0 : 1;
    return a.prepare("UPDATE series SET is_favorite = ? WHERE id = ?").run(t, s), t;
  }
  return 0;
}
function ne(s) {
  const e = a.prepare("SELECT is_watched FROM episodes WHERE id = ?").get(s);
  if (e) {
    const t = e.is_watched ? 0 : 1;
    return a.prepare("UPDATE episodes SET is_watched = ? WHERE id = ?").run(t, s), t;
  }
  return 0;
}
function re(s, e) {
  a.prepare("UPDATE series SET user_rating = ? WHERE id = ?").run(e, s);
}
function oe() {
  return a.prepare("SELECT id, file_path FROM episodes").all();
}
function ce(s) {
  if (s.length === 0) return;
  const e = s.map(() => "?").join(",");
  a.prepare(`DELETE FROM episodes WHERE id IN (${e})`).run(...s), a.prepare("DELETE FROM series WHERE id NOT IN (SELECT DISTINCT series_id FROM episodes)").run();
}
function le() {
  a.exec(`
    PRAGMA foreign_keys = OFF;
    DROP TABLE IF EXISTS episodes;
    DROP TABLE IF EXISTS series;
    PRAGMA foreign_keys = ON;
  `), B();
}
function de(s, e) {
  if (s.length === 0) return;
  const t = s.map(() => "?").join(",");
  a.prepare(`UPDATE episodes SET is_watched = ? WHERE id IN (${t})`).run(e, ...s);
}
const C = (s) => new Promise((e) => setTimeout(e, s)), x = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
async function W(s, e, t, i) {
  var f, c, l, d;
  try {
    const E = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(e)}&limit=10`, g = await fetch(E);
    if (!g.ok) {
      if (g.status === 429)
        return console.log(`Rate limited on ${e}! Waiting 2 seconds...`), await C(2e3), W(s, e, t, i);
      console.error(`Jikan API Error: ${g.status}. Skipping metadata for ${e}.`);
      return;
    }
    const h = await g.json();
    if (h.data && h.data.length > 0) {
      let n = h.data[0], R = -9999;
      const S = x(t), b = x(e);
      h.data.forEach((r, O) => {
        let o = 0;
        const y = [
          r.title,
          r.title_english,
          ...r.title_synonyms || []
        ].filter(Boolean).map((T) => T.toLowerCase()), N = y.map(x);
        N.includes(b) ? o += 2e3 : N.some((T) => T.includes(S)) && (o += 100);
        const A = r.type || "";
        if (A === "TV" && (o += 200), A === "Movie" && (o += 50), (A === "Music" || A === "CM" || A === "PV" || A === "Special" || A === "ONA") && (o -= 800), i > 1) {
          const T = N.includes(S);
          T && (o -= 1e3), !T && N.some((L) => L.includes(S)) && (o += 400);
          const P = ["", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"][i] || "", Y = [
            `season ${i}`,
            `${i}nd season`,
            `${i}rd season`,
            `${i}th season`,
            `part ${i}`,
            `season ${P}`
          ];
          y.some((L) => Y.some((F) => L.includes(F))) && (o += 1e3);
          const z = new RegExp("\\b(season [1-9]|part [1-9]|[1-9]nd|[1-9]rd|[1-9]th)\\b", "i");
          y.some((L) => {
            const F = L.match(z);
            return F ? !F[0].includes(i.toString()) : !1;
          }) && (o -= 1e3);
        } else {
          const T = /\b(season [2-9]|part [2-9]|2nd|3rd|4th|5th|6th)\b/i;
          y.some((P) => T.test(P)) && (o -= 1e3);
        }
        o += (10 - O) * 10, i > 1 && r.year && (o += (r.year - 2e3) * 50), i > 1 ? o += (r.members || 0) / 1e6 : o += (r.members || 0) / 1e5, o > R && (R = o, n = r);
      });
      const _ = n.mal_id, w = ((c = (f = n.images) == null ? void 0 : f.jpg) == null ? void 0 : c.large_image_url) || ((d = (l = n.images) == null ? void 0 : l.jpg) == null ? void 0 : d.image_url) || "";
      let U = "";
      if (w)
        try {
          const r = await fetch(w);
          if (r.ok) {
            const O = await r.arrayBuffer();
            U = `data:image/jpeg;base64,${Z.from(O).toString("base64")}`;
          }
        } catch (r) {
          console.error(`Failed to download poster for ${n.title}:`, r);
        }
      const X = {
        mal_id: _,
        poster_url: U,
        synopsis: n.synopsis || "No synopsis available.",
        genres: n.genres ? n.genres.map((r) => r.name).join(", ") : "",
        score: n.score || 0
      };
      se(s, X), await C(1500);
      const G = `https://api.jikan.moe/v4/anime/${_}/episodes`, $ = await fetch(G);
      if ($.ok) {
        const r = await $.json();
        if (r.data) {
          for (const O of r.data) {
            const o = O.mal_id.toString().padStart(2, "0");
            ie(s, o, O.title);
          }
          console.log(`Vault Updated: ${n.title} (MAL ID: ${_})`);
        }
      }
    } else
      console.log(`No results found on MyAnimeList for: ${e}`);
  } catch (E) {
    console.error(`Failed to fetch data for ${e}:`, E);
  }
}
function pe(s) {
  const e = s;
  let t = s;
  t = t.replace(/[\[\(].*?[\]\)]/g, ""), t = t.replace(/\b(1080p|720p|480p|2160p|4k)\b/gi, ""), t = t.replace(/\b(x264|x265|hevc|10bit|8bit)\b/gi, ""), t = t.replace(/\.[^/.]+$/, ""), t = t.replace(/_/g, " "), t = t.trim();
  let i = t, f = "01", c = "??";
  const l = /Season\s+(\d+).*?(?:Episode\s+|-\s+)(\d+(?:\.\d+)?)/i, d = /S(\d+)\s*E(\d+(?:\.\d+)?)/i, E = /\s-\s(\d+(?:\.\d+)?)/, g = /Episode\s+(\d+(?:\.\d+)?)/i, h = /[- ]\s*(Bonus|OVA|Special|OAD|Movie|Extra|Omake|Recap)/i, n = t.match(l), R = t.match(d), S = t.match(E), b = t.match(g), _ = t.match(h);
  if (n)
    f = n[1].padStart(2, "0"), c = n[2], i = t.substring(0, n.index).trim();
  else if (R)
    f = R[1].padStart(2, "0"), c = R[2], i = t.substring(0, R.index).trim();
  else if (S)
    c = S[1], i = t.substring(0, S.index).trim();
  else if (b)
    c = b[1], i = t.substring(0, b.index).trim();
  else if (_)
    c = _[1], i = t.substring(0, _.index).trim();
  else {
    const w = t.indexOf(" - ");
    w !== -1 && (i = t.substring(0, w).trim(), c = t.substring(w + 3).trim());
  }
  return isNaN(parseFloat(c)) || c.includes(".") || (c = c.padStart(2, "0")), i = i.replace(/[-.]$/, "").trim(), i = i.replace(/\./g, " ").trim(), i || (i = t), { original: e, title: i, season: f, episode: c };
}
const V = p.dirname(q(import.meta.url));
process.env.APP_ROOT = p.join(V, "..");
const v = process.env.VITE_DEV_SERVER_URL, Re = p.join(process.env.APP_ROOT, "dist-electron"), k = p.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = v ? p.join(process.env.APP_ROOT, "public") : k;
D.commandLine.appendSwitch("log-level", "3");
let u;
m.handle("dialog:openDirectory", async () => {
  const { canceled: s, filePaths: e } = await K.showOpenDialog({
    properties: ["openDirectory"]
  });
  return s ? null : e[0];
});
m.handle("db:getLibrary", () => I());
m.handle("files:scan", async (s, e) => {
  async function t(i) {
    const f = await M.readdir(i, { withFileTypes: !0 });
    return (await Promise.all(f.map((l) => {
      const d = p.join(i, l.name);
      return l.isDirectory() ? t(d) : d;
    }))).flat();
  }
  try {
    const f = (await t(e)).filter((l) => /\.(mkv|mp4|avi|ts)$/i.test(p.extname(l))), c = /* @__PURE__ */ new Map();
    for (const l of f) {
      const d = p.basename(l), E = pe(d), g = parseInt(E.season), h = g > 1 ? `${E.title} Season ${g}` : E.title, n = ee(h);
      te(n.id, E.season, E.episode, l), n.needsFetch && c.set(n.id, { searchTitle: h, parsedTitle: E.title, seasonInt: g });
    }
    return (async () => {
      for (const [l, d] of c.entries())
        await W(l, d.searchTitle, d.parsedTitle, d.seasonInt), u == null || u.webContents.send("metadata-updated"), await C(1500);
    })(), I();
  } catch (i) {
    return console.error("Scanning Error:", i), [];
  }
});
m.handle("db:toggleFavorite", (s, e) => ae(e));
m.handle("db:toggleWatched", (s, e) => ne(e));
m.handle("db:updateRating", (s, e, t) => re(e, t));
m.handle("db:cleanLibrary", async () => {
  const s = oe(), e = [];
  for (const t of s)
    try {
      await M.access(t.file_path);
    } catch {
      e.push(t.id);
    }
  return e.length > 0 && ce(e), I();
});
m.handle("db:nukeDatabase", () => (le(), I()));
m.handle("app:saveSettings", async (s, e) => {
  const t = p.join(D.getPath("userData"), "settings.json");
  return await M.writeFile(t, JSON.stringify({ rootPath: e })), !0;
});
m.handle("db:updateWatchedStatus", (s, e, t) => de(e, t));
m.handle("app:playVideo", async (s, e) => {
  await Q.openPath(e);
});
function H() {
  u = new j({
    width: 900,
    height: 670,
    title: "OtakuVault",
    icon: p.join(process.env.VITE_PUBLIC, "icon.png"),
    webPreferences: {
      preload: p.join(V, "preload.mjs"),
      sandbox: !0,
      contextIsolation: !0,
      nodeIntegration: !1
    }
  }), u.webContents.on("did-finish-load", () => {
    u == null || u.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), v ? u.loadURL(v) : u.loadFile(p.join(k, "index.html"));
}
D.on("window-all-closed", () => {
  process.platform !== "darwin" && (D.quit(), u = null);
});
D.on("activate", () => {
  j.getAllWindows().length === 0 && H();
});
D.whenReady().then(() => {
  B(), H();
});
export {
  Re as MAIN_DIST,
  k as RENDERER_DIST,
  v as VITE_DEV_SERVER_URL
};
