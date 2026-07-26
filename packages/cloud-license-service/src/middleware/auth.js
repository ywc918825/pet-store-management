import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import crypto from 'node:crypto'

dotenv.config()

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex')
if (!process.env.JWT_SECRET) {
  console.warn('[license-auth] 未配置 JWT_SECRET，已使用临时随机密钥，重启后 token 将失效。请在 .env 中设置 JWT_SECRET。')
}
// Pre-compute the admin password hash once at startup (avoids re-hashing on every request)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'license123'
const ADMIN_HASH = bcrypt.hashSync(ADMIN_PASSWORD, 10)

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' })
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (e) {
    return null
  }
}

export function verifyAdminPassword(password) {
  return bcrypt.compareSync(password, ADMIN_HASH)
}
