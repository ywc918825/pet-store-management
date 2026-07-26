<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">数据报表</span>
      <div>
        <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" />
        <el-button type="primary" style="margin-left: 12px" @click="loadData">查询</el-button>
      </div>
    </div>
    <div class="stat-cards">
      <div class="stat-card">
        <div class="stat-label">营业额</div>
        <div class="stat-value">¥{{ summary.revenue }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">订单数</div>
        <div class="stat-value">{{ summary.orderCount }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">会员数</div>
        <div class="stat-value">{{ summary.memberCount }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">宠物数</div>
        <div class="stat-value">{{ summary.petCount }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">库存预警</div>
        <div class="stat-value" :class="{ warn: summary.lowStock > 0 }">{{ summary.lowStock }}</div>
      </div>
    </div>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="12">
        <div class="chart-card">
          <h4>日营业额趋势</h4>
          <div v-for="item in dailyRevenue" :key="item.date" class="chart-row">
            <span>{{ item.date }}</span>
            <span>¥{{ item.revenue }}（{{ item.order_count }}单）</span>
          </div>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="chart-card">
          <h4>会员消费排行</h4>
          <div v-for="(item, idx) in memberRanking" :key="idx" class="chart-row">
            <span>{{ idx + 1 }}. {{ item.name }}</span>
            <span>¥{{ item.total_amount }}</span>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="12">
        <div class="chart-card">
          <h4>项目销量</h4>
          <div v-for="item in itemSales" :key="item.item_name" class="chart-row">
            <span>{{ item.item_name }}</span>
            <span>{{ item.qty }} / ¥{{ item.amount }}</span>
          </div>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="chart-card">
          <h4>利润核算</h4>
          <div class="chart-row">
            <span>营收</span>
            <span>¥{{ profit.revenue }}</span>
          </div>
          <div class="chart-row">
            <span>成本</span>
            <span>¥{{ profit.cost }}</span>
          </div>
          <div class="chart-row total">
            <span>利润</span>
            <span>¥{{ profit.profit }}</span>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import dayjs from 'dayjs'
import { getDashboardSummary, getDailyRevenue, getMemberRanking, getItemSales, getProfit } from '@/api/dashboard'

const dateRange = ref([dayjs().subtract(6, 'day').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')])
const summary = reactive({ revenue: 0, orderCount: 0, memberCount: 0, petCount: 0, lowStock: 0 })
const dailyRevenue = ref([])
const memberRanking = ref([])
const itemSales = ref([])
const profit = reactive({ revenue: 0, cost: 0, profit: 0 })

const loadData = async () => {
  const [startDate, endDate] = dateRange.value || []
  const params = { startDate, endDate }
  const s = await getDashboardSummary(params)
  Object.assign(summary, s)
  dailyRevenue.value = await getDailyRevenue(params)
  memberRanking.value = await getMemberRanking(params)
  itemSales.value = await getItemSales(params)
  Object.assign(profit, await getProfit(params))
}

onMounted(loadData)
</script>

<style scoped lang="scss">
.stat-cards {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
}
.stat-card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}
.stat-label {
  color: #909399;
  font-size: 14px;
  margin-bottom: 8px;
}
.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
}
.stat-value.warn {
  color: #f56c6c;
}
.chart-card {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  min-height: 200px;
}
.chart-card h4 {
  margin-bottom: 12px;
  color: #303133;
}
.chart-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #f0f2f5;
}
.chart-row.total {
  font-weight: 700;
  color: #409eff;
}
</style>
