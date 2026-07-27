<template>
  <div class="invoice-page">
    <div class="no-print toolbar">
      <el-button @click="goBack">返回</el-button>
      <el-button type="primary" @click="printInvoice">
        <el-icon><Printer /></el-icon> 打印发票
      </el-button>
    </div>

    <div v-loading="loading" class="invoice-sheet">
      <template v-if="invoice">
        <div class="invoice-header">
          <h1>{{ shop.name }}</h1>
          <div class="sub-title">消费发票 / 销售凭证</div>
          <div v-if="shop.address || shop.phone" class="shop-meta">
            <span v-if="shop.address">地址:{{ shop.address }}</span>
            <span v-if="shop.phone">电话:{{ shop.phone }}</span>
          </div>
        </div>

        <div class="invoice-info">
          <div><span>订单号:</span>{{ invoice.order_no }}</div>
          <div><span>日期:</span>{{ invoice.created_at }}</div>
          <div><span>会员:</span>{{ invoice.member_name || '散客' }}</div>
          <div><span>收银员:</span>{{ cashierName }}</div>
        </div>

        <table class="invoice-table">
          <thead>
            <tr>
              <th>项目</th>
              <th>类型</th>
              <th>单价</th>
              <th>数量</th>
              <th>金额</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(it, idx) in invoice.items" :key="idx">
              <td>{{ it.item_name }}</td>
              <td>{{ itemTypeName(it.item_type) }}</td>
              <td>¥{{ money(it.price) }}</td>
              <td>{{ it.quantity }}</td>
              <td>¥{{ money(it.amount) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4" class="t-right">合计</td>
              <td>¥{{ money(invoice.total_amount) }}</td>
            </tr>
            <tr v-if="Number(invoice.discount_amount) > 0">
              <td colspan="4" class="t-right">优惠</td>
              <td>-¥{{ money(invoice.discount_amount) }}</td>
            </tr>
            <tr class="grand">
              <td colspan="4" class="t-right">应收</td>
              <td>¥{{ money(invoice.payable_amount) }}</td>
            </tr>
            <tr>
              <td colspan="4" class="t-right">实收 ({{ payLabel(invoice.payment_method) }})</td>
              <td>¥{{ money(invoice.received_amount) }}</td>
            </tr>
            <tr v-if="Number(invoice.change_amount) > 0">
              <td colspan="4" class="t-right">找零</td>
              <td>¥{{ money(invoice.change_amount) }}</td>
            </tr>
          </tfoot>
        </table>

        <div v-if="invoice.remark" class="invoice-remark">备注:{{ invoice.remark }}</div>

        <div class="invoice-footer">
          <div>谢谢惠顾,欢迎再次光临!</div>
          <div class="stamp">发票专用章</div>
        </div>
      </template>
      <el-empty v-else-if="!loading" description="未找到该订单" />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getInvoice } from '@/api/cashier'
import { request } from '@/utils/request'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const invoice = ref(null)
const shop = reactive({ name: '宠物生活馆', address: '', phone: '' })

const money = (n) => Number(n || 0).toFixed(2)
const payLabel = (m) => ({ cash: '现金', wechat: '微信', alipay: '支付宝', balance: '余额' }[m] || m || '现金')
const itemTypeName = (t) => ({ service: '服务', product: '商品', custom: '自定义' }[t] || t)

const cashierName = ref('')
const goBack = () => router.back()
const printInvoice = () => window.print()

onMounted(async () => {
  try {
    const [inv, settings] = await Promise.all([
      getInvoice(route.params.orderNo),
      request.get('/settings').catch(() => null)
    ])
    invoice.value = inv
    if (settings) {
      if (settings.shop_name) shop.name = settings.shop_name
      if (settings.shop_address) shop.address = settings.shop_address
      if (settings.shop_phone) shop.phone = settings.shop_phone
    }
    const staff = inv.items && inv.items.find(i => i.staff_name)
    cashierName.value = staff ? staff.staff_name : ''
  } catch (e) {
    ElMessage.error(e.message || '加载发票失败')
  } finally {
    loading.value = false
  }
})
</script>

<style scoped lang="scss">
.invoice-page {
  background: #f5f5f5;
  min-height: 100vh;
  padding: 16px;
}
.toolbar {
  max-width: 800px;
  margin: 0 auto 12px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
.invoice-sheet {
  max-width: 800px;
  margin: 0 auto;
  background: #fff;
  padding: 40px 48px;
  min-height: 1000px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}
.invoice-header {
  text-align: center;
  border-bottom: 2px solid #333;
  padding-bottom: 16px;
  h1 { font-size: 26px; margin: 0 0 8px; }
  .sub-title { font-size: 15px; color: #666; letter-spacing: 2px; }
  .shop-meta {
    margin-top: 8px;
    font-size: 12px;
    color: #999;
    display: flex;
    justify-content: center;
    gap: 24px;
  }
}
.invoice-info {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px 24px;
  margin: 20px 0;
  font-size: 14px;
  span { color: #999; margin-right: 6px; }
}
.invoice-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  th, td {
    border: 1px solid #ddd;
    padding: 10px 12px;
    text-align: left;
  }
  th { background: #fafafa; }
  tfoot td { font-weight: 600; }
  .t-right { text-align: right; }
  tr.grand td { font-size: 16px; color: #f56c6c; }
}
.invoice-remark {
  margin-top: 16px;
  font-size: 13px;
  color: #666;
}
.invoice-footer {
  margin-top: 40px;
  text-align: center;
  color: #999;
  font-size: 13px;
  .stamp {
    display: inline-block;
    margin-top: 24px;
    padding: 8px 20px;
    border: 2px solid #c0392b;
    border-radius: 8px;
    color: #c0392b;
    font-weight: 700;
    transform: rotate(-8deg);
    opacity: 0.7;
  }
}

@media print {
  .invoice-page { background: #fff; padding: 0; }
  .no-print { display: none !important; }
  .invoice-sheet { box-shadow: none; max-width: 100%; padding: 0; min-height: auto; }
}
</style>
