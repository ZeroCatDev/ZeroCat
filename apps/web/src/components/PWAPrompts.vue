<template>
  <!-- PWA安装提示 -->
  <v-snackbar
    v-model="showInstallPrompt"
    :timeout="-1"
    location="bottom"
    color="primary"
    variant="elevated"
  >
    <div class="d-flex align-center">
      <v-icon start>mdi-download</v-icon>
      <div>
        <div class="text-body-2 font-weight-medium">安装ZeroCat应用</div>
        <div class="text-caption">添加到主屏幕，获得更好的体验</div>
      </div>
    </div>

    <template v-slot:actions>
      <v-btn
        variant="text"
        @click="showInstallPrompt = false"
      >
        稍后
      </v-btn>
      <v-btn
        :loading="installing"
        variant="tonal"
        @click="handleInstall"
      >
        安装
      </v-btn>
    </template>
  </v-snackbar>

  <!-- 应用更新提示 -->
  <v-snackbar
    v-model="showUpdatePrompt"
    :timeout="-1"
    location="top"
    color="info"
    variant="elevated"
  >
    <div class="d-flex align-center">
      <v-icon start>mdi-update</v-icon>
      <div>
        <div class="text-body-2 font-weight-medium">应用更新可用</div>
        <div class="text-caption">新版本已准备就绪，请重启应用</div>
      </div>
    </div>

    <template v-slot:actions>
      <v-btn
        variant="text"
        @click="showUpdatePrompt = false"
      >
        忽略
      </v-btn>
      <v-btn
        variant="tonal"
        @click="handleUpdate"
      >
        更新
      </v-btn>
    </template>
  </v-snackbar>

  <!-- 离线提示 -->
  <v-snackbar
    v-model="showOfflinePrompt"
    :timeout="3000"
    location="top"
    color="warning"
    variant="elevated"
  >
    <div class="d-flex align-center">
      <v-icon start>mdi-wifi-off</v-icon>
      <div>
        <div class="text-body-2 font-weight-medium">网络连接已断开</div>
        <div class="text-caption">部分功能可能无法使用</div>
      </div>
    </div>

    <template v-slot:actions>
      <v-btn
        variant="text"
        @click="showOfflinePrompt = false"
      >
        知道了
      </v-btn>
    </template>
  </v-snackbar>

  <!-- 重新连接提示 -->
  <v-snackbar
    v-model="showOnlinePrompt"
    :timeout="3000"
    location="top"
    color="success"
    variant="elevated"
  >
    <div class="d-flex align-center">
      <v-icon start>mdi-wifi</v-icon>
      <div>
        <div class="text-body-2 font-weight-medium">网络连接已恢复</div>
        <div class="text-caption">所有功能现已可用</div>
      </div>
    </div>

    <template v-slot:actions>
      <v-btn
        variant="text"
        @click="showOnlinePrompt = false"
      >
        好的
      </v-btn>
    </template>
  </v-snackbar>
</template>

<script>
import { ref, watch, onMounted } from 'vue'
import { usePWA } from '@/composables/usePWA'
import { showSnackbar } from '@/composables/useNotifications'

export default {
  name: 'PWAPrompts',
  setup() {
    const {
      isInstallable,
      isOnline,
      showUpdatePrompt: pwaUpdatePrompt,
      installing,
      install,
      skipWaiting
    } = usePWA()

    const showInstallPrompt = ref(false)
    const showUpdatePrompt = ref(false)
    const showOfflinePrompt = ref(false)
    const showOnlinePrompt = ref(false)
    
    let wasOffline = false

    // 监听安装状态
    watch(isInstallable, (newVal) => {
      if (newVal) {
        // 延迟显示安装提示，让用户先熟悉应用
        setTimeout(() => {
          showInstallPrompt.value = true
        }, 30000) // 30秒后显示
      }
    })

    // 监听更新状态
    watch(pwaUpdatePrompt, (newVal) => {
      showUpdatePrompt.value = newVal
    })

    // 监听网络状态
    watch(isOnline, (newVal, oldVal) => {
      if (newVal === false && oldVal === true) {
        // 网络断开
        showOfflinePrompt.value = true
        wasOffline = true
      } else if (newVal === true && wasOffline) {
        // 网络恢复
        showOnlinePrompt.value = true
        wasOffline = false
      }
    })

    // 处理安装
    const handleInstall = async () => {
      try {
        const success = await install()
        if (success) {
          showSnackbar('应用安装成功！', 'success')
          showInstallPrompt.value = false
        } else {
          showSnackbar('安装已取消', 'info')
        }
      } catch (error) {
        console.error('安装失败:', error)
        showSnackbar('安装失败，请重试', 'error')
      }
    }

    // 处理更新
    const handleUpdate = () => {
      try {
        skipWaiting()
        showSnackbar('应用正在更新...', 'info')
      } catch (error) {
        console.error('更新失败:', error)
        showSnackbar('更新失败，请刷新页面', 'error')
      }
    }

    onMounted(() => {
      // 初始网络状态
      wasOffline = !isOnline.value
    })

    return {
      showInstallPrompt,
      showUpdatePrompt,
      showOfflinePrompt,
      showOnlinePrompt,
      installing,
      handleInstall,
      handleUpdate
    }
  }
}
</script>

<style scoped>
.v-snackbar {
  max-width: 400px;
}
</style>