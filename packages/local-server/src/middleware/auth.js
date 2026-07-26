import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import dotenv from 'dotenv'
import { query } from '../config/db.js'
import { error } from '../utils/response.js'

dotenv.config()

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex')
if (!process.env.JWT_SECRET) {
  console.warn('[auth] 未配置 JWT_SECRET，已使用临时随机密钥，重启后 token 将失效。请在 .env 中设置 JWT_SECRET。')
}

// Verify JWT token and attach user to request
export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json(error('请先登录', 401))
  }

  const token = authHeader.split(' ')[1]
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    const rows = await query('SELECT u.*, r.code as role_code, r.name as role_name, r.permissions FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = ? AND u.status = 1', [decoded.userId])
    if (rows.length === 0) {
      return res.status(401).json(error('用户不存在或已禁用', 401))
    }
    const user = rows[0]
    user.permissions = user.permissions ? JSON.parse(user.permissions) : []
    req.user = user
    next()
  } catch (err) {
    return res.status(401).json(error('登录已过期', 401))
  }
}

// Generate JWT token
export function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || '24h' })
}
