import { ref, reactive, computed } from 'vue';
import pushNotificationService from '@/services/pushNotificationService.js';
import { useNotificationStore } from '@/stores/notification';

// 创建全局snackbar状态
export const globalSnackbar = reactive({
  show: false,
  text: '',
  color: 'success',
  timeout: 3000
});

// 显示snackbar的全局函数
export const showSnackbar = (text, color = 'success', timeout = 3000) => {
  globalSnackbar.text = text;
  globalSnackbar.color = color;
  globalSnackbar.timeout = timeout;
  globalSnackbar.show = true;
};

// 通知管理工具
export const useNotifications = () => {
  const notificationStore = useNotificationStore();

  // 状态管理
  const unreadCount = computed(() => notificationStore.unreadCount);
  const pushLoading = ref(false);
  const pushStatus = reactive({
    supported: false,
    permission: 'default',
    subscribed: false,
    subscription: null
  });

  // 获取权限文本
  const getPermissionText = (permission) => {
    switch (permission) {
      case 'granted': return '已授权';
      case 'denied': return '已拒绝';
      default: return '未设置';
    }
  };

  // 加载推送状态
  const loadPushStatus = async () => {
    try {
      const status = await pushNotificationService.getSubscriptionStatus();
      Object.assign(pushStatus, status);
    } catch (error) {
      console.error('加载推送状态失败:', error);
    }
  };

  // 加载未读数量
  const loadUnreadCount = async () => {
    try {
      await notificationStore.fetchUnreadCount();
    } catch (error) {
      console.error('加载未读数量失败:', error);
    }
  };

  // 切换推送通知
  const togglePushNotification = async () => {
    pushLoading.value = true;

    try {
      if (pushStatus.subscribed) {
        await pushNotificationService.unsubscribe();
        showSnackbar('推送通知已关闭', 'success');
      } else {
        await pushNotificationService.subscribe();
        showSnackbar('推送通知已开启', 'success');
      }

      await loadPushStatus();
    } catch (error) {
      console.error('切换推送通知失败:', error);
      showSnackbar(error.message || '操作失败', 'error');
    } finally {
      pushLoading.value = false;
    }
  };

  // 标记所有为已读
  const markAllAsRead = async () => {
    try {
      await notificationStore.markAllAsRead();
      showSnackbar('所有通知已标记为已读', 'success');
    } catch (error) {
      console.error('标记已读失败:', error);
      showSnackbar('操作失败', 'error');
    }
  };

  // 更新未读数量
  const updateUnreadCount = (count) => {
    notificationStore.setUnreadCount(count);
  };

  return {
    // 状态
    unreadCount,
    pushLoading,
    pushStatus,

    // 方法
    getPermissionText,
    loadPushStatus,
    loadUnreadCount,
    togglePushNotification,
    markAllAsRead,
    updateUnreadCount
  };
};
