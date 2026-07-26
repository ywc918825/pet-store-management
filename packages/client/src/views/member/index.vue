<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">会员管理</span>
      <el-button type="primary" @click="openDialog()" v-permission="'member:edit'">新增会员</el-button>
    </div>
    <div class="search-form">
      <el-input v-model="search.keyword" placeholder="手机号/姓名" clearable style="width: 260px" @keyup.enter="loadData" />
      <el-button type="primary" style="margin-left: 12px" @click="loadData">查询</el-button>
    </div>
    <el-table :data="tableData" v-loading="loading" border>
      <el-table-column prop="name" label="姓名" />
      <el-table-column prop="phone" label="手机号" />
      <el-table-column prop="level" label="会员等级" />
      <el-table-column prop="balance" label="储值余额" />
      <el-table-column prop="points" label="积分" />
      <el-table-column prop="total_consumption" label="累计消费" />
      <el-table-column label="操作" width="220">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
          <el-button link type="primary" @click="openRecharge(row)" v-permission="'member:recharge'">储值</el-button>
          <el-button link type="primary" @click="viewPets(row)">宠物</el-button>
        </template>
      </el-table-column>
    </el-table>
    <div class="pagination">
      <el-pagination v-model:current-page="search.page" v-model:page-size="search.pageSize" :total="total" layout="prev, pager, next" @change="loadData" />
    </div>

    <!-- Member form dialog -->
    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑会员' : '新增会员'" width="500px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="姓名">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="form.phone" />
        </el-form-item>
        <el-form-item label="性别">
          <el-radio-group v-model="form.gender">
            <el-radio :label="0">未知</el-radio>
            <el-radio :label="1">男</el-radio>
            <el-radio :label="2">女</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="生日">
          <el-date-picker v-model="form.birthday" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="会员等级">
          <el-input v-model="form.level" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveMember">保存</el-button>
      </template>
    </el-dialog>

    <!-- Recharge dialog -->
    <el-dialog v-model="rechargeVisible" title="会员储值" width="400px">
      <p>会员：{{ currentMember.name }}（余额：{{ currentMember.balance }}）</p>
      <el-form :model="rechargeForm" label-width="80px" style="margin-top: 16px">
        <el-form-item label="充值金额">
          <el-input-number v-model="rechargeForm.amount" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="支付方式">
          <el-select v-model="rechargeForm.paymentMethod" style="width: 100%">
            <el-option label="现金" value="现金" />
            <el-option label="微信" value="微信" />
            <el-option label="支付宝" value="支付宝" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="rechargeForm.remark" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rechargeVisible = false">取消</el-button>
        <el-button type="primary" @click="doRecharge">确认充值</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getMemberList, createMember, updateMember, rechargeMember } from '@/api/member'

const loading = ref(false)
const tableData = ref([])
const total = ref(0)
const search = reactive({ keyword: '', page: 1, pageSize: 20 })
const dialogVisible = ref(false)
const form = reactive({ id: null, name: '', phone: '', gender: 0, birthday: '', level: '普通会员' })
const rechargeVisible = ref(false)
const currentMember = reactive({ id: null, name: '', balance: 0 })
const rechargeForm = reactive({ amount: 100, paymentMethod: '现金', remark: '' })

const loadData = async () => {
  loading.value = true
  try {
    const res = await getMemberList(search)
    tableData.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

const openDialog = (row = null) => {
  if (row) {
    Object.assign(form, row)
  } else {
    Object.assign(form, { id: null, name: '', phone: '', gender: 0, birthday: '', level: '普通会员' })
  }
  dialogVisible.value = true
}

const saveMember = async () => {
  if (!form.name || !form.phone) return ElMessage.warning('请填写姓名和手机号')
  if (form.id) {
    await updateMember(form.id, form)
  } else {
    await createMember(form)
  }
  ElMessage.success('保存成功')
  dialogVisible.value = false
  loadData()
}

const openRecharge = (row) => {
  Object.assign(currentMember, row)
  rechargeForm.amount = 100
  rechargeForm.paymentMethod = '现金'
  rechargeForm.remark = ''
  rechargeVisible.value = true
}

const doRecharge = async () => {
  await rechargeMember(currentMember.id, rechargeForm)
  ElMessage.success('充值成功')
  rechargeVisible.value = false
  loadData()
}

const viewPets = (row) => {
  // Could open a drawer with pets; here simply navigate to pet page with filter
  ElMessage.info(`会员 ${row.name} 有宠物档案，请切换到宠物档案页查看`)
}

onMounted(loadData)
</script>
