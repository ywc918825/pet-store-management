import { request } from '@/utils/request'

export const getDashboardSummary = (params) => request.get('/dashboard/summary', { params })
export const getDailyRevenue = (params) => request.get('/dashboard/daily-revenue', { params })
export const getMemberRanking = (params) => request.get('/dashboard/member-ranking', { params })
export const getItemSales = (params) => request.get('/dashboard/item-sales', { params })
export const getStockFlow = (params) => request.get('/dashboard/stock-flow', { params })
export const getProfit = (params) => request.get('/dashboard/profit', { params })
