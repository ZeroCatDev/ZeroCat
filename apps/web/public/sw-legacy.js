// Service Worker for push notifications
const CACHE_NAME = 'zerocat-notifications-v1';

// 监听推送事件
self.addEventListener('push', function(event) {
  console.log('收到推送消息:', event);

  let notificationData = {
    title: '新通知',
    body: '您有一条新的通知',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'default-notification',
    requireInteraction: false,
    actions: [
      {
        action: 'view',
        title: '查看',
        icon: '/favicon.ico'
      },
      {
        action: 'close',
        title: '关闭'
      }
    ],
    data: {
      url: '/app/notifications'
    }
  };

  // 解析推送数据
  if (event.data) {
    try {
      const pushData = event.data.json();
      console.log('推送数据:', pushData);
      
      // 更新通知数据
      if (pushData.title) notificationData.title = pushData.title;
      if (pushData.body || pushData.content) notificationData.body = pushData.body || pushData.content;
      if (pushData.icon) notificationData.icon = pushData.icon;
      if (pushData.link || pushData.url) notificationData.data.url = pushData.link || pushData.url;
      if (pushData.tag) notificationData.tag = pushData.tag;
      if (pushData.requireInteraction !== undefined) notificationData.requireInteraction = pushData.requireInteraction;
      
      // 处理自定义数据
      if (pushData.data) {
        notificationData.data = { ...notificationData.data, ...pushData.data };
      }
    } catch (error) {
      console.error('解析推送数据失败:', error);
      // 使用默认数据
    }
  }

  // 显示通知
  const promiseChain = self.registration.showNotification(notificationData.title, notificationData);
  event.waitUntil(promiseChain);
});

// 监听通知点击事件
self.addEventListener('notificationclick', function(event) {
  console.log('通知被点击:', event);
  
  const notification = event.notification;
  const action = event.action;
  
  // 关闭通知
  notification.close();
  
  // 处理操作
  if (action === 'close') {
    // 用户选择关闭，什么也不做
    return;
  }
  
  // 默认行为或"查看"操作：打开页面
  const urlToOpen = notification.data?.url || '/app/notifications';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // 检查是否已有打开的窗口
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        try {
          const clientUrl = new URL(client.url);
          const targetUrl = new URL(urlToOpen, self.location.origin);
          if (clientUrl.pathname === targetUrl.pathname && 'focus' in client) {
            // 如果已有相关页面打开，聚焦到该页面
            return client.focus();
          }
        } catch (error) {
          console.warn('URL比较失败:', error);
        }
      }
      
      // 如果没有相关页面打开，打开新页面
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    }).catch(error => {
      console.error('处理通知点击失败:', error);
    })
  );
});

// 监听通知关闭事件
self.addEventListener('notificationclose', function(event) {
  console.log('通知被关闭:', event);
  
  // 可以在这里发送分析数据
  // event.waitUntil(
  //   fetch('/api/notifications/analytics', {
  //     method: 'POST',
  //     body: JSON.stringify({
  //       action: 'close',
  //       notificationTag: event.notification.tag,
  //       timestamp: Date.now()
  //     })
  //   })
  // );
});

// Service Worker安装事件
self.addEventListener('install', function(event) {
  console.log('Service Worker安装');
  
  // 跳过等待，立即激活
  self.skipWaiting();
  
  // 简化安装过程，不预缓存任何资源
  event.waitUntil(Promise.resolve());
});

// Service Worker激活事件
self.addEventListener('activate', function(event) {
  console.log('Service Worker激活');
  
  // 清理旧缓存（如果有的话）
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('删除旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function() {
      // 立即接管所有页面
      return self.clients.claim();
    }).catch(error => {
      console.error('Service Worker激活失败:', error);
    })
  );
});

// 处理消息事件（用于与主线程通信）
self.addEventListener('message', function(event) {
  console.log('Service Worker收到消息:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});