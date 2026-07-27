import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const USE_PG = !!process.env.DATABASE_URL

let pgPool = null
function getPool() {
  if (!pgPool) {
    console.log('[db] Creating PG pool, DATABASE_URL=', process.env.DATABASE_URL ? 'SET' : 'UNSET')
    try {
      pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('supabase')
          ? { rejectUnauthorized: false }
          : undefined,
        max: 5
      })
    } catch (e) {
      console.error('[db] Pool creation FAILED:', e.message)
      throw e
    }
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
        try {
          const pool = getPool()
          console.log('[db] pg.get sql=', pgSql.substring(0, 80))
          const { rows } = await pool.query(pgSql, params)
          return rows[0]
        } catch (e) {
          console.error('[db] pg.get ERROR:', e.message, '\n', e.stack || '')
          throw e
        }
      },
      async all(...params) {
        try {
          const pool = getPool()
          console.log('[db] pg.all sql=', pgSql.substring(0, 80))
          const { rows } = await pool.query(pgSql, params)
          return rows
        } catch (e) {
          console.error('[db] pg.all ERROR:', e.message, '\n', e.stack || '')
          throw e
        }
      },
      async run(...params) {
        try {
          const pool = getPool()
          console.log('[db] pg.run sql=', pgSql.substring(0, 80))
          const result = await pool.query(pgSql, params)
          return { lastID: undefined, changes: result.rowCount }
        } catch (e) {
          console.error('[db] pg.run ERROR:', e.message, '\n', e.stack || '')
          throw e
        }
      }
    }
  }

  // Local SQLite mode — lazy-load via separate module.
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
