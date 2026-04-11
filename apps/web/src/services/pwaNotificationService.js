import { showSnackbar } from '@/composables/useNotifications'

class PWANotificationService {
  constructor() {
    this.registration = null
    this.subscription = null
    this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window
    this.permission = 'default'
    
    this.init()
  }

  async init() {
    if (!this.isSupported) {
      console.warn('推送通知不受支持')
      return
    }

    try {
      // 获取Service Worker注册
      this.registration = await navigator.serviceWorker.ready
      this.permission = Notification.permission
      
      // 获取现有订阅
      this.subscription = await this.registration.pushManager.getSubscription()
      
      console.log('PWA通知服务初始化完成', {
        registration: !!this.registration,
        subscription: !!this.subscription,
        permission: this.permission
      })
    } catch (error) {
      console.error('PWA通知服务初始化失败:', error)
    }
  }

  // 请求通知权限
  async requestPermission() {
    if (!this.isSupported) {
      throw new Error('推送通知不受支持')
    }

    if (this.permission === 'granted') {
      return true
    }

    try {
      const permission = await Notification.requestPermission()
      this.permission = permission
      
      if (permission === 'granted') {
        showSnackbar('通知权限已授予', 'success')
        return true
      } else if (permission === 'denied') {
        showSnackbar('通知权限被拒绝', 'error')
        return false
      } else {
        showSnackbar('通知权限待定', 'info')
        return false
      }
    } catch (error) {
      console.error('请求通知权限失败:', error)
      showSnackbar('请求通知权限失败', 'error')
      throw error
    }
  }

  // 订阅推送通知
  async subscribe(serverPublicKey) {
    if (!this.isSupported || !this.registration) {
      throw new Error('推送通知不受支持或Service Worker未注册')
    }

    if (this.permission !== 'granted') {
      const granted = await this.requestPermission()
      if (!granted) {
        throw new Error('通知权限未授予')
      }
    }

    try {
      // 如果已有订阅，先取消
      if (this.subscription) {
        await this.unsubscribe()
      }

      // 创建新订阅
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(serverPublicKey)
      })

      this.subscription = subscription
      
      console.log('推送通知订阅成功:', subscription)
      return subscription
    } catch (error) {
      console.error('订阅推送通知失败:', error)
      throw error
    }
  }

  // 取消订阅
  async unsubscribe() {
    if (!this.subscription) {
      return true
    }

    try {
      const success = await this.subscription.unsubscribe()
      this.subscription = null
      
      console.log('取消推送通知订阅:', success)
      return success
    } catch (error) {
      console.error('取消订阅失败:', error)
      throw error
    }
  }

  // 获取订阅状态
  getSubscription() {
    return this.subscription
  }

  // 检查是否已订阅
  isSubscribed() {
    return !!this.subscription
  }

  // 获取权限状态
  getPermission() {
    return this.permission
  }

  // 检查是否支持推送通知
  isNotificationSupported() {
    return this.isSupported
  }

  // 显示本地通知（用于测试）
  async showLocalNotification(title, options = {}) {
    if (this.permission !== 'granted') {
      throw new Error('通知权限未授予')
    }

    const defaultOptions = {
      icon: '/favicon.png',
      badge: '/favicon.png',
      tag: 'local-notification',
      requireInteraction: false,
      ...options
    }

    try {
      if (this.registration) {
        // 使用Service Worker显示通知
        await this.registration.showNotification(title, defaultOptions)
      } else {
        // 使用浏览器API显示通知
        new Notification(title, defaultOptions)
      }
      
      console.log('本地通知已显示:', title)
    } catch (error) {
      console.error('显示本地通知失败:', error)
      throw error
    }
  }

  // 工具方法：将base64字符串转换为Uint8Array
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  // 获取推送订阅的公钥
  getSubscriptionKey() {
    if (!this.subscription || !this.subscription.getKey) {
      return null
    }

    try {
      const key = this.subscription.getKey('p256dh')
      return key ? btoa(String.fromCharCode(...new Uint8Array(key))) : null
    } catch (error) {
      console.error('获取订阅公钥失败:', error)
      return null
    }
  }

  // 获取推送订阅的认证信息
  getSubscriptionAuth() {
    if (!this.subscription || !this.subscription.getKey) {
      return null
    }

    try {
      const auth = this.subscription.getKey('auth')
      return auth ? btoa(String.fromCharCode(...new Uint8Array(auth))) : null
    } catch (error) {
      console.error('获取订阅认证信息失败:', error)
      return null
    }
  }

  // 获取完整的订阅信息（用于发送到服务器）
  getSubscriptionInfo() {
    if (!this.subscription) {
      return null
    }

    return {
      endpoint: this.subscription.endpoint,
      keys: {
        p256dh: this.getSubscriptionKey(),
        auth: this.getSubscriptionAuth()
      }
    }
  }
}

// 创建单例实例
export const pwaNotificationService = new PWANotificationService()

// 导出composable
export function usePWANotifications() {
  return {
    service: pwaNotificationService,
    isSupported: pwaNotificationService.isNotificationSupported(),
    requestPermission: () => pwaNotificationService.requestPermission(),
    subscribe: (serverKey) => pwaNotificationService.subscribe(serverKey),
    unsubscribe: () => pwaNotificationService.unsubscribe(),
    isSubscribed: () => pwaNotificationService.isSubscribed(),
    getPermission: () => pwaNotificationService.getPermission(),
    showLocalNotification: (title, options) => 
      pwaNotificationService.showLocalNotification(title, options),
    getSubscriptionInfo: () => pwaNotificationService.getSubscriptionInfo()
  }
}