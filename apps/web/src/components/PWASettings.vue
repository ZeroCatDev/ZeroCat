<template>
  <v-card>
    <v-card-title class="d-flex align-center">
      <v-icon start color="primary">mdi-application-cog</v-icon>
      PWA设置
    </v-card-title>

    <v-divider></v-divider>

    <v-card-text>
      <!-- 安装状态 -->
      <div class="mb-6">
        <h3 class="text-h6 mb-3">应用状态</h3>
        
        <!-- 安装状态 -->
        <v-list-item class="px-0">
          <template v-slot:prepend>
            <v-icon 
              :color="isInstalled ? 'success' : 'grey'"
              :icon="isInstalled ? 'mdi-check-circle' : 'mdi-circle-outline'"
            ></v-icon>
          </template>
          <v-list-item-title>应用安装状态</v-list-item-title>
          <v-list-item-subtitle>
            {{ isInstalled ? '已安装为PWA应用' : '在浏览器中运行' }}
          </v-list-item-subtitle>
          <template v-slot:append v-if="isInstallable && !isInstalled">
            <v-btn
              :loading="installing"
              color="primary"
              variant="tonal"
              size="small"
              @click="handleInstall"
            >
              安装应用
            </v-btn>
          </template>
        </v-list-item>

        <!-- 网络状态 -->
        <v-list-item class="px-0">
          <template v-slot:prepend>
            <v-icon 
              :color="isOnline ? 'success' : 'error'"
              :icon="isOnline ? 'mdi-wifi' : 'mdi-wifi-off'"
            ></v-icon>
          </template>
          <v-list-item-title>网络连接</v-list-item-title>
          <v-list-item-subtitle>
            {{ isOnline ? '已连接到网络' : '离线模式' }}
          </v-list-item-subtitle>
        </v-list-item>

        <!-- 更新状态 -->
        <v-list-item class="px-0">
          <template v-slot:prepend>
            <v-icon 
              :color="updateAvailable ? 'warning' : 'success'"
              :icon="updateAvailable ? 'mdi-update' : 'mdi-check-circle'"
            ></v-icon>
          </template>
          <v-list-item-title>应用版本</v-list-item-title>
          <v-list-item-subtitle>
            {{ updateAvailable ? '有更新可用' : '已是最新版本' }}
          </v-list-item-subtitle>
          <template v-slot:append v-if="updateAvailable">
            <v-btn
              color="warning"
              variant="tonal"
              size="small"
              @click="updateApp"
            >
              立即更新
            </v-btn>
          </template>
        </v-list-item>
      </div>

      <!-- 缓存管理 -->
      <div class="mb-6">
        <h3 class="text-h6 mb-3">缓存管理</h3>
        
        <v-row>
          <v-col cols="12" sm="6">
            <v-card variant="outlined">
              <v-card-text>
                <div class="d-flex align-center mb-2">
                  <v-icon color="blue" class="mr-2">mdi-database</v-icon>
                  <span class="font-weight-medium">API缓存</span>
                </div>
                <p class="text-caption text-grey mb-3">
                  API请求的缓存数据
                </p>
                <v-btn
                  :loading="clearingCache.api"
                  variant="outlined"
                  size="small"
                  block
                  @click="handleClearCache('api')"
                >
                  清除API缓存
                </v-btn>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" sm="6">
            <v-card variant="outlined">
              <v-card-text>
                <div class="d-flex align-center mb-2">
                  <v-icon color="green" class="mr-2">mdi-image</v-icon>
                  <span class="font-weight-medium">图片缓存</span>
                </div>
                <p class="text-caption text-grey mb-3">
                  图片和媒体文件缓存
                </p>
                <v-btn
                  :loading="clearingCache.images"
                  variant="outlined"
                  size="small"
                  block
                  @click="handleClearCache('images')"
                >
                  清除图片缓存
                </v-btn>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" sm="6">
            <v-card variant="outlined">
              <v-card-text>
                <div class="d-flex align-center mb-2">
                  <v-icon color="purple" class="mr-2">mdi-file-code</v-icon>
                  <span class="font-weight-medium">静态资源</span>
                </div>
                <p class="text-caption text-grey mb-3">
                  JS、CSS等静态文件缓存
                </p>
                <v-btn
                  :loading="clearingCache.static"
                  variant="outlined"
                  size="small"
                  block
                  @click="handleClearCache('static')"
                >
                  清除静态缓存
                </v-btn>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" sm="6">
            <v-card variant="outlined">
              <v-card-text>
                <div class="d-flex align-center mb-2">
                  <v-icon color="red" class="mr-2">mdi-delete-sweep</v-icon>
                  <span class="font-weight-medium">全部缓存</span>
                </div>
                <p class="text-caption text-grey mb-3">
                  清除所有缓存数据
                </p>
                <v-btn
                  :loading="clearingCache.all"
                  color="error"
                  variant="outlined"
                  size="small"
                  block
                  @click="handleClearAllCache"
                >
                  清除全部缓存
                </v-btn>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </div>

      <!-- PWA信息 -->
      <div v-if="swInfo">
        <h3 class="text-h6 mb-3">应用信息</h3>
        
        <v-list density="compact">
          <v-list-item>
            <v-list-item-title>Service Worker版本</v-list-item-title>
            <v-list-item-subtitle>{{ swInfo.version }}</v-list-item-subtitle>
          </v-list-item>
          
          <v-list-item>
            <v-list-item-title>更新时间</v-list-item-title>
            <v-list-item-subtitle>{{ formatTime(swInfo.timestamp) }}</v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </div>
    </v-card-text>

    <!-- 操作按钮 -->
    <v-card-actions>
      <v-spacer></v-spacer>
      <v-btn
        variant="text"
        prepend-icon="mdi-refresh"
        @click="refreshSWInfo"
      >
        刷新信息
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script>
import { ref, onMounted } from 'vue'
import { usePWA } from '@/composables/usePWA'
import { showSnackbar } from '@/composables/useNotifications'

export default {
  name: 'PWASettings',
  setup() {
    const {
      isInstallable,
      isInstalled,
      isOnline,
      updateAvailable,
      installing,
      install,
      updateApp,
      clearCache,
      getSWInfo
    } = usePWA()

    const swInfo = ref(null)
    const clearingCache = ref({
      api: false,
      images: false,
      static: false,
      all: false
    })

    // 处理安装
    const handleInstall = async () => {
      try {
        const success = await install()
        if (success) {
          showSnackbar('应用安装成功！', 'success')
        } else {
          showSnackbar('安装已取消', 'info')
        }
      } catch (error) {
        console.error('安装失败:', error)
        showSnackbar('安装失败，请重试', 'error')
      }
    }

    // 处理清除缓存
    const handleClearCache = async (cacheType) => {
      clearingCache.value[cacheType] = true
      
      try {
        const success = await clearCache(cacheType)
        if (success) {
          showSnackbar(`${getCacheTypeName(cacheType)}清除成功`, 'success')
        } else {
          showSnackbar('清除缓存失败', 'error')
        }
      } catch (error) {
        console.error('清除缓存失败:', error)
        showSnackbar('清除缓存失败', 'error')
      } finally {
        clearingCache.value[cacheType] = false
      }
    }

    // 处理清除全部缓存
    const handleClearAllCache = async () => {
      const confirmed = confirm('确定要清除所有缓存吗？这可能会影响应用性能。')
      if (!confirmed) return

      clearingCache.value.all = true
      
      try {
        const cacheTypes = ['api', 'images', 'static']
        const results = await Promise.all(
          cacheTypes.map(type => clearCache(type))
        )
        
        if (results.every(success => success)) {
          showSnackbar('所有缓存清除成功', 'success')
          // 可选：重新加载页面
          setTimeout(() => {
            window.location.reload()
          }, 1000)
        } else {
          showSnackbar('部分缓存清除失败', 'warning')
        }
      } catch (error) {
        console.error('清除缓存失败:', error)
        showSnackbar('清除缓存失败', 'error')
      } finally {
        clearingCache.value.all = false
      }
    }

    // 获取缓存类型名称
    const getCacheTypeName = (type) => {
      const names = {
        api: 'API缓存',
        images: '图片缓存',
        static: '静态资源缓存'
      }
      return names[type] || '缓存'
    }

    // 格式化时间
    const formatTime = (timestamp) => {
      if (!timestamp) return '未知'
      return new Date(timestamp).toLocaleString('zh-CN')
    }

    // 刷新SW信息
    const refreshSWInfo = async () => {
      try {
        const info = await getSWInfo()
        swInfo.value = info
      } catch (error) {
        console.error('获取SW信息失败:', error)
      }
    }

    onMounted(() => {
      refreshSWInfo()
    })

    return {
      isInstallable,
      isInstalled,
      isOnline,
      updateAvailable,
      installing,
      swInfo,
      clearingCache,
      handleInstall,
      updateApp,
      handleClearCache,
      handleClearAllCache,
      formatTime,
      refreshSWInfo
    }
  }
}
</script>

<style scoped>
.v-card {
  max-width: 800px;
}
</style>