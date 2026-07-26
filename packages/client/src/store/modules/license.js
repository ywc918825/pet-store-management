import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getLicenseStatus, activateLicense, heartbeat } from '@/api/license'

export const useLicenseStore = defineStore('license', () => {
  const status = ref('unknown') // active, grace, expired, locked
  const expireAt = ref(null)
  const version = ref('')
  const lastHeartbeat = ref(null)
  const machineId = ref(localStorage.getItem('machine_id') || '')
  const daysLeft = computed(() => {
    if (!expireAt.value) return 0
    const diff = new Date(expireAt.value) - new Date()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  })

  const isLocked = computed(() => status.value === 'locked' || status.value === 'expired')
  const canOperateCore = computed(() => status.value === 'active' || status.value === 'grace')

  const initLicense = async () => {
    // Skip redundant re-fetch if we already have a valid active/grace status.
    // This also prevents the route guard from overwriting a freshly-activated
    // state with a stale or failing server response.
    if (status.value === 'active' || status.value === 'grace') return
    try {
      const res = await getLicenseStatus()
      status.value = res.status
      expireAt.value = res.expireAt
      version.value = res.version
      lastHeartbeat.value = res.lastHeartbeat
      if (res.machineId) {
        machineId.value = res.machineId
        localStorage.setItem('machine_id', res.machineId)
      }
    } catch (e) {
      // Only fallback to unknown if we have no prior valid status;
      // preserve active/grace from a previous successful activation.
      if (status.value !== 'active' && status.value !== 'grace') {
        status.value = 'unknown'
      }
    }
  }

  const activate = async (code) => {
    const res = await activateLicense({ code })
    // Persist the activated state immediately so the route guard
    // won't overwrite it with a stale server response.
    status.value = res.status || 'active'
    expireAt.value = res.expireAt
    version.value = res.version || ''
    return res
  }

  const doHeartbeat = async () => {
    try {
      const res = await heartbeat()
      status.value = res.status
      expireAt.value = res.expireAt
      lastHeartbeat.value = new Date().toISOString()
    } catch (e) {
      // Fail silently; offline grace handled by server
    }
  }

  return {
    status,
    expireAt,
    version,
    lastHeartbeat,
    machineId,
    daysLeft,
    isLocked,
    canOperateCore,
    initLicense,
    activate,
    doHeartbeat
  }
})
