import { request } from '@/utils/request'

export const getAppointmentList = (params) => request.get('/appointments', { params })
export const createAppointment = (data) => request.post('/appointments', data)
export const updateAppointment = (id, data) => request.put(`/appointments/${id}`, data)
export const updateAppointmentStatus = (id, data) => request.patch(`/appointments/${id}/status`, data)
