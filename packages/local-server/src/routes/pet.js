import express from 'express'
import { query } from '../config/db.js'
import { success, error, paginate } from '../utils/response.js'
import { authMiddleware } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'

const router = express.Router()

router.get('/', authMiddleware, requirePermission('pet:view'), async (req, res) => {
  const { keyword, memberId, page = 1, pageSize = 20 } = req.query
  let sql = 'SELECT p.*, m.name as member_name, m.phone as member_phone FROM pets p LEFT JOIN members m ON p.member_id = m.id WHERE p.status = 1'
  const params = []
  if (keyword) {
    sql += ' AND (p.name LIKE ? OR p.breed LIKE ? OR m.phone LIKE ?)'
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`)
  }
  if (memberId) {
    sql += ' AND p.member_id = ?'
    params.push(memberId)
  }
  sql += ' ORDER BY p.created_at DESC'
  const rows = await query(sql, params)
  rows.forEach(r => {
    try { r.vaccine_records = JSON.parse(r.vaccine_records) } catch (e) { r.vaccine_records = [] }
  })
  res.json(success(paginate(rows, Number(page), Number(pageSize))))
})

router.get('/:id', authMiddleware, requirePermission('pet:view'), async (req, res) => {
  const rows = await query('SELECT p.*, m.name as member_name, m.phone as member_phone FROM pets p LEFT JOIN members m ON p.member_id = m.id WHERE p.id = ?', [req.params.id])
  if (rows.length === 0) return res.json(error('宠物不存在'))
  const pet = rows[0]
  try { pet.vaccine_records = JSON.parse(pet.vaccine_records) } catch (e) { pet.vaccine_records = [] }
  res.json(success(pet))
})

router.post('/', authMiddleware, requirePermission('pet:edit'), async (req, res) => {
  const { memberId, name, breed, birthday, weight, gender, color, vaccineRecords, careNotes, photoUrl } = req.body
  if (!memberId || !name) return res.json(error('会员和宠物名称不能为空'))
  const result = await query(
    'INSERT INTO pets (member_id, name, breed, birthday, weight, gender, color, vaccine_records, care_notes, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [memberId, name, breed, birthday, weight, gender, color, JSON.stringify(vaccineRecords || []), careNotes, photoUrl]
  )
  res.json(success({ id: result.insertId }))
})

router.put('/:id', authMiddleware, requirePermission('pet:edit'), async (req, res) => {
  const { name, breed, birthday, weight, gender, color, vaccineRecords, careNotes, photoUrl, status } = req.body
  await query(
    'UPDATE pets SET name = ?, breed = ?, birthday = ?, weight = ?, gender = ?, color = ?, vaccine_records = ?, care_notes = ?, photo_url = ?, status = ? WHERE id = ?',
    [name, breed, birthday, weight, gender, color, JSON.stringify(vaccineRecords || []), careNotes, photoUrl, status, req.params.id]
  )
  res.json(success(null, '更新成功'))
})

router.delete('/:id', authMiddleware, requirePermission('pet:edit'), async (req, res) => {
  await query('UPDATE pets SET status = 0 WHERE id = ?', [req.params.id])
  res.json(success(null, '删除成功'))
})

export default router
