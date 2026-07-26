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
        </div>
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
            <div>{{ item.itemName }}</div>
            <div class="item-sub">¥{{ item.price }} × {{ item.quantity }}</div>
          </div>
          <div class="cart-actions">
            <el-input-number v-model="item.quantity" :min="1" :max="99" size="small" />
            <el-button link type="danger" @click="cart.splice(idx, 1)">删除</el-button>
          </div>
        </div>
        <el-empty v-if="cart.length === 0" description="请选择服务项目或商品" />
      </div>
      <div class="cart-footer">
        <div class="member-select">
          <span>会员：</span>
          <el-select v-model="selectedMember" filterable remote :remote-method="searchMembers" :loading="memberLoading" clearable placeholder="搜索会员" style="width: 200px">
            <el-option v-for="m in memberOptions" :key="m.id" :label="`${m.name} ${m.phone}`" :value="m" />
          </el-select>
          <span v-if="selectedMember" class="balance-tip">余额：¥{{ selectedMember.balance }}</span>
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
            <el-option label="余额" value="balance" />
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
          <span>{{ item.itemName }}</span>
          <span>¥{{ (item.price * item.quantity).toFixed(2) }}</span>
        </div>
        <el-divider />
        <div class="receipt-line total">
          <span>合计</span>
          <span>¥{{ totalAmount }}</span>
        </div>
        <div class="receipt-line">
          <span>支付方式</span>
          <span>{{ paymentMethod }}</span>
        </div>
        <div class="receipt-line">
          <span>实收</span>
          <span>¥{{ receivedAmount.toFixed(2) }}</span>
        </div>
        <div class="receipt-line" v-if="changeAmount > 0">
          <span>找零</span>
          <span>¥{{ changeAmount.toFixed(2) }}</span>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="receiptVisible = false; resetCart()">完成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getServiceItems, createOrder } from '@/api/cashier'
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
const paymentMethod = ref('cash')
const receivedAmount = ref(0)
const receiptVisible = ref(false)
const lastOrder = reactive({ orderNo: '' })

const filteredItems = computed(() => {
  if (activeCategory.value === 'retail') return products.value
  return serviceItems.value.filter(i => i.category === activeCategory.value)
})

const totalAmount = computed(() => cart.value.reduce((sum, i) => sum + i.price * i.quantity, 0).toFixed(2))
const changeAmount = computed(() => Math.max(0, receivedAmount.value - Number(totalAmount.value)))

const loadItems = async () => {
  serviceItems.value = await getServiceItems()
  // For demo, products are empty until added in inventory
  products.value = []
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
  const existing = cart.value.find(i => i.itemId === item.id && i.itemType === (item.category === 'retail' ? 'product' : 'service'))
  if (existing) {
    existing.quantity += 1
  } else {
    cart.value.push({
      itemType: item.category === 'retail' ? 'product' : 'service',
      itemId: item.id,
      itemName: item.name,
      price: Number(item.price),
      cost: Number(item.cost || 0),
      quantity: 1
    })
  }
}

const checkout = async () => {
  if (paymentMethod.value === 'balance' && (!selectedMember.value || selectedMember.value.balance < Number(totalAmount.value))) {
    return ElMessage.warning('会员余额不足或未选择会员')
  }
  try {
    const res = await createOrder({
      memberId: selectedMember.value?.id,
      items: cart.value,
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
  await createOrder({ memberId: selectedMember.value?.id, items: cart.value, hang: true })
  ElMessage.success('挂单成功')
  resetCart()
}

const resetCart = () => {
  cart.value = []
  selectedMember.value = null
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
