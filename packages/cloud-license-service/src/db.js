import { Pool } from 'pg'
// NOTE: sqlite3 is NOT imported at the top level — it's a native addon (.node
// binary) that crashes Netlify Lambda at module load time even when the SQLite
// code path is never reached (USE_PG=true).  We lazy-import it only inside
// getSqlite() so the cloud deployment never touches the binary.
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// Load .env so local dev can switch to Postgres by setting DATABASE_URL.
// On Netlify there is no .env file (vars come from the platform) and this is
// a harmless no-op.
dotenv.config()

// When DATABASE_URL is set (Netlify + Supabase deployment), use Postgres.
// Otherwise fall back to the local SQLite file so local development keeps
// working exactly as before, with zero extra setup.
const USE_PG = !!process.env.DATABASE_URL

// ---------------------------------------------------------------------------
// Local SQLite mode (default, when DATABASE_URL is unset)
// ---------------------------------------------------------------------------
const initSql = `
CREATE TABLE IF NOT EXISTS activation_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  duration_days INTEGER NOT NULL,
  version TEXT NOT NULL DEFAULT 'basic',
  status TEXT NOT NULL DEFAULT 'active',
  total_devices INTEGER NOT NULL DEFAULT 2,
  remark TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS device_bindings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code_id INTEGER NOT NULL,
  machine_id TEXT NOT NULL,
  hardware_info TEXT,
  activated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_heartbeat TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  FOREIGN KEY (code_id) REFERENCES activation_codes(id)
);

CREATE TABLE IF NOT EXISTS heartbeat_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_binding_id INTEGER NOT NULL,
  heartbeat_at TEXT NOT NULL DEFAULT (datetime('now')),
  result TEXT,
  FOREIGN KEY (device_binding_id) REFERENCES device_bindings(id)
);
`

let sqliteDriver = null
async function getSqlite() {
  if (!sqliteDriver) {
    // Lazy-import the native sqlite3 addon only when SQLite is actually needed.
    // On Netlify (USE_PG=true) this code path is never reached, so the
    // native .node binary is never loaded and the Lambda doesn't crash.
    const sqlite3 = (await import('sqlite3')).default
    // Compute __dirname lazily — only when SQLite is actually needed.
    // This avoids calling fileURLToPath(import.meta.url) at module load time,
    // which crashes on Netlify because the nft bundler leaves import.meta.url
    // as undefined.  On Netlify this code path is never reached (USE_PG=true).
    const _filename = fileURLToPath(import.meta.url)
    const _dirname = path.dirname(_filename)
    const dbDir = path.join(_dirname, '../data')
    fs.mkdirSync(dbDir, { recursive: true })
    sqliteDriver = new sqlite3.Database(path.join(dbDir, 'license.db'))
    sqliteDriver.exec(initSql)
  }
  return sqliteDriver
}

// ---------------------------------------------------------------------------
// Postgres (Supabase) mode
// ---------------------------------------------------------------------------
let pgPool = null
function getPool() {
  if (!pgPool) {
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('supabase')
        ? { rejectUnauthorized: false }
        : undefined,
      max: 5
    })
  }
  return pgPool
}

// SQLite uses `?` placeholders; Postgres uses `$1, $2, ...`. Translate so the
// route code (and the seed script) can stay dialect-agnostic.
function toPgPlaceholders(sql) {
  let i = 0
  return sql.replace(/\?/g, () => `$${++i}`)
}

// ---------------------------------------------------------------------------
// Unified prepare() interface — identical shape to what the routes already use.
// ---------------------------------------------------------------------------
function prepare(sql) {
  if (USE_PG) {
    const pgSql = toPgPlaceholders(sql)
    return {
      async get(...params) {
        const { rows } = await getPool().query(pgSql, params)
        return rows[0]
      },
      async all(...params) {
        const { rows } = await getPool().query(pgSql, params)
        return rows
      },
      async run(...params) {
        const result = await getPool().query(pgSql, params)
        return { lastID: undefined, changes: result.rowCount }
      }
    }
  }

  const driver = await getSqlite()
  return {
    get(...params) {
      return new Promise((resolve, reject) => {
        driver.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)))
      })
    },
    all(...params) {
      return new Promise((resolve, reject) => {
        driver.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
      })
    },
    run(...params) {
      return new Promise((resolve, reject) => {
        driver.run(sql, params, function (err) {
          err ? reject(err) : resolve({ lastID: this.lastID, changes: this.changes })
        })
      })
    }
  }
}

export default { prepare }
