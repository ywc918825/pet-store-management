import express from 'express'
import { v4 as uuidv4 } from 'uuid'
import dayjs from 'dayjs'
import db from '../db.js'
import { signToken, verifyToken, verifyAdminPassword } from '../middleware/auth.js'

const router = express.Router()

// Admin login
router.post('/login', (req, res) => {
  const { username, password } = req.body
  if (username !== process.env.ADMIN_USERNAME || !verifyAdminPassword(password)) {
    return res.status(401).json({ code: 401, message: '账号或密码错误' })
  }
  const token = signToken({ username, role: 'admin' })
  res.json({ code: 0, data: { token } })
})

function adminAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1]
  const decoded = verifyToken(token)
  if (!decoded || decoded.role !== 'admin') {
    return res.status(401).json({ code: 401, message: '无权限' })
  }
  next()
}

// Shared secret for the payment platform's auto-issue callback. The caller is
// the payment server (not a human operator), so it authenticates with this
// key instead of an admin JWT.
function checkIssueKey(req, res, next) {
  const key = req.headers['x-issue-key'] || req.query.key
  const expected = process.env.ISSUE_KEY
  if (!expected) {
    return res.status(500).json({ code: 500, message: '服务端未配置 ISSUE_KEY' })
  }
  if (key !== expected) {
    return res.status(403).json({ code: 403, message: '非法的发卡密钥' })
  }
  next()
}

// Placeholder for notifying the buyer after a code is issued. Wire up real
// channels (WeChat MP template / email / SMS) here later. The payment platform
// callback already knows the order, so this is best-effort and never blocks.
async function notifyIssue(codes, notify) {
  // TODO: integrate real channel. For now just log.
  console.log('[issue] notify', JSON.stringify(notify), 'codes', codes.join(','))
}

// Payment-success auto-issue webhook (reserved hook for the payment platform).
router.post('/issue', checkIssueKey, async (req, res) => {
  const {
    orderId,
    durationDays = 365,
    version = 'pro',
    totalDevices = 2,
    count = 1,
    remark = '',
    notify
  } = req.body
  const n = Math.min(Math.max(parseInt(count, 10) || 1, 1), 100)
  const codes = []
  for (let i = 0; i < n; i++) {
    const code = uuidv4().replace(/-/g, '').substring(0, 16).toUpperCase()
    await db.prepare('INSERT INTO activation_codes (code, duration_days, version, total_devices, remark) VALUES (?, ?, ?, ?, ?)')
      .run(code, durationDays, version, totalDevices, remark || `order:${orderId || ''}`)
    codes.push(code)
  }
  if (notify) {
    try { await notifyIssue(codes, notify) } catch (e) { console.error('notify failed', e) }
  }
  res.json({ code: 0, data: { orderId, count: codes.length, codes } })
})

// Generate activation codes in batch
router.post('/codes', adminAuth, async (req, res) => {
  const { count = 1, durationDays = 30, version = 'basic', totalDevices = 2, remark = '' } = req.body
  const codes = []
  for (let i = 0; i < count; i++) {
    const code = uuidv4().replace(/-/g, '').substring(0, 16).toUpperCase()
    await db.prepare('INSERT INTO activation_codes (code, duration_days, version, total_devices, remark) VALUES (?, ?, ?, ?, ?)')
      .run(code, durationDays, version, totalDevices, remark)
    codes.push(code)
  }
  res.json({ code: 0, data: codes })
})

// List activation codes
router.get('/codes', adminAuth, async (req, res) => {
  console.log('[admin:codes] ENTER, query=', JSON.stringify(req.query))
  const { status, page = 1, pageSize = 20 } = req.query
  let sql = 'SELECT * FROM activation_codes WHERE 1=1'
  const params = []
  if (status) { sql += ' AND status = ?'; params.push(status) }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize))
  const rows = await db.prepare(sql).all(...params)
  const totalRow = await db.prepare('SELECT COUNT(*) as total FROM activation_codes').get()
  res.json({ code: 0, data: { list: rows, total: totalRow.total, page: Number(page), pageSize: Number(pageSize) } })
})

// Blacklist or delete activation code
router.patch('/codes/:id/status', adminAuth, async (req, res) => {
  const { status } = req.body
  await db.prepare('UPDATE activation_codes SET status = ? WHERE id = ?').run(status, req.params.id)
  if (status === 'blacklisted') {
    await db.prepare("UPDATE device_bindings SET status = 'unbound' WHERE code_id = ?").run(req.params.id)
  }
  res.json({ code: 0, message: '操作成功' })
})

// List devices
router.get('/devices', adminAuth, async (req, res) => {
  const { codeId, page = 1, pageSize = 20 } = req.query
  let sql = `SELECT d.*, c.code as activation_code, c.duration_days, c.version
             FROM device_bindings d
             LEFT JOIN activation_codes c ON d.code_id = c.id
             WHERE 1=1`
  const params = []
  if (codeId) { sql += ' AND d.code_id = ?'; params.push(codeId) }
  sql += ' ORDER BY d.activated_at DESC LIMIT ? OFFSET ?'
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize))
  const rows = await db.prepare(sql).all(...params)
  const totalRow = await db.prepare('SELECT COUNT(*) as total FROM device_bindings').get()
  res.json({ code: 0, data: { list: rows, total: totalRow.total, page: Number(page), pageSize: Number(pageSize) } })
})

// Unbind a device
router.post('/devices/:id/unbind', adminAuth, async (req, res) => {
  await db.prepare("UPDATE device_bindings SET status = 'unbound' WHERE id = ?").run(req.params.id)
  res.json({ code: 0, message: '解绑成功' })
})

export default router
