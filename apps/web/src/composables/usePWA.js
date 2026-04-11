import { ref, onMounted, onUnmounted } from 'vue'

export function usePWA() {
  const isInstallable = ref(false)
  const isInstalled = ref(false)
  const isOnline = ref(navigator.onLine)
  const showUpdatePrompt = ref(false)
  const updateAvailable = ref(false)
  const installing = ref(false)
  
  let deferredPrompt = null
  let swRegistration = null

  // 检查是否已安装
  const checkInstalled = () => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      isInstalled.value = true
    }
    
    if (window.navigator.standalone === true) {
      isInstalled.value = true
    }
  }

  // 安装PWA
  const install = async () => {
    if (!deferredPrompt) {
      console.warn('PWA安装提示不可用')
      return false
    }

    installing.value = true
    
    try {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      
      if (outcome === 'accepted') {
        console.log('用户接受了PWA安装')
        isInstallable.value = false
        deferredPrompt = null
        return true
      } else {
        console.log('用户拒绝了PWA安装')
        return false
      }
    } catch (error) {
      console.error('PWA安装失败:', error)
      return false
    } finally {
      installing.value = false
    }
  }

  // 更新应用
  const updateApp = async () => {
    if (!swRegistration) {
      console.warn('Service Worker注册不可用')
      return
    }

    try {
      // 发送跳过等待消息
      if (swRegistration.waiting) {
        swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' })
      }
      
      // 监听控制变化
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload()
      })
    } catch (error) {
      console.error('应用更新失败:', error)
    }
  }

  // 跳过等待
  const skipWaiting = () => {
    showUpdatePrompt.value = false
    updateApp()
  }

  // 获取SW版本信息
  const getSWInfo = async () => {
    if (!swRegistration) return null

    try {
      const channel = new MessageChannel()
      
      return new Promise((resolve) => {
        channel.port1.onmessage = (event) => {
          resolve(event.data)
        }
        
        if (swRegistration.active) {
          swRegistration.active.postMessage({
            type: 'GET_VERSION'
          }, [channel.port2])
        } else {
          resolve(null)
        }
      })
    } catch (error) {
      console.error('获取SW信息失败:', error)
      return null
    }
  }

  // 清除缓存
  const clearCache = async (cacheName = 'all') => {
    if (!swRegistration) return false

    try {
      const channel = new MessageChannel()
      
      return new Promise((resolve) => {
        channel.port1.onmessage = (event) => {
          resolve(event.data.success)
        }
        
        if (swRegistration.active) {
          swRegistration.active.postMessage({
            type: 'CLEAR_CACHE',
            cacheName
          }, [channel.port2])
        } else {
          resolve(false)
        }
      })
    } catch (error) {
      console.error('清除缓存失败:', error)
      return false
    }
  }

  // 网络状态监听
  const handleOnline = () => {
    isOnline.value = true
  }
  
  const handleOffline = () => {
    isOnline.value = false
  }

  // PWA安装提示监听
  const handleBeforeInstallPrompt = (e) => {
    e.preventDefault()
    deferredPrompt = e
    isInstallable.value = true
  }

  // PWA安装完成监听
  const handleAppInstalled = () => {
    console.log('PWA已安装')
    isInstalled.value = true
    isInstallable.value = false
    deferredPrompt = null
  }

  // SW更新监听
  const handleSWUpdate = (registration) => {
    swRegistration = registration
    
    // 监听等待中的SW
    if (registration.waiting) {
      updateAvailable.value = true
      showUpdatePrompt.value = true
    }

    // 监听新的SW安装
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing
      
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          updateAvailable.value = true
          showUpdatePrompt.value = true
        }
      })
    })
  }

  onMounted(() => {
    // 检查安装状态
    checkInstalled()
    
    // 网络状态监听
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // PWA安装监听
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    // 注册Service Worker (使用vite-plugin-pwa的自动注册)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(handleSWUpdate)
      
      // 监听SW消息
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SW_UPDATE_AVAILABLE') {
          updateAvailable.value = true
          showUpdatePrompt.value = true
        }
      })
    }
  })

  onUnmounted(() => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.removeEventListener('appinstalled', handleAppInstalled)
  })

  return {
    isInstallable,
    isInstalled,
    isOnline,
    showUpdatePrompt,
    updateAvailable,
    installing,
    install,
    updateApp,
    skipWaiting,
    clearCache,
    getSWInfo
  }
}