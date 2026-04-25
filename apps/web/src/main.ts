import { createApp } from "vue";
import { createPinia } from "pinia";
import naive from "naive-ui";
import App from "./App.vue";
import router from "./router";

// 导入全局样式
import "./styles/variables.css";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(naive);

// 挂载应用（认证初始化由路由守卫统一管理）
app.mount("#app");
