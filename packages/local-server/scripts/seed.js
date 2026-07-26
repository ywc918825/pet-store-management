import { query, getConnection } from '../src/config/db.js'
import { hashPassword } from '../src/utils/crypto.js'

// Default permission definitions
const PERMISSIONS = {
  'member:view': '查看会员',
  'member:edit': '编辑会员',
  'member:recharge': '会员储值',
  'pet:view': '查看宠物档案',
  'pet:edit': '编辑宠物档案',
  'cashier:operate': '开单收银',
  'cashier:discount': '改价折扣',
  'cashier:delete': '删单',
  'appointment:view': '查看预约',
  'appointment:edit': '编辑预约',
  'inventory:view': '查看库存',
  'inventory:edit': '编辑库存',
  'report:view': '查看报表',
  'staff:manage': '员工权限管理',
  'setting:manage': '系统设置'
}

const roles = [
  { name: '老板/管理员', code: 'admin', permissions: Object.keys(PERMISSIONS), is_system: 1 },
  { name: '店长', code: 'manager', permissions: Object.keys(PERMISSIONS).filter(p => p !== 'setting:manage'), is_system: 1 },
  { name: '收银员', code: 'cashier', permissions: ['member:view', 'pet:view', 'cashier:operate'], is_system: 1 },
  { name: '美容师', code: 'groomer', permissions: ['appointment:view'], is_system: 1 }
]

const adminUser = { username: 'admin', password: '123456', real_name: '系统管理员', phone: '13800000000' }

async function seed() {
  const conn = await getConnection()
  try {
    await conn.execute('SET FOREIGN_KEY_CHECKS = 0')
    await conn.execute('TRUNCATE TABLE users')
    await conn.execute('TRUNCATE TABLE roles')

    for (const role of roles) {
      await conn.execute(
        'INSERT INTO roles (name, code, permissions, is_system) VALUES (?, ?, ?, ?)',
        [role.name, role.code, JSON.stringify(role.permissions), role.is_system]
      )
    }

    const [adminRole] = await conn.execute('SELECT id FROM roles WHERE code = ?', ['admin'])
    await conn.execute(
      'INSERT INTO users (username, password_hash, real_name, phone, role_id, status) VALUES (?, ?, ?, ?, ?, ?)',
      [adminUser.username, hashPassword(adminUser.password), adminUser.real_name, adminUser.phone, adminRole[0].id, 1]
    )

    // Seed default service items
    await conn.execute('TRUNCATE TABLE service_items')
    await conn.execute('SET FOREIGN_KEY_CHECKS = 1')
    const services = [
      { code: 'S001', name: '基础洗护', category: 'wash', price: 50, cost: 10, duration_minutes: 60 },
      { code: 'S002', name: '精致美容', category: 'groom', price: 120, cost: 20, duration_minutes: 90 },
      { code: 'S003', name: '单日寄养', category: 'foster', price: 80, cost: 15, duration_minutes: 0 },
      { code: 'S004', name: '深度SPA', category: 'wash', price: 150, cost: 30, duration_minutes: 120 }
    ]
    for (const s of services) {
      await conn.execute(
        'INSERT INTO service_items (code, name, category, price, cost, duration_minutes) VALUES (?, ?, ?, ?, ?, ?)',
        [s.code, s.name, s.category, s.price, s.cost, s.duration_minutes]
      )
    }

    console.log('Seed completed: default roles, admin user (123456), and service items created.')
  } finally {
    conn.release()
  }
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
