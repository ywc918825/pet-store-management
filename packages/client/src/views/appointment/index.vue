<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">预约管理</span>
      <el-button type="primary" @click="openDialog()" v-permission="'appointment:edit'">新增预约</el-button>
    </div>
    <div class="search-form">
      <el-date-picker v-model="search.date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" />
      <el-select v-model="search.status" clearable placeholder="状态" style="width: 140px; margin-left: 12px">
        <el-option label="已预约" value="booked" />
        <el-option label="已到店" value="arrived" />
        <el-option label="服务中" value="serving" />
        <el-option label="已完成" value="completed" />
        <el-option label="已取消" value="cancelled" />
      </el-select>
      <el-button type="primary" style="margin-left: 12px" @click="loadData">查询</el-button>
    </div>
    <el-table :data="tableData" v-loading="loading" border>
      <el-table-column prop="appointment_time" label="预约时间" />
      <el-table-column prop="member_name" label="会员" />
      <el-table-column prop="member_phone" label="手机号" />
      <el-table-column prop="pet_name" label="宠物" />
      <el-table-column prop="service_name" label="服务项目" />
      <el-table-column prop="status" label="状态">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
          <el-button link type="primary" @click="updateStatus(row.id, 'arrived')" v-if="row.status === 'booked'" v-permission="'appointment:edit'">到店</el-button>
          <el-button link type="primary" @click="updateStatus(row.id, 'serving')" v-if="row.status === 'arrived'" v-permission="'appointment:edit'">开始服务</el-button>
          <el-button link type="success" @click="updateStatus(row.id, 'completed')" v-if="row.status === 'serving'" v-permission="'appointment:edit'">完成</el-button>
          <el-button link type="danger" @click="updateStatus(row.id, 'cancelled')" v-if="['booked','arrived'].includes(row.status)" v-permission="'appointment:edit'">取消</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑预约' : '新增预约'" width="520px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="会员">
          <el-select v-model="form.memberId" filterable remote :remote-method="searchMembers" :loading="memberLoading" placeholder="搜索会员" style="width: 100%">
            <el-option v-for="m in memberOptions" :key="m.id" :label="`${m.name} ${m.phone}`" :value="m.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="宠物">
          <el-select v-model="form.petId" placeholder="选择宠物" style="width: 100%">
            <el-option v-for="p in petOptions" :key="p.id" :label="`${p.name}（${p.breed}）`" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="服务项目">
          <el-select v-model="form.serviceItemId" placeholder="选择服务" style="width: 100%">
            <el-option v-for="s in serviceItems" :key="s.id" :label="`${s.name} ¥${s.price}`" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="预约时间">
          <el-date-picker v-model="form.appointmentTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveAppointment">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getAppointmentList, createAppointment, updateAppointment, updateAppointmentStatus } from '@/api/appointment'
import { getMemberList } from '@/api/member'
import { getPetList } from '@/api/pet'
import { getServiceItems } from '@/api/cashier'

const loading = ref(false)
const tableData = ref([])
const search = reactive({ date: '', status: '', page: 1, pageSize: 50 })
const dialogVisible = ref(false)
const form = reactive({ id: null, memberId: null, petId: null, serviceItemId: null, appointmentTime: '', remark: '' })
const memberOptions = ref([])
const petOptions = ref([])
const serviceItems = ref([])
const memberLoading = ref(false)

const statusMap = { booked: '已预约', arrived: '已到店', serving: '服务中', completed: '已完成', cancelled: '已取消' }
const statusType = (s) => ({ booked: 'primary', arrived: 'warning', serving: '', completed: 'success', cancelled: 'info' }[s])
const statusText = (s) => statusMap[s] || s

const loadData = async () => {
  loading.value = true
  try {
    const res = await getAppointmentList(search)
    tableData.value = res.list
  } finally {
    loading.value = false
  }
}

const searchMembers = async (keyword) => {
  if (!keyword) return
  memberLoading.value = true
  try {
    const res = await getMemberList({ keyword, page: 1, pageSize: 20 })
    memberOptions.value = res.list
  } finally {
    memberLoading.value = false
  }
}

watch(() => form.memberId, async (id) => {
  if (!id) { petOptions.value = []; return }
  const res = await getPetList({ memberId: id, pageSize: 100 })
  petOptions.value = res.list
})

const openDialog = (row = null) => {
  if (row) {
    Object.assign(form, { id: row.id, memberId: row.member_id, petId: row.pet_id, serviceItemId: row.service_item_id, appointmentTime: row.appointment_time, remark: row.remark })
    memberOptions.value = [{ id: row.member_id, name: row.member_name, phone: row.member_phone }]
  } else {
    Object.assign(form, { id: null, memberId: null, petId: null, serviceItemId: null, appointmentTime: '', remark: '' })
    memberOptions.value = []
    petOptions.value = []
  }
  dialogVisible.value = true
}

const saveAppointment = async () => {
  if (!form.memberId || !form.appointmentTime) return ElMessage.warning('请填写会员和预约时间')
  if (form.id) await updateAppointment(form.id, form)
  else await createAppointment(form)
  ElMessage.success('保存成功')
  dialogVisible.value = false
  loadData()
}

const updateStatus = async (id, status) => {
  await updateAppointmentStatus(id, { status })
  ElMessage.success('状态更新成功')
  loadData()
}

onMounted(async () => {
  serviceItems.value = await getServiceItems()
  loadData()
})
</script>
