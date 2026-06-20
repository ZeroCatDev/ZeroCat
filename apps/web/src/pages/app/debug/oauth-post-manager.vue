<template>
  <v-container class="py-6" fluid>
    <v-row>
      <v-col cols="12">
        <div class="d-flex align-center flex-wrap ga-3 mb-4">
          <div>
            <h1 class="text-h4 font-weight-bold mb-1">OAuth 贴文调试</h1>
            <div class="text-body-2 text-medium-emphasis">
              使用 OAuth access token 调试贴文读取、发布、互动和删除接口。
            </div>
          </div>
          <v-spacer />
          <v-chip
            :color="accessToken ? 'success' : 'warning'"
            label
            variant="tonal"
          >
            {{ accessToken ? '已获得 OAuth Token' : '未登录 OAuth' }}
          </v-chip>
        </div>
      </v-col>

      <v-col cols="12" lg="4">
        <v-card border class="mb-4">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" icon="mdi-application-key-outline" />
            OAuth 登录
          </v-card-title>
          <v-card-text>
            <v-alert class="mb-4" density="compact" type="info" variant="tonal">
              在 OAuth 应用后台把回调地址配置为当前页面地址，然后使用这里发起授权。
            </v-alert>

            <v-text-field
              v-model="oauthForm.clientId"
              class="mb-3"
              density="comfortable"
              label="Client ID"
              variant="outlined"
            />
            <v-text-field
              v-model="oauthForm.clientSecret"
              class="mb-3"
              density="comfortable"
              label="Client Secret"
              type="password"
              variant="outlined"
            />
            <v-text-field
              v-model="oauthForm.redirectUri"
              class="mb-3"
              density="comfortable"
              label="Redirect URI"
              variant="outlined"
            >
              <template #append-inner>
                <v-btn
                  icon="mdi-content-copy"
                  size="small"
                  variant="text"
                  @click="copyText(oauthForm.redirectUri)"
                />
              </template>
            </v-text-field>
            <v-textarea
              v-model="oauthForm.scope"
              auto-grow
              class="mb-3"
              density="comfortable"
              label="Scope"
              rows="3"
              variant="outlined"
            />

            <div class="d-flex flex-wrap ga-2">
              <v-btn
                color="primary"
                prepend-icon="mdi-login"
                @click="startOAuth"
              >
                OAuth 登录
              </v-btn>
              <v-btn
                :disabled="!refreshToken"
                :loading="authLoading"
                prepend-icon="mdi-refresh"
                variant="outlined"
                @click="refreshAccessToken"
              >
                刷新 Token
              </v-btn>
              <v-btn
                color="error"
                :disabled="!accessToken && !refreshToken"
                prepend-icon="mdi-logout"
                variant="text"
                @click="clearToken"
              >
                清除
              </v-btn>
            </div>
          </v-card-text>
        </v-card>

        <v-card border>
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" icon="mdi-shield-key-outline" />
            Token 状态
          </v-card-title>
          <v-card-text>
            <div class="debug-kv">
              <span>Access Token</span>
              <code>{{ accessToken ? tokenPreview(accessToken) : '-' }}</code>
              <span>Refresh Token</span>
              <code>{{ refreshToken ? tokenPreview(refreshToken) : '-' }}</code>
              <span>过期时间</span>
              <span>{{ tokenExpiresAt || '-' }}</span>
              <span>授权范围</span>
              <span>{{ tokenScope || '-' }}</span>
            </div>
            <v-btn
              block
              class="mt-4"
              :disabled="!accessToken"
              :loading="userLoading"
              prepend-icon="mdi-account"
              variant="outlined"
              @click="loadUserInfo"
            >
              读取 /oauth/userinfo
            </v-btn>
            <pre v-if="userInfo" class="debug-json mt-3">{{ pretty(userInfo) }}</pre>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" lg="8">
        <v-card border class="mb-4">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" icon="mdi-post-outline" />
            发帖
          </v-card-title>
          <v-card-text>
            <v-textarea
              v-model="composer.content"
              auto-grow
              counter="1000"
              density="comfortable"
              label="贴文内容"
              rows="4"
              variant="outlined"
            />
            <div class="d-flex flex-wrap ga-2 mt-2">
              <v-btn
                color="primary"
                :disabled="!accessToken || !composer.content.trim()"
                :loading="postLoading"
                prepend-icon="mdi-send"
                @click="createPost"
              >
                发布
              </v-btn>
              <v-btn
                :disabled="!accessToken || !targetPostId || !composer.content.trim()"
                prepend-icon="mdi-reply"
                variant="outlined"
                @click="replyToPost"
              >
                回复目标 ID
              </v-btn>
              <v-btn
                :disabled="!accessToken || !targetPostId || !composer.content.trim()"
                prepend-icon="mdi-format-quote-open"
                variant="outlined"
                @click="quotePost"
              >
                引用目标 ID
              </v-btn>
            </div>
          </v-card-text>
        </v-card>

        <v-card border class="mb-4">
          <v-card-title class="d-flex align-center flex-wrap ga-2">
            <v-icon icon="mdi-timeline-text-outline" />
            贴文列表
            <v-spacer />
            <v-text-field
              v-model="feedLimit"
              class="limit-input"
              density="compact"
              hide-details
              label="数量"
              max="50"
              min="1"
              type="number"
              variant="outlined"
            />
            <v-switch
              v-model="includeReplies"
              color="primary"
              density="compact"
              hide-details
              label="含回复"
            />
            <v-btn
              :disabled="!accessToken"
              :loading="feedLoading"
              prepend-icon="mdi-refresh"
              variant="outlined"
              @click="loadGlobalFeed"
            >
              加载全局
            </v-btn>
          </v-card-title>
          <v-card-text>
            <v-alert
              v-if="!accessToken"
              density="compact"
              type="warning"
              variant="tonal"
            >
              先完成 OAuth 登录，或粘贴已有 access token。
            </v-alert>
            <div v-else-if="posts.length === 0" class="empty-state">
              <v-icon icon="mdi-post-outline" size="42" />
              <div class="text-body-2 text-medium-emphasis mt-2">暂无已加载贴文</div>
            </div>
            <div v-else class="post-list">
              <v-card
                v-for="post in posts"
                :key="postKey(post)"
                class="post-row"
                variant="outlined"
              >
                <v-card-text>
                  <div class="d-flex align-start ga-3">
                    <div class="flex-grow-1 min-w-0">
                      <div class="d-flex align-center flex-wrap ga-2 mb-1">
                        <span class="font-weight-bold">#{{ postId(post) }}</span>
                        <span class="text-caption text-medium-emphasis">
                          {{ authorName(post) }}
                        </span>
                        <v-chip v-if="post.type" size="x-small" variant="tonal">
                          {{ post.type }}
                        </v-chip>
                      </div>
                      <div class="post-content">{{ postContent(post) }}</div>
                      <div class="text-caption text-medium-emphasis mt-2">
                        {{ post.created_at || post.createdAt || '' }}
                      </div>
                    </div>
                    <v-btn
                      icon="mdi-target"
                      size="small"
                      title="设为目标 ID"
                      variant="text"
                      @click="targetPostId = String(postId(post))"
                    />
                  </div>
                  <div class="d-flex flex-wrap ga-2 mt-3">
                    <v-btn size="small" variant="outlined" @click="loadPost(postId(post))">
                      查看
                    </v-btn>
                    <v-btn size="small" variant="outlined" @click="likePost(postId(post))">
                      点赞
                    </v-btn>
                    <v-btn size="small" variant="outlined" @click="unlikePost(postId(post))">
                      取消点赞
                    </v-btn>
                    <v-btn size="small" variant="outlined" @click="bookmarkPost(postId(post))">
                      收藏
                    </v-btn>
                    <v-btn size="small" variant="outlined" @click="unbookmarkPost(postId(post))">
                      取消收藏
                    </v-btn>
                    <v-btn size="small" variant="outlined" @click="retweetPost(postId(post))">
                      转推
                    </v-btn>
                    <v-btn
                      color="error"
                      size="small"
                      variant="text"
                      @click="deletePost(postId(post))"
                    >
                      删除
                    </v-btn>
                  </div>
                </v-card-text>
              </v-card>
            </div>
          </v-card-text>
        </v-card>

        <v-card border>
          <v-card-title class="d-flex align-center flex-wrap ga-2">
            <v-icon icon="mdi-console" />
            单贴与响应日志
            <v-spacer />
            <v-text-field
              v-model="targetPostId"
              class="target-input"
              density="compact"
              hide-details
              label="目标贴文 ID"
              variant="outlined"
            />
            <v-btn
              :disabled="!targetPostId"
              prepend-icon="mdi-magnify"
              variant="outlined"
              @click="loadPost(targetPostId)"
            >
              查询
            </v-btn>
          </v-card-title>
          <v-card-text>
            <div class="d-flex flex-wrap ga-2 mb-3">
              <v-btn :disabled="!targetPostId" size="small" @click="resyncPost">
                重新同步
              </v-btn>
              <v-btn :disabled="!targetPostId" size="small" @click="pushFederation">
                推送联邦
              </v-btn>
              <v-btn
                color="error"
                :disabled="!targetPostId"
                size="small"
                variant="text"
                @click="deletePost(targetPostId)"
              >
                删除目标
              </v-btn>
              <v-btn :disabled="requestLogs.length === 0" size="small" variant="text" @click="requestLogs = []">
                清空日志
              </v-btn>
            </div>
            <pre class="debug-json">{{ pretty(lastResponse || requestLogs) }}</pre>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="3500">
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
  import rawAxios from 'axios'
  import { computed, onMounted, reactive, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'

  const route = useRoute()
  const router = useRouter()

  const BASE_API = import.meta.env.VITE_APP_BASE_API
  const CONFIG_STORAGE_KEY = 'debug_oauth_post_manager_config'
  const SESSION_STORAGE_KEY = 'debug_oauth_post_manager_session'
  const DEFAULT_SCOPE = 'user:read post:read post:create post:interact post:delete post:update'

  const defaultRedirectUri = `${window.location.origin}/app/debug/oauth-post-manager`

  const oauthForm = reactive({
    clientId: '',
    clientSecret: '',
    redirectUri: defaultRedirectUri,
    scope: DEFAULT_SCOPE,
  })

  const composer = reactive({
    content: '',
  })

  const accessToken = ref('')
  const refreshToken = ref('')
  const tokenScope = ref('')
  const tokenExpiresAt = ref('')
  const userInfo = ref(null)
  const posts = ref([])
  const targetPostId = ref('')
  const feedLimit = ref(10)
  const includeReplies = ref(false)
  const lastResponse = ref(null)
  const requestLogs = ref([])

  const authLoading = ref(false)
  const userLoading = ref(false)
  const feedLoading = ref(false)
  const postLoading = ref(false)

  const snackbar = reactive({
    show: false,
    text: '',
    color: 'success',
  })

  const authHeaders = computed(() => ({
    Authorization: `Bearer ${accessToken.value}`,
  }))

  function showMessage(text, color = 'success') {
    snackbar.text = text
    snackbar.color = color
    snackbar.show = true
  }

  function saveState() {
    localStorage.setItem(
      CONFIG_STORAGE_KEY,
      JSON.stringify({
        oauthForm: {
          clientId: oauthForm.clientId,
          redirectUri: oauthForm.redirectUri,
          scope: oauthForm.scope,
        },
      }),
    )
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        clientSecret: oauthForm.clientSecret,
        accessToken: accessToken.value,
        refreshToken: refreshToken.value,
        tokenScope: tokenScope.value,
        tokenExpiresAt: tokenExpiresAt.value,
      }),
    )
  }

  function restoreState() {
    try {
      const savedConfig = JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY) || '{}')
      const savedSession = JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY) || '{}')
      if (savedConfig.oauthForm) {
        Object.assign(oauthForm, {
          ...savedConfig.oauthForm,
          redirectUri: savedConfig.oauthForm.redirectUri || defaultRedirectUri,
          scope: savedConfig.oauthForm.scope || DEFAULT_SCOPE,
        })
      }
      oauthForm.clientSecret = savedSession.clientSecret || ''
      accessToken.value = savedSession.accessToken || ''
      refreshToken.value = savedSession.refreshToken || ''
      tokenScope.value = savedSession.tokenScope || ''
      tokenExpiresAt.value = savedSession.tokenExpiresAt || ''
    } catch {
      // ignore malformed debug state
    }
  }

  function buildAuthorizeUrl() {
    const state = crypto.randomUUID()
    sessionStorage.setItem(`${SESSION_STORAGE_KEY}_state`, state)
    saveState()

    const params = new URLSearchParams({
      client_id: oauthForm.clientId.trim(),
      redirect_uri: oauthForm.redirectUri.trim(),
      response_type: 'code',
      scope: oauthForm.scope.trim(),
      state,
    })
    return `${BASE_API}/oauth/authorize?${params.toString()}`
  }

  function startOAuth() {
    if (!oauthForm.clientId.trim() || !oauthForm.clientSecret.trim()) {
      showMessage('请先填写 Client ID 和 Client Secret', 'error')
      return
    }
    window.location.href = buildAuthorizeUrl()
  }

  async function exchangeCode(code) {
    const expectedState = sessionStorage.getItem(`${SESSION_STORAGE_KEY}_state`)
    const receivedState = String(route.query.state || '')
    if (expectedState && receivedState && expectedState !== receivedState) {
      showMessage('OAuth state 校验失败', 'error')
      return
    }

    authLoading.value = true
    try {
      const response = await rawAxios.post(`${BASE_API}/oauth/token`, {
        grant_type: 'authorization_code',
        code,
        client_id: oauthForm.clientId,
        client_secret: oauthForm.clientSecret,
        redirect_uri: oauthForm.redirectUri,
      })
      applyTokenResponse(response.data)
      await router.replace({ path: route.path, query: {} })
      showMessage('OAuth 登录完成')
      await loadUserInfo()
    } catch (error) {
      handleError('换取 access token 失败', error)
    } finally {
      authLoading.value = false
    }
  }

  async function refreshAccessToken() {
    if (!refreshToken.value) return

    authLoading.value = true
    try {
      const response = await rawAxios.post(`${BASE_API}/oauth/token`, {
        grant_type: 'refresh_token',
        client_id: oauthForm.clientId,
        client_secret: oauthForm.clientSecret,
        refresh_token: refreshToken.value,
      })
      applyTokenResponse(response.data)
      showMessage('Token 已刷新')
    } catch (error) {
      handleError('刷新 token 失败', error)
    } finally {
      authLoading.value = false
    }
  }

  function applyTokenResponse(data) {
    accessToken.value = data.access_token || ''
    refreshToken.value = data.refresh_token || refreshToken.value
    tokenScope.value = data.scope || ''
    tokenExpiresAt.value = data.expires_in
      ? new Date(Date.now() + Number(data.expires_in) * 1000).toLocaleString()
      : ''
    pushLog('OAuth token', data)
    saveState()
  }

  function clearToken() {
    accessToken.value = ''
    refreshToken.value = ''
    tokenScope.value = ''
    tokenExpiresAt.value = ''
    userInfo.value = null
    saveState()
  }

  async function oauthRequest(method, url, data = undefined, params = undefined) {
    const response = await rawAxios.request({
      baseURL: BASE_API,
      method,
      url,
      data,
      params,
      headers: authHeaders.value,
    })
    pushLog(`${method.toUpperCase()} ${url}`, response.data)
    lastResponse.value = response.data
    return response.data
  }

  async function loadUserInfo() {
    userLoading.value = true
    try {
      userInfo.value = await oauthRequest('get', '/oauth/userinfo')
    } catch (error) {
      handleError('读取用户信息失败', error)
    } finally {
      userLoading.value = false
    }
  }

  async function loadGlobalFeed() {
    feedLoading.value = true
    try {
      const response = await oauthRequest('get', '/posts/global', undefined, {
        limit: Number(feedLimit.value) || 10,
        include_replies: String(includeReplies.value),
      })
      const data = response?.data || response
      posts.value = Array.isArray(data?.posts) ? data.posts : []
      showMessage(`已加载 ${posts.value.length} 条贴文`)
    } catch (error) {
      handleError('加载贴文列表失败', error)
    } finally {
      feedLoading.value = false
    }
  }

  async function createPost() {
    postLoading.value = true
    try {
      const response = await oauthRequest('post', '/posts', {
        content: composer.content.trim(),
      })
      composer.content = ''
      showMessage('贴文已发布')
      const created = response?.data?.post || response?.data || response
      if (created?.id) {
        targetPostId.value = String(created.id)
      }
      await loadGlobalFeed()
    } catch (error) {
      handleError('发布贴文失败', error)
    } finally {
      postLoading.value = false
    }
  }

  async function replyToPost() {
    await runPostAction('回复失败', 'post', `/posts/${targetPostId.value}/reply`, {
      content: composer.content.trim(),
    })
    composer.content = ''
  }

  async function quotePost() {
    await runPostAction('引用失败', 'post', `/posts/${targetPostId.value}/quote`, {
      content: composer.content.trim(),
    })
    composer.content = ''
  }

  async function likePost(id) {
    await runPostAction('点赞失败', 'post', `/posts/${id}/like`)
  }

  async function unlikePost(id) {
    await runPostAction('取消点赞失败', 'delete', `/posts/${id}/like`)
  }

  async function bookmarkPost(id) {
    await runPostAction('收藏失败', 'post', `/posts/${id}/bookmark`)
  }

  async function unbookmarkPost(id) {
    await runPostAction('取消收藏失败', 'delete', `/posts/${id}/bookmark`)
  }

  async function retweetPost(id) {
    await runPostAction('转推失败', 'post', `/posts/${id}/retweet`)
  }

  async function deletePost(id) {
    await runPostAction('删除失败', 'delete', `/posts/${id}`)
    posts.value = posts.value.filter((post) => String(postId(post)) !== String(id))
  }

  async function resyncPost() {
    await runPostAction('重新同步失败', 'post', `/posts/${targetPostId.value}/resync`)
  }

  async function pushFederation() {
    await runPostAction('推送联邦失败', 'post', `/posts/${targetPostId.value}/push-federation`)
  }

  async function loadPost(id) {
    if (!id) return

    try {
      await oauthRequest('get', `/posts/${id}`)
      targetPostId.value = String(id)
    } catch (error) {
      handleError('查询贴文失败', error)
    }
  }

  async function runPostAction(errorMessage, method, url, data = undefined) {
    try {
      await oauthRequest(method, url, data)
      showMessage('操作完成')
    } catch (error) {
      handleError(errorMessage, error)
    }
  }

  function postId(post) {
    return post?.id || post?.post_id || post?.postId || '-'
  }

  function postKey(post) {
    return String(postId(post))
  }

  function authorName(post) {
    const author = post?.author || post?.user
    return author?.display_name || author?.username || `user:${post?.author_id || '-'}`
  }

  function postContent(post) {
    return post?.content || post?.text || post?.raw_content || '(空内容)'
  }

  function pushLog(label, payload) {
    requestLogs.value.unshift({
      time: new Date().toLocaleTimeString(),
      label,
      payload,
    })
    requestLogs.value = requestLogs.value.slice(0, 20)
  }

  function handleError(message, error) {
    const payload = error?.response?.data || { message: error?.message || message }
    lastResponse.value = payload
    pushLog(message, payload)
    showMessage(payload?.message || payload?.error_description || payload?.error || message, 'error')
  }

  function tokenPreview(token) {
    if (!token) return ''
    return `${token.slice(0, 14)}...${token.slice(-8)}`
  }

  function pretty(value) {
    return JSON.stringify(value, null, 2)
  }

  async function copyText(text) {
    await navigator.clipboard.writeText(text)
    showMessage('已复制')
  }

  onMounted(async () => {
    restoreState()
    const code = route.query.code
    if (typeof code === 'string' && code) {
      await exchangeCode(code)
    }
  })
</script>

<style scoped>
  .limit-input {
    max-width: 120px;
  }

  .target-input {
    max-width: 180px;
  }

  .debug-kv {
    display: grid;
    grid-template-columns: 110px minmax(0, 1fr);
    gap: 10px 12px;
    align-items: start;
    font-size: 0.875rem;
  }

  .debug-kv span:nth-child(odd) {
    color: rgba(var(--v-theme-on-surface), 0.62);
  }

  .debug-kv code,
  .scope-code {
    word-break: break-all;
  }

  .debug-json {
    max-height: 420px;
    overflow: auto;
    padding: 12px;
    border-radius: 8px;
    background: rgba(var(--v-theme-on-surface), 0.055);
    font-size: 0.78rem;
    line-height: 1.5;
  }

  .empty-state {
    min-height: 180px;
    display: grid;
    place-items: center;
    align-content: center;
    color: rgba(var(--v-theme-on-surface), 0.56);
  }

  .post-list {
    display: grid;
    gap: 12px;
  }

  .post-row {
    border-radius: 8px;
  }

  .post-content {
    white-space: pre-wrap;
    word-break: break-word;
  }

  .min-w-0 {
    min-width: 0;
  }
</style>
