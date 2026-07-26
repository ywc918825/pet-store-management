import express from 'express'
import { query } from '../config/db.js'
import { comparePassword, hashPassword } from '../utils/crypto.js'
import { signToken, authMiddleware } from '../middleware/auth.js'
import { success, error } from '../utils/response.js'
import { operationLog } from '../middleware/log.js'

// Simple in-memory brute-force protection for login
const loginAttempts = new Map()
const MAX_ATTEMPTS = 5
const LOCK_MS = 15 * 60 * 1000

function recordFailure(key) {
  const now = Date.now()
  const rec = loginAttempts.get(key) || { count: 0, lockUntil: 0 }
  if (now > rec.lockUntil) {
    rec.count += 1
    if (rec.count >= MAX_ATTEMPTS) {
      rec.lockUntil = now + LOCK_MS
      rec.count = 0
    }
    loginAttempts.set(key, rec)
  }
  return rec.lockUntil
}
function isLocked(key) {
  const rec = loginAttempts.get(key)
  return !!rec && Date.now() < rec.lockUntil
}
function clearFailure(key) {
  loginAttempts.delete(key)
}
// Periodically drop stale entries so the map doesn't grow forever
const attemptSweeper = setInterval(() => {
  const now = Date.now()
  for (const [k, v] of loginAttempts) if (now > v.lockUntil && v.count === 0) loginAttempts.delete(k)
}, LOCK_MS)
if (attemptSweeper.unref) attemptSweeper.unref()

const router = express.Router()

router.post('/login', async (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.json(error('用户名和密码不能为空'))
  }
  const key = `${req.ip}:${username}`
  if (isLocked(key)) {
    return res.json(error('登录尝试过多，账号已临时锁定，请 15 分钟后再试', 429))
  }
  const rows = await query(
    'SELECT u.*, r.code as role_code, r.name as role_name, r.permissions FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.username = ?',
    [username]
  )
  if (rows.length === 0 || !comparePassword(password, rows[0].password_hash)) {
    const lockUntil = recordFailure(key)
    const msg = lockUntil > Date.now() ? '密码错误次数过多，账号已锁定 15 分钟' : '用户名或密码错误'
    return res.json(error(msg, 401))
  }
  clearFailure(key)
  const user = rows[0]
  if (user.status !== 1) {
    return res.json(error('账号已禁用', 403))
  }
  const token = signToken(user.id)
  const permissions = user.permissions ? JSON.parse(user.permissions) : []
  delete user.password_hash
  res.json(success({ token, user, permissions }))
})

router.get('/me', authMiddleware, async (req, res) => {
  const user = { ...req.user }
  delete user.password_hash
  res.json(success({ user, permissions: user.permissions }))
})

router.post('/logout', authMiddleware, async (req, res) => {
  res.json(success(null, '已退出登录'))
})

router.post('/change-password', authMiddleware, async (req, res) => {
  const { oldPassword, newPassword } = req.body
  const rows = await query('SELECT password_hash FROM users WHERE id = ?', [req.user.id])
  if (rows.length === 0 || !comparePassword(oldPassword, rows[0].password_hash)) {
    return res.json(error('原密码错误'))
  }
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(newPassword), req.user.id])
  res.json(success(null, '密码修改成功'))
})

export default router
