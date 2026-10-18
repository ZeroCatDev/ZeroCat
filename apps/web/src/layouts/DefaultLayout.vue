<template>
  <v-app>
    <Toast/>
    <AppHeader @toggle-drawer="drawer = !drawer" />

    <!-- 统一侧边栏 - 使用 Vuetify 原生 temporary 模式 -->
    <v-navigation-drawer
      v-model="drawer"
      temporary
      :width="280"
    >
      <UnifiedSidebar mode="vuetify" />
    </v-navigation-drawer>

    <v-main>
      <v-alert v-if="localuser.readonly || localuser.user.value?.restrictions?.length" class="ma-4" type="warning" variant="tonal" role="status">
        当前账号的部分或全部功能处于只读状态，受限范围内暂时无法发布、修改内容或互动。仍可读取内容及维护账号安全。
      </v-alert>
      <router-view v-slot="{ Component, route }">
        <transition mode="out-in" name="md3">
          <div :key="route.path">
            <component
              :is="use404(route) ? error404 : Component"
            />
          </div>
        </transition>
      </router-view>
    </v-main>
  </v-app>
</template>

<script setup>
import { ref } from "vue";
import { localuser } from '@/services/localAccount';
import AppHeader from "@/components/AppHeader.vue";
import UnifiedSidebar from "@/components/sidebar/UnifiedSidebar.vue";
import Toast from "primevue/toast";
import error404 from "@/components/error/404.vue";
import { use404 } from "@/composables/use404";

// 抽屉状态 - 默认关闭，不缓存
const drawer = ref(false);

// 主题管理 — 初始化由 vuetify.js 的 getInitialTheme 完成，此处无需重复
// watch 仅用于响应用户手动切换（来自 AppHeader/Sidebar 的 toggleTheme）
</script>

<style>
.md3-enter-active,
.md3-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.md3-enter-from,
.md3-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
