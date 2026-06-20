<template>
  <v-container class="oauth-authorize py-8" fluid>
    <v-row justify="center">
      <v-col cols="12" lg="5" md="7" xl="4">
        <v-alert
          v-if="error"
          class="mb-4"
          closable
          type="error"
          variant="tonal"
          @click:close="error = null"
        >
          {{ error }}
        </v-alert>

        <div v-if="loading && !application" class="loading-state">
          <v-progress-circular color="primary" indeterminate size="42" />
          <div class="text-body-2 text-medium-emphasis mt-3">正在加载授权请求</div>
        </div>

        <v-card v-else-if="application" class="auth-shell" elevation="0">
          <v-card-text class="auth-content">
            <div class="brand-row mb-7">
              <v-avatar
                class="app-avatar"
                :image="application.logo_url || '/default-app-logo.png'"
                rounded="lg"
                size="56"
              >
                <v-icon icon="mdi-application-brackets-outline" size="30" />
              </v-avatar>
              <v-icon class="brand-arrow" icon="mdi-arrow-right" size="22" />
              <v-avatar class="zc-avatar" rounded="lg" size="56">
                Z
              </v-avatar>
            </div>

            <h1 class="auth-title">
              {{ application.name }} 想访问你的 ZeroCat 账号
            </h1>

            <div class="account-select mt-5">
              <v-select
                v-model="selectedEmail"
                density="comfortable"
                :disabled="emails.length === 0"
                hide-details="auto"
                item-title="email"
                item-value="email"
                :items="emails"
                label="账号"
                variant="outlined"
              >
                <template #item="{ props, item }">
                  <v-list-item v-bind="props">
                    <template #append>
                      <v-chip v-if="item.raw.primary" color="primary" label size="x-small">
                        主邮箱
                      </v-chip>
                    </template>
                  </v-list-item>
                </template>
              </v-select>
            </div>

            <v-divider class="my-6" />

            <div class="text-subtitle-1 font-weight-bold mb-2">
              此应用将可以：
            </div>

            <v-list class="permission-list" density="comfortable" lines="two">
              <v-list-item
                v-for="item in requestedScopeItems"
                :key="item.name"
                class="permission-item"
              >
                <template #prepend>
                  <v-icon
                    :color="isSensitiveScope(item) ? 'error' : 'medium-emphasis'"
                    :icon="item.icon"
                    size="22"
                  />
                </template>

                <v-list-item-title class="permission-title">
                  {{ item.title }}
                  <span v-if="isSensitiveScope(item)" class="sensitive-mark">
                    敏感
                  </span>
                </v-list-item-title>
                <v-list-item-subtitle>
                  {{ item.description }}
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>

            <v-divider class="my-6" />

            <div class="meta-list">
              <div v-if="application.homepage_url" class="meta-row">
                <span>应用主页</span>
                <a :href="application.homepage_url" target="_blank">
                  {{ application.homepage_url }}
                </a>
              </div>
              <div class="meta-row">
                <span>授权后跳转</span>
                <strong>{{ redirectHost }}</strong>
              </div>
            </div>
          </v-card-text>

          <v-card-actions class="auth-actions">
            <v-btn
              color="primary"
              size="large"
              variant="text"
              @click="cancel"
            >
              取消
            </v-btn>
            <v-spacer />
            <v-btn
              color="primary"
              :disabled="!canAuthorize"
              :loading="loading"
              size="large"
              variant="flat"
              @click="authorize"
            >
              继续
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import axios from '@/axios/axios'
  import { getScopeCatalog } from '@/services/tokenService'

  const route = useRoute()
  const router = useRouter()

  const application = ref(null)
  const loading = ref(false)
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
      const parsed = new URL(redirectUri)
      return `${parsed.host}${parsed.pathname}`
    } catch {
      return redirectUri || '未提供'
    }
  })

  const canAuthorize = computed(() => {
    return Boolean(selectedEmail.value && requestedScopeItems.value.length > 0)
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

  async function loadApplication () {
    if (!validateParams()) return

    loading.value = true
    try {
      const response = await axios.get(`/oauth/applications/${clientId}`)
      application.value = response.data

      if (!requestedScopeParam.value) {
        requestedScopeParam.value = Array.isArray(response.data?.scopes)
          ? response.data.scopes.join(' ')
          : 'user:read'
      }

      if (
        Array.isArray(application.value.redirect_uris) &&
        !application.value.redirect_uris.includes(redirectUri)
      ) {
        error.value = '无效的回调地址'
        application.value = null
      }
    } catch (error_) {
      error.value = '无法加载应用信息'
      console.error('Failed to load application:', error_)
    } finally {
      loading.value = false
    }
  }

  async function loadEmails () {
    try {
      const response = await axios.get('/oauth/user/emails')
      emails.value = response.data.map((email) => ({
        email: email.contact_value,
        primary: email.is_primary
      }))
      if (emails.value.length > 0) {
        const primaryEmail = emails.value.find((email) => email.primary)
        selectedEmail.value = primaryEmail ? primaryEmail.email : emails.value[0].email
      }
    } catch (error_) {
      console.error('Failed to load emails:', error_)
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

    loading.value = true
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
      }
    } catch (error_) {
      error.value = error_.response?.data?.error_description || error_.response?.data?.error || '授权失败，请重试'
      console.error('Authorization failed:', error_)
    } finally {
      loading.value = false
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

  onMounted(async () => {
    await Promise.all([
      loadApplication(),
      loadEmails(),
      loadScopeCatalog()
    ])
  })
</script>

<style scoped>
.oauth-authorize {
  min-height: 100vh;
  background: rgb(var(--v-theme-background));
}

.loading-state {
  min-height: 420px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.auth-shell {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  overflow: hidden;
  background: rgb(var(--v-theme-surface));
}

.auth-content {
  padding: 40px 40px 24px;
}

.brand-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
}

.app-avatar,
.zc-avatar {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgb(var(--v-theme-surface));
}

.zc-avatar {
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
}

.brand-arrow {
  color: rgba(var(--v-theme-on-surface), 0.62);
}

.auth-title {
  max-width: 420px;
  margin: 0 auto;
  font-size: 1.75rem;
  font-weight: 500;
  line-height: 1.25;
  text-align: center;
  letter-spacing: 0;
}

.account-select {
  max-width: 420px;
  margin-right: auto;
  margin-left: auto;
}

.permission-list {
  padding: 0;
  background: transparent;
}

.permission-item {
  padding-inline: 0;
}

.permission-title {
  white-space: normal;
}

.sensitive-mark {
  margin-left: 8px;
  color: rgb(var(--v-theme-error));
  font-size: 0.78rem;
  font-weight: 700;
}

.meta-list {
  display: grid;
  gap: 10px;
  font-size: 0.875rem;
}

.meta-row {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  gap: 12px;
}

.meta-row span {
  color: rgba(var(--v-theme-on-surface), 0.62);
}

.meta-row a,
.meta-row strong {
  min-width: 0;
  overflow-wrap: anywhere;
  font-weight: 500;
}

.auth-actions {
  padding: 16px 32px 28px;
}

@media (max-width: 600px) {
  .auth-content {
    padding: 28px 22px 16px;
  }

  .auth-title {
    font-size: 1.45rem;
  }

  .auth-actions {
    padding: 12px 18px 22px;
  }

  .auth-actions .v-btn {
    width: 100%;
  }
}
</style>
