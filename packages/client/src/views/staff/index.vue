<template>
  <div class="page-container">
    <el-tabs v-model="activeTab">
      <el-tab-pane label="员工账号" name="users">
        <div class="table-toolbar">
          <el-button type="primary" @click="openUserDialog()" v-permission="'staff:manage'">新增员工</el-button>
        </div>
        <el-table :data="users" v-loading="loading" border>
          <el-table-column prop="username" label="用户名" />
          <el-table-column prop="real_name" label="姓名" />
          <el-table-column prop="phone" label="手机" />
          <el-table-column prop="role_name" label="角色" />
          <el-table-column prop="status" label="状态">
            <template #default="{ row }">
              <el-tag :type="row.status === 1 ? 'success' : 'info'">{{ row.status === 1 ? '启用' : '禁用' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="180">
            <template #default="{ row }">
              <el-button link type="primary" @click="openUserDialog(row)">编辑</el-button>
              <el-button link type="danger" @click="deleteUser(row.id)" v-permission="'staff:manage'">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="角色权限" name="roles">
        <div class="table-toolbar">
          <el-button type="primary" @click="openRoleDialog()" v-permission="'staff:manage'">新增角色</el-button>
        </div>
        <el-table :data="roles" border>
          <el-table-column prop="name" label="角色名" />
          <el-table-column prop="code" label="编码" />
          <el-table-column label="权限">
            <template #default="{ row }">
              {{ (row.permissions || []).join(', ') }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="180">
            <template #default="{ row }">
              <el-button link type="primary" @click="openRoleDialog(row)">编辑</el-button>
              <el-button link type="danger" @click="deleteRole(row.id)" v-if="!row.is_system" v-permission="'staff:manage'">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="操作日志" name="logs">
        <el-table :data="logs" border>
          <el-table-column prop="created_at" label="时间" />
          <el-table-column prop="operator_name" label="操作人" />
          <el-table-column prop="action" label="操作" />
          <el-table-column prop="target_type" label="对象类型" />
          <el-table-column prop="target_id" label="对象ID" />
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="userVisible" :title="userForm.id ? '编辑员工' : '新增员工'" width="460px">
      <el-form :model="userForm" label-width="80px">
        <el-form-item label="用户名">
          <el-input v-model="userForm.username" :disabled="!!userForm.id" />
        </el-form-item>
        <el-form-item label="密码" v-if="!userForm.id">
          <el-input v-model="userForm.password" type="password" />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="userForm.realName" />
        </el-form-item>
        <el-form-item label="手机">
          <el-input v-model="userForm.phone" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="userForm.roleId" style="width: 100%">
            <el-option v-for="r in roles" :key="r.id" :label="r.name" :value="r.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="userForm.status" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="userVisible = false">取消</el-button>
        <el-button type="primary" @click="saveUser">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="roleVisible" :title="roleForm.id ? '编辑角色' : '新增角色'" width="500px">
      <el-form :model="roleForm" label-width="80px">
        <el-form-item label="角色名">
          <el-input v-model="roleForm.name" />
        </el-form-item>
        <el-form-item label="编码">
          <el-input v-model="roleForm.code" :disabled="!!roleForm.id" />
        </el-form-item>
        <el-form-item label="权限">
          <el-checkbox-group v-model="roleForm.permissions">
            <el-checkbox v-for="(label, code) in permissionMap" :key="code" :label="code">{{ label }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roleVisible = false">取消</el-button>
        <el-button type="primary" @click="saveRole">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getUsers, createUser, updateUser, deleteUser as apiDeleteUser, getRoles, createRole, updateRole, deleteRole as apiDeleteRole, getOperationLogs } from '@/api/staff'

const activeTab = ref('users')
const loading = ref(false)
const users = ref([])
const roles = ref([])
const logs = ref([])

const userVisible = ref(false)
const userForm = reactive({ id: null, username: '', password: '', realName: '', phone: '', roleId: null, status: 1 })
const roleVisible = ref(false)
const roleForm = reactive({ id: null, name: '', code: '', permissions: [] })

const permissionMap = {
  'member:view': '查看会员', 'member:edit': '编辑会员', 'member:recharge': '会员储值',
  'pet:view': '查看宠物', 'pet:edit': '编辑宠物',
  'cashier:operate': '开单收银', 'cashier:discount': '改价折扣', 'cashier:delete': '删单',
  'appointment:view': '查看预约', 'appointment:edit': '编辑预约',
  'inventory:view': '查看库存', 'inventory:edit': '编辑库存',
  'report:view': '查看报表', 'staff:manage': '员工权限', 'setting:manage': '系统设置'
}

const loadData = async () => {
  loading.value = true
  try {
    const [u, r, l] = await Promise.all([getUsers(), getRoles(), getOperationLogs()])
    users.value = u.list
    roles.value = r
    logs.value = l.list
  } finally {
    loading.value = false
  }
}

const openUserDialog = (row = null) => {
  if (row) Object.assign(userForm, { ...row, realName: row.real_name, roleId: row.role_id, status: row.status })
  else Object.assign(userForm, { id: null, username: '', password: '', realName: '', phone: '', roleId: null, status: 1 })
  userVisible.value = true
}

const saveUser = async () => {
  if (!userForm.username || (!userForm.id && !userForm.password) || !userForm.roleId) return ElMessage.warning('请填写完整信息')
  if (userForm.id) await updateUser(userForm.id, userForm)
  else await createUser(userForm)
  ElMessage.success('保存成功')
  userVisible.value = false
  loadData()
}

const deleteUser = async (id) => {
  await ElMessageBox.confirm('确定删除该员工？', '提示', { type: 'warning' })
  await apiDeleteUser(id)
  ElMessage.success('删除成功')
  loadData()
}

const openRoleDialog = (row = null) => {
  if (row) Object.assign(roleForm, { ...row, permissions: row.permissions || [] })
  else Object.assign(roleForm, { id: null, name: '', code: '', permissions: [] })
  roleVisible.value = true
}

const saveRole = async () => {
  if (!roleForm.name || !roleForm.code) return ElMessage.warning('请填写角色名和编码')
  if (roleForm.id) await updateRole(roleForm.id, roleForm)
  else await createRole(roleForm)
  ElMessage.success('保存成功')
  roleVisible.value = false
  loadData()
}

const deleteRole = async (id) => {
  await ElMessageBox.confirm('确定删除该角色？', '提示', { type: 'warning' })
  await apiDeleteRole(id)
  ElMessage.success('删除成功')
  loadData()
}

onMounted(loadData)
</script>
