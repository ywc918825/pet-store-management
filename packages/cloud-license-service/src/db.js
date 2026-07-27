// Database adapter — dual-mode:
//   - Supabase/Postgres via `postgres` (pure JS, zero native bindings)
//   - Local SQLite via dynamic import of db-sqlite-adapter.js

import postgres from 'postgres'
import dotenv from 'dotenv'

dotenv.config()

const USE_PG = !!process.env.DATABASE_URL

// ---------------------------------------------------------------------------
// Postgres (Supabase) mode — pure JS driver, no native bindings
// ---------------------------------------------------------------------------
let _sql = null
function getSql() {
  if (!_sql) {
    _sql = postgres(process.env.DATABASE_URL, {
      ssl: process.env.DATABASE_URL?.includes('supabase') ? 'require' : undefined,
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10
    })
  }
  return _sql
}

function prepare(queryStr) {
  if (USE_PG) {
    const sql = getSql()
    return {
      async get(...params) {
        let i = 0
        const pgSql = queryStr.replace(/\?/g, () => `$${++i}`)
        const rows = await sql.unsafe(pgSql, params)
        return rows[0] || null
      },
      async all(...params) {
        let i = 0
        const pgSql = queryStr.replace(/\?/g, () => `$${++i}`)
        return await sql.unsafe(pgSql, params)
      },
      async run(...params) {
        let i = 0
        const pgSql = queryStr.replace(/\?/g, () => `$${++i}`)
        const result = await sql.unsafe(pgSql, params)
        return { lastID: undefined, changes: result.count ?? result.rowCount }
      }
    }
  }

  // --- Local SQLite mode ---
  let _sqlitePrepare = null
  async function _getSqlitePrepare() {
    if (!_sqlitePrepare) {
      const m = await import('./db-sqlite-adapter.js')
      _sqlitePrepare = m.prepare
    }
    return _sqlitePrepare
  }

  return {
    async get(...params) {
      const fn = (await _getSqlitePrepare())(queryStr)
      return fn.get(...params)
    },
    async all(...params) {
      const fn = (await _getSqlitePrepare())(queryStr)
      return fn.all(...params)
    },
    async run(...params) {
      const fn = (await _getSqlitePrepare())(queryStr)
      return fn.run(...params)
    }
  }
}

export default { prepare }
