import { request } from '@/utils/request'

export const getPetList = (params) => request.get('/pets', { params })
export const getPetDetail = (id) => request.get(`/pets/${id}`)
export const createPet = (data) => request.post('/pets', data)
export const updatePet = (id, data) => request.put(`/pets/${id}`, data)
export const deletePet = (id) => request.delete(`/pets/${id}`)
