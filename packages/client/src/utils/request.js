import axios from 'axios'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/store/modules/user'

// Axios instance for local business API
const request = axios.create({
  baseURL: '/api',
  timeout: 30000
})

request.interceptors.request.use(
  (config) => {
    const userStore = useUserStore()
    if (userStore.token) {
      config.headers.Authorization = `Bearer ${userStore.token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

request.interceptors.response.use(
  (response) => {
    const res = response.data
    if (res.code !== 0) {
      ElMessage.error(res.message || '请求失败')
      if (res.code === 401) {
        const userStore = useUserStore()
        userStore.logout()
        window.location.href = '/#/login'
      }
      return Promise.reject(new Error(res.message))
    }
    return res.data
  },
  (error) => {
    ElMessage.error(error.response?.data?.message || '网络错误')
    return Promise.reject(error)
  }
)

export { request }
