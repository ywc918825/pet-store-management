import express from 'express'
import cors from 'cors'
import licenseRoutesModule from './routes/license.js'
import adminRoutesModule from './routes/admin.js'

// Netlify's nft bundler may wrap ESM default exports as { default: X }
// instead of the plain Router object.  Unwrap if needed.
const licenseRoutes = licenseRoutesModule.default || licenseRoutesModule
const adminRoutes = adminRoutesModule.default || adminRoutesModule

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

// Debug: log all requests
app.use((req, res, next) => {
  console.log('[app] request:', req.method, req.path)
  next()
})

app.use('/api/license', licenseRoutes)
app.use('/api/admin', adminRoutes)

app.get('/health', (req, res) => {
  res.json({ code: 0, data: { status: 'ok', time: new Date().toISOString() } })
})

export default app
