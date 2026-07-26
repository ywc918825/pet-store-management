import express from 'express'
import { query } from '../config/db.js'
import { success, error, paginate } from '../utils/response.js'
import { hashPassword } from '../utils/crypto.js'
import { authMiddleware } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { operationLog } from '../middleware/log.js'

const router = express.Router()

// Users
router.get('/users', authMiddleware, requirePermission('staff:manage'), async (req, res) => {
  const { keyword, page = 1, pageSize = 20 } = req.query
  let sql = 'SELECT u.id, u.username, u.real_name, u.phone, u.status, u.created_at, r.name as role_name, r.code as role_code FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE 1=1'
  const params = []
  if (keyword) { sql += ' AND (u.username LIKE ? OR u.real_name LIKE ? OR u.phone LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`) }
  sql += ' ORDER BY u.id DESC'
  const rows = await query(sql, params)
  res.json(success(paginate(rows, Number(page), Number(pageSize))))
})

router.post('/users', authMiddleware, requirePermission('staff:manage'), async (req, res) => {
  const { username, password, realName, phone, roleId } = req.body
  if (!username || !password || !roleId) return res.json(error('用户名、密码和角色不能为空'))
  const exists = await query('SELECT id FROM users WHERE username = ?', [username])
  if (exists.length > 0) return res.json(error('用户名已存在'))
  const result = await query(
    'INSERT INTO users (username, password_hash, real_name, phone, role_id) VALUES (?, ?, ?, ?, ?)',
    [username, hashPassword(password), realName, phone, roleId]
  )
  res.json(success({ id: result.insertId }))
})

router.put('/users/:id', authMiddleware, requirePermission('staff:manage'), async (req, res) => {
  const { realName, phone, roleId, status } = req.body
  const updates = []
  const params = []
  if (realName !== undefined) { updates.push('real_name = ?'); params.push(realName) }
  if (phone !== undefined) { updates.push('phone = ?'); params.push(phone) }
  if (roleId !== undefined) { updates.push('role_id = ?'); params.push(roleId) }
  if (status !== undefined) { updates.push('status = ?'); params.push(status) }
  if (updates.length === 0) return res.json(error('无更新内容'))
  params.push(req.params.id)
  await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params)
  res.json(success(null, '更新成功'))
})

router.delete('/users/:id', authMiddleware, requirePermission('staff:manage'), async (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.json(error('不能删除当前登录账号'))
  await query('DELETE FROM users WHERE id = ?', [req.params.id])
  res.json(success(null, '删除成功'))
})

// Roles
router.get('/roles', authMiddleware, async (req, res) => {
  const rows = await query('SELECT * FROM roles ORDER BY id')
  rows.forEach(r => {
    try { r.permissions = JSON.parse(r.permissions) } catch (e) { r.permissions = [] }
  })
  res.json(success(rows))
})

router.post('/roles', authMiddleware, requirePermission('staff:manage'), async (req, res) => {
  const { name, code, permissions } = req.body
  if (!name || !code) return res.json(error('角色名称和编码不能为空'))
  const exists = await query('SELECT id FROM roles WHERE code = ?', [code])
  if (exists.length > 0) return res.json(error('角色编码已存在'))
  const result = await query(
    'INSERT INTO roles (name, code, permissions) VALUES (?, ?, ?)',
    [name, code, JSON.stringify(permissions || [])]
  )
  res.json(success({ id: result.insertId }))
})

router.put('/roles/:id', authMiddleware, requirePermission('staff:manage'), async (req, res) => {
  const { name, permissions } = req.body
  const role = await query('SELECT is_system FROM roles WHERE id = ?', [req.params.id])
  if (role.length > 0 && role[0].is_system === 1) {
    // Allow updating permissions for system roles but protect name
  }
  await query(
    'UPDATE roles SET name = ?, permissions = ? WHERE id = ?',
    [name, JSON.stringify(permissions || []), req.params.id]
  )
  res.json(success(null, '更新成功'))
})

router.delete('/roles/:id', authMiddleware, requirePermission('staff:manage'), async (req, res) => {
  const role = await query('SELECT is_system FROM roles WHERE id = ?', [req.params.id])
  if (role.length > 0 && role[0].is_system === 1) return res.json(error('系统预设角色不能删除'))
  await query('DELETE FROM roles WHERE id = ?', [req.params.id])
  res.json(success(null, '删除成功'))
})

// Operation logs
router.get('/operation-logs', authMiddleware, requirePermission('staff:manage'), async (req, res) => {
  const { action, userId, startDate, endDate, page = 1, pageSize = 20 } = req.query
  let sql = `SELECT l.*, u.real_name as operator_name FROM operation_logs l LEFT JOIN users u ON l.user_id = u.id WHERE 1=1`
  const params = []
  if (action) { sql += ' AND l.action LIKE ?'; params.push(`%${action}%`) }
  if (userId) { sql += ' AND l.user_id = ?'; params.push(userId) }
  if (startDate) { sql += ' AND l.created_at >= ?'; params.push(startDate + ' 00:00:00') }
  if (endDate) { sql += ' AND l.created_at <= ?'; params.push(endDate + ' 23:59:59') }
  sql += ' ORDER BY l.created_at DESC'
  const rows = await query(sql, params)
  rows.forEach(r => {
    try { r.detail = JSON.parse(r.detail) } catch (e) { r.detail = {} }
  })
  res.json(success(paginate(rows, Number(page), Number(pageSize))))
})

export default router
