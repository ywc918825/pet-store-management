import express from 'express'
import { query } from '../config/db.js'
import { success } from '../utils/response.js'
import { authMiddleware } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'

const router = express.Router()

router.get('/summary', authMiddleware, requirePermission('report:view'), async (req, res) => {
  const { startDate, endDate } = req.query
  const start = startDate ? `${startDate} 00:00:00` : null
  const end = endDate ? `${endDate} 23:59:59` : null

  let dateFilter = ''
  const params = []
  if (start && end) {
    dateFilter = ' AND created_at BETWEEN ? AND ?'
    params.push(start, end)
  }

  const [revenue] = await query(`SELECT COALESCE(SUM(payable_amount), 0) as total FROM orders WHERE status = 'paid' ${dateFilter}`, params)
  const [orderCount] = await query(`SELECT COUNT(*) as total FROM orders WHERE status = 'paid' ${dateFilter}`, params)
  const [memberCount] = await query('SELECT COUNT(*) as total FROM members WHERE status = 1')
  const [petCount] = await query('SELECT COUNT(*) as total FROM pets WHERE status = 1')
  const [lowStock] = await query('SELECT COUNT(*) as total FROM products WHERE status = 1 AND stock <= min_stock')

  res.json(success({ revenue: revenue.total, orderCount: orderCount.total, memberCount: memberCount.total, petCount: petCount.total, lowStock: lowStock.total }))
})

router.get('/daily-revenue', authMiddleware, requirePermission('report:view'), async (req, res) => {
  const { startDate, endDate } = req.query
  const rows = await query(
    `SELECT DATE(created_at) as date, COUNT(*) as order_count, COALESCE(SUM(payable_amount), 0) as revenue
     FROM orders
     WHERE status = 'paid' AND DATE(created_at) BETWEEN ? AND ?
     GROUP BY DATE(created_at)
     ORDER BY date`,
    [startDate, endDate]
  )
  res.json(success(rows))
})

router.get('/member-ranking', authMiddleware, requirePermission('report:view'), async (req, res) => {
  const { startDate, endDate, limit = 10 } = req.query
  const rows = await query(
    `SELECT m.id, m.name, m.phone, COALESCE(SUM(o.payable_amount), 0) as total_amount, COUNT(o.id) as order_count
     FROM members m
     LEFT JOIN orders o ON m.id = o.member_id AND o.status = 'paid' AND DATE(o.created_at) BETWEEN ? AND ?
     WHERE m.status = 1
     GROUP BY m.id, m.name, m.phone
     ORDER BY total_amount DESC
     LIMIT ?`,
    [startDate, endDate, Number(limit)]
  )
  res.json(success(rows))
})

router.get('/item-sales', authMiddleware, requirePermission('report:view'), async (req, res) => {
  const { startDate, endDate } = req.query
  const rows = await query(
    `SELECT oi.item_name, oi.item_type, SUM(oi.quantity) as qty, SUM(oi.amount) as amount
     FROM order_items oi
     LEFT JOIN orders o ON oi.order_id = o.id
     WHERE o.status = 'paid' AND DATE(o.created_at) BETWEEN ? AND ?
     GROUP BY oi.item_name, oi.item_type
     ORDER BY amount DESC`,
    [startDate, endDate]
  )
  res.json(success(rows))
})

router.get('/stock-flow', authMiddleware, requirePermission('report:view'), async (req, res) => {
  const { startDate, endDate } = req.query
  const rows = await query(
    `SELECT sr.type, p.name as product_name, sr.quantity, sr.before_stock, sr.after_stock, sr.remark, sr.created_at
     FROM stock_records sr
     LEFT JOIN products p ON sr.product_id = p.id
     WHERE DATE(sr.created_at) BETWEEN ? AND ?
     ORDER BY sr.created_at DESC`,
    [startDate, endDate]
  )
  res.json(success(rows))
})

router.get('/profit', authMiddleware, requirePermission('report:view'), async (req, res) => {
  const { startDate, endDate } = req.query
  const [revenue] = await query(
    `SELECT COALESCE(SUM(payable_amount), 0) as revenue, COALESCE(SUM(total_amount - discount_amount), 0) as gross
     FROM orders
     WHERE status = 'paid' AND DATE(created_at) BETWEEN ? AND ?`,
    [startDate, endDate]
  )
  const [cost] = await query(
    `SELECT COALESCE(SUM(oi.cost * oi.quantity), 0) as cost
     FROM order_items oi
     LEFT JOIN orders o ON oi.order_id = o.id
     WHERE o.status = 'paid' AND DATE(o.created_at) BETWEEN ? AND ?`,
    [startDate, endDate]
  )
  const profit = Number(revenue.gross) - Number(cost.cost)
  res.json(success({ revenue: revenue.revenue, cost: cost.cost, profit }))
})

export default router
