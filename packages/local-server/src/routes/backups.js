import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { query } from '../config/db.js'
import { success, error } from '../utils/response.js'
import { authMiddleware } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { operationLog } from '../middleware/log.js'

const router = express.Router()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backupDir = path.join(__dirname, '../../backups')

// List backups
router.get('/', authMiddleware, requirePermission('setting:manage'), async (req, res) => {
  const rows = await query('SELECT id, file_path, file_size, type, status, created_at FROM backups ORDER BY created_at DESC')
  rows.forEach(r => {
    r.file_name = path.basename(r.file_path)
    r.file_path = undefined
  })
  res.json(success(rows))
})

// Manual backup
router.post('/manual', authMiddleware, requirePermission('setting:manage'), operationLog('manual_backup', 'backup', null), async (req, res) => {
  const fileName = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.sql`
  const filePath = path.join(backupDir, fileName)
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env
  if (!DB_NAME) return res.json(error('数据库配置缺失'))
  // Use execFile (no shell) for safety — same pattern as auto-backup in index.js
  const { execFile } = await import('child_process')
  const args = ['-h', DB_HOST || 'localhost', '-P', String(DB_PORT || 3306), '-u', DB_USER || 'root']
  if (DB_PASSWORD) args.push(`-p${DB_PASSWORD}`)
  args.push(DB_NAME)
  const out = fs.createWriteStream(filePath)
  const child = execFile('mysqldump', args, { maxBuffer: 1024 * 1024 * 50 })
  child.stdout.pipe(out)
  child.on('error', (err) => { console.error('Manual backup failed:', err); out.close(); return res.json(error('备份失败：' + err.message)) })
  child.on('close', async (code) => {
    out.close()
    if (code !== 0) return res.json(error('备份失败，退出码 ' + code))
    try {
      const stats = fs.statSync(filePath)
      const result = await query('INSERT INTO backups (file_path, file_size, type) VALUES (?, ?, ?)', [filePath, stats.size, 'manual'])
      res.json(success({ id: result.insertId, fileName, fileSize: stats.size }))
    } catch (e) {
      res.json(error('备份记录写入失败'))
    }
  })
})

// Download backup file
router.get('/:id/download', authMiddleware, requirePermission('setting:manage'), async (req, res) => {
  const rows = await query('SELECT file_path FROM backups WHERE id = ?', [req.params.id])
  if (rows.length === 0) return res.status(404).json(error('备份文件不存在'))
  const filePath = rows[0].file_path
  if (!fs.existsSync(filePath)) return res.status(404).json(error('备份文件已删除'))
  const fileName = path.basename(filePath)
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`)
  res.setHeader('Content-Type', 'application/octet-stream')
  fs.createReadStream(filePath).pipe(res)
})

// Delete backup record and file
router.delete('/:id', authMiddleware, requirePermission('setting:manage'), operationLog('delete_backup', 'backup', null), async (req, res) => {
  const rows = await query('SELECT file_path FROM backups WHERE id = ?', [req.params.id])
  if (rows.length > 0 && fs.existsSync(rows[0].file_path)) {
    try { fs.unlinkSync(rows[0].file_path) } catch (e) {}
  }
  await query('DELETE FROM backups WHERE id = ?', [req.params.id])
  res.json(success(null, '删除成功'))
})

export default router
