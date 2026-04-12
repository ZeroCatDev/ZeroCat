<template>
  <v-container>
    <v-row>
      <!-- 通知概览卡片 -->
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>
            <v-icon start>mdi-bell</v-icon>
            通知概览
          </v-card-title>

          <v-card-text>
            <v-list>
              <v-list-item>
                <template v-slot:prepend>
                  <v-icon color="primary">mdi-email</v-icon>
                </template>
                <v-list-item-title>未读通知</v-list-item-title>
                <v-list-item-subtitle>{{ unreadCount }} 条</v-list-item-subtitle>
              </v-list-item>

              <v-list-item>
                <template v-slot:prepend>
                  <v-icon :color="pushStatus.subscribed ? 'success' : 'grey'">
                    mdi-web
                  </v-icon>
                </template>
                <v-list-item-title>浏览器推送</v-list-item-title>
                <v-list-item-subtitle>
                  {{ pushStatus.subscribed ? '已开启' : '未开启' }}
                </v-list-item-subtitle>
              </v-list-item>

              <v-list-item>
                <template v-slot:prepend>
                  <v-icon :color="pushStatus.permission === 'granted' ? 'success' : 'warning'">
                    mdi-shield-check
                  </v-icon>
                </template>
                <v-list-item-title>通知权限</v-list-item-title>
                <v-list-item-subtitle>
                  {{ getPermissionText(pushStatus.permission) }}
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>

          <v-card-actions>
            <v-btn
              color="primary"
              :to="'/app/notifications'"
              prepend-icon="mdi-bell"
            >
              查看所有通知
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <!-- 快速操作卡片 -->
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>
            <v-icon start>mdi-cog</v-icon>
            快速操作
          </v-card-title>

          <v-card-text>
            <v-list>
              <v-list-item class="action-item" @click="togglePushNotification" :disabled="pushLoading">
                <template v-slot:prepend>
                  <v-progress-circular
                    v-if="pushLoading"
                    indeterminate
                    size="24"
                  ></v-progress-circular>
                  <v-icon
                    v-else
                    :color="pushStatus.subscribed ? 'success' : 'primary'"
                  >
                    {{ pushStatus.subscribed ? 'mdi-bell-off' : 'mdi-bell' }}
                  </v-icon>
                </template>
                <v-list-item-title>
                  {{ pushStatus.subscribed ? '关闭浏览器推送' : '开启浏览器推送' }}
                </v-list-item-title>
                <v-list-item-subtitle>
                  {{ pushStatus.subscribed ? '停止接收推送通知' : '开始接收推送通知' }}
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-4">
      <!-- 浏览器推送通知设置 -->
      <v-col cols="12">
        <v-card border>
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
                :type="getPushPermissionAlertType()"
                :text="getPushPermissionHint()"
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
        <v-card border>
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

      <!-- 自定义通知等级设置 -->
      <v-col cols="12">
        <v-card border>
          <v-card-title class="text-h6">
            <v-icon start>mdi-bell-badge</v-icon>
            通知等级设置
            <v-btn
              icon="mdi-refresh"
              size="small"
              variant="text"
              :loading="changedSettingsLoading"
              @click="loadChangedSettings"
              class="ml-2"
            ></v-btn>
          </v-card-title>

          <v-card-text>
            <div v-if="changedSettingsLoading" class="text-center py-4">
              <v-progress-circular indeterminate></v-progress-circular>
            </div>

            <div v-else-if="changedSettings.length === 0" class="text-center py-4">
              <v-icon color="grey" size="large">mdi-bell-off-outline</v-icon>
              <div class="text-body-2 text-grey mt-2">暂无自定义通知设置</div>
              <div class="text-caption text-grey mt-1">当你对用户或项目设置通知等级时，会显示在这里</div>
            </div>

            <v-list v-else>
              <v-list-item
                v-for="setting in changedSettings"
                :key="setting.id"
              >
                <v-list-item-title>{{ formatSettingTarget(setting) }}</v-list-item-title>
                <v-list-item-subtitle>
                  更新时间: {{ formatDate(setting.updated_at) }}
                </v-list-item-subtitle>

                <template v-slot:append>
                  <NotificationLevelSelector
                    v-model="setting.level"
                    :loading="isSettingUpdating(setting)"
                    :disabled="isSettingUpdating(setting)"
                    label="通知等级"
                    @change="(value) => updateSettingLevel(setting, value)"
                  />
                </template>
              </v-list-item>
            </v-list>

            <div v-if="changedSettings.length > 0" class="text-caption text-grey mt-2">
              选择“默认”会从列表移除，表示恢复默认通知等级
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { ref, reactive, onMounted } from 'vue';
import { useNotifications, showSnackbar } from '@/composables/useNotifications.js';
import pushNotificationService from '@/services/pushNotificationService.js';
import NotificationLevelSelector from '@/components/notifications/NotificationLevelSelector.vue';
import {
  listChangedNotificationSettings,
  updateNotificationSetting
} from '@/services/notificationService.js';

export default {
  name: 'NotificationSettingsCard',
  components: {
    NotificationLevelSelector
  },
  setup() {
    // 使用统一的通知管理
    const notifications = useNotifications();

    // 订阅状态
    const subscriptionsLoading = ref(false);
    const subscriptions = ref([]);
    const subscriptionInfo = ref(null);

    // 设备信息
    const deviceInfo = reactive({
      browser: 'Unknown',
      os: 'Unknown'
    });

    // 通知等级设置
    const changedSettings = ref([]);
    const changedSettingsLoading = ref(false);
    const changedSettingsUpdating = reactive({});
    const persistedLevels = reactive({});

    const getPushPermissionAlertType = () => {
      switch (notifications.pushStatus.permission) {
        case 'granted':
          return 'success';
        case 'denied':
          return 'error';
        default:
          return 'info';
      }
    };

    const getPushPermissionHint = () => {
      switch (notifications.pushStatus.permission) {
        case 'granted':
          return '通知权限已授予，您可以接收推送通知';
        case 'denied':
          return '通知权限被拒绝，请在浏览器设置中手动开启';
        default:
          return '需要您的授权才能发送推送通知';
      }
    };

    const getDeviceIcon = (device) => {
      if (!device) return 'mdi-cellphone';

      const { os } = device;

      if (os?.includes('Android') || os?.includes('iOS')) {
        return 'mdi-cellphone';
      }
      if (os?.includes('Windows') || os?.includes('Mac') || os?.includes('Linux')) {
        return 'mdi-laptop';
      }
      return 'mdi-web';
    };

    const formatDate = (dateString) => {
      if (!dateString) return '未知';
      return new Date(dateString).toLocaleString();
    };

    const loadSubscriptions = async () => {
      subscriptionsLoading.value = true;

      try {
        const result = await pushNotificationService.getServerSubscriptions();
        subscriptions.value = result.subscriptions || [];

        if (notifications.pushStatus.subscription) {
          subscriptionInfo.value = subscriptions.value.find(
            (sub) => sub.endpoint === notifications.pushStatus.subscription.endpoint
          ) || null;
        } else {
          subscriptionInfo.value = null;
        }
      } catch (error) {
        console.error('加载订阅列表失败:', error);
        showSnackbar('加载设备列表失败', 'error');
      } finally {
        subscriptionsLoading.value = false;
      }
    };

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

    const formatTargetType = (targetType) => {
      const normalized = String(targetType || '').toUpperCase();
      if (normalized === 'USER') return '用户';
      if (normalized === 'PROJECT') return '项目';
      return targetType || '未知';
    };

    const formatSettingTarget = (setting) => {
      return `${formatTargetType(setting?.target_type)} #${setting?.target_id}`;
    };

    const getSettingKey = (setting) => {
      return `${String(setting?.target_type || '').toUpperCase()}:${setting?.target_id}`;
    };

    const isSettingUpdating = (setting) => {
      return !!changedSettingsUpdating[getSettingKey(setting)];
    };

    const loadChangedSettings = async () => {
      changedSettingsLoading.value = true;
      try {
        const result = await listChangedNotificationSettings();
        const settings = Array.isArray(result?.settings) ? result.settings : [];
        changedSettings.value = settings;

        Object.keys(persistedLevels).forEach((key) => {
          delete persistedLevels[key];
        });
        settings.forEach((setting) => {
          persistedLevels[getSettingKey(setting)] = setting.level;
        });
      } catch (error) {
        console.error('加载通知设置失败:', error);
        showSnackbar('加载通知设置失败', 'error');
      } finally {
        changedSettingsLoading.value = false;
      }
    };

    const updateSettingLevel = async (setting, nextLevel) => {
      const key = getSettingKey(setting);
      if (changedSettingsUpdating[key]) return;

      const previousLevel = persistedLevels[key] || setting.level;
      changedSettingsUpdating[key] = true;

      try {
        await updateNotificationSetting({
          targetId: setting.target_id,
          targetType: setting.target_type,
          level: nextLevel
        });

        const normalizedLevel = String(nextLevel || '').toUpperCase();
        if (normalizedLevel === 'BASIC' || normalizedLevel === 'DEFAULT') {
          changedSettings.value = changedSettings.value.filter((item) => getSettingKey(item) !== key);
          delete persistedLevels[key];
        } else {
          persistedLevels[key] = nextLevel;
          setting.level = nextLevel;
        }

        showSnackbar('通知等级已更新', 'success');
      } catch (error) {
        setting.level = previousLevel;
        const message = error?.response?.data?.error || '更新通知等级失败';
        showSnackbar(message, 'error');
        console.error('更新通知等级失败:', error);
      } finally {
        changedSettingsUpdating[key] = false;
      }
    };

    // 刷新通知
    const refreshNotifications = async () => {
      await notifications.loadUnreadCount();
      await notifications.loadPushStatus();
    };

    // 初始化
    onMounted(async () => {
      await notifications.loadPushStatus();
      await Promise.all([
        notifications.loadUnreadCount(),
        loadSubscriptions(),
        loadChangedSettings()
      ]);

      const info = pushNotificationService.getDeviceInfo();
      Object.assign(deviceInfo, info);
    });

    return {
      refreshNotifications,
      subscriptionsLoading,
      subscriptions,
      subscriptionInfo,
      deviceInfo,
      getPushPermissionAlertType,
      getPushPermissionHint,
      getDeviceIcon,
      formatDate,
      loadSubscriptions,
      removeSubscription,
      changedSettings,
      changedSettingsLoading,
      formatSettingTarget,
      isSettingUpdating,
      loadChangedSettings,
      updateSettingLevel,
      ...notifications
    };
  }
};
</script>

<style scoped>
.action-item {
  cursor: pointer;
}

.action-item:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.action-item[disabled] {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
