import {
  registerBrowserNotification,
  unregisterBrowserNotification,
  getPushSubscriptions
} from './notificationService.js';
import { get } from "@/services/serverConfig";

class PushNotificationService {
  constructor() {
    this.isSupported = this.checkSupport();
    this.subscription = null;
    this.registration = null;
  }

  // 检查浏览器是否支持推送通知
  checkSupport() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  // 获取设备信息
  getDeviceInfo() {
    const userAgent = navigator.userAgent;
    let browser = 'Unknown';
    let os = 'Unknown';

    // 检测浏览器
    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';

    // 检测操作系统
    if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Mac')) os = 'macOS';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iOS')) os = 'iOS';

    return { browser, os, version: navigator.appVersion, userAgent };
  }

  // 请求通知权限
  async requestPermission() {
    if (!this.isSupported) {
      throw new Error('浏览器不支持推送通知');
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      throw new Error('用户已拒绝通知权限，请在浏览器设置中手动开启');
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('用户拒绝了通知权限');
    }

    return permission;
  }

  // 注册Service Worker并订阅推送通知
  async subscribe() {
    try {
      // 请求权限
      await this.requestPermission();

      // 使用现有的Service Worker注册
      if (!this.registration) {
        if (!('serviceWorker' in navigator)) {
          throw new Error('浏览器不支持Service Worker');
        }

        // 等待已注册的Service Worker准备就绪
        this.registration = await navigator.serviceWorker.ready;
        console.log('使用现有Service Worker:', this.registration);
      }

      // 检查是否已有订阅
      const existingSubscription = await this.registration.pushManager.getSubscription();
      if (existingSubscription) {
        this.subscription = existingSubscription;
        console.log('已存在推送订阅:', existingSubscription);
        
        // 向服务器注册现有订阅
        await this.registerWithServer(existingSubscription);
        return existingSubscription;
      }

      // 创建新的订阅
      const subscribeOptions = { userVisibleOnly: true };
      
      // 从服务器配置获取VAPID公钥
      try {
        const vapidPublicKey = get("webpush.vapid_public_key");
        if (vapidPublicKey && vapidPublicKey.trim()) {
          subscribeOptions.applicationServerKey = this.urlBase64ToUint8Array(vapidPublicKey);
          console.log('使用VAPID公钥:', vapidPublicKey);
        }
      } catch (error) {
        console.warn('获取VAPID公钥失败，使用基本订阅:', error);
      }

      const subscription = await this.registration.pushManager.subscribe(subscribeOptions);
      this.subscription = subscription;
      
      // 向服务器注册订阅
      await this.registerWithServer(subscription);

      console.log('推送通知订阅成功:', subscription);
      return subscription;

    } catch (error) {
      console.error('订阅推送通知失败:', error);
      throw error;
    }
  }

  // 取消订阅推送通知
  async unsubscribe() {
    try {
      if (!this.subscription) {
        this.registration = await navigator.serviceWorker.ready;
        this.subscription = await this.registration.pushManager.getSubscription();
      }

      if (this.subscription) {
        // 从服务器取消注册
        await this.unregisterWithServer(this.subscription);
        
        // 取消本地订阅
        await this.subscription.unsubscribe();
        this.subscription = null;
        
        console.log('推送通知取消订阅成功');
        return true;
      }

      return false;
    } catch (error) {
      console.error('取消订阅推送通知失败:', error);
      throw error;
    }
  }

  // 向服务器注册订阅
  async registerWithServer(subscription) {
    try {
      const deviceInfo = this.getDeviceInfo();
      const result = await registerBrowserNotification(subscription, deviceInfo);
      console.log('服务器注册成功:', result);
      return result;
    } catch (error) {
      console.error('服务器注册失败:', error);
      throw error;
    }
  }

  // 从服务器取消注册
  async unregisterWithServer(subscription) {
    try {
      const result = await unregisterBrowserNotification(subscription.endpoint);
      console.log('服务器取消注册成功:', result);
      return result;
    } catch (error) {
      console.error('服务器取消注册失败:', error);
      throw error;
    }
  }

  // 获取当前订阅状态
  async getSubscriptionStatus() {
    try {
      if (!this.isSupported) {
        return { supported: false, permission: 'unsupported', subscribed: false };
      }

      const permission = Notification.permission;
      let subscribed = false;
      let subscription = null;

      if (permission === 'granted') {
        this.registration = await navigator.serviceWorker.ready;
        subscription = await this.registration.pushManager.getSubscription();
        subscribed = !!subscription;
        this.subscription = subscription;
      }

      return { supported: true, permission, subscribed, subscription };
    } catch (error) {
      console.error('获取订阅状态失败:', error);
      return {
        supported: this.isSupported,
        permission: Notification.permission,
        subscribed: false,
        error: error.message
      };
    }
  }

  // 获取服务器端的订阅列表
  async getServerSubscriptions() {
    return await getPushSubscriptions();
  }

  // 显示本地通知（用于测试）
  async showTestNotification(title = '测试通知', options = {}) {
    if (Notification.permission !== 'granted') {
      throw new Error('没有通知权限');
    }

    const defaultOptions = {
      body: '这是一条测试通知',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'test-notification',
      requireInteraction: false,
      actions: [
        { action: 'view', title: '查看', icon: '/favicon.ico' },
        { action: 'close', title: '关闭' }
      ]
    };

    const notification = new Notification(title, { ...defaultOptions, ...options });
    
    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return notification;
  }

  // 工具函数：将Base64编码的VAPID公钥转换为Uint8Array
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}

// 创建单例实例
export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;