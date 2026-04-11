<template>
  <v-app>
    <Toast/>
    <v-main>
      <router-view v-slot="{ Component, route }">
        <transition mode="out-in" name="md3">
          <component :is="Component" :key="route.path"/>
        </transition>
      </router-view>
    </v-main>
  </v-app>
</template>

<script setup>
import Toast from "primevue/toast";
// 主题初始化由 vuetify.js 的 getInitialTheme 完成，无需在布局中重复
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
