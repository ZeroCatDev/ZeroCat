<route lang="yaml">
meta:
  layout: simple
</route>

<template>
  <div class="oauth-page">
    <header class="oauth-topbar">
      <div class="oauth-topbar__brand">
        <span class="oauth-topbar__logo">Z</span>
        <span class="oauth-topbar__name">ZeroCat</span>
      </div>
      <span class="oauth-topbar__hint">授权请求</span>
    </header>

    <main class="oauth-main">
      <v-alert
        v-if="error"
        class="oauth-alert"
        closable
        density="comfortable"
        type="error"
        variant="tonal"
        @click:close="error = null"
      >
        {{ error }}
      </v-alert>

      <!-- 加载 / 自动授权 -->
      <section v-if="showBusyState" class="oauth-panel oauth-panel--center">
        <v-progress-circular color="primary" indeterminate size="40" width="3" />
        <p class="oauth-busy-title">
          {{ autoAuthorizing ? '正在自动授权' : '正在加载授权请求' }}
        </p>
        <p v-if="autoAuthorizing && application" class="oauth-busy-sub">
          {{ application.name }} · 即将跳转
        </p>
      </section>

      <!-- 授权卡片 -->
      <section v-else-if="application" class="oauth-panel">
        <div class="oauth-app">
          <v-avatar
            class="oauth-app__avatar"
            :image="application.logo_url || undefined"
            rounded="lg"
            size="48"
          >
            <v-icon icon="mdi-application-brackets-outline" size="26" />
          </v-avatar>
          <div class="oauth-app__meta">
            <div class="oauth-app__name">
              {{ application.name }}
              <v-chip
                v-if="application.is_verified"
                class="ml-1"
                color="success"
                label
                size="x-small"
                variant="tonal"
              >
                已验证
              </v-chip>
            </div>
            <div class="oauth-app__desc">
              请求访问你的 ZeroCat 账号
            </div>
          </div>
        </div>

        <div class="oauth-field">
          <label class="oauth-label">授权账号</label>
          <v-select
            v-model="selectedEmail"
            density="comfortable"
            :disabled="emails.length === 0 || authorizing"
            hide-details="auto"
            item-title="email"
            item-value="email"
            :items="emails"
            placeholder="选择邮箱"
            variant="outlined"
          >
            <template #item="{ props: itemProps, item }">
              <v-list-item v-bind="itemProps">
                <template #append>
                  <v-chip v-if="item.raw.primary" color="primary" label size="x-small">
                    主邮箱
                  </v-chip>
                </template>
              </v-list-item>
            </template>
          </v-select>
          <p v-if="emails.length === 0" class="oauth-hint oauth-hint--warn">
            需要已验证邮箱才能授权。请先在账户设置中验证邮箱。
          </p>
        </div>

        <div class="oauth-field">
          <div class="oauth-label-row">
            <label class="oauth-label">将获得的权限</label>
            <span class="oauth-count">{{ requestedScopeItems.length }} 项</span>
          </div>
          <ul class="oauth-scope-list">
            <li
              v-for="item in requestedScopeItems"
              :key="item.name"
              class="oauth-scope-item"
            >
              <v-icon
                class="oauth-scope-item__icon"
                :color="isSensitiveScope(item) ? 'error' : undefined"
                :icon="item.icon"
                size="20"
              />
              <div class="oauth-scope-item__body">
                <div class="oauth-scope-item__title">
                  {{ item.title }}
                  <span v-if="isSensitiveScope(item)" class="oauth-sensitive">敏感</span>
                </div>
                <div class="oauth-scope-item__desc">{{ item.description }}</div>
              </div>
            </li>
          </ul>
        </div>

        <div class="oauth-meta">
          <div v-if="application.homepage_url" class="oauth-meta__row">
            <span>主页</span>
            <a :href="application.homepage_url" rel="noopener noreferrer" target="_blank">
              {{ application.homepage_url }}
            </a>
          </div>
          <div class="oauth-meta__row">
            <span>跳转至</span>
            <strong>{{ redirectHost }}</strong>
          </div>
        </div>

        <div class="oauth-actions">
          <v-btn
            class="oauth-actions__btn"
            :disabled="authorizing"
            size="large"
            variant="text"
            @click="cancel"
          >
            取消
          </v-btn>
          <v-btn
            class="oauth-actions__btn oauth-actions__btn--primary"
            color="primary"
            :disabled="!canAuthorize"
            :loading="authorizing"
            size="large"
            variant="flat"
            @click="authorize"
          >
            授权并继续
          </v-btn>
        </div>
      </section>

      <!-- 无法加载应用 -->
      <section v-else-if="!loading" class="oauth-panel oauth-panel--center">
        <v-icon color="error" icon="mdi-alert-circle-outline" size="40" />
        <p class="oauth-busy-title">无法完成授权</p>
        <p class="oauth-busy-sub">{{ error || '请检查链接参数后重试' }}</p>
        <v-btn class="mt-4" color="primary" variant="tonal" @click="goHome">
          返回首页
        </v-btn>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import axios from '@/axios/axios'
  import { getScopeCatalog } from '@/services/tokenService'
  import { useAuthStore } from '@/stores/auth'

  const route = useRoute()
  const router = useRouter()
  const authStore = useAuthStore()

  const application = ref(null)
  const loading = ref(true)
  const authorizing = ref(false)
  const autoAuthorizing = ref(false)
  const error = ref(null)
  const emails = ref([])
  const selectedEmail = ref(null)
  const scopeCatalog = ref([])

  const clientId = route.query.client_id
  const redirectUri = route.query.redirect_uri
  const requestedScopeParam = ref(route.query.scope ? String(route.query.scope) : '')
  const state = route.query.state
  const codeChallenge = route.query.code_challenge
  const codeChallengeMethod = route.query.code_challenge_method

  const scopeIconMap = {
    user: 'mdi-account-outline',
    project: 'mdi-folder-outline',
    asset: 'mdi-image-outline',
    post: 'mdi-post-outline',
    notification: 'mdi-bell-outline',
    token: 'mdi-key-outline',
    oauth_app: 'mdi-application-cog-outline',
    comment: 'mdi-comment-outline',
    follow: 'mdi-account-heart-outline',
    list: 'mdi-format-list-bulleted',
    blog: 'mdi-post-outline',
    cachekv: 'mdi-database-outline',
    git_sync: 'mdi-source-branch',
    extension: 'mdi-puzzle-outline',
    admin: 'mdi-shield-crown-outline'
  }

  const legacyScopeMap = {
    'user:basic': 'user:read',
    'user:email': 'user:read',
    profile: 'user:read'
  }

  const requestedScopeNames = computed(() => {
    return requestedScopeParam.value
      .split(/\s+/)
      .map((name) => legacyScopeMap[name] || name)
      .filter(Boolean)
      .filter((name, index, arr) => arr.indexOf(name) === index)
  })

  const requestedScopeItems = computed(() => {
    const catalogMap = new Map(scopeCatalog.value.map((item) => [item.name, item]))
    return requestedScopeNames.value.map((name) => {
      const item = catalogMap.get(name)
      if (item) {
        return {
          name,
          icon: scopeIconMap[item.resource] || 'mdi-shield-key-outline',
          title: item.title || name,
          description: item.description || name,
          risk_level: item.risk_level || 'medium'
        }
      }
      const resource = name.split(':')[0]
      return {
        name,
        icon: scopeIconMap[resource] || 'mdi-shield-key-outline',
        title: name,
        description: '应用请求的自定义权限',
        risk_level: 'medium'
      }
    })
  })

  const redirectHost = computed(() => {
    try {
      const parsed = new URL(String(redirectUri || ''))
      return `${parsed.host}${parsed.pathname}`
    } catch {
      return redirectUri || '未提供'
    }
  })

  const canAuthorize = computed(() => {
    return Boolean(selectedEmail.value && requestedScopeItems.value.length > 0 && !authorizing.value)
  })

  const showBusyState = computed(() => {
    return (loading.value && !application.value) || autoAuthorizing.value
  })

  function isSensitiveScope (item: { risk_level?: string } | null | undefined) {
    return item?.risk_level === 'high'
  }

  function validateParams () {
    if (!clientId) {
      error.value = '缺少必要的 client_id 参数'
      return false
    }
    if (!redirectUri) {
      error.value = '缺少必要的 redirect_uri 参数'
      return false
    }
    return true
  }

  function ensureLoggedIn () {
    if (authStore.isLogin) return true
    const returnUrl = route.fullPath
    authStore.setAuthRedirectUrl(returnUrl)
    router.replace({
      path: '/app/account/login',
      query: { redirect: returnUrl }
    })
    return false
  }

  async function loadApplication () {
    if (!validateParams()) return

    try {
      const response = await axios.get(`/oauth/applications/${clientId}`)
      application.value = response.data

      if (!requestedScopeParam.value) {
        requestedScopeParam.value = Array.isArray(response.data?.scopes)
          ? response.data.scopes.join(' ')
          : 'user:read'
      }

      // 仅当服务端返回了 redirect_uris（通常为所有者）时做本地校验
      if (
        Array.isArray(application.value.redirect_uris) &&
        application.value.redirect_uris.length > 0 &&
        !application.value.redirect_uris.includes(redirectUri)
      ) {
        error.value = '无效的回调地址'
        application.value = null
      }
    } catch (error_) {
      error.value = '无法加载应用信息'
      console.error('Failed to load application:', error_)
    }
  }

  async function loadEmails () {
    try {
      const response = await axios.get('/oauth/user/emails')
      emails.value = (response.data || []).map((email) => ({
        email: email.contact_value,
        primary: email.is_primary
      }))
      if (emails.value.length > 0) {
        const primaryEmail = emails.value.find((email) => email.primary)
        selectedEmail.value = primaryEmail ? primaryEmail.email : emails.value[0].email
      }
    } catch (error_) {
      const code = error_?.response?.data?.code
      if (code === 'ZC_ERROR_NEED_LOGIN' || error_?.response?.status === 401) {
        ensureLoggedIn()
        return
      }
      console.error('Failed to load emails:', error_)
      error.value = '无法加载账户邮箱'
    }
  }

  async function loadScopeCatalog () {
    try {
      const response = await getScopeCatalog()
      scopeCatalog.value = response.data?.data || []
    } catch (error_) {
      console.error('Failed to load scopes:', error_)
    }
  }

  async function authorize () {
    if (!canAuthorize.value) {
      error.value = '请选择授权邮箱和至少一项权限'
      return
    }

    authorizing.value = true
    error.value = null
    try {
      const response = await axios.post('/oauth/authorize/confirm', {
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: requestedScopeItems.value.map((item) => item.name).join(' '),
        state,
        authorized_email: selectedEmail.value,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod
      })

      if (response.data.redirect_url) {
        window.location.href = response.data.redirect_url
        return
      }
      error.value = '授权成功但未返回跳转地址'
    } catch (error_) {
      const code = error_?.response?.data?.code
      if (code === 'ZC_ERROR_NEED_LOGIN' || error_?.response?.status === 401) {
        ensureLoggedIn()
        return
      }
      error.value =
        error_.response?.data?.error_description ||
        error_.response?.data?.error ||
        error_.response?.data?.message ||
        '授权失败，请重试'
      console.error('Authorization failed:', error_)
    } finally {
      authorizing.value = false
      autoAuthorizing.value = false
    }
  }

  function cancel () {
    router.push({
      path: '/app/oauth/error',
      query: {
        error: 'access_denied',
        error_description: '用户拒绝了应用程序的访问请求',
        state: state || ''
      }
    })
  }

  function goHome () {
    router.push('/')
  }

  onMounted(async () => {
    if (!ensureLoggedIn()) {
      loading.value = false
      return
    }

    loading.value = true
    try {
      await Promise.all([
        loadApplication(),
        loadEmails(),
        loadScopeCatalog()
      ])

      // 管理员开启自动授权：页面打开后直接同意并跳转
      if (
        application.value?.auto_authorize &&
        selectedEmail.value &&
        requestedScopeItems.value.length > 0
      ) {
        autoAuthorizing.value = true
        await authorize()
      }
    } finally {
      loading.value = false
    }
  })
</script>

<style scoped>
.oauth-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-background));
  color: rgb(var(--v-theme-on-background));
}

.oauth-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 52px;
  padding: 0 16px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgb(var(--v-theme-surface));
}

.oauth-topbar__brand {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
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
  padding: 20px 16px 32px;
}

.oauth-alert {
  margin-bottom: 16px;
}

.oauth-panel {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 12px;
  background: rgb(var(--v-theme-surface));
  padding: 20px 18px 16px;
}

.oauth-panel--center {
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 8px;
}

.oauth-busy-title {
  margin: 12px 0 0;
  font-size: 1rem;
  font-weight: 600;
}

.oauth-busy-sub {
  margin: 0;
  color: rgba(var(--v-theme-on-surface), 0.62);
  font-size: 0.875rem;
}

.oauth-app {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.oauth-app__avatar {
  flex-shrink: 0;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgb(var(--v-theme-surface));
}

.oauth-app__meta {
  min-width: 0;
}

.oauth-app__name {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.3;
}

.oauth-app__desc {
  margin-top: 2px;
  color: rgba(var(--v-theme-on-surface), 0.62);
  font-size: 0.875rem;
}

.oauth-field {
  margin-bottom: 18px;
}

.oauth-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.oauth-label {
  display: block;
  margin-bottom: 8px;
  color: rgba(var(--v-theme-on-surface), 0.72);
  font-size: 0.8125rem;
  font-weight: 600;
}

.oauth-label-row .oauth-label {
  margin-bottom: 0;
}

.oauth-count {
  color: rgba(var(--v-theme-on-surface), 0.5);
  font-size: 0.75rem;
}

.oauth-hint {
  margin: 6px 0 0;
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), 0.55);
}

.oauth-hint--warn {
  color: rgb(var(--v-theme-warning));
}

.oauth-scope-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 10px;
  overflow: hidden;
}

.oauth-scope-item {
  display: flex;
  gap: 10px;
  padding: 12px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.oauth-scope-item:last-child {
  border-bottom: none;
}

.oauth-scope-item__icon {
  flex-shrink: 0;
  margin-top: 2px;
  opacity: 0.75;
}

.oauth-scope-item__body {
  min-width: 0;
}

.oauth-scope-item__title {
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.3;
}

.oauth-scope-item__desc {
  margin-top: 2px;
  color: rgba(var(--v-theme-on-surface), 0.58);
  font-size: 0.8rem;
  line-height: 1.35;
  word-break: break-word;
}

.oauth-sensitive {
  margin-left: 6px;
  color: rgb(var(--v-theme-error));
  font-size: 0.72rem;
  font-weight: 700;
}

.oauth-meta {
  display: grid;
  gap: 8px;
  margin-bottom: 8px;
  padding-top: 4px;
  font-size: 0.8125rem;
}

.oauth-meta__row {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}

.oauth-meta__row span {
  color: rgba(var(--v-theme-on-surface), 0.55);
}

.oauth-meta__row a,
.oauth-meta__row strong {
  min-width: 0;
  overflow-wrap: anywhere;
  font-weight: 500;
  word-break: break-all;
}

.oauth-actions {
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;
  margin-top: 18px;
  padding-top: 12px;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.oauth-actions__btn {
  width: 100%;
  min-height: 44px;
  text-transform: none;
  letter-spacing: 0;
}

@media (min-width: 600px) {
  .oauth-main {
    padding: 40px 16px 48px;
  }

  .oauth-panel {
    padding: 24px 24px 18px;
  }

  .oauth-actions {
    flex-direction: row;
    align-items: center;
    justify-content: flex-end;
  }

  .oauth-actions__btn {
    width: auto;
    min-width: 112px;
  }

  .oauth-actions__btn--primary {
    min-width: 140px;
  }
}
</style>
