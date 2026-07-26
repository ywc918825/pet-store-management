import { query } from '../config/db.js'

// Record sensitive operation logs asynchronously
export function operationLog(action, targetType, targetIdResolver, detailResolver) {
  return async (req, res, next) => {
    const originalJson = res.json
    res.json = async function (body) {
      res.json = originalJson
      try {
        const targetId = typeof targetIdResolver === 'function' ? targetIdResolver(req, body) : targetIdResolver
        const detail = typeof detailResolver === 'function' ? detailResolver(req, body) : detailResolver
        await query(
          'INSERT INTO operation_logs (user_id, action, target_type, target_id, detail, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
          [req.user?.id || null, action, targetType, targetId || '', JSON.stringify(detail || {}), req.ip || '']
        )
      } catch (e) {
        // Do not fail the main request because of logging
      }
      return res.json(body)
    }
    next()
  }
}
