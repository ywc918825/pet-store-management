<template>
  <div class="admin-login">
    <el-card class="login-card">
      <div class="title">授权管理后台</div>
      <div class="subtitle">软件方运营入口 · 仅限授权管理员</div>
      <el-form :model="form" :rules="rules" ref="formRef" label-width="80px" @submit.prevent>
        <el-form-item label="账号" prop="username">
          <el-input v-model="form.username" placeholder="管理员账号" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" show-password placeholder="管理员密码" @keyup.enter="handleLogin" />
        </el-form-item>
        <el-button type="primary" :loading="loading" class="full" @click="handleLogin">登录</el-button>
      </el-form>
      <div class="back">
        <el-link type="primary" @click="goMerchant">返回商家端登录</el-link>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { adminLogin, ADMIN_TOKEN_KEY } from '@/api/admin'

const router = useRouter()
const loading = ref(false)
const formRef = ref()
const form = reactive({ username: '', password: '' })
const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const handleLogin = async () => {
  await formRef.value.validate()
  loading.value = true
  try {
    const res = await adminLogin(form)
    localStorage.setItem(ADMIN_TOKEN_KEY, res.token)
    ElMessage.success('登录成功')
    router.push('/admin/license')
  } finally {
    loading.value = false
  }
}

const goMerchant = () => {
  router.push('/login')
}
</script>

<style scoped lang="scss">
.admin-login {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #001529;
}
.login-card {
  width: 380px;
  padding: 12px 8px;
}
.title {
  font-size: 20px;
  font-weight: 600;
  text-align: center;
}
.subtitle {
  font-size: 13px;
  color: #909399;
  text-align: center;
  margin: 6px 0 18px;
}
.full {
  width: 100%;
}
.back {
  text-align: center;
  margin-top: 12px;
}
</style>
