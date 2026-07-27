// Database adapter — dual-mode with DEBUG mode
import postgres from 'postgres'
import dotenv from 'dotenv'

dotenv.config()

const USE_PG = !!process.env.DATABASE_URL

// ---------------------------------------------------------------------------
// Postgres (Supabase) mode
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
    // DEBUG: return mock without touching DB — tests if crash is in connection
    // const sql = getSql()
    // return {
    //   async get(...params) { ... },
    //   ...
    // }
    return {
      async get(/* ...params */) {
        console.log('[db-mock] get:', queryStr.substring(0, 60))
        return null
      },
      async all(/* ...params */) {
        console.log('[db-mock] all:', queryStr.substring(0, 60))
        return []
      },
      async run(/* ...params */) {
        console.log('[db-mock] run:', queryStr.substring(0, 60))
        return { lastID: 1, changes: 1 }
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
