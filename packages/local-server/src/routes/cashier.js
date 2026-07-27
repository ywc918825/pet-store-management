import express from 'express'
import { query, getConnection } from '../config/db.js'
import { success, error, paginate } from '../utils/response.js'
import { authMiddleware } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { generateOrderNo } from '../utils/crypto.js'

const router = express.Router()

router.get('/service-items', authMiddleware, requirePermission('cashier:operate'), async (req, res) => {
  const { category } = req.query
  let sql = 'SELECT * FROM service_items WHERE status = 1'
  const params = []
  if (category) {
    sql += ' AND category = ?'
    params.push(category)
  }
  sql += ' ORDER BY category, id'
  const rows = await query(sql, params)
  res.json(success(rows))
})

// 下架/上架系统服务项(收银面板管理)。下架后 status=0,不在面板显示;
// 物理删除会破坏历史订单快照关联,故用 status 软开关,后台服务管理可重新上架。
router.patch('/service-items/:id', authMiddleware, requirePermission('cashier:operate'), async (req, res) => {
  const id = req.params.id
  const newStatus = Number(req.body.status) === 0 ? 0 : 1
  await query('UPDATE service_items SET status = ? WHERE id = ?', [newStatus, id])
  res.json(success(null, newStatus === 0 ? '已下架' : '已上架'))
})

// Products available for cashier (stock > 0). Separate from the inventory
// module so the cashier role does not need inventory:view permission.
router.get('/products', authMiddleware, requirePermission('cashier:operate'), async (req, res) => {
  const { keyword } = req.query
  const params = []
  let where = ' WHERE status = 1 AND stock > 0'
  if (keyword) { where += ' AND name LIKE ?'; params.push(`%${keyword}%`) }
  const rows = await query(`SELECT id, code, name, category, unit, sale_price as price FROM products ${where} ORDER BY name`, params)
  res.json(success(rows))
})

// Custom cashier items — user-defined persistent cards (e.g. "剪指甲 ¥20").
// Rendered alongside service_items in the cashier grid so cashiers can
// reuse common one-off entries without re-typing.
router.get('/custom-items', authMiddleware, requirePermission('cashier:operate'), async (req, res) => {
  const { category } = req.query
  const params = []
  let where = ' WHERE 1=1'
  if (category) { where += ' AND category = ?'; params.push(category) }
  const rows = await query(`SELECT id, category, name, price FROM custom_cashier_items ${where} ORDER BY id DESC`, params)
  res.json(success(rows))
})

router.post('/custom-items', authMiddleware, requirePermission('cashier:operate'), async (req, res) => {
  const { category, name, price } = req.body
  if (!name || !String(name).trim()) return res.json(error('品项名称不能为空'))
  const numPrice = Number(price)
  if (!numPrice || numPrice <= 0) return res.json(error('价格必须大于 0'))
  const allowedCats = ['wash', 'groom', 'foster', 'retail']
  if (!allowedCats.includes(category)) return res.json(error('无效的类别'))
  const result = await query(
    'INSERT INTO custom_cashier_items (category, name, price, created_by) VALUES (?, ?, ?, ?)',
    [category, String(name).trim(), numPrice, req.user.id]
  )
  res.json(success({ id: result.insertId }))
})

router.delete('/custom-items/:id', authMiddleware, requirePermission('cashier:operate'), async (req, res) => {
  await query('DELETE FROM custom_cashier_items WHERE id = ?', [req.params.id])
  res.json(success(null, '删除成功'))
})

router.get('/', authMiddleware, requirePermission('cashier:operate'), async (req, res) => {
  const page = Number(req.query.page || 1)
  const pageSize = Number(req.query.pageSize || 20)
  const params = []
  let where = ' WHERE 1=1'
  if (req.query.orderNo) { where += ' AND o.order_no LIKE ?'; params.push(`%${req.query.orderNo}%`) }
  if (req.query.memberId) { where += ' AND o.member_id = ?'; params.push(req.query.memberId) }
  if (req.query.status) { where += ' AND o.status = ?'; params.push(req.query.status) }
  if (req.query.startDate) { where += ' AND o.created_at >= ?'; params.push(req.query.startDate + ' 00:00:00') }
  if (req.query.endDate) { where += ' AND o.created_at <= ?'; params.push(req.query.endDate + ' 23:59:59') }
  const base = `FROM orders o LEFT JOIN members m ON o.member_id = m.id ${where}`
  const [countRow] = await query(`SELECT COUNT(*) as total ${base}`, params)
  const rows = await query(`SELECT o.*, m.name as member_name, m.phone as member_phone ${base} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`, [...params, pageSize, (page - 1) * pageSize])
  res.json(success({ list: rows, total: countRow.total, page, pageSize }))
})

router.get('/hang', authMiddleware, requirePermission('cashier:operate'), async (req, res) => {
  const rows = await query("SELECT o.*, m.name as member_name FROM orders o LEFT JOIN members m ON o.member_id = m.id WHERE o.status = 'hang' ORDER BY o.created_at DESC")
  res.json(success(rows))
})

router.get('/:id', authMiddleware, requirePermission('cashier:operate'), async (req, res) => {
  const orders = await query('SELECT * FROM orders WHERE id = ?', [req.params.id])
  if (!orders || orders.length === 0) return res.json(error('订单不存在'))
  const items = await query('SELECT oi.*, u.real_name as staff_name FROM order_items oi LEFT JOIN users u ON oi.staff_id = u.id WHERE oi.order_id = ?', [req.params.id])
  res.json(success({ ...orders[0], items }))
})

router.post('/', authMiddleware, requirePermission('cashier:operate'), async (req, res) => {
  const { memberId, petId, items, paymentMethod, receivedAmount, discountAmount = 0, remark, hang = false } = req.body
  if (!items || items.length === 0) return res.json(error('订单项目不能为空'))

  const conn = await getConnection()
  try {
    await conn.beginTransaction()

    let totalAmount = 0
    let totalCost = 0
    const orderNo = generateOrderNo()

    for (const item of items) {
      const amount = Number(item.price) * Number(item.quantity)
      totalAmount += amount
      totalCost += Number(item.cost || 0) * Number(item.quantity)
    }

    const payableAmount = Math.max(0, totalAmount - Number(discountAmount))
    let status = 'pending'
    let paymentStatus = 0
    let changeAmount = 0

    if (hang) {
      status = 'hang'
    } else {
      status = 'paid'
      paymentStatus = 1
      changeAmount = Math.max(0, Number(receivedAmount || 0) - payableAmount)

      // Deduct member balance if applicable
      if (paymentMethod === 'balance' && memberId) {
        const [members] = await conn.execute('SELECT balance FROM members WHERE id = ? FOR UPDATE', [memberId])
        if (members.length === 0) throw new Error('会员不存在')
        if (members[0].balance < payableAmount) throw new Error('会员余额不足')
        await conn.execute('UPDATE members SET balance = balance - ?, total_consumption = total_consumption + ?, points = points + ? WHERE id = ?',
          [payableAmount, payableAmount, Math.floor(payableAmount / 10), memberId])
        await conn.execute(
          'INSERT INTO recharge_records (member_id, type, amount, balance_before, balance_after, payment_method, operator_id, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [memberId, 'consume', -payableAmount, members[0].balance, members[0].balance - payableAmount, '余额支付', req.user.id, `订单${orderNo}`]
        )
      }

      // Deduct product stock
      for (const item of items.filter(i => i.itemType === 'product')) {
        const [products] = await conn.execute('SELECT stock FROM products WHERE id = ? FOR UPDATE', [item.itemId])
        if (products.length === 0) throw new Error('商品不存在')
        const before = products[0].stock
        const after = before - item.quantity
        if (after < 0) throw new Error(`商品 ${item.itemName} 库存不足`)
        await conn.execute('UPDATE products SET stock = ? WHERE id = ?', [after, item.itemId])
        await conn.execute(
          'INSERT INTO stock_records (product_id, type, quantity, before_stock, after_stock, order_no, operator_id, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [item.itemId, 'out', item.quantity, before, after, orderNo, req.user.id, '订单出库']
        )
      }
    }

    const [result] = await conn.execute(
      'INSERT INTO orders (order_no, member_id, pet_id, type, status, total_amount, discount_amount, payable_amount, received_amount, change_amount, payment_method, payment_status, hang_ticket_no, operator_id, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [orderNo, memberId || null, petId || null, 'mixed', status, totalAmount, discountAmount, payableAmount, receivedAmount || 0, changeAmount, paymentMethod || 'cash', paymentStatus, hang ? orderNo : null, req.user.id, remark || '']
    )

    const orderId = result.insertId
    for (const item of items) {
      await conn.execute(
        'INSERT INTO order_items (order_id, item_type, item_id, item_name, price, quantity, amount, cost, staff_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [orderId, item.itemType, item.itemId, item.itemName, item.price, item.quantity, item.price * item.quantity, item.cost || 0, item.staffId || null]
      )
    }

    await conn.commit()
    res.json(success({ orderId, orderNo, status, payableAmount }))
  } catch (e) {
    await conn.rollback()
    res.json(error(e.message))
  } finally {
    conn.release()
  }
})

router.delete('/:id', authMiddleware, requirePermission('cashier:delete'), async (req, res) => {
  const { reason } = req.body
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const [orders] = await conn.execute('SELECT * FROM orders WHERE id = ? FOR UPDATE', [req.params.id])
    if (orders.length === 0) throw new Error('订单不存在')
    const order = orders[0]
    if (order.status === 'cancelled') throw new Error('订单已取消')

    // Revert stock and balance
    const items = await conn.execute('SELECT * FROM order_items WHERE order_id = ?', [req.params.id])
    for (const item of items[0]) {
      if (item.item_type === 'product') {
        const [products] = await conn.execute('SELECT stock FROM products WHERE id = ? FOR UPDATE', [item.item_id])
        const before = products[0].stock
        const after = before + item.quantity
        await conn.execute('UPDATE products SET stock = ? WHERE id = ?', [after, item.item_id])
        await conn.execute(
          'INSERT INTO stock_records (product_id, type, quantity, before_stock, after_stock, order_no, operator_id, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [item.item_id, 'in', item.quantity, before, after, order.order_no, req.user.id, '订单取消入库']
        )
      }
    }

    if (order.payment_method === 'balance' && order.member_id && order.payable_amount > 0) {
      const [members] = await conn.execute('SELECT balance FROM members WHERE id = ? FOR UPDATE', [order.member_id])
      const before = members[0].balance
      const after = before + order.payable_amount
      await conn.execute('UPDATE members SET balance = ?, total_consumption = GREATEST(0, total_consumption - ?) WHERE id = ?', [after, order.payable_amount, order.member_id])
      await conn.execute(
        'INSERT INTO recharge_records (member_id, type, amount, balance_before, balance_after, payment_method, operator_id, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [order.member_id, 'recharge', order.payable_amount, before, after, '取消订单退款', req.user.id, `取消订单${order.order_no}`]
      )
    }

    await conn.execute("UPDATE orders SET status = 'cancelled', remark = ? WHERE id = ?", [`取消原因：${reason || '无'}`, req.params.id])
    await conn.commit()
    res.json(success(null, '订单已取消'))
  } catch (e) {
    await conn.rollback()
    res.json(error(e.message))
  } finally {
    conn.release()
  }
})

router.post('/:id/redeem', authMiddleware, requirePermission('cashier:operate'), async (req, res) => {
  const { paymentMethod, receivedAmount, discountAmount = 0 } = req.body
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const [orders] = await conn.execute("SELECT * FROM orders WHERE id = ? AND status = 'hang' FOR UPDATE", [req.params.id])
    if (orders.length === 0) throw new Error('挂单不存在或已处理')
    const order = orders[0]
    const payableAmount = Math.max(0, Number(order.total_amount) - Number(discountAmount))
    const changeAmount = Math.max(0, Number(receivedAmount || 0) - payableAmount)

    if (paymentMethod === 'balance' && order.member_id) {
      const [members] = await conn.execute('SELECT balance FROM members WHERE id = ? FOR UPDATE', [order.member_id])
      if (members[0].balance < payableAmount) throw new Error('会员余额不足')
      await conn.execute('UPDATE members SET balance = balance - ?, total_consumption = total_consumption + ? WHERE id = ?',
        [payableAmount, payableAmount, order.member_id])
    }

    await conn.execute(
      "UPDATE orders SET status = 'paid', payment_status = 1, payment_method = ?, discount_amount = ?, payable_amount = ?, received_amount = ?, change_amount = ? WHERE id = ?",
      [paymentMethod, discountAmount, payableAmount, receivedAmount, changeAmount, req.params.id]
    )
    await conn.commit()
    res.json(success(null, '取单结算成功'))
  } catch (e) {
    await conn.rollback()
    res.json(error(e.message))
  } finally {
    conn.release()
  }
})

export default router
