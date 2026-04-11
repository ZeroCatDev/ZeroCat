<template>
  <v-container class="d-flex align-center justify-center" style="min-height: 80vh">
    <v-row justify="center">
      <v-col cols="12" lg="5" md="6" sm="8">
        <v-card class="error-card">
          <v-card-item class="text-center">
            <v-icon
              class="mb-4"
              color="error"
              icon="mdi-alert-circle"
              size="64"
            ></v-icon>
            <v-card-title class="text-h4 mb-2">
              授权错误
            </v-card-title>
            <v-card-subtitle class="text-body-1 mb-4">
              {{ errorCode }}
            </v-card-subtitle>
          </v-card-item>

          <v-card-text class="text-center pb-4">
            <p class="text-body-1">
              {{ errorDescription }}
            </p>
          </v-card-text>

          <v-card-actions class="justify-center pb-6">
            <v-btn
              color="primary"
              prepend-icon="mdi-home"
              variant="outlined"
              @click="goHome"
            >
              返回首页
            </v-btn>
          </v-card-actions>
        </v-card>

        <!-- 技术细节折叠面板 -->
        <v-expansion-panels class="mt-4" variant="accordion">
          <v-expansion-panel>
            <v-expansion-panel-title>
              <div class="d-flex align-center">
                <v-icon class="mr-2" icon="mdi-code-tags"></v-icon>
                技术细节
              </div>
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <v-list>
                <v-list-item>
                  <v-list-item-title class="font-weight-bold">
                    错误代码
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    {{ error }}
                  </v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <v-list-item-title class="font-weight-bold">
                    错误描述
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    {{ error_description }}
                  </v-list-item-subtitle>
                </v-list-item>
                <v-list-item v-if="state">
                  <v-list-item-title class="font-weight-bold">
                    状态值
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    {{ state }}
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import {computed} from 'vue'
import {useRoute, useRouter} from 'vue-router'

const route = useRoute()
const router = useRouter()

// 从URL参数中获取错误信息
const error = route.query.error || 'unknown_error'
const error_description = route.query.error_description || '发生未知错误'
const state = route.query.state

// 错误代码映射
const errorCodeMap = {
  'access_denied': '访问被拒绝',
  'invalid_request': '无效的请求',
  'unauthorized_client': '未授权的客户端',
  'unsupported_response_type': '不支持的响应类型',
  'invalid_scope': '无效的权限范围',
  'server_error': '服务器错误',
  'temporarily_unavailable': '服务暂时不可用',
  'unknown_error': '未知错误'
}

// 获取友好的错误代码显示
const errorCode = computed(() => {
  return errorCodeMap[error] || errorCodeMap.unknown_error
})

// 获取友好的错误描述
const errorDescription = computed(() => {
  return error_description || '抱歉，授权过程中发生错误。请稍后重试或联系管理员。'
})

// 返回首页
const goHome = () => {
  router.push('/')
}
</script>

<style scoped>
.error-card {
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1) !important;
}

.v-expansion-panels {
  box-shadow: none !important;
  background: transparent;
}

.v-expansion-panel {
  background: transparent !important;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px !important;
}

.v-expansion-panel-title {
  padding: 16px;
}

.v-list-item {
  padding: 12px 0;
}
</style>
