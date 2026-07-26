import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

export function hashPassword(password) {
  const salt = bcrypt.genSaltSync(SALT_ROUNDS)
  return bcrypt.hashSync(password, salt)
}

export function comparePassword(password, hash) {
  return bcrypt.compareSync(password, hash)
}

export function generateOrderNo() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const h = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  const r = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
  return `PS${y}${m}${d}${h}${min}${s}${r}`
}
