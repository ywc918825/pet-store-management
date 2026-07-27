import { createRouter, createWebHashHistory } from 'vue-router'
import { useUserStore } from '@/store/modules/user'
import { useLicenseStore } from '@/store/modules/license'

// Route configuration with permission meta
const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { public: true }
  },
  {
    path: '/activate',
    name: 'Activate',
    component: () => import('@/views/activate/index.vue'),
    meta: { public: true }
  },
  {
    path: '/admin/login',
    name: 'AdminLogin',
    component: () => import('@/views/admin/login.vue'),
    meta: { public: true }
  },
  {
    path: '/admin/license',
    name: 'AdminLicense',
    component: () => import('@/views/admin/license.vue'),
    meta: { public: true }
  },
  {
    path: '/invoice/:orderNo',
    name: 'Invoice',
    component: () => import('@/views/invoice/index.vue'),
    meta: { standalone: true }
  },
  {
    path: '/',
    name: 'Layout',
    component: () => import('@/layout/index.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'Dashboard', component: () => import('@/views/dashboard/index.vue'), meta: { title: '数据报表', icon: 'DataLine', permission: 'report:view' } },
      { path: 'member', name: 'Member', component: () => import('@/views/member/index.vue'), meta: { title: '会员管理', icon: 'User', permission: 'member:view' } },
      { path: 'pet', name: 'Pet', component: () => import('@/views/pet/index.vue'), meta: { title: '宠物档案', icon: 'FirstAidKit', permission: 'pet:view' } },
      { path: 'cashier', name: 'Cashier', component: () => import('@/views/cashier/index.vue'), meta: { title: '开单收银', icon: 'Money', permission: 'cashier:operate' } },
      { path: 'appointment', name: 'Appointment', component: () => import('@/views/appointment/index.vue'), meta: { title: '预约管理', icon: 'Calendar', permission: 'appointment:view' } },
      { path: 'inventory', name: 'Inventory', component: () => import('@/views/inventory/index.vue'), meta: { title: '库存管理', icon: 'Box', permission: 'inventory:view' } },
      { path: 'staff', name: 'Staff', component: () => import('@/views/staff/index.vue'), meta: { title: '员工权限', icon: 'UserFilled', permission: 'staff:manage' } },
      { path: 'settings', name: 'Settings', component: () => import('@/views/settings/index.vue'), meta: { title: '系统设置', icon: 'Setting', permission: 'setting:manage' } }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// Route guard: check license and auth
router.beforeEach(async (to, from, next) => {
  const licenseStore = useLicenseStore()
  const userStore = useUserStore()

  // Always init license status first
  await licenseStore.initLicense()

  // Public routes skip license lock
  if (to.meta.public) {
    return next()
  }

  // If license is completely locked, force activation
  if (licenseStore.isLocked) {
    return next('/activate')
  }

  if (!userStore.token) {
    return next('/login')
  }

  // Token persists in localStorage across page refreshes, but userInfo is
  // reset to null. Load it before permission checks, otherwise hasPermission()
  // always returns false and the guard falls into a redirect loop (the page
  // appears "stuck" — this was the root cause of "activated but won't redirect").
  if (!userStore.userInfo) {
    try {
      await userStore.fetchInfo()
    } catch (e) {
      // Token invalid/expired — clear it and force re-login
      userStore.logout()
      return next('/login')
    }
  }

  // Permission check
  const required = to.meta.permission
  if (required && !userStore.hasPermission(required)) {
    return next('/')
  }

  next()
})

export default router
