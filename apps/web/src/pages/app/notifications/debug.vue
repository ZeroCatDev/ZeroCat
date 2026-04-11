<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title>
            <v-icon start>mdi-bug</v-icon>
            通知系统调试面板
          </v-card-title>

          <v-card-text>
            <v-alert type="info" class="mb-4">
              此页面仅用于开发和调试目的，包含各种通知功能的测试工具。
            </v-alert>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row>
      <!-- 推送通知调试 -->
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>
            <v-icon start>mdi-web</v-icon>
            浏览器推送调试
          </v-card-title>

          <v-card-text>
            <!-- 状态信息 -->
            <v-expansion-panels variant="accordion" class="mb-4">
              <v-expansion-panel>
                <v-expansion-panel-title>
                  <v-icon start>mdi-information</v-icon>
                  系统状态
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-list density="compact">
                    <v-list-item>
                      <v-list-item-title>浏览器支持</v-list-item-title>
                      <v-list-item-subtitle>
                        <v-chip
                          :color="pushStatus.supported ? 'success' : 'error'"
                          size="small"
                        >
                          {{ pushStatus.supported ? '支持' : '不支持' }}
                        </v-chip>
                      </v-list-item-subtitle>
                    </v-list-item>

                    <v-list-item>
                      <v-list-item-title>通知权限</v-list-item-title>
                      <v-list-item-subtitle>
                        <v-chip
                          :color="getPermissionColor(pushStatus.permission)"
                          size="small"
                        >
                          {{ pushStatus.permission }}
                        </v-chip>
                      </v-list-item-subtitle>
                    </v-list-item>

                    <v-list-item>
                      <v-list-item-title>订阅状态</v-list-item-title>
                      <v-list-item-subtitle>
                        <v-chip
                          :color="pushStatus.subscribed ? 'success' : 'warning'"
                          size="small"
                        >
                          {{ pushStatus.subscribed ? '已订阅' : '未订阅' }}
                        </v-chip>
                      </v-list-item-subtitle>
                    </v-list-item>

                    <v-list-item>
                      <v-list-item-title>设备信息</v-list-item-title>
                      <v-list-item-subtitle>
                        {{ deviceInfo.browser }} / {{ deviceInfo.os }}
                      </v-list-item-subtitle>
                    </v-list-item>
                  </v-list>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <v-expansion-panel v-if="pushStatus.subscription">
                <v-expansion-panel-title>
                  <v-icon start>mdi-code-json</v-icon>
                  订阅详情
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-textarea
                    :model-value="JSON.stringify(pushStatus.subscription, null, 2)"
                    readonly
                    variant="outlined"
                    rows="10"
                    class="code-textarea"
                  ></v-textarea>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>

            <!-- 操作按钮 -->
            <v-row>
              <v-col cols="12" sm="6">
                <v-btn
                  block
                  color="primary"
                  :loading="loading.permission"
                  @click="requestPermission"
                >
                  <v-icon start>mdi-shield-check</v-icon>
                  请求权限
                </v-btn>
              </v-col>

              <v-col cols="12" sm="6">
                <v-btn
                  block
                  :color="pushStatus.subscribed ? 'error' : 'success'"
                  :loading="loading.subscription"
                  @click="toggleSubscription"
                >
                  <v-icon start>
                    {{ pushStatus.subscribed ? 'mdi-bell-off' : 'mdi-bell' }}
                  </v-icon>
                  {{ pushStatus.subscribed ? '取消订阅' : '订阅推送' }}
                </v-btn>
              </v-col>


              <v-col cols="12" sm="6">
                <v-btn
                  block
                  color="warning"
                  :loading="loading.serverTest"
                  @click="sendServerTestNotification"
                >
                  <v-icon start>mdi-server</v-icon>
                  测试服务器推送
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- API调试 -->
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>
            <v-icon start>mdi-api</v-icon>
            API调试
          </v-card-title>

          <v-card-text>
            <v-row>
              <v-col cols="12">
                <v-btn
                  block
                  color="primary"
                  :loading="loading.notifications"
                  @click="fetchNotifications"
                  class="mb-2"
                >
                  <v-icon start>mdi-download</v-icon>
                  获取通知列表
                </v-btn>
              </v-col>

              <v-col cols="12">
                <v-btn
                  block
                  color="success"
                  :loading="loading.unreadCount"
                  @click="fetchUnreadCount"
                  class="mb-2"
                >
                  <v-icon start>mdi-counter</v-icon>
                  获取未读数量
                </v-btn>
              </v-col>

              <v-col cols="12">
                <v-btn
                  block
                  color="info"
                  :loading="loading.subscriptions"
                  @click="fetchSubscriptions"
                  class="mb-2"
                >
                  <v-icon start>mdi-devices</v-icon>
                  获取订阅列表
                </v-btn>
              </v-col>

              <v-col cols="12">
                <v-btn
                  block
                  color="warning"
                  :loading="loading.markAllRead"
                  @click="markAllAsRead"
                  class="mb-2"
                >
                  <v-icon start>mdi-check-all</v-icon>
                  标记全部已读
                </v-btn>
              </v-col>
            </v-row>

            <!-- API响应展示 -->
            <v-expansion-panels v-if="apiResponses.length > 0" variant="accordion" class="mt-4">
              <v-expansion-panel
                v-for="(response, index) in apiResponses"
                :key="index"
              >
                <v-expansion-panel-title>
                  <v-icon start :color="response.success ? 'success' : 'error'">
                    {{ response.success ? 'mdi-check' : 'mdi-alert' }}
                  </v-icon>
                  {{ response.title }} - {{ response.timestamp }}
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-textarea
                    :model-value="JSON.stringify(response.data, null, 2)"
                    readonly
                    variant="outlined"
                    rows="8"
                    class="code-textarea"
                  ></v-textarea>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 控制台日志 -->
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title>
            <v-icon start>mdi-console</v-icon>
            控制台日志
            <v-spacer></v-spacer>
            <v-btn
              icon="mdi-delete"
              size="small"
              color="error"
              @click="clearLogs"
            ></v-btn>
          </v-card-title>

          <v-card-text>
            <div class="console-container">
              <div
                v-for="(log, index) in logs"
                :key="index"
                :class="['log-entry', `log-${log.level}`]"
              >
                <span class="log-timestamp">{{ log.timestamp }}</span>
                <span class="log-level">[{{ log.level.toUpperCase() }}]</span>
                <span class="log-message">{{ log.message }}</span>
                <pre v-if="log.data" class="log-data">{{ JSON.stringify(log.data, null, 2) }}</pre>
              </div>

              <div v-if="logs.length === 0" class="text-center py-4 text-grey">
                暂无日志
              </div>
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
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  debugNotificationTest
} from '@/services/notificationService.js';

export default {
  name: 'NotificationDebugPage',
  setup() {
    // 使用统一的通知管理
    const notifications = useNotifications();

    // 设备信息
    const deviceInfo = reactive({
      browser: 'Unknown',
      os: 'Unknown'
    });

    const loading = reactive({
      permission: false,
      subscription: false,
      serverTest: false,
      notifications: false,
      unreadCount: false,
      subscriptions: false,
      markAllRead: false
    });

    const apiResponses = ref([]);
    const logs = ref([]);

    // 添加日志
    const addLog = (level, message, data = null) => {
      logs.value.unshift({
        level,
        message,
        data,
        timestamp: new Date().toLocaleTimeString()
      });

      if (logs.value.length > 100) {
        logs.value = logs.value.slice(0, 100);
      }
    };

    // 添加API响应
    const addApiResponse = (title, data, success = true) => {
      apiResponses.value.unshift({
        title,
        data,
        success,
        timestamp: new Date().toLocaleTimeString()
      });

      if (apiResponses.value.length > 10) {
        apiResponses.value = apiResponses.value.slice(0, 10);
      }
    };

    // 获取权限颜色
    const getPermissionColor = (permission) => {
      switch (permission) {
        case 'granted': return 'success';
        case 'denied': return 'error';
        default: return 'warning';
      }
    };

    // 请求权限
    const requestPermission = async () => {
      loading.permission = true;

      try {
        const permission = await pushNotificationService.requestPermission();
        await notifications.loadPushStatus();

        addLog('success', `权限请求成功: ${permission}`);
        showSnackbar(`权限已${permission === 'granted' ? '授予' : '拒绝'}`, 'success');
      } catch (error) {
        addLog('error', '权限请求失败', error);
        showSnackbar(error.message || '权限请求失败', 'error');
      } finally {
        loading.permission = false;
      }
    };

    // 切换订阅
    const toggleSubscription = async () => {
      loading.subscription = true;

      try {
        if (notifications.pushStatus.subscribed) {
          await pushNotificationService.unsubscribe();
          addLog('success', '取消订阅成功');
          showSnackbar('已取消推送订阅', 'success');
        } else {
          const subscription = await pushNotificationService.subscribe();
          addLog('success', '订阅成功', subscription);
          showSnackbar('推送订阅成功', 'success');
        }

        await notifications.loadPushStatus();
      } catch (error) {
        addLog('error', '订阅操作失败', error);
        showSnackbar(error.message || '订阅操作失败', 'error');
      } finally {
        loading.subscription = false;
      }
    };


    // 发送服务器测试通知
    const sendServerTestNotification = async () => {
      loading.serverTest = true;

      try {
        const result = await debugNotificationTest();
        addLog('success', '服务器测试通知发送成功', result);
        addApiResponse('服务器测试通知', result);
        showSnackbar('服务器测试通知已发送', 'success');
      } catch (error) {
        addLog('error', '服务器测试通知发送失败', error);
        addApiResponse('服务器测试通知', error, false);
        showSnackbar(error.message || '服务器测试失败', 'error');
      } finally {
        loading.serverTest = false;
      }
    };

    // 获取通知列表
    const fetchNotifications = async () => {
      loading.notifications = true;

      try {
        const result = await getNotifications();
        addLog('success', '获取通知列表成功', result);
        addApiResponse('通知列表', result);
      } catch (error) {
        addLog('error', '获取通知列表失败', error);
        addApiResponse('通知列表', error, false);
      } finally {
        loading.notifications = false;
      }
    };

    // 获取未读数量
    const fetchUnreadCount = async () => {
      loading.unreadCount = true;

      try {
        const result = await getUnreadNotificationCount();
        addLog('success', '获取未读数量成功', result);
        addApiResponse('未读数量', result);
      } catch (error) {
        addLog('error', '获取未读数量失败', error);
        addApiResponse('未读数量', error, false);
      } finally {
        loading.unreadCount = false;
      }
    };

    // 获取订阅列表
    const fetchSubscriptions = async () => {
      loading.subscriptions = true;

      try {
        const result = await pushNotificationService.getServerSubscriptions();
        addLog('success', '获取订阅列表成功', result);
        addApiResponse('订阅列表', result);
      } catch (error) {
        addLog('error', '获取订阅列表失败', error);
        addApiResponse('订阅列表', error, false);
      } finally {
        loading.subscriptions = false;
      }
    };

    // 标记全部已读
    const markAllAsRead = async () => {
      loading.markAllRead = true;

      try {
        const result = await markAllNotificationsAsRead();
        addLog('success', '标记全部已读成功', result);
        addApiResponse('标记全部已读', result);
        showSnackbar('所有通知已标记为已读', 'success');
      } catch (error) {
        addLog('error', '标记全部已读失败', error);
        addApiResponse('标记全部已读', error, false);
      } finally {
        loading.markAllRead = false;
      }
    };

    // 清空日志
    const clearLogs = () => {
      logs.value = [];
      apiResponses.value = [];
      addLog('info', '日志已清空');
    };

    // 初始化
    onMounted(async () => {
      addLog('info', '调试页面初始化');
      await notifications.loadPushStatus();

      // 获取设备信息
      const info = pushNotificationService.getDeviceInfo();
      Object.assign(deviceInfo, info);
    });

    return {
      deviceInfo,
      loading,
      apiResponses,
      logs,
      getPermissionColor,
      requestPermission,
      toggleSubscription,
      sendTestNotification,
      sendServerTestNotification,
      fetchNotifications,
      fetchUnreadCount,
      fetchSubscriptions,
      markAllAsRead,
      clearLogs,
      ...notifications
    };
  }
};
</script>

<style scoped>
.code-textarea :deep(textarea) {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
}

.console-container {
  background: #1e1e1e;
  border-radius: 4px;
  padding: 16px;
  max-height: 400px;
  overflow-y: auto;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  color: #d4d4d4;
}

.log-entry {
  margin-bottom: 8px;
  word-wrap: break-word;
}

.log-timestamp {
  color: #888;
  margin-right: 8px;
}

.log-level {
  margin-right: 8px;
  font-weight: bold;
}

.log-info .log-level {
  color: #4fc3f7;
}

.log-success .log-level {
  color: #66bb6a;
}

.log-error .log-level {
  color: #ef5350;
}

.log-warning .log-level {
  color: #ffca28;
}

.log-message {
  color: #d4d4d4;
}

.log-data {
  margin-top: 4px;
  margin-left: 16px;
  color: #888;
  font-size: 11px;
  white-space: pre-wrap;
}
</style>