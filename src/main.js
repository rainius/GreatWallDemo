import { createApp } from 'vue'
import App from './App.vue'
import { library } from '@fortawesome/fontawesome-svg-core'
import { faArrowLeft, faLocationDot } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

library.add(faArrowLeft, faLocationDot)

const app = createApp(App)

// 注册全局组件 (Vue 3 方式)
app.component('font-awesome-icon', FontAwesomeIcon)

// 挂载应用
app.mount('#app')