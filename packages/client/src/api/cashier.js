import { request } from '@/utils/request'

export const getServiceItems = (params) => request.get('/orders/service-items', { params })
export const getHangTickets = () => request.get('/orders/hang')
export const createOrder = (data) => request.post('/orders', data)
export const getOrderList = (params) => request.get('/orders', { params })
export const getOrderDetail = (id) => request.get(`/orders/${id}`)
export const deleteOrder = (id, data) => request.delete(`/orders/${id}`, { data })
export const redeemHangTicket = (id) => request.post(`/orders/${id}/redeem`)
