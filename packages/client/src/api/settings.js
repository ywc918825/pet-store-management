import { request } from '@/utils/request'

export const getSettings = () => request.get('/settings')
export const updateSettings = (data) => request.post('/settings', data)
export const changePassword = (data) => request.post('/settings/change-password', data)

export const getBackups = () => request.get('/backups')
export const manualBackup = () => request.post('/backups/manual')
export const deleteBackup = (id) => request.delete(`/backups/${id}`)

// Download with auth token via fetch blob
export const downloadBackup = async (id, fileName) => {
  const token = localStorage.getItem('token')
  const res = await fetch(`/api/backups/${id}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
  if (!res.ok) throw new Error('下载失败')
  const blob = await res.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}
