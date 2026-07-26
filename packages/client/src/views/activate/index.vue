<template>
  <div class="activate-page">
    <div class="activate-box">
      <el-icon size="64" color="#409eff"><Lock /></el-icon>
      <h2>软件激活</h2>
      <p class="sub-title">请输入激活码完成授权</p>
      <div class="machine-info">
        <span>机器码：{{ licenseStore.machineId || '获取中...' }}</span>
        <el-button link type="primary" @click="copyMachineId">复制</el-button>
      </div>
      <el-form :model="form" @submit.prevent="handleActivate">
        <el-form-item>
          <el-input v-model="form.code" placeholder="请输入16位激活码" size="large" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" size="large" style="width: 100%" :loading="loading" @click="handleActivate">立即激活</el-button>
        </el-form-item>
      </el-form>
      <div class="demo-codes">
        <p>演示激活码（本地 mock 云）：</p>
        <p>DEMO30BASIC（30天基础版）</p>
        <p>DEMO90PRO（90天高级版）</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useLicenseStore } from '@/store/modules/license'

const router = useRouter()
const licenseStore = useLicenseStore()
const loading = ref(false)
const form = reactive({ code: '' })

const copyMachineId = () => {
  navigator.clipboard.writeText(licenseStore.machineId)
  ElMessage.success('已复制机器码')
}

const handleActivate = async () => {
  if (!form.code) return ElMessage.warning('请输入激活码')
  loading.value = true
  try {
    await licenseStore.activate(form.code)
    ElMessage.success('激活成功')
    // Wait for Pinia state flush so the route guard sees the updated status
    await nextTick()
    router.push('/')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.activate-page {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
}
.activate-box {
  width: 460px;
  padding: 48px;
  background: #fff;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}
.sub-title {
  color: #606266;
  margin: 8px 0 24px;
}
.machine-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 16px;
  color: #909399;
  font-size: 12px;
  word-break: break-all;
}
.demo-codes {
  margin-top: 24px;
  color: #909399;
  font-size: 12px;
  line-height: 1.8;
}
</style>
