<template>
  <v-container class="pa-4 config-debug" fluid>
    <v-row>
      <v-col cols="12">
        <!-- <h2 class="text-h5 mb-4">配置调试页面</h2> -->

        <v-card class="mb-4">
          <v-card-title class="d-flex justify-space-between align-center">
            <span class="text-h6">配置状态</span>
          </v-card-title>

          <v-card-text>
            <v-row>
              <v-col cols="12" sm="6">
                <div class="status-item">
                  <div class="text-subtitle-2">最后更新时间</div>
                  <div>{{ formatTime(lastFetchTime) }}</div>
                </div>
              </v-col>
              <v-col cols="12" sm="6">
                <div class="status-item">
                  <div class="text-subtitle-2">配置状态</div>
                  <div :class="{ 'text-error': isExpired, 'text-success': !isExpired }">
                    {{ isExpired ? '已过期' : '有效' }}
                  </div>
                </div>
              </v-col>
              <v-col cols="12" sm="6">
                <div class="status-item">
                  <div class="text-subtitle-2">下次自动更新</div>
                  <div>{{ formatTime(nextAutoRefresh) }}</div>
                </div>
              </v-col>
              <v-col cols="12" sm="6">
                <div class="status-item">
                  <div class="text-subtitle-2">剩余有效时间</div>
                  <div>{{ formatDuration(timeUntilExpiry) }}</div>
                </div>
              </v-col>
            </v-row>
          </v-card-text>

          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn
              :disabled="!isExpired && isRefreshing"
              :loading="isRefreshing"
              color="primary"
              variant="tonal"
              @click="handleRefresh"
            >
              {{ getRefreshButtonText() }}
            </v-btn>
          </v-card-actions>
        </v-card>

        <v-card>
          <v-card-title class="d-flex justify-space-between align-center">
            <span class="text-h6">配置内容</span>
            <v-text-field
              v-model="searchKey"
              class="max-width-200"
              clearable
              density="compact"
              hide-details
              label="查找配置项"
            ></v-text-field>
          </v-card-title>

          <v-card-text>
            <pre v-if="!searchKey"> {{ JSON.stringify(config, null, 2) }}</pre>

            <v-alert
              v-else-if="searchResult === undefined"
              class="mt-2"
              text="未找到对应的配置项"
              type="warning"
            ></v-alert>
            <v-code v-else class="mt-2">
              <pre>{{ JSON.stringify({ [searchKey]: searchResult }, null, 2) }}</pre>
            </v-code>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import {ref, onMounted, computed, watch} from 'vue'
import {fetchConfig, get} from '@/services/serverConfig'

const MAX_AGE = 5 * 60 * 1000 // 5分钟，与serverConfig.js中保持一致
const STORAGE_KEY = {
  LAST_FETCH: 'config_last_fetch_time'
}

export default {
  name: 'ConfigDebug',
  setup() {
    const config = ref({})
    const isRefreshing = ref(false)
    const lastFetchTime = ref(0)
    const timer = ref(null)
    const searchKey = ref('')
    const searchResult = ref(undefined)

    const isExpired = computed(() => {
      return Date.now() - lastFetchTime.value > MAX_AGE
    })

    const nextAutoRefresh = computed(() => {
      return lastFetchTime.value + MAX_AGE
    })

    const timeUntilExpiry = computed(() => {
      const remaining = nextAutoRefresh.value - Date.now()
      return remaining > 0 ? remaining : 0
    })

    const updateConfig = async () => {
      config.value = await get()
      lastFetchTime.value = parseInt(localStorage.getItem(STORAGE_KEY.LAST_FETCH) || '0', 10)
      if (searchKey.value) {
        searchResult.value = await get(searchKey.value)
      }
    }

    const handleRefresh = async () => {
      isRefreshing.value = true
      try {
        await fetchConfig()
        await updateConfig()
      } catch (error) {
        console.error('刷新配置失败:', error)
      } finally {
        isRefreshing.value = false
      }
    }

    const formatTime = (timestamp) => {
      if (!timestamp) return '未更新'
      const date = new Date(timestamp)
      return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`
    }

    const formatDuration = (ms) => {
      if (ms <= 0) return '已过期'
      const minutes = Math.floor(ms / 60000)
      const seconds = Math.floor((ms % 60000) / 1000)
      return `${minutes}分${seconds}秒`
    }

    const getRefreshButtonText = () => {
      if (isRefreshing.value) return '刷新中...'
      if (isExpired.value) return '立即刷新'
      return '强制刷新'
    }

    // 监听搜索关键字变化
    watch(searchKey, async (newKey) => {
      if (!newKey) {
        searchResult.value = undefined
        return
      }
      searchResult.value = await get(newKey)
    })

    // 每秒更新计时器
    const startTimer = () => {
      timer.value = setInterval(() => {
        lastFetchTime.value = parseInt(localStorage.getItem(STORAGE_KEY.LAST_FETCH) || '0', 10)
      }, 1000)
    }

    onMounted(async () => {
      await updateConfig()
      startTimer()
    })

    onUnmounted(() => {
      if (timer.value) {
        clearInterval(timer.value)
      }
    })

    return {
      config,
      lastFetchTime,
      isRefreshing,
      isExpired,
      nextAutoRefresh,
      timeUntilExpiry,
      searchKey,
      searchResult,
      handleRefresh,
      formatTime,
      formatDuration,
      getRefreshButtonText,
    }
  },
}
</script>

<style scoped>
.config-debug {
  max-width: 900px;
  margin: auto;
}

.status-item {
  padding: 8px;
  border-radius: 4px;
}

.status-item .text-subtitle-2 {
  margin-bottom: 4px;
}

pre {
  font-size: 0.875rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.text-error {
  color: #ff5252;
}

.text-success {
  color: #4caf50;
}

.max-width-200 {
  max-width: 200px;
}
</style>
