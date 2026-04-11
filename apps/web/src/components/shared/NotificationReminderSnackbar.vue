<template>
  <v-snackbar
    v-model="show"
    :timeout="-1"
    location="top"
    color="info"
    class="notification-reminder-snackbar"
  >
    <div class="d-flex align-center">
      <v-icon class="me-3" size="24"> mdi-bell-outline </v-icon>
      <div class="flex-grow-1">
        <div class="text-subtitle-2 font-weight-medium">开启通知提醒</div>
        <div class="text-caption opacity-80">及时获取重要消息和项目更新</div>
      </div>
    </div>

    <template v-slot:actions>
      <v-btn variant="text" @click="handleEnable" class="text-white">
        开启
      </v-btn>
      <v-btn
        variant="text"
        @click="handleDismiss"
        class="text-white opacity-80"
        icon="mdi-close"
      >
      </v-btn>
    </template>
  </v-snackbar>
</template>

<script>
import { ref, onMounted, watch } from "vue";
import { localuser } from "@/services/localAccount";
import { useNotifications, showSnackbar } from "@/composables/useNotifications";

export default {
  name: "NotificationReminderSnackbar",

  setup() {
    const show = ref(false);
    const STORAGE_KEY = "notificationReminderDismissed";
    const DISMISS_THRESHOLD = 3; // 拒绝3次后停止提醒

    // 使用统一的通知管理
    const notifications = useNotifications();
    console.error(notifications.pushStatus);
    // 获取拒绝数据
    const getDismissData = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          return JSON.parse(stored);
        }
      } catch (error) {
        console.error("Error reading dismiss data:", error);
      }

      return {
        count: 0,
        lastShown: null,
        lastDismissed: null,
      };
    };

    // 保存拒绝数据
    const saveDismissData = (data) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (error) {
        console.error("Error saving dismiss data:", error);
      }
    };

    // 检查是否应该显示提醒
    const shouldShowReminder = () => {
      // 只有已登录用户才显示
      if (!localuser.isLogin.value) {
        //alert('请先登录');
        return false;
      }

      // 如果已经开启通知，不再提醒
      if (notifications.pushStatus?.subscribed) {
        //alert('您已开启通知');
        return false;
      }

      // 检查拒绝次数
      const dismissData = getDismissData();
      if (dismissData.count >= DISMISS_THRESHOLD) {
        //alert('您已拒绝开启通知超过3次，已停止提醒');
        return false;
      }

      return true;
    };

    // 处理开启通知
    const handleEnable = async () => {
      show.value = false;

      try {
        await notifications.togglePushNotification();
        await notifications.loadPushStatus(); // 刷新推送状态

        // 清除拒绝记录
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.error("Failed to enable notifications:", error);
      }
    };

    // 处理暂不开启
    const handleDismiss = () => {
      show.value = false;

      const dismissData = getDismissData();
      const newData = {
        count: dismissData.count + 1,
        lastShown: new Date().toDateString(),
        lastDismissed: new Date().toISOString(),
      };

      saveDismissData(newData);

      if (newData.count >= DISMISS_THRESHOLD) {
        showSnackbar("已停止通知提醒，您可以在设置中随时开启", "info", 4000);
      }
    };

    // 显示提醒
    const showReminder = () => {
      if (shouldShowReminder()) {
        // 延迟显示，避免与其他通知冲突
        setTimeout(() => {
          show.value = true;

          // 更新显示记录
          const dismissData = getDismissData();
          const newData = {
            ...dismissData,
            lastShown: new Date().toDateString(),
          };
          saveDismissData(newData);
        }, 2000);
      }
    };

    // 检查并处理通知逻辑
    const checkAndHandleNotifications = async () => {
      if (!localuser.isLogin.value) {
        show.value = false;
        return;
      }

      await notifications.loadPushStatus();

      // 如果浏览器不支持通知，则不执行任何操作
      if (!notifications.pushStatus.supported) {
        console.log("浏览器不支持推送通知。");
        return;
      }

      // 如果已经授予权限，则自动尝试订阅（如果尚未订阅）
      if (notifications.pushStatus.permission === 'granted') {
        if (!notifications.pushStatus.subscribed) {
          console.log("已授予权限，自动订阅通知...");
          await notifications.togglePushNotification();
        }
        show.value = false; // 无论如何都不显示弹窗
      }
      // 如果权限是默认或被拒绝，则显示提醒弹窗
      else {
        showReminder();
      }
    };

    // 监听登录状态变化
    watch(
      () => localuser.isLogin.value,
      (isLoggedIn) => {
        if (isLoggedIn) {
          checkAndHandleNotifications();
        } else {
          show.value = false;
        }
      }
    );

    // 监听推送状态变化
    watch(
      () => notifications.pushStatus.subscribed,
      (subscribed) => {
        if (subscribed) {
          show.value = false;
        }
      }
    );

    // 组件挂载时检查
    onMounted(() => {
      checkAndHandleNotifications();
    });

    return {
      show,
      handleEnable,
      handleDismiss,
    };
  },
};
</script>

<style scoped>
.notification-reminder-snackbar :deep(.v-snackbar__wrapper) {
  min-height: 80px;
}

.notification-reminder-snackbar :deep(.v-snackbar__content) {
  padding: 16px 24px;
}
</style>
