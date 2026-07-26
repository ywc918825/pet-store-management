import express from 'express'
import { query, getConnection } from '../config/db.js'
import { success, error, paginate } from '../utils/response.js'
import { authMiddleware } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'

const router = express.Router()

// Products
router.get('/products', authMiddleware, requirePermission('inventory:view'), async (req, res) => {
  const page = Number(req.query.page || 1)
  const pageSize = Number(req.query.pageSize || 20)
  const params = []
  let where = ' WHERE p.status = 1'
  if (req.query.keyword) { where += ' AND (p.name LIKE ? OR p.code LIKE ?)'; params.push(`%${req.query.keyword}%`, `%${req.query.keyword}%`) }
  if (req.query.category) { where += ' AND p.category = ?'; params.push(req.query.category) }
  const [countRow] = await query(`SELECT COUNT(*) as total FROM products p LEFT JOIN suppliers s ON p.supplier_id = s.id${where}`, params)
  const rows = await query(`SELECT p.*, s.name as supplier_name FROM products p LEFT JOIN suppliers s ON p.supplier_id = s.id${where} ORDER BY p.id DESC LIMIT ? OFFSET ?`, [...params, pageSize, (page - 1) * pageSize])
  res.json(success({ list: rows, total: countRow.total, page, pageSize }))
})

router.post('/products', authMiddleware, requirePermission('inventory:edit'), async (req, res) => {
  const { code, name, category, unit, purchasePrice, salePrice, stock, minStock, supplierId } = req.body
  if (!name) return res.json(error('商品名称不能为空'))
  const exists = await query('SELECT id FROM products WHERE code = ?', [code])
  if (exists.length > 0) return res.json(error('商品编码已存在'))
  const result = await query(
    'INSERT INTO products (code, name, category, unit, purchase_price, sale_price, stock, min_stock, supplier_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [code, name, category, unit, purchasePrice || 0, salePrice || 0, stock || 0, minStock || 0, supplierId || null]
  )
  res.json(success({ id: result.insertId }))
})

router.put('/products/:id', authMiddleware, requirePermission('inventory:edit'), async (req, res) => {
  const { name, category, unit, purchasePrice, salePrice, minStock, supplierId, status } = req.body
  await query(
    'UPDATE products SET name = ?, category = ?, unit = ?, purchase_price = ?, sale_price = ?, min_stock = ?, supplier_id = ?, status = ? WHERE id = ?',
    [name, category, unit, purchasePrice, salePrice, minStock, supplierId, status, req.params.id]
  )
  res.json(success(null, '更新成功'))
})

router.post('/products/:id/stock-in', authMiddleware, requirePermission('inventory:edit'), async (req, res) => {
  const { quantity, remark } = req.body
  const qty = Number(quantity)
  if (!qty || qty <= 0) return res.json(error('入库数量必须大于0'))
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const [products] = await conn.execute('SELECT stock FROM products WHERE id = ? FOR UPDATE', [req.params.id])
    if (products.length === 0) throw new Error('商品不存在')
    const before = products[0].stock
    const after = before + qty
    await conn.execute('UPDATE products SET stock = ? WHERE id = ?', [after, req.params.id])
    await conn.execute(
      'INSERT INTO stock_records (product_id, type, quantity, before_stock, after_stock, operator_id, remark) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.params.id, 'in', qty, before, after, req.user.id, remark || '手动入库']
    )
    await conn.commit()
    res.json(success({ after }))
  } catch (e) {
    await conn.rollback()
    res.json(error(e.message))
  } finally {
    conn.release()
  }
})

router.post('/products/:id/stock-out', authMiddleware, requirePermission('inventory:edit'), async (req, res) => {
  const { quantity, remark } = req.body
  const qty = Number(quantity)
  if (!qty || qty <= 0) return res.json(error('出库数量必须大于0'))
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const [products] = await conn.execute('SELECT stock FROM products WHERE id = ? FOR UPDATE', [req.params.id])
    if (products.length === 0) throw new Error('商品不存在')
    const before = products[0].stock
    const after = before - qty
    if (after < 0) throw new Error('库存不足')
    await conn.execute('UPDATE products SET stock = ? WHERE id = ?', [after, req.params.id])
    await conn.execute(
      'INSERT INTO stock_records (product_id, type, quantity, before_stock, after_stock, operator_id, remark) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.params.id, 'out', qty, before, after, req.user.id, remark || '手动出库']
    )
    await conn.commit()
    res.json(success({ after }))
  } catch (e) {
    await conn.rollback()
    res.json(error(e.message))
  } finally {
    conn.release()
  }
})

// Suppliers
router.get('/suppliers', authMiddleware, requirePermission('inventory:view'), async (req, res) => {
  const { keyword } = req.query
  let sql = 'SELECT * FROM suppliers WHERE status = 1'
  const params = []
  if (keyword) { sql += ' AND (name LIKE ? OR contact LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`) }
  sql += ' ORDER BY id DESC'
  const rows = await query(sql, params)
  res.json(success(rows))
})

router.post('/suppliers', authMiddleware, requirePermission('inventory:edit'), async (req, res) => {
  const { name, contact, phone, address } = req.body
  if (!name) return res.json(error('供应商名称不能为空'))
  const result = await query(
    'INSERT INTO suppliers (name, contact, phone, address) VALUES (?, ?, ?, ?)',
    [name, contact, phone, address]
  )
  res.json(success({ id: result.insertId }))
})

router.put('/suppliers/:id', authMiddleware, requirePermission('inventory:edit'), async (req, res) => {
  const { name, contact, phone, address, status } = req.body
  await query(
    'UPDATE suppliers SET name = ?, contact = ?, phone = ?, address = ?, status = ? WHERE id = ?',
    [name, contact, phone, address, status, req.params.id]
  )
  res.json(success(null, '更新成功'))
})

// Stock records
router.get('/stock-records', authMiddleware, requirePermission('inventory:view'), async (req, res) => {
  const page = Number(req.query.page || 1)
  const pageSize = Number(req.query.pageSize || 20)
  const params = []
  let where = ' WHERE 1=1'
  if (req.query.productId) { where += ' AND sr.product_id = ?'; params.push(req.query.productId) }
  if (req.query.type) { where += ' AND sr.type = ?'; params.push(req.query.type) }
  if (req.query.startDate) { where += ' AND sr.created_at >= ?'; params.push(req.query.startDate + ' 00:00:00') }
  if (req.query.endDate) { where += ' AND sr.created_at <= ?'; params.push(req.query.endDate + ' 23:59:59') }
  const base = `FROM stock_records sr
             LEFT JOIN products p ON sr.product_id = p.id
             LEFT JOIN users u ON sr.operator_id = u.id ${where}`
  const [countRow] = await query(`SELECT COUNT(*) as total ${base}`, params)
  const rows = await query(`SELECT sr.*, p.name as product_name, p.code as product_code, u.real_name as operator_name ${base} ORDER BY sr.created_at DESC LIMIT ? OFFSET ?`, [...params, pageSize, (page - 1) * pageSize])
  res.json(success({ list: rows, total: countRow.total, page, pageSize }))
})

export default router
