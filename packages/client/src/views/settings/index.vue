<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">系统设置</span>
    </div>

    <el-row :gutter="16">
      <el-col :span="12">
        <el-card class="setting-card" shadow="never">
          <template #header>
            <div class="card-header">
              <el-icon><Shop /></el-icon>
              <span>门店信息</span>
            </div>
          </template>
          <el-form :model="shopForm" label-width="100px" @submit.prevent>
            <el-form-item label="门店名称">
              <el-input v-model="shopForm.shop_name" placeholder="请输入门店名称" />
            </el-form-item>
            <el-form-item label="联系电话">
              <el-input v-model="shopForm.shop_phone" placeholder="请输入联系电话" />
            </el-form-item>
            <el-form-item label="门店地址">
              <el-input v-model="shopForm.shop_address" type="textarea" :rows="2" placeholder="请输入门店地址" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveShop" :loading="saving">保存门店信息</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card class="setting-card" shadow="never" style="margin-top: 16px">
          <template #header>
            <div class="card-header">
              <el-icon><Lock /></el-icon>
              <span>修改密码</span>
            </div>
          </template>
          <el-form :model="pwdForm" label-width="100px" @submit.prevent>
            <el-form-item label="原密码">
              <el-input v-model="pwdForm.oldPassword" type="password" show-password placeholder="请输入原密码" />
            </el-form-item>
            <el-form-item label="新密码">
              <el-input v-model="pwdForm.newPassword" type="password" show-password placeholder="请输入新密码（至少6位）" />
            </el-form-item>
            <el-form-item label="确认密码">
              <el-input v-model="pwdForm.confirmPassword" type="password" show-password placeholder="请再次输入新密码" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="changePwd" :loading="pwdLoading">确认修改</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card class="setting-card" shadow="never">
          <template #header>
            <div class="card-header">
              <el-icon><Key /></el-icon>
              <span>授权信息</span>
            </div>
          </template>
          <div class="license-info">
            <div class="info-row">
              <span class="info-label">授权状态</span>
              <el-tag :type="licenseTagType">{{ licenseStatusText }}</el-tag>
            </div>
            <div class="info-row">
              <span class="info-label">软件版本</span>
              <span>{{ licenseStore.version || '-' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">到期时间</span>
              <span>{{ licenseStore.expireAt || '-' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">剩余天数</span>
              <span>{{ licenseStore.daysLeft }} 天</span>
            </div>
            <div class="info-row">
              <span class="info-label">机器码</span>
              <span class="machine-code">{{ licenseStore.machineId || '-' }}</span>
            </div>
            <el-button type="primary" plain style="margin-top: 12px" @click="goActivate">查看/更换授权</el-button>
          </div>
        </el-card>

        <el-card class="setting-card" shadow="never" style="margin-top: 16px">
          <template #header>
            <div class="card-header">
              <el-icon><DocumentCopy /></el-icon>
              <span>数据备份</span>
              <el-button type="primary" size="small" :loading="backupLoading" @click="doManualBackup" style="margin-left: auto">立即备份</el-button>
            </div>
          </template>
          <el-table :data="backupList" size="small" height="300" empty-text="暂无备份记录">
            <el-table-column prop="file_name" label="文件名" show-overflow-tooltip />
            <el-table-column prop="type" label="类型" width="80">
              <template #default="{ row }">
                <el-tag size="small" :type="row.type === 'auto' ? 'info' : 'success'">{{ row.type === 'auto' ? '自动' : '手动' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="file_size" label="大小" width="100">
              <template #default="{ row }">
                {{ formatSize(row.file_size) }}
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="备份时间" width="160" />
            <el-table-column label="操作" width="140" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="downloadBackup(row)">下载</el-button>
                <el-button link type="danger" size="small" @click="removeBackup(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useLicenseStore } from '@/store/modules/license'
import { useUserStore } from '@/store/modules/user'
import { getSettings, updateSettings, changePassword, getBackups, manualBackup, deleteBackup, downloadBackup as downloadBackupApi } from '@/api/settings'

const router = useRouter()
const licenseStore = useLicenseStore()
const userStore = useUserStore()

const shopForm = reactive({ shop_name: '', shop_phone: '', shop_address: '' })
const pwdForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
const saving = ref(false)
const pwdLoading = ref(false)
const backupLoading = ref(false)
const backupList = ref([])

const licenseTagType = computed(() => {
  const map = { active: 'success', grace: 'warning', expired: 'danger', locked: 'danger', unknown: 'info' }
  return map[licenseStore.status] || 'info'
})

const licenseStatusText = computed(() => {
  const map = { active: '授权正常', grace: '离线宽限', expired: '已到期', locked: '已锁定', unknown: '未激活' }
  return map[licenseStore.status] || licenseStore.status
})

const loadSettings = async () => {
  try {
    const data = await getSettings()
    Object.assign(shopForm, {
      shop_name: data.shop_name || '',
      shop_phone: data.shop_phone || '',
      shop_address: data.shop_address || ''
    })
  } catch (e) {}
}

const saveShop = async () => {
  saving.value = true
  try {
    await updateSettings({
      shop_name: shopForm.shop_name,
      shop_phone: shopForm.shop_phone,
      shop_address: shopForm.shop_address
    })
    ElMessage.success('门店信息保存成功')
  } finally {
    saving.value = false
  }
}

const changePwd = async () => {
  if (!pwdForm.oldPassword || !pwdForm.newPassword || !pwdForm.confirmPassword) {
    return ElMessage.warning('请完整填写密码信息')
  }
  if (pwdForm.newPassword.length < 6) {
    return ElMessage.warning('新密码长度不能少于6位')
  }
  if (pwdForm.newPassword !== pwdForm.confirmPassword) {
    return ElMessage.warning('两次输入的新密码不一致')
  }
  pwdLoading.value = true
  try {
    await changePassword({ oldPassword: pwdForm.oldPassword, newPassword: pwdForm.newPassword })
    ElMessage.success('密码修改成功，请重新登录')
    userStore.logout()
    router.push('/login')
  } finally {
    pwdLoading.value = false
  }
}

const loadBackups = async () => {
  try {
    backupList.value = await getBackups()
  } catch (e) {
    backupList.value = []
  }
}

const doManualBackup = async () => {
  backupLoading.value = true
  try {
    await manualBackup()
    ElMessage.success('备份成功')
    await loadBackups()
  } finally {
    backupLoading.value = false
  }
}

const downloadBackup = async (row) => {
  try {
    await downloadBackupApi(row.id, row.file_name)
  } catch (e) {
    ElMessage.error(e.message || '下载失败')
  }
}

const removeBackup = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除该备份记录吗？', '提示', { type: 'warning' })
    await deleteBackup(row.id)
    ElMessage.success('删除成功')
    await loadBackups()
  } catch (e) {}
}

const formatSize = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const goActivate = () => {
  router.push('/activate')
}

onMounted(() => {
  loadSettings()
  loadBackups()
})
</script>

<style scoped lang="scss">
.page-container {
  padding-bottom: 24px;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}
.setting-card {
  border-radius: 8px;
}
.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}
.license-info {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
}
.info-label {
  color: #909399;
}
.machine-code {
  font-size: 12px;
  color: #606266;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
