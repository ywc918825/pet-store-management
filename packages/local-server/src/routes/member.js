import express from 'express'
import { query, getConnection } from '../config/db.js'
import { success, error, paginate } from '../utils/response.js'
import { authMiddleware } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { operationLog } from '../middleware/log.js'

const router = express.Router()

router.get('/', authMiddleware, requirePermission('member:view'), async (req, res) => {
  const page = Number(req.query.page || 1)
  const pageSize = Number(req.query.pageSize || 20)
  const params = []
  let where = ' WHERE status = 1'
  if (req.query.keyword) {
    where += ' AND (phone LIKE ? OR name LIKE ?)'
    params.push(`%${req.query.keyword}%`, `%${req.query.keyword}%`)
  }
  const [countRow] = await query(`SELECT COUNT(*) as total FROM members${where}`, params)
  const rows = await query(`SELECT * FROM members${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`, [...params, pageSize, (page - 1) * pageSize])
  res.json(success({ list: rows, total: countRow.total, page, pageSize }))
})

router.get('/:id', authMiddleware, requirePermission('member:view'), async (req, res) => {
  const rows = await query('SELECT * FROM members WHERE id = ?', [req.params.id])
  if (rows.length === 0) return res.json(error('会员不存在'))
  const pets = await query('SELECT * FROM pets WHERE member_id = ? AND status = 1', [req.params.id])
  res.json(success({ ...rows[0], pets }))
})

router.post('/', authMiddleware, requirePermission('member:edit'), async (req, res) => {
  const { phone, name, gender, birthday, level } = req.body
  if (!phone || !name) return res.json(error('手机号和姓名不能为空'))
  const exists = await query('SELECT id FROM members WHERE phone = ?', [phone])
  if (exists.length > 0) return res.json(error('手机号已存在'))
  const result = await query(
    'INSERT INTO members (phone, name, gender, birthday, level) VALUES (?, ?, ?, ?, ?)',
    [phone, name, gender || 0, birthday || null, level || '普通会员']
  )
  res.json(success({ id: result.insertId }))
})

router.put('/:id', authMiddleware, requirePermission('member:edit'), async (req, res) => {
  const { name, gender, birthday, level, status } = req.body
  await query(
    'UPDATE members SET name = ?, gender = ?, birthday = ?, level = ?, status = ? WHERE id = ?',
    [name, gender, birthday, level, status, req.params.id]
  )
  res.json(success(null, '更新成功'))
})

router.post('/:id/recharge', authMiddleware, requirePermission('member:recharge'), async (req, res) => {
  const { amount, paymentMethod, remark } = req.body
  const value = Number(amount)
  if (!value || value <= 0) return res.json(error('充值金额必须大于0'))
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const [members] = await conn.execute('SELECT balance FROM members WHERE id = ? FOR UPDATE', [req.params.id])
    if (members.length === 0) throw new Error('会员不存在')
    const before = members[0].balance
    const after = before + value
    await conn.execute('UPDATE members SET balance = ?, points = points + ? WHERE id = ?', [after, Math.floor(value / 10), req.params.id])
    await conn.execute(
      'INSERT INTO recharge_records (member_id, type, amount, balance_before, balance_after, payment_method, operator_id, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.params.id, 'recharge', value, before, after, paymentMethod || '现金', req.user.id, remark || '']
    )
    await conn.commit()
    res.json(success({ balance: after }))
  } catch (e) {
    await conn.rollback()
    res.json(error(e.message))
  } finally {
    conn.release()
  }
})

router.get('/:id/recharge-records', authMiddleware, requirePermission('member:view'), async (req, res) => {
  const rows = await query(
    'SELECT r.*, u.real_name as operator_name FROM recharge_records r LEFT JOIN users u ON r.operator_id = u.id WHERE r.member_id = ? ORDER BY r.created_at DESC',
    [req.params.id]
  )
  res.json(success(rows))
})

export default router
