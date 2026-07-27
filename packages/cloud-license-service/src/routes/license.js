import express from 'express'
import dayjs from 'dayjs'
import { v4 as uuidv4 } from 'uuid'
import dbModule from '../db.js'

// Netlify nft wraps ESM default exports as { default: X }
const db = dbModule.default || dbModule

const router = express.Router()
const GRACE_HOURS = 72

// Helper: compute license status for a device binding
function computeStatus(binding, code) {
  if (code.status === 'blacklisted') return { status: 'locked', reason: '激活码已被拉黑' }
  if (binding.status === 'unbound') return { status: 'locked', reason: '设备已解绑' }

  const now = dayjs()
  const expireAt = dayjs(binding.activated_at).add(code.duration_days, 'day')
  const diffHours = now.diff(expireAt, 'hour', true)

  if (diffHours > GRACE_HOURS) return { status: 'expired', expireAt: expireAt.toISOString() }
  if (diffHours > 0) return { status: 'grace', expireAt: expireAt.toISOString() }
  return { status: 'active', expireAt: expireAt.toISOString() }
}

// Client: get current license status from local server side
router.get('/status', async (req, res) => {
  const machineId = req.headers['x-machine-id']
  if (!machineId) {
    return res.json({ code: 0, data: { status: 'locked', message: '未激活' } })
  }
  const binding = await db.prepare('SELECT * FROM device_bindings WHERE machine_id = ? AND status = ?').get(machineId, 'active')
  if (!binding) {
    return res.json({ code: 0, data: { status: 'locked', message: '设备未绑定' } })
  }
  const code = await db.prepare('SELECT * FROM activation_codes WHERE id = ?').get(binding.code_id)
  const statusInfo = computeStatus(binding, code)
  res.json({
    code: 0,
    data: {
      ...statusInfo,
      version: code.version,
      machineId,
      lastHeartbeat: binding.last_heartbeat
    }
  })
})

// Client: activate with code
router.post('/activate', async (req, res) => {
  const { code, machineId, hardwareInfo } = req.body
  if (!code || !machineId) {
    return res.status(400).json({ code: 400, message: '缺少激活码或机器码' })
  }

  const activationCode = await db.prepare('SELECT * FROM activation_codes WHERE code = ?').get(code)
  if (!activationCode) {
    return res.status(400).json({ code: 400, message: '激活码无效' })
  }
  if (activationCode.status === 'blacklisted') {
    return res.status(400).json({ code: 400, message: '激活码已被拉黑' })
  }
  if (activationCode.status === 'used') {
    // Already used, check if this machine is bound
    const existing = await db.prepare('SELECT * FROM device_bindings WHERE code_id = ? AND machine_id = ? AND status = ?').get(activationCode.id, machineId, 'active')
    if (!existing) {
      return res.status(400).json({ code: 400, message: '激活码已用完' })
    }
    const statusInfo = computeStatus(existing, activationCode)
    return res.json({ code: 0, data: { ...statusInfo, version: activationCode.version, machineId } })
  }

  // Check device count
  const countRow = await db.prepare("SELECT COUNT(*) as count FROM device_bindings WHERE code_id = ? AND status = 'active'").get(activationCode.id)
  if (countRow.count >= activationCode.total_devices) {
    return res.status(400).json({ code: 400, message: '激活码绑定设备数已达上限' })
  }

  const now = dayjs().toISOString()
  await db.prepare('INSERT INTO device_bindings (code_id, machine_id, hardware_info, activated_at, last_heartbeat, status) VALUES (?, ?, ?, ?, ?, ?)')
    .run(activationCode.id, machineId, hardwareInfo || '', now, now, 'active')
  await db.prepare("UPDATE activation_codes SET status = 'used' WHERE id = ?").run(activationCode.id)

  const expireAt = dayjs(now).add(activationCode.duration_days, 'day').toISOString()
  res.json({
    code: 0,
    data: { status: 'active', expireAt, version: activationCode.version, machineId }
  })
})

// Client: heartbeat
router.post('/heartbeat', async (req, res) => {
  const machineId = req.headers['x-machine-id']
  if (!machineId) {
    return res.status(400).json({ code: 400, message: '缺少机器码' })
  }
  const binding = await db.prepare('SELECT * FROM device_bindings WHERE machine_id = ? AND status = ?').get(machineId, 'active')
  if (!binding) {
    return res.status(400).json({ code: 400, message: '设备未绑定' })
  }
  const code = await db.prepare('SELECT * FROM activation_codes WHERE id = ?').get(binding.code_id)
  const now = dayjs().toISOString()
  await db.prepare('UPDATE device_bindings SET last_heartbeat = ? WHERE id = ?').run(now, binding.id)
  await db.prepare('INSERT INTO heartbeat_logs (device_binding_id, heartbeat_at, result) VALUES (?, ?, ?)').run(binding.id, now, 'ok')

  const statusInfo = computeStatus(binding, code)
  res.json({ code: 0, data: { ...statusInfo, version: code.version, machineId } })
})

export default router
