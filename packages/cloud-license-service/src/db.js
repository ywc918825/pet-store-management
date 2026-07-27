import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const USE_PG = !!process.env.DATABASE_URL

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

function toPgPlaceholders(sql) {
  let i = 0
  return sql.replace(/\?/g, () => `$${++i}`)
}

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

  // Local SQLite mode — lazy-load via a separate module so that nft's static
  // analysis never sees the native sqlite3 addon in this file's import graph.
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
      const fn = (await _getSqlitePrepare())(sql)
      return fn.get(...params)
    },
    async all(...params) {
      const fn = (await _getSqlitePrepare())(sql)
      return fn.all(...params)
    },
    async run(...params) {
      const fn = (await _getSqlitePrepare())(sql)
      return fn.run(...params)
    }
  }
}

export default { prepare }
