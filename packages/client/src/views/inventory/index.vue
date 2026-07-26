<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">库存管理</span>
      <el-button type="primary" @click="openProductDialog()" v-permission="'inventory:edit'">新增商品</el-button>
    </div>
    <div class="search-form">
      <el-input v-model="search.keyword" placeholder="商品名/编码" clearable style="width: 260px" @keyup.enter="loadData" />
      <el-button type="primary" style="margin-left: 12px" @click="loadData">查询</el-button>
    </div>
    <el-table :data="tableData" v-loading="loading" border>
      <el-table-column prop="code" label="商品编码" />
      <el-table-column prop="name" label="商品名称" />
      <el-table-column prop="category" label="分类" />
      <el-table-column prop="stock" label="库存">
        <template #default="{ row }">
          <span :class="{ 'low-stock': row.stock <= row.min_stock }">{{ row.stock }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="purchase_price" label="进货价" />
      <el-table-column prop="sale_price" label="销售价" />
      <el-table-column prop="supplier_name" label="供应商" />
      <el-table-column label="操作" width="220">
        <template #default="{ row }">
          <el-button link type="primary" @click="openProductDialog(row)">编辑</el-button>
          <el-button link type="primary" @click="openStockDialog(row, 'in')" v-permission="'inventory:edit'">入库</el-button>
          <el-button link type="primary" @click="openStockDialog(row, 'out')" v-permission="'inventory:edit'">出库</el-button>
        </template>
      </el-table-column>
    </el-table>
    <div class="pagination">
      <el-pagination v-model:current-page="search.page" v-model:page-size="search.pageSize" :total="total" layout="prev, pager, next" @change="loadData" />
    </div>

    <el-dialog v-model="productVisible" :title="productForm.id ? '编辑商品' : '新增商品'" width="500px">
      <el-form :model="productForm" label-width="90px">
        <el-form-item label="商品编码">
          <el-input v-model="productForm.code" :disabled="!!productForm.id" />
        </el-form-item>
        <el-form-item label="商品名称">
          <el-input v-model="productForm.name" />
        </el-form-item>
        <el-form-item label="分类">
          <el-input v-model="productForm.category" />
        </el-form-item>
        <el-form-item label="单位">
          <el-input v-model="productForm.unit" />
        </el-form-item>
        <el-form-item label="进货价">
          <el-input-number v-model="productForm.purchasePrice" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="销售价">
          <el-input-number v-model="productForm.salePrice" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="库存预警">
          <el-input-number v-model="productForm.minStock" :min="0" />
        </el-form-item>
        <el-form-item label="供应商">
          <el-select v-model="productForm.supplierId" clearable style="width: 100%">
            <el-option v-for="s in suppliers" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="productVisible = false">取消</el-button>
        <el-button type="primary" @click="saveProduct">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="stockVisible" :title="stockType === 'in' ? '入库' : '出库'" width="400px">
      <p>商品：{{ currentProduct.name }}，当前库存：{{ currentProduct.stock }}</p>
      <el-form :model="stockForm" label-width="80px" style="margin-top: 16px">
        <el-form-item :label="stockType === 'in' ? '入库数量' : '出库数量'">
          <el-input-number v-model="stockForm.quantity" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="stockForm.remark" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="stockVisible = false">取消</el-button>
        <el-button type="primary" @click="doStock">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getProducts, createProduct, updateProduct, stockIn, stockOut, getSuppliers } from '@/api/inventory'

const loading = ref(false)
const tableData = ref([])
const total = ref(0)
const search = reactive({ keyword: '', page: 1, pageSize: 20 })
const productVisible = ref(false)
const productForm = reactive({ id: null, code: '', name: '', category: '', unit: '', purchasePrice: 0, salePrice: 0, stock: 0, minStock: 0, supplierId: null })
const suppliers = ref([])
const stockVisible = ref(false)
const stockType = ref('in')
const currentProduct = reactive({ id: null, name: '', stock: 0 })
const stockForm = reactive({ quantity: 1, remark: '' })

const loadData = async () => {
  loading.value = true
  try {
    const res = await getProducts(search)
    tableData.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

const openProductDialog = (row = null) => {
  if (row) {
    Object.assign(productForm, { ...row, purchasePrice: row.purchase_price, salePrice: row.sale_price, minStock: row.min_stock, supplierId: row.supplier_id })
  } else {
    Object.assign(productForm, { id: null, code: '', name: '', category: '', unit: '', purchasePrice: 0, salePrice: 0, stock: 0, minStock: 0, supplierId: null })
  }
  productVisible.value = true
}

const saveProduct = async () => {
  if (!productForm.name) return ElMessage.warning('请填写商品名称')
  if (productForm.id) await updateProduct(productForm.id, productForm)
  else await createProduct(productForm)
  ElMessage.success('保存成功')
  productVisible.value = false
  loadData()
}

const openStockDialog = (row, type) => {
  stockType.value = type
  Object.assign(currentProduct, { id: row.id, name: row.name, stock: row.stock })
  stockForm.quantity = 1
  stockForm.remark = ''
  stockVisible.value = true
}

const doStock = async () => {
  if (stockType.value === 'in') await stockIn(currentProduct.id, stockForm)
  else await stockOut(currentProduct.id, stockForm)
  ElMessage.success('操作成功')
  stockVisible.value = false
  loadData()
}

onMounted(async () => {
  suppliers.value = await getSuppliers()
  loadData()
})
</script>

<style scoped>
.low-stock {
  color: #f56c6c;
  font-weight: 700;
}
</style>
