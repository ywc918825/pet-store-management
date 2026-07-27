// SQLite database adapter — only imported dynamically by db.js when
// USE_PG=false (local development).  Never touched on Netlify.
//
// This file intentionally uses `import sqlite3` at the top level because it
// runs in a normal Node.js process during local dev where the native .node
// binary is available.  Netlify never loads this module.

import sqlite3 from 'sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

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

const _filename = fileURLToPath(import.meta.url)
const _dirname = path.dirname(_filename)
const dbDir = path.join(_dirname, '../data')
fs.mkdirSync(dbDir, { recursive: true })

let _driver = null

function getDriver() {
  if (!_driver) {
    _driver = new sqlite3.Database(path.join(dbDir, 'license.db'))
    _driver.exec(initSql)
  }
  return _driver
}

export function prepare(sql) {
  const driver = getDriver()
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
