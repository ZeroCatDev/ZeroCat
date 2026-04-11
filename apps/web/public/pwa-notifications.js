// 自定义推送通知处理，会被注入到生成的SW中

// 推送通知处理
self.addEventListener('push', function(event) {
  console.log('收到推送消息:', event)

  let notificationData = {
    title: '新通知',
    body: '您有一条新的通知',
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: 'zerocat-notification',
    requireInteraction: false,
    actions: [
      {
        action: 'view',
        title: '查看',
        icon: '/favicon.png'
      },
      {
        action: 'close',
        title: '关闭'
      }
    ],
    data: {
      url: '/app/notifications',
      timestamp: Date.now()
    }
  }

  // 解析推送数据
  if (event.data) {
    try {
      const pushData = event.data.json()
      console.log('推送数据:', pushData)
      
      // 更新通知数据
      if (pushData.title) notificationData.title = pushData.title
      if (pushData.body || pushData.content) notificationData.body = pushData.body || pushData.content
      if (pushData.icon) notificationData.icon = pushData.icon
      if (pushData.link || pushData.url) notificationData.data.url = pushData.link || pushData.url
      if (pushData.tag) notificationData.tag = pushData.tag
      if (pushData.requireInteraction !== undefined) notificationData.requireInteraction = pushData.requireInteraction
      
      // 处理自定义数据
      if (pushData.data) {
        notificationData.data = { ...notificationData.data, ...pushData.data }
      }

      // 处理优先级
      if (pushData.high_priority) {
        notificationData.requireInteraction = true
        notificationData.vibrate = [200, 100, 200]
      }
    } catch (error) {
      console.error('解析推送数据失败:', error)
    }
  }

  // 显示通知
  const promiseChain = self.registration.showNotification(notificationData.title, notificationData)
  event.waitUntil(promiseChain)
})

// 通知点击处理
self.addEventListener('notificationclick', function(event) {
  console.log('通知被点击:', event)
  
  const notification = event.notification
  const action = event.action
  
  // 关闭通知
  notification.close()
  
  // 处理操作
  if (action === 'close') {
    return
  }
  
  // 默认行为或"查看"操作：打开页面
  const urlToOpen = notification.data?.url || '/app/notifications'
  
  event.waitUntil(
    clients.matchAll({ 
      type: 'window', 
      includeUncontrolled: true 
    }).then(function(clientList) {
      // 检查是否已有打开的窗口
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i]
        try {
          const clientUrl = new URL(client.url)
          const targetUrl = new URL(urlToOpen, self.location.origin)
          
          // 如果是相同的页面，聚焦到该页面
          if (clientUrl.pathname === targetUrl.pathname && 'focus' in client) {
            return client.focus()
          }
        } catch (error) {
          console.warn('URL比较失败:', error)
        }
      }
      
      // 如果没有相关页面打开，打开新页面
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    }).catch(error => {
      console.error('处理通知点击失败:', error)
    })
  )
})

// 通知关闭处理
self.addEventListener('notificationclose', function(event) {
  console.log('通知被关闭:', event)
  
  // 可以发送分析数据
  const analyticsData = {
    action: 'close',
    notificationTag: event.notification.tag,
    timestamp: Date.now()
  }
  
  // 这里可以添加分析统计
  console.log('通知关闭分析:', analyticsData)
})

// 消息处理（用于与主线程通信）
self.addEventListener('message', function(event) {
  console.log('Service Worker收到消息:', event.data)
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ 
      version: 'zerocat-pwa-v1',
      timestamp: Date.now()
    })
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    const cacheName = event.data.cacheName
    // 由于使用generateSW，缓存管理由Workbox处理
    // 这里可以添加自定义缓存清理逻辑
    console.log('清理缓存请求:', cacheName)
    event.ports[0].postMessage({ success: true })
  }
})