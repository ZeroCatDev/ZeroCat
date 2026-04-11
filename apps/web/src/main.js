/**
 * main.js
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Plugins
import {registerPlugins} from "@/plugins";
import ToastService from "primevue/toastservice";
import PrimeVue from "primevue/config";
import Aura from "@primevue/themes/aura";

import { createHead  } from "@unhead/vue/client";

// Components
import App from "./App.vue";

// Composables
import {createApp} from "vue";

import './styles/settings.scss'

import router from "./router";

// Directives
import { UserHoverDirectivePlugin } from "@/directives/userHoverDirective";

const app = createApp(App);

const head = createHead();
app.use(head);

app.use(PrimeVue, {
  theme: {
    preset: Aura,
  },
});
app.use(ToastService);

// 注册用户悬停卡片全局指令
app.use(UserHoverDirectivePlugin);

// 使用 Vercel Speed Insights 观测网站性能
// import { injectSpeedInsights } from "@vercel/speed-insights";
// injectSpeedInsights();
// 使用 Vercel Analytics 收集数据
// import { inject } from "@vercel/analytics";
// inject();

registerPlugins(app);
app.mount("#app");

// 挂载后异步初始化 Sentry（非开发环境）
if (!import.meta.env.DEV) {
  import('@sentry/vue').then((Sentry) => {
    Sentry.init({
      app,
      dsn: import.meta.env.VITE_SENTRY_DSN || "https://2250927423fac4b5e6633d4fdffdd1a3@report.houlang.cloud/5",
      sendDefaultPii: true,
      integrations: [
        Sentry.browserTracingIntegration({ router }),
        Sentry.replayIntegration()
      ],
      tracesSampleRate: 0.1,
      tracePropagationTargets: [
        "localhost",
        /^https:\/\/zerocat\.dev\//,
        /^https:\/\/zerocat\.houlangs\.com\//,
        /^https:\/\/zerocat\.houlang\.cloud\//
      ],
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      enableLogs: true
    });
  });
}

// 如果是开发环境，异步启用 Vue DevTools
if (import.meta.env.DEV) {
  import('@vue/devtools').then(({ devtools }) => {
    devtools.init();
  });
}
