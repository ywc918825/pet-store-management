<template>
  <div class="cashier-page">
    <div class="cashier-left">
      <div class="service-tabs">
        <el-radio-group v-model="activeCategory" size="large">
          <el-radio-button label="wash">洗护</el-radio-button>
          <el-radio-button label="groom">美容</el-radio-button>
          <el-radio-button label="foster">寄养</el-radio-button>
          <el-radio-button label="retail">零售</el-radio-button>
        </el-radio-group>
      </div>
      <div class="item-grid">
        <div v-for="item in filteredItems" :key="item.id" class="item-card" @click="addToCart(item)">
          <div class="item-name">{{ item.name }}</div>
          <div class="item-price">¥{{ item.price }}</div>
          <div v-if="activeCategory === 'retail'" class="item-stock">库存: {{ item.stock || 0 }}</div>
        </div>
      </div>
      <div class="custom-add">
        <el-button type="primary" plain size="large" @click="openCustomDialog" style="width:100%">
          <el-icon><Plus /></el-icon> 自定义品项
        </el-button>
      </div>
    </div>
    <div class="cashier-right">
      <div class="cart-header">
        <span>购物车</span>
        <el-button link type="danger" @click="cart = []">清空</el-button>
      </div>
      <div class="cart-list">
        <div v-for="(item, idx) in cart" :key="idx" class="cart-item">
          <div>
            <div>
              {{ item.itemName }}
              <el-tag v-if="item._custom" size="small" type="warning" style="margin-left:4px">自定义</el-tag>
            </div>
            <div class="item-sub">¥{{ item.price }} × {{ item.quantity }}</div>
          </div>
          <div class="cart-actions">
            <el-input-number v-model="item.quantity" :min="1" :max="99" size="small" />
            <el-button link type="danger" @click="cart.splice(idx, 1)">删除</el-button>
          </div>
        </div>
        <el-empty v-if="cart.length === 0" description="点击品项或「自定义品项」添加" />
      </div>
      <div class="cart-footer">
        <div class="member-select">
          <el-checkbox v-model="walkInCustomer" @change="onWalkInChange">
            散客(非会员)
          </el-checkbox>
          <span v-if="!walkInCustomer" style="margin-left:4px">会员：</span>
          <el-select
            v-if="!walkInCustomer"
            v-model="selectedMember"
            filterable remote
            :remote-method="searchMembers"
            :loading="memberLoading"
            clearable
            placeholder="搜索会员(姓名/电话)"
            style="width: 200px"
          >
            <el-option v-for="m in memberOptions" :key="m.id" :label="`${m.name} ${m.phone}`" :value="m" />
          </el-select>
          <el-tag v-else type="info" size="small">未登记顾客</el-tag>
          <span v-if="selectedMember && !walkInCustomer" class="balance-tip">余额：¥{{ selectedMember.balance }}</span>
        </div>
        <div class="total-row">
          <span>合计：</span>
          <span class="total-price">¥{{ totalAmount }}</span>
        </div>
        <div class="pay-row">
          <el-select v-model="paymentMethod" placeholder="支付方式" style="width: 140px">
            <el-option label="现金" value="cash" />
            <el-option label="微信" value="wechat" />
            <el-option label="支付宝" value="alipay" />
            <el-option v-if="!walkInCustomer && selectedMember" label="余额" value="balance" />
          </el-select>
          <el-input-number v-model="receivedAmount" :min="0" :precision="2" placeholder="实收金额" style="width: 140px; margin-left: 8px" />
          <span v-if="changeAmount > 0" class="change-tip">找零：¥{{ changeAmount.toFixed(2) }}</span>
        </div>
        <div class="action-row">
          <el-button size="large" @click="hangOrder" :disabled="cart.length === 0">挂单</el-button>
          <el-button size="large" type="primary" @click="checkout" :disabled="cart.length === 0 || !licenseStore.canOperateCore">结算</el-button>
        </div>
      </div>
    </div>

    <!-- Receipt dialog -->
    <el-dialog v-model="receiptVisible" title="收银小票" width="360px" align-center>
      <div class="receipt">
        <h3>宠物店收银小票</h3>
        <p>订单号：{{ lastOrder.orderNo }}</p>
        <p>时间：{{ new Date().toLocaleString() }}</p>
        <el-divider />
        <div v-for="(item, idx) in cart" :key="idx" class="receipt-line">
          <span>{{ item.itemName }}{{ item._custom ? ' (自定义)' : '' }}</span>
          <span>¥{{ (item.price * item.quantity).toFixed(2) }}</span>
        </div>
        <el-divider />
        <div class="receipt-line total">
          <span>合计</span>
          <span>¥{{ totalAmount }}</span>
        </div>
        <div class="receipt-line">
          <span>支付方式</span>
          <span>{{ payLabel(paymentMethod) }}</span>
        </div>
        <div class="receipt-line">
          <span>实收</span>
          <span>¥{{ receivedAmount.toFixed(2) }}</span>
        </div>
        <div class="receipt-line" v-if="changeAmount > 0">
          <span>找零</span>
          <span>¥{{ changeAmount.toFixed(2) }}</span>
        </div>
        <div class="receipt-line" v-if="walkInCustomer">
          <span>顾客</span>
          <span>散客</span>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="receiptVisible = false; resetCart()">完成</el-button>
      </template>
    </el-dialog>

    <!-- Custom item dialog -->
    <el-dialog v-model="customItemVisible" title="自定义品项" width="400px" align-center>
      <el-form :model="customForm" label-width="80px">
        <el-form-item label="类别">
          <el-select v-model="customForm.category" style="width:100%">
            <el-option label="洗护" value="wash" />
            <el-option label="美容" value="groom" />
            <el-option label="寄养" value="foster" />
            <el-option label="零售" value="retail" />
          </el-select>
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="customForm.name" placeholder="如：剪指甲、清理耳道、狗粮500g" />
        </el-form-item>
        <el-form-item label="单价(¥)">
          <el-input-number v-model="customForm.price" :min="0.01" :precision="2" style="width:100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="customItemVisible = false">取消</el-button>
        <el-button type="primary" @click="addCustomItem">加入购物车</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getServiceItems, getShopProducts, createOrder } from '@/api/cashier'
import { getMemberList } from '@/api/member'
import { useLicenseStore } from '@/store/modules/license'

const licenseStore = useLicenseStore()
const activeCategory = ref('wash')
const serviceItems = ref([])
const products = ref([])
const cart = ref([])
const selectedMember = ref(null)
const memberOptions = ref([])
const memberLoading = ref(false)
const walkInCustomer = ref(false)
const paymentMethod = ref('cash')
const receivedAmount = ref(0)
const receiptVisible = ref(false)
const lastOrder = reactive({ orderNo: '' })

// --- Custom item dialog ---
const customItemVisible = ref(false)
const customForm = reactive({ category: 'wash', name: '', price: 0 })

const payLabel = (m) => ({ cash: '现金', wechat: '微信', alipay: '支付宝', balance: '余额' }[m] || m)

const filteredItems = computed(() => {
  if (activeCategory.value === 'retail') return products.value
  return serviceItems.value.filter(i => i.category === activeCategory.value)
})

const totalAmount = computed(() => cart.value.reduce((sum, i) => sum + i.price * i.quantity, 0).toFixed(2))
const changeAmount = computed(() => Math.max(0, receivedAmount.value - Number(totalAmount.value)))

// When walk-in toggles, clear member and reset payment if balance
const onWalkInChange = (val) => {
  if (val) {
    selectedMember.value = null
    if (paymentMethod.value === 'balance') paymentMethod.value = 'cash'
  }
}

// When member is selected, uncheck walk-in
watch(selectedMember, (val) => {
  if (val) walkInCustomer.value = false
})

const loadItems = async () => {
  const [services, prods] = await Promise.all([
    getServiceItems(),
    getShopProducts()
  ])
  serviceItems.value = services
  products.value = prods.map(p => ({
    ...p,
    category: 'retail',
    price: Number(p.price),
    stock: Number(p.stock || 0)
  }))
}

const openCustomDialog = () => {
  customForm.category = activeCategory.value
  customForm.name = ''
  customForm.price = 0
  customItemVisible.value = true
}

const addCustomItem = () => {
  if (!customForm.name.trim()) return ElMessage.warning('请输入品项名称')
  if (!customForm.price || customForm.price <= 0) return ElMessage.warning('请输入有效单价')
  cart.value.push({
    itemType: 'custom',
    itemId: null,
    itemName: customForm.name.trim(),
    price: Number(customForm.price),
    cost: 0,
    quantity: 1,
    _custom: true
  })
  customItemVisible.value = false
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

const addToCart = (item) => {
  const itemType = item.category === 'retail' ? 'product' : 'service'
  const existing = cart.value.find(i => i.itemId === item.id && i.itemType === itemType)
  if (existing) {
    existing.quantity += 1
  } else {
    cart.value.push({
      itemType,
      itemId: item.id,
      itemName: item.name,
      price: Number(item.price),
      cost: Number(item.cost || 0),
      quantity: 1,
      _custom: false
    })
  }
}

const checkout = async () => {
  if (paymentMethod.value === 'balance' && (!selectedMember.value || selectedMember.value.balance < Number(totalAmount.value))) {
    return ElMessage.warning('会员余额不足或未选择会员')
  }
  try {
    const res = await createOrder({
      memberId: walkInCustomer.value ? null : selectedMember.value?.id,
      items: cart.value.map(({ _custom, ...rest }) => rest),
      paymentMethod: paymentMethod.value,
      receivedAmount: receivedAmount.value
    })
    lastOrder.orderNo = res.orderNo
    receiptVisible.value = true
  } catch (e) {
    ElMessage.error(e.message || '结算失败')
  }
}

const hangOrder = async () => {
  await createOrder({
    memberId: walkInCustomer.value ? null : selectedMember.value?.id,
    items: cart.value.map(({ _custom, ...rest }) => rest),
    hang: true
  })
  ElMessage.success('挂单成功')
  resetCart()
}

const resetCart = () => {
  cart.value = []
  selectedMember.value = null
  walkInCustomer.value = false
  paymentMethod.value = 'cash'
  receivedAmount.value = 0
}

onMounted(loadItems)
</script>

<style scoped lang="scss">
.cashier-page {
  display: flex;
  gap: 16px;
  height: calc(100vh - 92px);
}
.cashier-left {
  flex: 1;
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  overflow: auto;
}
.service-tabs {
  margin-bottom: 16px;
}
.item-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}
.item-card {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}
.item-card:hover {
  border-color: #409eff;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15);
}
.item-name {
  font-weight: 600;
  margin-bottom: 8px;
}
.item-price {
  color: #f56c6c;
  font-size: 16px;
}
.item-stock {
  color: #909399;
  font-size: 11px;
  margin-top: 4px;
}
.custom-add {
  margin-top: 16px;
}
.cashier-right {
  width: 420px;
  background: #fff;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
}
.cart-header {
  padding: 16px;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  justify-content: space-between;
  font-weight: 600;
}
.cart-list {
  flex: 1;
  padding: 16px;
  overflow: auto;
}
.cart-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f0f2f5;
}
.item-sub {
  color: #909399;
  font-size: 12px;
  margin-top: 4px;
}
.cart-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cart-footer {
  padding: 16px;
  border-top: 1px solid #e4e7ed;
}
.member-select {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.balance-tip {
  color: #67c23a;
  font-size: 12px;
}
.total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.total-price {
  font-size: 28px;
  color: #f56c6c;
  font-weight: 700;
}
.pay-row {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
}
.change-tip {
  margin-left: 12px;
  color: #67c23a;
}
.action-row {
  display: flex;
  gap: 12px;
}
.action-row .el-button {
  flex: 1;
}
.receipt {
  text-align: center;
}
.receipt-line {
  display: flex;
  justify-content: space-between;
  margin: 8px 0;
}
.receipt-line.total {
  font-weight: 700;
  font-size: 16px;
}
</style>
