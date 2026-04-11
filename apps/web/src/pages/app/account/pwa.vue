<template>
  <v-container>
    <div class="pwa-settings-page">
      <!-- 页面标题 -->
      <div class="page-header mb-6">
        <v-row align="center">
          <v-col>
            <h1 class="text-h4 font-weight-bold">PWA设置</h1>
            <p class="text-subtitle-1 text-grey mt-2">
              管理渐进式Web应用设置和缓存
            </p>
          </v-col>
        </v-row>
      </div>

      <!-- PWA设置组件 -->
      <PWASettings />
    </div>
  </v-container>
</template>

<script setup>
import PWASettings from '@/components/PWASettings.vue'

// 页面元数据
useHead({
  title: 'PWA设置'
})
</script>

<style scoped>
.pwa-settings-page {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  text-align: center;
}

@media (max-width: 768px) {
  .page-header {
    text-align: left;
  }
}
</style>