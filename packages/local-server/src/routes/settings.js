import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { query } from '../config/db.js'
import { success, error } from '../utils/response.js'
import { authMiddleware } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { hashPassword, comparePassword } from '../utils/crypto.js'
import { operationLog } from '../middleware/log.js'

const router = express.Router()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backupDir = path.join(__dirname, '../../backups')

// Get all settings as key-value object
router.get('/', authMiddleware, requirePermission('setting:manage'), async (req, res) => {
  const rows = await query('SELECT setting_key, setting_value FROM settings')
  const data = {}
  rows.forEach(r => { data[r.setting_key] = r.setting_value })
  res.json(success(data))
})

// Update settings (batch)
router.post('/', authMiddleware, requirePermission('setting:manage'), operationLog('update_settings', 'settings', null), async (req, res) => {
  const settings = req.body
  if (!settings || typeof settings !== 'object') return res.json(error('参数错误'))
  for (const [key, value] of Object.entries(settings)) {
    await query(
      'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
      [key, value]
    )
  }
  res.json(success(null, '保存成功'))
})

// Change current user password
router.post('/change-password', authMiddleware, operationLog('change_password', 'user', null), async (req, res) => {
  const { oldPassword, newPassword } = req.body
  if (!oldPassword || !newPassword) return res.json(error('原密码和新密码不能为空'))
  if (newPassword.length < 6) return res.json(error('新密码长度不能少于6位'))
  const rows = await query('SELECT password_hash FROM users WHERE id = ?', [req.user.id])
  if (rows.length === 0) return res.json(error('用户不存在'))
  if (!comparePassword(oldPassword, rows[0].password_hash)) return res.json(error('原密码错误'))
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(newPassword), req.user.id])
  res.json(success(null, '密码修改成功'))
})

// List backups
router.get('/backups', authMiddleware, requirePermission('setting:manage'), async (req, res) => {
  const rows = await query('SELECT id, file_path, file_size, type, status, created_at FROM backups ORDER BY created_at DESC')
  rows.forEach(r => {
    r.file_name = path.basename(r.file_path)
    r.file_path = undefined
  })
  res.json(success(rows))
})

// Manual backup
router.post('/backups/manual', authMiddleware, requirePermission('setting:manage'), operationLog('manual_backup', 'backup', null), async (req, res) => {
  const fileName = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.sql`
  const filePath = path.join(backupDir, fileName)
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env
  if (!DB_NAME) return res.json(error('数据库配置缺失'))
  // Build mysqldump command; spawn sync for simplicity
  const { exec } = await import('child_process')
  const cmd = `mysqldump -h ${DB_HOST || 'localhost'} -P ${DB_PORT || 3306} -u ${DB_USER || 'root'} ${DB_PASSWORD ? `-p${DB_PASSWORD}` : ''} ${DB_NAME} > "${filePath}"`
  exec(cmd, async (err) => {
    if (err) return res.json(error('备份失败：' + err.message))
    const stats = fs.statSync(filePath)
    const result = await query('INSERT INTO backups (file_path, file_size, type) VALUES (?, ?, ?)', [filePath, stats.size, 'manual'])
    res.json(success({ id: result.insertId, fileName, fileSize: stats.size }))
  })
})

// Download backup file
router.get('/backups/:id/download', authMiddleware, requirePermission('setting:manage'), async (req, res) => {
  const rows = await query('SELECT file_path FROM backups WHERE id = ?', [req.params.id])
  if (rows.length === 0) return res.status(404).json(error('备份文件不存在'))
  const filePath = rows[0].file_path
  if (!fs.existsSync(filePath)) return res.status(404).json(error('备份文件已删除'))
  const fileName = path.basename(filePath)
  res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(fileName)}`)
  res.setHeader('Content-Type', 'application/octet-stream')
  fs.createReadStream(filePath).pipe(res)
})

// Delete backup record (keeps file optional, here also removes file)
router.delete('/backups/:id', authMiddleware, requirePermission('setting:manage'), operationLog('delete_backup', 'backup', null), async (req, res) => {
  const rows = await query('SELECT file_path FROM backups WHERE id = ?', [req.params.id])
  if (rows.length > 0 && fs.existsSync(rows[0].file_path)) {
    try { fs.unlinkSync(rows[0].file_path) } catch (e) {}
  }
  await query('DELETE FROM backups WHERE id = ?', [req.params.id])
  res.json(success(null, '删除成功'))
})

export default router
