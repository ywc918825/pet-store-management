import { request } from '@/utils/request'

export const getProducts = (params) => request.get('/products', { params })
export const createProduct = (data) => request.post('/products', data)
export const updateProduct = (id, data) => request.put(`/products/${id}`, data)
export const stockIn = (id, data) => request.post(`/products/${id}/stock-in`, data)
export const stockOut = (id, data) => request.post(`/products/${id}/stock-out`, data)
export const getSuppliers = (params) => request.get('/suppliers', { params })
export const createSupplier = (data) => request.post('/suppliers', data)
export const updateSupplier = (id, data) => request.put(`/suppliers/${id}`, data)
export const getStockRecords = (params) => request.get('/stock-records', { params })
