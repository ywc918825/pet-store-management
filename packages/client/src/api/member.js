import { request } from '@/utils/request'

export const getMemberList = (params) => request.get('/members', { params })
export const getMemberDetail = (id) => request.get(`/members/${id}`)
export const createMember = (data) => request.post('/members', data)
export const updateMember = (id, data) => request.put(`/members/${id}`, data)
export const rechargeMember = (id, data) => request.post(`/members/${id}/recharge`, data)
export const getRechargeRecords = (memberId) => request.get(`/members/${memberId}/recharge-records`)
