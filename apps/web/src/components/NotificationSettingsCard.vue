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
              <v-list-item @click="togglePushNotification" :disabled="pushLoading">
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



              <v-list-item @click="openSettings">
                <template v-slot:prepend>
                  <v-icon color="primary">mdi-cog</v-icon>
                </template>
                <v-list-item-title>高级设置</v-list-item-title>
                <v-list-item-subtitle>管理设备和详细设置</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>

    </v-row>

    <!-- 设置对话框 -->
    <notification-settings-dialog v-model="showSettingsDialog" />
  </v-container>
</template>

<script>
import { ref, onMounted } from 'vue';
import { useNotifications } from '@/composables/useNotifications.js';
import NotificationsCard from '@/components/NotificationsCard.vue';
import NotificationSettingsDialog from '@/components/NotificationSettingsDialog.vue';

export default {
  name: 'NotificationSettingsCard',
  components: {
    NotificationsCard,
    NotificationSettingsDialog
  },
  setup() {
    const showSettingsDialog = ref(false);

    // 使用统一的通知管理
    const notifications = useNotifications();

    // 打开设置对话框
    const openSettings = () => {
      showSettingsDialog.value = true;
    };

    // 刷新通知
    const refreshNotifications = async () => {
      await notifications.loadUnreadCount();
      await notifications.loadPushStatus();
    };

    // 初始化
    onMounted(async () => {
      await notifications.loadPushStatus();
      await notifications.loadUnreadCount();
    });

    return {
      showSettingsDialog,
      openSettings,
      refreshNotifications,
      ...notifications
    };
  }
};
</script>

<style scoped>
.v-list-item {
  cursor: pointer;
}

.v-list-item:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.v-list-item[disabled] {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
