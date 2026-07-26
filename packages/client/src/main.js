import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import './styles/index.scss'
import { useUserStore } from './store/modules/user.js'

const app = createApp(App)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(createPinia())

// Button-level permission directive
app.directive('permission', {
  mounted(el, binding) {
    const userStore = useUserStore()
    if (!userStore.hasPermission(binding.value)) {
      el.parentNode?.removeChild(el)
    }
  }
})

app.use(router)
app.use(ElementPlus, { locale: zhCn })
app.mount('#app')
