<template>
  <component :is="currentLayout">
    <router-view/>
  </component>

  <!-- 全局Snackbar -->
  <GlobalSnackbar />
  <!-- Sudo认证管理组件 -->
  <SudoManager ref="sudoManager" />
  <!-- 通知提醒Snackbar -->
  <NotificationReminderSnackbar />

  <!-- PWA提示组件 -->
  <PWAPrompts />

  <!-- 通知推送账户检查组件 -->
  <NotificationAccountChecker />

  <!-- 全局删除确认对话框 -->
  <DeleteConfirmDialog />

  <!-- 全局登录对话框 -->
  <LoginDialog />

  <!-- 底部悬浮发帖栏 -->
  <FloatingPostBar />

  <!-- 全局发帖对话框 -->
  <PostDialog />
</template>

<script setup>
import {computed, defineAsyncComponent} from "vue";
import {useRoute, useRouter} from "vue-router";
import {useHead} from "@unhead/vue";

// 同步加载：全局随时可能触发
import GlobalSnackbar from "@/components/GlobalSnackbar.vue";

// 异步加载：非首屏必需的组件
const SudoManager = defineAsyncComponent(() =>
  import('@/components/auth/SudoManager.vue')
);
const NotificationReminderSnackbar = defineAsyncComponent(() =>
  import('@/components/shared/NotificationReminderSnackbar.vue')
);
const PWAPrompts = defineAsyncComponent(() =>
  import('@/components/PWAPrompts.vue')
);
const NotificationAccountChecker = defineAsyncComponent(() =>
  import('@/components/NotificationAccountChecker.vue')
);
const DeleteConfirmDialog = defineAsyncComponent(() =>
  import('@/components/shared/DeleteConfirmDialog.vue')
);
const LoginDialog = defineAsyncComponent(() =>
  import('@/components/account/LoginDialog.vue')
);
const FloatingPostBar = defineAsyncComponent(() =>
  import('@/components/posts/FloatingPostBar.vue')
);
const PostDialog = defineAsyncComponent(() =>
  import('@/components/posts/PostDialog.vue')
);

// 布局组件必须同步加载，否则路由切换时没有容器渲染导致白屏
import DefaultLayout from "@/layouts/DefaultLayout.vue";
import SimpleLayout from "@/layouts/SimpleLayout.vue";

const route = useRoute();
const router = useRouter();

// 可用布局映射
const layouts = {
  default: DefaultLayout,
  simple: SimpleLayout,
};

// 根据路由元数据确定使用哪个布局
const currentLayout = computed(() => {
  const layoutName = route.meta.layout || "default";
  return layouts[layoutName] || DefaultLayout;
});

// SEO 和 Meta 标签配置
useHead({
  titleTemplate: (title) => (!title ? "ZeroCat社区" : `${title} - ZeroCat社区`),
  htmlAttrs: {
    lang: "zh-CN",
  },
  meta: [
    {
      name: "description",
      content: "ZeroCat是新一代开源编程社区！",
    },
    {
      name: "keywords",
      content: "scratch编程,scratch社区,python编程,python社区,在线编程,编程社区,开源,自托管,开源编程社区,代码,阿尔法营,有道小图灵,别针社区,clipcc,蝾螈池,zerocat",
    },
    {property: "og:title", content: "ZeroCat社区"},
    {property: "og:description", content: "ZeroCat是新一代开源编程社区！"},
    {property: "og:image", content: "https://zerocat.houlangs.com/og.png"},
    {property: "og:url", content: "https://zerocat.houlangs.com"},
    {name: "twitter:card", content: "summary_large_image"},
    {name: "twitter:title", content: "ZeroCat社区"},
    {name: "twitter:description", content: "ZeroCat是新一代开源编程社区！"},
    {name: "twitter:image", content: "https://zerocat.houlangs.com/og.png"},
    {name: "twitter:url", content: "https://zerocat.houlangs.com"},
    {name: "viewport", content: "width=device-width, initial-scale=1.0"},
    {name: "mobile-web-app-capable", content: "yes"},
    {name: "apple-mobile-web-app-status-bar-style", content: "black"},
    {name: "apple-mobile-web-app-title", content: "ZeroCat社区"},
    {name: "msapplication-TileColor", content: "#da532c"},
  ],
});
</script>
