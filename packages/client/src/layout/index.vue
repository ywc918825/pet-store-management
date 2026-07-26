<template>
  <el-container class="layout">
    <el-aside class="sidebar" width="var(--sidebar-width)">
      <div class="brand">
        <el-icon size="28" color="#fff"><Shop /></el-icon>
        <span>宠物店管理</span>
      </div>
      <el-menu :default-active="activeMenu" router class="menu" background-color="#001529" text-color="#bfcbd9" active-text-color="#409eff">
        <el-menu-item v-for="item in menuList" :key="item.path" :index="item.path" v-show="userStore.hasPermission(item.permission)">
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.title }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="header-left">
          <span class="license-tag" :class="licenseStore.status">
            <el-icon><Warning v-if="licenseStore.status !== 'active'" /></el-icon>
            {{ licenseText }}
          </span>
        </div>
        <div class="header-right">
          <span class="user-name">{{ userStore.userInfo?.real_name || userStore.userInfo?.username }}</span>
          <el-dropdown @command="handleCommand">
            <el-icon size="20"><Setting /></el-icon>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="password">修改密码</el-dropdown-item>
                <el-dropdown-item command="activate">授权信息</el-dropdown-item>
                <el-dropdown-item command="admin">授权管理后台</el-dropdown-item>
                <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/store/modules/user'
import { useLicenseStore } from '@/store/modules/license'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const licenseStore = useLicenseStore()

const activeMenu = computed(() => route.path)

const menuList = [
  { title: '数据报表', path: '/dashboard', icon: 'DataLine', permission: 'report:view' },
  { title: '会员管理', path: '/member', icon: 'User', permission: 'member:view' },
  { title: '宠物档案', path: '/pet', icon: 'FirstAidKit', permission: 'pet:view' },
  { title: '开单收银', path: '/cashier', icon: 'Money', permission: 'cashier:operate' },
  { title: '预约管理', path: '/appointment', icon: 'Calendar', permission: 'appointment:view' },
  { title: '库存管理', path: '/inventory', icon: 'Box', permission: 'inventory:view' },
  { title: '员工权限', path: '/staff', icon: 'UserFilled', permission: 'staff:manage' },
  { title: '系统设置', path: '/settings', icon: 'Setting', permission: 'setting:manage' }
]

const licenseText = computed(() => {
  const map = { active: '授权正常', grace: '离线宽限', expired: '已到期', locked: '已锁定', unknown: '未激活' }
  const base = map[licenseStore.status] || licenseStore.status
  if (licenseStore.status === 'active' || licenseStore.status === 'grace') {
    return `${base}（剩余${licenseStore.daysLeft}天）`
  }
  return base
})

const handleCommand = (cmd) => {
  if (cmd === 'logout') {
    userStore.logout()
    router.push('/login')
  } else if (cmd === 'activate') {
    router.push('/activate')
  } else if (cmd === 'admin') {
    router.push('/admin/license')
  } else if (cmd === 'password') {
    ElMessage.info('密码修改功能可在系统设置中完成')
  }
}

// Heartbeat every 60 minutes
let heartbeatTimer = null
onMounted(() => {
  heartbeatTimer = setInterval(() => {
    licenseStore.doHeartbeat()
  }, 60 * 60 * 1000)
  licenseStore.doHeartbeat()
})
onUnmounted(() => {
  clearInterval(heartbeatTimer)
})
</script>

<style scoped lang="scss">
.layout {
  height: 100%;
}
.sidebar {
  background: #001529;
}
.brand {
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.menu {
  border-right: none;
}
.header {
  height: var(--header-height);
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}
.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}
.user-name {
  color: #606266;
}
.license-tag {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.license-tag.active { background: #e1f3d8; color: #67c23a; }
.license-tag.grace { background: #faecd8; color: #e6a23c; }
.license-tag.expired, .license-tag.locked { background: #fde2e2; color: #f56c6c; }
.license-tag.unknown { background: #e9e9eb; color: #909399; }
.main {
  padding: 16px;
  background: #f5f7fa;
}
</style>
