<template>
  <div class="admin-page">
    <el-header class="topbar">
      <span class="brand">授权管理后台</span>
      <el-button text @click="handleLogout">退出登录</el-button>
    </el-header>

    <el-main class="content">
      <!-- Generate codes -->
      <el-card class="block" header="生成激活码">
        <el-form :model="genForm" inline>
          <el-form-item label="有效天数">
            <el-input-number v-model="genForm.durationDays" :min="1" :max="3650" />
          </el-form-item>
          <el-form-item label="版本">
            <el-select v-model="genForm.version" style="width: 120px">
              <el-option label="基础版 basic" value="basic" />
              <el-option label="高级版 pro" value="pro" />
            </el-select>
          </el-form-item>
          <el-form-item label="绑定设备数">
            <el-input-number v-model="genForm.totalDevices" :min="1" :max="50" />
          </el-form-item>
          <el-form-item label="生成数量">
            <el-input-number v-model="genForm.count" :min="1" :max="100" />
          </el-form-item>
          <el-form-item label="备注">
            <el-input v-model="genForm.remark" placeholder="可选" style="width: 160px" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="genLoading" @click="handleGenerate">生成</el-button>
          </el-form-item>
        </el-form>
        <el-alert v-if="lastGenerated.length" type="success" :closable="false" show-icon>
          <template #title>已生成 {{ lastGenerated.length }} 个激活码（请复制发给用户）</template>
          <div class="codes">
            <code v-for="c in lastGenerated" :key="c" @click="copy(c)">{{ c }}</code>
          </div>
        </el-alert>
      </el-card>

      <!-- Codes list -->
      <el-card class="block" header="激活码列表">
        <el-table :data="codes" v-loading="codesLoading" stripe>
          <el-table-column prop="code" label="激活码" width="200" />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="codeTag(row.status)">{{ codeStatusText(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="version" label="版本" width="90" />
          <el-table-column prop="duration_days" label="天数" width="80" />
          <el-table-column prop="total_devices" label="设备数" width="80" />
          <el-table-column prop="remark" label="备注" min-width="120" />
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <el-button v-if="row.status !== 'blacklisted'" size="small" type="danger" @click="blacklist(row)">拉黑</el-button>
              <el-button v-else size="small" type="warning" @click="restore(row)">恢复</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- Devices list -->
      <el-card class="block" header="已绑定设备">
        <el-table :data="devices" v-loading="devicesLoading" stripe>
          <el-table-column prop="activation_code" label="激活码" width="200" />
          <el-table-column prop="machine_id" label="机器码" min-width="200" />
          <el-table-column prop="hardware_info" label="硬件信息" min-width="140" show-overflow-tooltip />
          <el-table-column prop="activated_at" label="激活时间" width="180" />
          <el-table-column prop="last_heartbeat" label="最后心跳" width="180" />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.status === 'active' ? 'success' : 'info'">
                {{ row.status === 'active' ? '已绑定' : '已解绑' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button v-if="row.status === 'active'" size="small" type="danger" @click="unbind(row)">解绑</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </el-main>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  generateCodes,
  listCodes,
  updateCodeStatus,
  listDevices,
  unbindDevice,
  ADMIN_TOKEN_KEY
} from '@/api/admin'

const router = useRouter()
const codes = ref([])
const devices = ref([])
const codesLoading = ref(false)
const devicesLoading = ref(false)
const genLoading = ref(false)
const lastGenerated = ref([])

const genForm = reactive({
  durationDays: 365,
  version: 'pro',
  totalDevices: 2,
  count: 1,
  remark: ''
})

const codeStatusText = (s) => ({ active: '未使用', used: '已使用', blacklisted: '已拉黑' }[s] || s)
const codeTag = (s) => ({ active: 'info', used: 'success', blacklisted: 'danger' }[s] || 'info')

const loadCodes = async () => {
  codesLoading.value = true
  try {
    const res = await listCodes({ pageSize: 200 })
    codes.value = res.list || []
  } finally {
    codesLoading.value = false
  }
}

const loadDevices = async () => {
  devicesLoading.value = true
  try {
    const res = await listDevices({ pageSize: 200 })
    devices.value = res.list || []
  } finally {
    devicesLoading.value = false
  }
}

const handleGenerate = async () => {
  genLoading.value = true
  lastGenerated.value = []
  try {
    const res = await generateCodes({ ...genForm })
    lastGenerated.value = res || []
    ElMessage.success(`已生成 ${lastGenerated.value.length} 个激活码`)
    loadCodes()
  } finally {
    genLoading.value = false
  }
}

const blacklist = async (row) => {
  await ElMessageBox.confirm(`确认拉黑 ${row.code}？该码绑定的所有设备将立即锁定。`, '警告', { type: 'warning' })
  await updateCodeStatus(row.id, 'blacklisted')
  ElMessage.success('已拉黑')
  loadCodes()
  loadDevices()
}

const restore = async (row) => {
  await updateCodeStatus(row.id, 'active')
  ElMessage.success('已恢复为未使用')
  loadCodes()
}

const unbind = async (row) => {
  await ElMessageBox.confirm(`确认解绑该设备？解绑后该码可绑定到其他电脑。`, '提示', { type: 'warning' })
  await unbindDevice(row.id)
  ElMessage.success('已解绑')
  loadDevices()
  loadCodes()
}

const copy = (text) => {
  navigator.clipboard.writeText(text)
  ElMessage.success('已复制：' + text)
}

const handleLogout = () => {
  localStorage.removeItem(ADMIN_TOKEN_KEY)
  router.push('/admin/login')
}

onMounted(() => {
  if (!localStorage.getItem(ADMIN_TOKEN_KEY)) {
    router.push('/admin/login')
    return
  }
  loadCodes()
  loadDevices()
})
</script>

<style scoped lang="scss">
.admin-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #001529;
  color: #fff;
  height: 56px;
}
.brand {
  font-size: 16px;
  font-weight: 600;
}
.content {
  padding: 16px;
  overflow: auto;
}
.block {
  margin-bottom: 16px;
}
.codes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  code {
    background: #fff;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    padding: 2px 8px;
    cursor: pointer;
    user-select: all;
  }
}
</style>
