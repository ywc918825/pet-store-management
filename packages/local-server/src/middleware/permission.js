import { error } from '../utils/response.js'

// Factory for route-level permission middleware
export function requirePermission(code) {
  return (req, res, next) => {
    const user = req.user
    if (!user) {
      return res.status(401).json(error('未登录', 401))
    }
    // Admin bypass
    if (user.role_code === 'admin') {
      return next()
    }
    if (!user.permissions.includes(code)) {
      return res.status(403).json(error('无操作权限', 403))
    }
    next()
  }
}
