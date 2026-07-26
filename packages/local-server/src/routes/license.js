import express from 'express'
import machineIdPkg from 'node-machine-id'
const { machineIdSync } = machineIdPkg
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import dayjs from 'dayjs'
import { success, error } from '../utils/response.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const router = express.Router()

const CLOUD_URL = process.env.CLOUD_LICENSE_URL || 'http://localhost:3002'
const machineId = machineIdSync({ original: true })
const cacheFile = path.join(__dirname, '../data/license_cache.json')
fs.mkdirSync(path.dirname(cacheFile), { recursive: true })

function readCache() {
  try {
    return JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
  } catch (e) {
    return null
  }
}

function writeCache(data) {
  fs.writeFileSync(cacheFile, JSON.stringify(data))
}

// Detect system time tampering by comparing monotonic clock
function checkTimeTampering() {
  const cache = readCache()
  if (!cache || !cache.lastServerAt) return false
  const now = Date.now()
  const lastServerTime = new Date(cache.lastServerAt).getTime()
  // If current time is earlier than last known server time minus 5 min buffer, likely tampered
  return now < lastServerTime - 5 * 60 * 1000
}

async function fetchFromCloud(endpoint, body = null) {
  try {
    const config = {
      method: body ? 'post' : 'get',
      url: `${CLOUD_URL}/api/license${endpoint}`,
      headers: { 'x-machine-id': machineId },
      timeout: 10000
    }
    if (body) config.data = { ...body, machineId }
    const { data } = await axios(config)
    if (data.code === 0) {
      writeCache({ ...data.data, lastServerAt: new Date().toISOString(), cachedAt: new Date().toISOString() })
      return data.data
    }
    return null
  } catch (e) {
    return null
  }
}

router.get('/status', async (req, res) => {
  if (checkTimeTampering()) {
    return res.json(success({ status: 'locked', reason: '检测到系统时间被篡改', machineId }))
  }
  const cloudStatus = await fetchFromCloud('/status')
  if (cloudStatus) {
    return res.json(success(cloudStatus))
  }
  // Offline mode: use cache with 72h grace
  const cache = readCache()
  if (!cache || !cache.expireAt) {
    return res.json(success({ status: 'unknown', message: '未激活或离线', machineId }))
  }
  const expireAt = dayjs(cache.expireAt)
  const now = dayjs()
  const diffHours = now.diff(expireAt, 'hour', true)
  if (diffHours > 72) {
    return res.json(success({ status: 'expired', expireAt: cache.expireAt, machineId, offline: true }))
  }
  const status = diffHours > 0 ? 'grace' : 'active'
  return res.json(success({ status, expireAt: cache.expireAt, version: cache.version, machineId, offline: true }))
})

router.post('/activate', async (req, res) => {
  if (checkTimeTampering()) {
    return res.json(error('检测到系统时间被篡改，已锁定'))
  }
  const { code } = req.body
  const hardwareInfo = JSON.stringify({ hostname: os.hostname() })
  const result = await fetchFromCloud('/activate', { code, hardwareInfo })
  if (!result) {
    return res.json(error('激活失败，请检查网络或激活码'))
  }
  return res.json(success(result))
})

router.post('/heartbeat', async (req, res) => {
  if (checkTimeTampering()) {
    return res.json(success({ status: 'locked', reason: '检测到系统时间被篡改', machineId }))
  }
  const result = await fetchFromCloud('/heartbeat')
  if (result) {
    return res.json(success(result))
  }
  const cache = readCache()
  if (!cache || !cache.expireAt) {
    return res.json(success({ status: 'unknown', machineId, offline: true }))
  }
  const expireAt = dayjs(cache.expireAt)
  const now = dayjs()
  const diffHours = now.diff(expireAt, 'hour', true)
  if (diffHours > 72) {
    return res.json(success({ status: 'expired', expireAt: cache.expireAt, machineId, offline: true }))
  }
  const status = diffHours > 0 ? 'grace' : 'active'
  return res.json(success({ status, expireAt: cache.expireAt, version: cache.version, machineId, offline: true }))
})

export default router
