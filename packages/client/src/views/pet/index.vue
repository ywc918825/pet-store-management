<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">宠物档案</span>
      <el-button type="primary" @click="openDialog()" v-permission="'pet:edit'">新增宠物</el-button>
    </div>
    <div class="search-form">
      <el-input v-model="search.keyword" placeholder="宠物名/品种/会员手机号" clearable style="width: 300px" @keyup.enter="loadData" />
      <el-button type="primary" style="margin-left: 12px" @click="loadData">查询</el-button>
    </div>
    <el-table :data="tableData" v-loading="loading" border>
      <el-table-column prop="name" label="宠物名" />
      <el-table-column prop="breed" label="品种" />
      <el-table-column prop="gender" label="性别">
        <template #default="{ row }">
          {{ row.gender === 1 ? '公' : row.gender === 2 ? '母' : '未知' }}
        </template>
      </el-table-column>
      <el-table-column prop="birthday" label="生日" />
      <el-table-column prop="weight" label="体重(kg)" />
      <el-table-column prop="member_name" label="主人" />
      <el-table-column prop="member_phone" label="主人手机" />
      <el-table-column label="操作" width="180">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
          <el-button link type="danger" @click="deletePet(row.id)" v-permission="'pet:edit'">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <div class="pagination">
      <el-pagination v-model:current-page="search.page" v-model:page-size="search.pageSize" :total="total" layout="prev, pager, next" @change="loadData" />
    </div>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑宠物' : '新增宠物'" width="560px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="主人会员">
          <el-select v-model="form.memberId" filterable remote :remote-method="searchMembers" :loading="memberLoading" placeholder="搜索会员手机号/姓名" style="width: 100%">
            <el-option v-for="m in memberOptions" :key="m.id" :label="`${m.name} ${m.phone}`" :value="m.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="宠物名">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="品种">
          <el-input v-model="form.breed" />
        </el-form-item>
        <el-form-item label="生日">
          <el-date-picker v-model="form.birthday" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="体重(kg)">
          <el-input-number v-model="form.weight" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="性别">
          <el-radio-group v-model="form.gender">
            <el-radio :label="0">未知</el-radio>
            <el-radio :label="1">公</el-radio>
            <el-radio :label="2">母</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="毛色">
          <el-input v-model="form.color" />
        </el-form-item>
        <el-form-item label="洗护备注">
          <el-input v-model="form.careNotes" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="savePet">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getPetList, createPet, updatePet, deletePet as apiDeletePet } from '@/api/pet'
import { getMemberList } from '@/api/member'

const loading = ref(false)
const tableData = ref([])
const total = ref(0)
const search = reactive({ keyword: '', page: 1, pageSize: 20 })
const dialogVisible = ref(false)
const form = reactive({ id: null, memberId: null, name: '', breed: '', birthday: '', weight: 0, gender: 0, color: '', careNotes: '', vaccineRecords: [] })
const memberOptions = ref([])
const memberLoading = ref(false)

const loadData = async () => {
  loading.value = true
  try {
    const res = await getPetList(search)
    tableData.value = res.list
    total.value = res.total
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

const openDialog = (row = null) => {
  if (row) {
    Object.assign(form, { ...row, memberId: row.member_id, careNotes: row.care_notes, vaccineRecords: row.vaccine_records })
    memberOptions.value = [{ id: row.member_id, name: row.member_name, phone: row.member_phone }]
  } else {
    Object.assign(form, { id: null, memberId: null, name: '', breed: '', birthday: '', weight: 0, gender: 0, color: '', careNotes: '', vaccineRecords: [] })
    memberOptions.value = []
  }
  dialogVisible.value = true
}

const savePet = async () => {
  if (!form.memberId || !form.name) return ElMessage.warning('请选择主人并填写宠物名')
  const payload = { ...form, memberId: form.memberId }
  if (form.id) {
    await updatePet(form.id, payload)
  } else {
    await createPet(payload)
  }
  ElMessage.success('保存成功')
  dialogVisible.value = false
  loadData()
}

const deletePet = async (id) => {
  await ElMessageBox.confirm('确定删除该宠物档案？', '提示', { type: 'warning' })
  await apiDeletePet(id)
  ElMessage.success('删除成功')
  loadData()
}

onMounted(loadData)
</script>
