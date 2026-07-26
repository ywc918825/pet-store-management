import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login, getCurrentUser } from '@/api/auth'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const userInfo = ref(null)
  const permissions = ref([])

  const isLoggedIn = computed(() => !!token.value)

  const hasPermission = (code) => {
    if (!userInfo.value) return false
    if (userInfo.value.role_code === 'admin') return true
    return permissions.value.includes(code)
  }

  const loginAction = async (credentials) => {
    const res = await login(credentials)
    token.value = res.token
    userInfo.value = res.user
    permissions.value = res.permissions || []
    localStorage.setItem('token', res.token)
    return res
  }

  const fetchInfo = async () => {
    if (!token.value) return
    const res = await getCurrentUser()
    userInfo.value = res.user
    permissions.value = res.permissions || []
  }

  const logout = () => {
    token.value = ''
    userInfo.value = null
    permissions.value = []
    localStorage.removeItem('token')
  }

  return {
    token,
    userInfo,
    permissions,
    isLoggedIn,
    hasPermission,
    loginAction,
    fetchInfo,
    logout
  }
})
