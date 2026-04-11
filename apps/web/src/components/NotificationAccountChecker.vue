<template>
  <!-- 这个组件在后台运行，不需要UI -->
</template>

<script setup>
import { watch, onMounted, onUnmounted } from 'vue'
import { localuser } from '@/services/localAccount'
import { pushNotificationService } from '@/services/pushNotificationService'
import { getPushSubscriptions } from '@/services/notificationService'

let checkInterval = null

// 检查推送通知是否匹配当前账户
const checkPushNotificationOwnership = async () => {
  try {
    // 如果用户未登录，无需检查
    if (!localuser.isLogin.value) {
      console.log('用户未登录，跳过推送通知检查')
      return
    }

    const currentUserId = localuser.user.value.id
    if (!currentUserId || currentUserId === 0) {
      console.warn('当前用户ID无效，无法检查推送通知')
      return
    }

    // 获取本地推送订阅状态
    const localStatus = await pushNotificationService.getSubscriptionStatus()

    // 如果本地没有订阅，无需检查
    if (!localStatus.subscribed || !localStatus.subscription) {
      console.log('本地没有有效的推送订阅，跳过检查')
      return
    }

    // 获取服务器端的推送订阅列表
    const serverSubscriptions = await getPushSubscriptions()
    if (!serverSubscriptions.subscriptions || !Array.isArray(serverSubscriptions.subscriptions)) {
      console.warn('服务器推送订阅数据无效，无法检查')
      return
    }

    // 查找当前设备的订阅
    const currentEndpoint = localStatus.subscription.endpoint
    const matchingSubscription = serverSubscriptions.subscriptions.find(

      sub => sub.endpoint === currentEndpoint
    )

    if (matchingSubscription) {
      // 检查订阅是否属于当前用户
      if (matchingSubscription.user_id !== currentUserId) {
        console.warn(`推送通知属于用户 ${matchingSubscription.user_id}，但当前用户是 ${currentUserId}，正在注销...`)

        // 注销不匹配的推送通知
        await pushNotificationService.unsubscribe()
        console.log('已自动注销不匹配账户的推送通知')
      } else {
        console.log('推送通知账户匹配正常')
      }
    }
  } catch (error) {
    console.warn('检查推送通知账户时出错:', error)
  }
}

// 监听用户登录状态变化
watch(
  () => localuser.isLogin.value,
  (isLoggedIn) => {
    if (isLoggedIn) {
      console.log('用户已登录，开始检查推送通知账户匹配')
      // 用户登录后，延迟检查推送通知
      setTimeout(checkPushNotificationOwnership, 2000)
    }
  },
  { immediate: true }
)

// 监听用户信息变化
watch(
  () => localuser.user.value.id,
  (newUserId, oldUserId) => {

    // 如果用户ID发生变化且都不为0，说明切换了账户
    if (newUserId && oldUserId && newUserId !== oldUserId && oldUserId !== 0) {
      console.log(`账户从 ${oldUserId} 切换到 ${newUserId}，检查推送通知`)
      setTimeout(checkPushNotificationOwnership, 1000)
    }
  }
)

onMounted(() => {
  // 组件挂载后立即检查一次
  if (localuser.isLogin.value) {
    setTimeout(checkPushNotificationOwnership, 3000)
  }

  // 每5分钟定期检查一次
  checkInterval = setInterval(checkPushNotificationOwnership, 5 * 60 * 1000)
})

onUnmounted(() => {
  if (checkInterval) {
    clearInterval(checkInterval)
  }
})
</script>
