import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import cron from 'node-cron'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { execFile } from 'child_process'
import axios from 'axios'

import authRoutes from './routes/auth.js'
import memberRoutes from './routes/member.js'
import petRoutes from './routes/pet.js'
import cashierRoutes from './routes/cashier.js'
import appointmentRoutes from './routes/appointment.js'
import inventoryRoutes from './routes/inventory.js'
import staffRoutes from './routes/staff.js'
import dashboardRoutes from './routes/dashboard.js'
import licenseRoutes from './routes/license.js'
import settingsRoutes from './routes/settings.js'
import backupsRoutes from './routes/backups.js'
import { query } from './config/db.js'
import { success, error } from './utils/response.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Static uploads and backups
const uploadDir = path.join(__dirname, '../uploads')
const backupDir = path.join(__dirname, '../backups')
fs.mkdirSync(uploadDir, { recursive: true })
fs.mkdirSync(backupDir, { recursive: true })
app.use('/uploads', express.static(uploadDir))

// Health check
app.get('/health', (req, res) => {
  res.json(success({ status: 'ok', time: new Date().toISOString() }))
})

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/license', licenseRoutes)
// Provider admin API is hosted on the cloud license service. Forward it here
// so the frontend reaches license-management endpoints uniformly via /api in
// both dev (Vite proxy) and packaged (local server serves client) modes.
// The Authorization header is passed through untouched.
const CLOUD_LICENSE_URL = process.env.CLOUD_LICENSE_URL || 'http://localhost:3002'
app.use('/api/admin', async (req, res) => {
  try {
    const method = req.method.toLowerCase()
    const url = `${CLOUD_LICENSE_URL}/api/admin${req.path}`
    const config = {
      method,
      url,
      headers: {
        Authorization: req.headers.authorization || '',
        'Content-Type': 'application/json'
      },
      params: req.query,
      timeout: 10000,
      validateStatus: () => true
    }
    if (['post', 'put', 'patch', 'delete'].includes(method)) config.data = req.body
    const { data, status } = await axios(config)
    res.status(status).json(data)
  } catch (e) {
    res.status(502).json(error('授权管理服务暂时不可用'))
  }
})
app.use('/api/members', memberRoutes)
app.use('/api/pets', petRoutes)
app.use('/api/orders', cashierRoutes)
app.use('/api/appointments', appointmentRoutes)
// Inventory, suppliers and stock records all live in one router with relative
// paths, so mount it once under /api to match the frontend's
// /api/products, /api/suppliers, /api/stock-records endpoints.
app.use('/api', inventoryRoutes)
// Staff routes: users, roles, and operation-logs are all defined as relative
// paths inside staff.js, so mount once under /api so that /users, /roles,
// /operation-logs resolve to /api/users, /api/roles, /api/operation-logs.
app.use('/api', staffRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/backups', backupsRoutes)

// In production (packaged exe) the client is built into packages/client/dist and
// served directly by this server. In dev the Vite dev server (port 5173) handles
// the frontend, so we only enable this when SERVE_CLIENT / NODE_ENV is set.
if (process.env.SERVE_CLIENT === 'true' || process.env.NODE_ENV === 'production') {
  const clientDist = path.resolve(__dirname, '../../client/dist')
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist))
    // SPA history fallback: serve index.html for any non-API, non-upload GET.
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
        return res.sendFile(path.join(clientDist, 'index.html'))
      }
      next()
    })
  } else {
    console.warn('SERVE_CLIENT enabled but client dist not found at', clientDist)
  }
}

// Global error handler
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json(error('服务器内部错误'))
})

// Auto backup at 02:00 every day.
// Use execFile with an args array (no shell) so DB credentials with special
// characters can't break or be abused, and stream stdout straight to a file.
if (process.env.ENABLE_AUTO_BACKUP !== 'false') {
  cron.schedule('0 2 * * *', async () => {
    try {
      const fileName = `auto_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.sql`
      const filePath = path.join(backupDir, fileName)
      const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env
      const args = ['-h', DB_HOST, '-P', String(DB_PORT || 3306), '-u', DB_USER]
      if (DB_PASSWORD) args.push(`-p${DB_PASSWORD}`)
      args.push(DB_NAME)
      const out = fs.createWriteStream(filePath)
      const child = execFile('mysqldump', args, { maxBuffer: 1024 * 1024 * 50 })
      child.stdout.pipe(out)
      child.on('error', (err) => { console.error('Auto backup failed:', err); out.close() })
      child.on('close', async (code) => {
        out.close()
        if (code !== 0) return console.error('Auto backup exited with code', code)
        try {
          const stats = fs.statSync(filePath)
          await query('INSERT INTO backups (file_path, file_size, type) VALUES (?, ?, ?)', [filePath, stats.size, 'auto'])
        } catch (e) { console.error('Auto backup record failed:', e) }
      })
    } catch (e) {
      console.error('Auto backup error:', e)
    }
  })
}

app.listen(PORT, () => {
  console.log(`Local business server running on http://localhost:${PORT}`)
})
