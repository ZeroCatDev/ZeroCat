<route lang="yaml">
meta:
  layout: simple
</route>

<template>
  <div class="oauth-error-page">
    <header class="oauth-topbar">
      <div class="oauth-topbar__brand">
        <span class="oauth-topbar__logo">Z</span>
        <span class="oauth-topbar__name">ZeroCat</span>
      </div>
      <span class="oauth-topbar__hint">授权错误</span>
    </header>

    <main class="oauth-main">
      <section class="oauth-panel">
        <div class="oauth-panel__icon">
          <v-icon color="error" icon="mdi-alert-circle-outline" size="40" />
        </div>
        <h1 class="oauth-title">{{ errorCode }}</h1>
        <p class="oauth-desc">{{ errorDescription }}</p>

        <div class="oauth-actions">
          <v-btn
            block
            color="primary"
            size="large"
            variant="flat"
            @click="goHome"
          >
            返回首页
          </v-btn>
        </div>

        <v-expansion-panels class="mt-4" variant="accordion">
          <v-expansion-panel>
            <v-expansion-panel-title class="text-body-2">
              技术细节
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <div class="detail-row">
                <span>错误代码</span>
                <code>{{ error }}</code>
              </div>
              <div class="detail-row">
                <span>描述</span>
                <code>{{ error_description }}</code>
              </div>
              <div v-if="state" class="detail-row">
                <span>state</span>
                <code>{{ state }}</code>
              </div>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const error = route.query.error || 'unknown_error'
const error_description = route.query.error_description || '发生未知错误'
const state = route.query.state

const errorCodeMap = {
  access_denied: '访问被拒绝',
  invalid_request: '无效的请求',
  unauthorized_client: '未授权的客户端',
  unsupported_response_type: '不支持的响应类型',
  invalid_scope: '无效的权限范围',
  server_error: '服务器错误',
  temporarily_unavailable: '服务暂时不可用',
  unknown_error: '未知错误'
}

const errorCode = computed(() => errorCodeMap[error] || errorCodeMap.unknown_error)

const errorDescription = computed(() => {
  return error_description || '抱歉，授权过程中发生错误。请稍后重试或联系管理员。'
})

const goHome = () => {
  router.push('/')
}
</script>

<style scoped>
.oauth-error-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-background));
}

.oauth-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 16px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgb(var(--v-theme-surface));
}

.oauth-topbar__brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.oauth-topbar__logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-size: 0.9rem;
  font-weight: 700;
}

.oauth-topbar__name {
  font-size: 0.95rem;
  font-weight: 600;
}

.oauth-topbar__hint {
  color: rgba(var(--v-theme-on-surface), 0.55);
  font-size: 0.8125rem;
}

.oauth-main {
  flex: 1;
  width: 100%;
  max-width: 440px;
  margin: 0 auto;
  padding: 24px 16px 40px;
}

.oauth-panel {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 12px;
  background: rgb(var(--v-theme-surface));
  padding: 28px 20px 20px;
  text-align: center;
}

.oauth-panel__icon {
  margin-bottom: 12px;
}

.oauth-title {
  margin: 0 0 8px;
  font-size: 1.25rem;
  font-weight: 600;
}

.oauth-desc {
  margin: 0 0 20px;
  color: rgba(var(--v-theme-on-surface), 0.68);
  font-size: 0.9rem;
  line-height: 1.5;
  word-break: break-word;
}

.oauth-actions {
  max-width: 280px;
  margin: 0 auto;
}

.detail-row {
  display: grid;
  gap: 4px;
  margin-bottom: 12px;
  text-align: left;
  font-size: 0.8125rem;
}

.detail-row span {
  color: rgba(var(--v-theme-on-surface), 0.55);
}

.detail-row code {
  display: block;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.05);
  word-break: break-all;
  white-space: pre-wrap;
}
</style>
