/**
 * router/index.ts
 *
 * Automatic routes for `./src/pages/*.vue`
 */

// Composables
import {createRouter, createWebHistory} from 'vue-router'
import {setupLayouts} from 'virtual:generated-layouts'
import {routes} from 'vue-router/auto-routes'
import {use404Helper} from '../composables/use404'
import {requiresAuth} from '@/services/authRoutes'
import {useAuthStore} from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: setupLayouts(routes),
})

// Workaround for https://github.com/vitejs/vite/issues/11804
router.onError((err, to) => {
  const isChunkError =
    err?.message?.includes?.('Failed to fetch dynamically imported module') ||
    err?.message?.includes?.('Failed to load') ||
    err?.message?.includes?.('Loading chunk') ||
    err?.message?.includes?.('Loading CSS chunk');

  if (isChunkError) {
    if (!localStorage.getItem('vuetify:dynamic-reload')) {
      console.log('Reloading page to fix dynamic import error')
      localStorage.setItem('vuetify:dynamic-reload', 'true')
      location.assign(to.fullPath)
    } else {
      console.error('Dynamic import error, reloading page did not fix it', err)
    }
  } else {
    console.error(err)
  }
})

router.isReady().then(() => {
  localStorage.removeItem('vuetify:dynamic-reload')
})

// 添加路由错误处理和认证守卫
router.beforeEach((to, from, next) => {
  // 如果路由不存在
  if (!to.matched.length) {
    use404Helper.show404();
    next(false);
    return;
  }
  // 如果是正常路由，确保重置404状态
  use404Helper.reset404();

  // 认证检查
  if (requiresAuth(to.path)) {
    const authStore = useAuthStore();
    if (!authStore.isLogin) {
      // 存储重定向目标
      authStore.setAuthRedirectUrl(to.fullPath);
      const returnUrl = encodeURIComponent(to.fullPath);
      next(`/app/account/login?redirect=${returnUrl}`);
      return;
    }
  }

  next();
});

export default router
