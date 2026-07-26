import axios from 'axios'
import { ElMessage } from 'element-plus'

// Independent axios instance for the provider (software owner) admin console.
// It is NOT the same as the merchant `request` instance: admin uses its own
// token (localStorage `admin_token`) and on 401 bounces to /admin/login
// instead of the merchant /login.
export const ADMIN_TOKEN_KEY = 'admin_token'

const adminRequest = axios.create({
  baseURL: '/api',
  timeout: 30000
})

adminRequest.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY)
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (err) => Promise.reject(err)
)

adminRequest.interceptors.response.use(
  (response) => {
    const res = response.data
    if (res.code !== 0) {
      ElMessage.error(res.message || '请求失败')
      return Promise.reject(new Error(res.message))
    }
    return res.data
  },
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem(ADMIN_TOKEN_KEY)
      if (window.location.hash !== '#/admin/login') {
        window.location.href = '/#/admin/login'
      }
    }
    ElMessage.error(err.response?.data?.message || '网络错误')
    return Promise.reject(err)
  }
)

export function adminLogin(data) {
  return adminRequest({ url: '/admin/login', method: 'post', data })
}

export function generateCodes(data) {
  return adminRequest({ url: '/admin/codes', method: 'post', data })
}

export function listCodes(params) {
  return adminRequest({ url: '/admin/codes', method: 'get', params })
}

export function updateCodeStatus(id, status) {
  return adminRequest({ url: `/admin/codes/${id}/status`, method: 'patch', data: { status } })
}

export function listDevices(params) {
  return adminRequest({ url: '/admin/devices', method: 'get', params })
}

export function unbindDevice(id) {
  return adminRequest({ url: `/admin/devices/${id}/unbind`, method: 'post' })
}

export default adminRequest
