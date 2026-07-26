import { request } from '@/utils/request'

export const getLicenseStatus = () => request.get('/license/status')
export const activateLicense = (data) => request.post('/license/activate', data)
export const heartbeat = () => request.post('/license/heartbeat')
