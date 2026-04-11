<template>
  <v-dialog v-model="dialog" max-width="800px" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between">
        <div>
          <v-icon start>mdi-bell-cog</v-icon>
          通知设置
        </div>
        <v-btn icon variant="text" @click="dialog = false">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-divider></v-divider>

      <v-card-text>
        <v-container>
          <v-row>
            <!-- 浏览器推送通知设置 -->
            <v-col cols="12">
              <v-card variant="outlined">
                <v-card-title class="text-h6">
                  <v-icon start>mdi-web</v-icon>
                  浏览器推送通知
                </v-card-title>

                <v-card-text>
                  <div v-if="!pushStatus.supported" class="text-center py-4">
                    <v-icon color="warning" size="large">mdi-alert-circle</v-icon>
                    <div class="text-body-2 mt-2">您的浏览器不支持推送通知功能</div>
                  </div>

                  <template v-else>
                    <!-- 权限状态显示 -->
                    <v-alert
                      :type="getPermissionAlertType()"
                      :text="getPermissionText()"
                      class="mb-4"
                    ></v-alert>

                    <!-- 订阅状态和操作 -->
                    <div class="d-flex align-center justify-space-between mb-4">
                      <div>
                        <div class="text-subtitle-1">推送通知状态</div>
                        <div class="text-body-2 text-grey">
                          {{ pushStatus.subscribed ? '已启用' : '未启用' }}
                        </div>
                      </div>

                      <v-btn
                        :color="pushStatus.subscribed ? 'error' : 'primary'"
                        :loading="pushLoading"
                        :disabled="pushStatus.permission === 'denied'"
                        @click="togglePushNotification"
                      >
                        {{ pushStatus.subscribed ? '关闭推送' : '开启推送' }}
                      </v-btn>
                    </div>


                    <!-- 设备信息 -->
                    <v-expansion-panels v-if="pushStatus.subscribed" variant="accordion">
                      <v-expansion-panel>
                        <v-expansion-panel-title>
                          <v-icon start>mdi-information</v-icon>
                          设备信息
                        </v-expansion-panel-title>
                        <v-expansion-panel-text>
                          <v-list density="compact">
                            <v-list-item>
                              <v-list-item-title>浏览器</v-list-item-title>
                              <v-list-item-subtitle>{{ deviceInfo.browser }}</v-list-item-subtitle>
                            </v-list-item>
                            <v-list-item>
                              <v-list-item-title>操作系统</v-list-item-title>
                              <v-list-item-subtitle>{{ deviceInfo.os }}</v-list-item-subtitle>
                            </v-list-item>
                            <v-list-item>
                              <v-list-item-title>订阅时间</v-list-item-title>
                              <v-list-item-subtitle>{{ formatDate(subscriptionInfo?.created_at) }}</v-list-item-subtitle>
                            </v-list-item>
                          </v-list>
                        </v-expansion-panel-text>
                      </v-expansion-panel>
                    </v-expansion-panels>
                  </template>
                </v-card-text>
              </v-card>
            </v-col>

            <!-- 已注册的推送订阅列表 -->
            <v-col cols="12" v-if="pushStatus.supported">
              <v-card variant="outlined">
                <v-card-title class="text-h6">
                  <v-icon start>mdi-devices</v-icon>
                  已注册的设备
                  <v-btn
                    icon="mdi-refresh"
                    size="small"
                    variant="text"
                    :loading="subscriptionsLoading"
                    @click="loadSubscriptions"
                    class="ml-2"
                  ></v-btn>
                </v-card-title>

                <v-card-text>
                  <div v-if="subscriptionsLoading" class="text-center py-4">
                    <v-progress-circular indeterminate></v-progress-circular>
                  </div>

                  <div v-else-if="subscriptions.length === 0" class="text-center py-4">
                    <v-icon color="grey" size="large">mdi-cellphone-off</v-icon>
                    <div class="text-body-2 text-grey mt-2">暂无已注册的设备</div>
                  </div>

                  <v-list v-else>
                    <v-list-item
                      v-for="subscription in subscriptions"
                      :key="subscription.id"
                    >
                      <template v-slot:prepend>
                        <v-avatar color="primary">
                          <v-icon>{{ getDeviceIcon(subscription.device_info) }}</v-icon>
                        </v-avatar>
                      </template>

                      <v-list-item-title>
                        {{ subscription.device_info?.browser || '未知浏览器' }}
                        ({{ subscription.device_info?.os || '未知系统' }})
                      </v-list-item-title>

                      <v-list-item-subtitle>
                        注册时间: {{ formatDate(subscription.created_at) }}
                        <br>
                        最后使用: {{ formatDate(subscription.last_used_at) }}
                      </v-list-item-subtitle>

                      <template v-slot:append>
                        <v-btn
                          icon="mdi-delete"
                          size="small"
                          color="error"
                          variant="text"
                          @click="removeSubscription(subscription)"
                        ></v-btn>
                      </template>
                    </v-list-item>
                  </v-list>
                </v-card-text>
              </v-card>
            </v-col>

            <!-- 通知历史管理 -->
            <v-col cols="12">
              <v-card variant="outlined">
                <v-card-title class="text-h6">
                  <v-icon start>mdi-history</v-icon>
                  通知管理
                </v-card-title>

                <v-card-text>
                  <div class="d-flex align-center justify-space-between">
                    <div>
                      <div class="text-subtitle-1">未读通知</div>
                      <div class="text-body-2 text-grey">{{ unreadCount }} 条未读</div>
                    </div>

                    <v-btn
                      color="primary"
                      :disabled="unreadCount === 0"
                      @click="markAllAsRead"
                    >
                      全部标记为已读
                    </v-btn>
                  </div>

                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-container>
      </v-card-text>

      <v-divider></v-divider>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="primary" @click="dialog = false">关闭</v-btn>
      </v-card-actions>
    </v-card>

  </v-dialog>
</template>

<script>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useNotifications, showSnackbar } from '@/composables/useNotifications.js';
import pushNotificationService from '@/services/pushNotificationService.js';
import {
  markAllNotificationsAsRead,
  deleteNotifications,
  getUnreadNotificationCount
} from '@/services/notificationService.js';

export default {
  name: 'NotificationSettingsDialog',
  props: {
    modelValue: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    // 对话框状态
    const dialog = computed({
      get: () => props.modelValue,
      set: (value) => emit('update:modelValue', value)
    });

    // 使用统一的通知管理
    const notifications = useNotifications();

    // 加载状态
    const subscriptionsLoading = ref(false);
    const showCleanupDialog = ref(false);

    // 设备信息
    const deviceInfo = reactive({
      browser: 'Unknown',
      os: 'Unknown'
    });

    // 订阅信息
    const subscriptions = ref([]);
    const subscriptionInfo = ref(null);

    // 获取权限提示类型
    const getPermissionAlertType = () => {
      switch (notifications.pushStatus.permission) {
        case 'granted': return 'success';
        case 'denied': return 'error';
        default: return 'info';
      }
    };

    // 获取权限提示文本
    const getPermissionText = () => {
      switch (notifications.pushStatus.permission) {
        case 'granted':
          return '通知权限已授予，您可以接收推送通知';
        case 'denied':
          return '通知权限被拒绝，请在浏览器设置中手动开启';
        default:
          return '需要您的授权才能发送推送通知';
      }
    };

    // 获取设备图标
    const getDeviceIcon = (deviceInfo) => {
      if (!deviceInfo) return 'mdi-cellphone';

      const { browser, os } = deviceInfo;

      if (os?.includes('Android') || os?.includes('iOS')) {
        return 'mdi-cellphone';
      } else if (os?.includes('Windows') || os?.includes('Mac') || os?.includes('Linux')) {
        return 'mdi-laptop';
      } else {
        return 'mdi-web';
      }
    };

    // 格式化日期
    const formatDate = (dateString) => {
      if (!dateString) return '未知';
      return new Date(dateString).toLocaleString();
    };

    // 加载订阅列表
    const loadSubscriptions = async () => {
      subscriptionsLoading.value = true;

      try {
        const result = await pushNotificationService.getServerSubscriptions();
        subscriptions.value = result.subscriptions || [];

        // 查找当前订阅信息
        if (notifications.pushStatus.subscription) {
          subscriptionInfo.value = subscriptions.value.find(
            sub => sub.endpoint === notifications.pushStatus.subscription.endpoint
          );
        }
      } catch (error) {
        console.error('加载订阅列表失败:', error);
        showSnackbar('加载设备列表失败', 'error');
      } finally {
        subscriptionsLoading.value = false;
      }
    };

    // 移除订阅
    const removeSubscription = async (subscription) => {
      try {
        await pushNotificationService.unregisterWithServer({ endpoint: subscription.endpoint });
        await loadSubscriptions();

        showSnackbar('设备已移除', 'success');
      } catch (error) {
        console.error('移除订阅失败:', error);
        showSnackbar('移除设备失败', 'error');
      }
    };


    // 监听对话框打开
    watch(dialog, async (newVal) => {
      if (newVal) {
        await notifications.loadPushStatus();
        await loadSubscriptions();
        await notifications.loadUnreadCount();

        // 获取设备信息
        const info = pushNotificationService.getDeviceInfo();
        Object.assign(deviceInfo, info);
      }
    });

    onMounted(() => {
      notifications.loadPushStatus();
    });

    return {
      dialog,
      showCleanupDialog,
      subscriptionsLoading,
      deviceInfo,
      subscriptions,
      subscriptionInfo,
      getPermissionAlertType,
      getPermissionText,
      getDeviceIcon,
      formatDate,
      loadSubscriptions,
      removeSubscription,
      ...notifications
    };
  }
};
</script>

<style scoped>
.v-expansion-panel-text {
  padding-top: 16px;
}
</style>
