<template>
  <v-container class="pa-4">
    <v-row justify="center">
      <v-col cols="12" lg="6" md="8" sm="10">
        <!-- 应用信息卡片 -->
        <v-card v-if="application" class="mb-4">
          <v-card-item>
            <template v-slot:prepend>
              <v-avatar
                :image="application.logo_url || '/default-app-logo.png'"
                class="mr-4"
                size="64"
              ></v-avatar>
            </template>
            <v-card-title class="text-h5">
              授权请求
            </v-card-title>
            <v-card-subtitle>
              <span class="font-weight-bold">{{ application.name }}</span> 想要访问您的账号
            </v-card-subtitle>
          </v-card-item>

          <v-divider></v-divider>

          <!-- 应用信息 -->
          <v-card-text class="pt-4">
            <div class="d-flex align-center mb-4">
              <v-icon class="mr-2" icon="mdi-web"></v-icon>
              <a :href="application.homepage_url" class="text-decoration-none" target="_blank">
                {{ application.homepage_url }}
              </a>
            </div>
            <p class="text-body-1">{{ application.description }}</p>
          </v-card-text>

          <v-divider></v-divider>

          <!-- 权限列表 -->
          <v-card-text>
            <h3 class="text-h6 mb-4">此应用将获得以下权限：</h3>
            <v-list>
              <v-list-item
                v-for="scope in requestedScopes"
                :key="scope.name"
                class="mb-2"
              >
                <template v-slot:prepend>
                  <v-icon
                    :icon="scope.icon"
                    class="mr-2"
                    color="primary"
                  ></v-icon>
                </template>
                <v-list-item-title class="font-weight-bold">
                  {{ scope.title }}
                </v-list-item-title>
                <v-list-item-subtitle>
                  {{ scope.description }}
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>

          <!-- 授权邮箱选择 -->
          <v-card-text v-if="emails.length > 0">
            <h3 class="text-h6 mb-4">选择授权邮箱：</h3>
            <v-select
              v-model="selectedEmail"
              :items="emails"
              class="mb-4"
              density="comfortable"
              item-title="email"
              item-value="email"
              label="选择要授权的邮箱"
              variant="outlined"
            ></v-select>
          </v-card-text>

          <v-divider></v-divider>

          <!-- 操作按钮 -->
          <v-card-actions class="pa-4">
            <v-btn
              class="mr-2"
              color="error"
              variant="outlined"
              @click="cancel"
            >
              取消
            </v-btn>
            <v-btn
              :disabled="!selectedEmail"
              :loading="loading"
              color="primary"
              @click="authorize"
            >
              授权应用
            </v-btn>
          </v-card-actions>
        </v-card>

        <!-- 错误提示 -->
        <v-alert
          v-if="error"
          class="mb-4"
          closable
          type="error"
          variant="tonal"
        >
          {{ error }}
        </v-alert>
      </v-col>
    </v-row>

    <!-- 加载中状态 -->
    <v-row v-if="loading && !application" justify="center">
      <v-col class="text-center" cols="12">
        <v-progress-circular
          color="primary"
          indeterminate
          size="64"
        ></v-progress-circular>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import {ref, onMounted, computed} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import axios from '@/axios/axios'

const route = useRoute()
const router = useRouter()

// 状态变量
const application = ref(null)
const loading = ref(false)
const error = ref(null)
const emails = ref([])
const selectedEmail = ref(null)

// 请求参数
const clientId = route.query.client_id
const redirectUri = route.query.redirect_uri
const scope = route.query.scope
const state = route.query.state
const codeChallenge = route.query.code_challenge
const codeChallengeMethod = route.query.code_challenge_method
//const responseType = route.query.response_type

// 权限映射
const scopeMap = {
  'user:basic': {
    icon: 'mdi-account',
    title: '查看您的基本信息',
    description: '包括您的用户名、显示名称和头像'
  },
  'user:email': {
    icon: 'mdi-email',
    title: '查看您的邮箱地址',
    description: '访问您的主要邮箱地址'
  }
}

// 计算请求的权限列表
const requestedScopes = computed(() => {
  if (!scope) return []
  return scope.split(' ').map(s => ({
    name: s,
    ...scopeMap[s]
  }))
})

// 验证参数
const validateParams = () => {
  if (!clientId) {
    error.value = '缺少必要的client_id参数'
    return false
  }
  if (!redirectUri) {
    error.value = '缺少必要的redirect_uri参数'
    return false
  }
  //if (responseType !== 'code') {
  //  error.value = 'response_type必须为code'
  //  return false
  //}
  return true
}

// 加载应用数据
const loadApplication = async () => {
  if (!validateParams()) return

  loading.value = true
  try {
    const response = await axios.get(`/oauth/applications/${clientId}`)
    application.value = response.data

    // 验证回调地址
    if (!application.value.redirect_uris.includes(redirectUri)) {
      error.value = '无效的回调地址'
      application.value = null
    }
  } catch (err) {
    error.value = '无法加载应用信息'
    console.error('Failed to load application:', err)
  }
  loading.value = false
}

// 加载用户邮箱
const loadEmails = async () => {
  try {
    const response = await axios.get('/oauth/user/emails')
    emails.value = response.data.map(email => ({
      email: email.contact_value,
      primary: email.is_primary
    }))
    if (emails.value.length > 0) {
      // 查找主邮箱并设置为默认选中
      const primaryEmail = emails.value.find(email => email.primary)
      selectedEmail.value = primaryEmail ? primaryEmail.email : emails.value[0].email
    }
  } catch (err) {
    console.error('Failed to load emails:', err)
  }
}

// 授权确认
const authorize = async () => {
  if (!selectedEmail.value) {
    error.value = '请选择要授权的邮箱'
    return
  }

  loading.value = true
  try {
    const response = await axios.post('/oauth/authorize/confirm', {
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
      state,
      authorized_email: selectedEmail.value,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod
    })

    // 重定向到应用指定的回调地址
    if (response.data.redirect_url) {
      window.location.href = response.data.redirect_url
    }
  } catch (err) {
    error.value = '授权失败，请重试'
    console.error('Authorization failed:', err)
  }
  loading.value = false
}

// 取消授权
const cancel = () => {
  const errorParams = new URLSearchParams({
    error: 'access_denied',
    error_description: '用户拒绝了应用程序的访问请求',
    state: state || ''
  })

  // 如果是本地错误，跳转到错误页面
  router.push({
    path: '/app/oauth/error',
    query: {
      error: 'access_denied',
      error_description: '用户拒绝了应用程序的访问请求',
      state: state || ''
    }
  })
}

// 页面加载时获取数据
onMounted(() => {
  loadApplication()
  loadEmails()
})
</script>

<style scoped>
.v-card {
  border: 1px solid rgba(0, 0, 0, 0.12);
}

.v-list-item {
  border-radius: 8px;
}

.v-list-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.05);
}
</style>
