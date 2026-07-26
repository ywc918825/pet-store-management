import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pet_store',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  enableKeepAlive: true,
  dateStrings: true
})

// Execute a single query
export async function query(sql, params) {
  const [rows] = await pool.execute(sql, params)
  return rows
}

// Get a connection for transactions
export async function getConnection() {
  return pool.getConnection()
}

// Ensure database exists (run before migrations)
export async function ensureDatabase() {
  const tempPool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  })
  await tempPool.execute(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'pet_store'} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  await tempPool.end()
}

export default pool
