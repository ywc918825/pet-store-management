import express from 'express'
import cors from 'cors'
import licenseRoutes from './routes/license.js'
import adminRoutes from './routes/admin.js'

// `origin: true` reflects the caller's Origin so the same API works for the
// local dev SPA (localhost:5173), the packaged app, and any hosted admin
// console. The API is protected by JWT / ISSUE_KEY, so open CORS is acceptable
// here. Restrict via CORS_ORIGINS="https://a,https://b" if you prefer an allowlist.
const corsOrigins = (process.env.CORS_ORIGINS || '*').split(',').map((s) => s.trim())
const corsOptions = corsOrigins.includes('*')
  ? { origin: true }
  : { origin: corsOrigins }

const app = express()
app.use(cors(corsOptions))
app.use(express.json())

app.use('/api/license', licenseRoutes)
app.use('/api/admin', adminRoutes)

app.get('/health', (req, res) => {
  res.json({ code: 0, data: { status: 'ok', time: new Date().toISOString() } })
})

export default app
