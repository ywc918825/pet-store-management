<template>
  <div class="login-page">
    <div class="login-box">
      <div class="logo">
        <el-icon size="48" color="#409eff"><Shop /></el-icon>
        <h1>宠物店管理系统</h1>
      </div>
      <el-form :model="form" :rules="rules" ref="formRef" label-position="top" @keyup.enter="handleLogin">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="请输入用户名" size="large" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="请输入密码" size="large" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" size="large" style="width: 100%" :loading="loading" @click="handleLogin">登录</el-button>
        </el-form-item>
      </el-form>
      <div class="tips">默认管理员：admin / 123456</div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/store/modules/user'

const router = useRouter()
const userStore = useUserStore()
const formRef = ref()
const loading = ref(false)

const form = reactive({ username: 'admin', password: '123456' })
const rules = {
  username: [{ required: true, message: '请输入用户名' }],
  password: [{ required: true, message: '请输入密码' }]
}

const handleLogin = async () => {
  await formRef.value.validate()
  loading.value = true
  try {
    await userStore.loginAction(form)
    ElMessage.success('登录成功')
    router.push('/')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.login-page {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #e3f2fd 0%, #ffffff 100%);
}
.login-box {
  width: 420px;
  padding: 40px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}
.logo {
  text-align: center;
  margin-bottom: 32px;
}
.logo h1 {
  margin-top: 12px;
  font-size: 22px;
  color: #303133;
}
.tips {
  margin-top: 16px;
  text-align: center;
  color: #909399;
  font-size: 12px;
}
</style>
