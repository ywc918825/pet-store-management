import express from 'express'
import { query } from '../config/db.js'
import { success, error, paginate } from '../utils/response.js'
import { authMiddleware } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'

const router = express.Router()

router.get('/', authMiddleware, requirePermission('appointment:view'), async (req, res) => {
  const { status, date, staffId, page = 1, pageSize = 20 } = req.query
  let sql = `SELECT a.*, m.name as member_name, m.phone as member_phone, p.name as pet_name, p.breed, si.name as service_name
             FROM appointments a
             LEFT JOIN members m ON a.member_id = m.id
             LEFT JOIN pets p ON a.pet_id = p.id
             LEFT JOIN service_items si ON a.service_item_id = si.id
             WHERE 1=1`
  const params = []
  if (status) { sql += ' AND a.status = ?'; params.push(status) }
  if (date) { sql += ' AND DATE(a.appointment_time) = ?'; params.push(date) }
  if (staffId) { sql += ' AND a.staff_id = ?'; params.push(staffId) }
  sql += ' ORDER BY a.appointment_time ASC'
  const rows = await query(sql, params)
  res.json(success(paginate(rows, Number(page), Number(pageSize))))
})

router.post('/', authMiddleware, requirePermission('appointment:edit'), async (req, res) => {
  const { memberId, petId, serviceItemId, appointmentTime, remark, staffId } = req.body
  if (!memberId || !appointmentTime) return res.json(error('会员和预约时间不能为空'))
  const result = await query(
    'INSERT INTO appointments (member_id, pet_id, service_item_id, appointment_time, remark, staff_id) VALUES (?, ?, ?, ?, ?, ?)',
    [memberId, petId || null, serviceItemId || null, appointmentTime, remark || '', staffId || null]
  )
  res.json(success({ id: result.insertId }))
})

router.put('/:id', authMiddleware, requirePermission('appointment:edit'), async (req, res) => {
  const { memberId, petId, serviceItemId, appointmentTime, remark, staffId } = req.body
  await query(
    'UPDATE appointments SET member_id = ?, pet_id = ?, service_item_id = ?, appointment_time = ?, remark = ?, staff_id = ? WHERE id = ?',
    [memberId, petId || null, serviceItemId || null, appointmentTime, remark || '', staffId || null, req.params.id]
  )
  res.json(success(null, '更新成功'))
})

router.patch('/:id/status', authMiddleware, requirePermission('appointment:edit'), async (req, res) => {
  const { status } = req.body
  const valid = ['booked', 'arrived', 'serving', 'completed', 'cancelled']
  if (!valid.includes(status)) return res.json(error('状态无效'))
  await query('UPDATE appointments SET status = ? WHERE id = ?', [status, req.params.id])
  res.json(success(null, '状态更新成功'))
})

export default router
