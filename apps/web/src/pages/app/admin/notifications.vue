<template>
  <v-container>
    <div class="notifications-admin">
      <!-- 主标题卡片 -->
      <v-card class="mb-6" elevation="2">
        <v-card-item>
          <template v-slot:prepend>
            <v-icon
              class="me-4"
              color="primary"
              icon="mdi-bell-ring"
              size="large"
            ></v-icon>
          </template>
          <v-card-title class="text-h5">通知管理</v-card-title>
          <v-card-subtitle class="mt-2">系统通知发送和管理</v-card-subtitle>
        </v-card-item>
      </v-card>

      <!-- 统计信息卡片 -->
      <v-row class="mb-4">
        <v-col
          v-for="stat in notificationStats"
          :key="stat.title"
          cols="12"
          md="3"
          sm="6"
        >
          <v-card :class="['stat-card', `stat-${stat.type}`]" elevation="2">
            <v-card-text>
              <div class="text-overline mb-2">{{ stat.title }}</div>
              <div class="text-h4">{{ stat.value }}</div>
              <v-icon class="stat-icon" large>{{ stat.icon }}</v-icon>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- 操作选项卡 -->
      <v-tabs v-model="activeTab" class="mb-4">
        <v-tab value="send">发送通知</v-tab>
        <v-tab value="list">通知列表</v-tab>
        <v-tab value="stats">统计信息</v-tab>
      </v-tabs>

      <!-- 发送通知选项卡 -->
      <v-card v-show="activeTab === 'send'">
        <v-card-title>
          <v-icon class="mr-2">mdi-send</v-icon>
          发送通知
        </v-card-title>
        <v-card-text>
          <v-form ref="sendForm" v-model="sendFormValid">
            <v-row>
              <!-- 接收者类型选择 -->
              <v-col cols="12" md="6">
                <v-select
                  v-model="notificationForm.recipient_type"
                  :items="recipientTypes"
                  label="接收者类型"
                  required
                ></v-select>
              </v-col>

              <!-- 发送模式选择 -->
              <v-col cols="12" md="6">
                <v-radio-group v-model="sendMode" row>
                  <v-radio label="单个" value="single"></v-radio>
                  <v-radio label="批量" value="batch"></v-radio>
                </v-radio-group>
              </v-col>

              <!-- 单个接收者 -->
              <v-col v-if="sendMode === 'single'" cols="12">
                <v-text-field
                  v-model="singleRecipient"
                  :rules="[(v) => !!v || '请输入接收者']"
                  :label="getRecipientLabel()"
                  :placeholder="getRecipientPlaceholder()"
                  required
                ></v-text-field>
              </v-col>

              <!-- 批量接收者 -->
              <v-col v-if="sendMode === 'batch'" cols="12">
                <v-textarea
                  v-model="batchRecipients"
                  :rules="[(v) => !!v || '请输入接收者']"
                  :label="`批量${getRecipientLabel()}（多个用逗号分隔）`"
                  :placeholder="`输入多个${getRecipientPlaceholder()}，用逗号分隔`"
                  required
                  rows="3"
                ></v-textarea>
              </v-col>

              <!-- 通知标题 -->
              <v-col cols="12">
                <v-text-field
                  v-model="notificationForm.title"
                  :rules="[(v) => !!v || '请输入通知标题']"
                  label="通知标题"
                  required
                ></v-text-field>
              </v-col>

              <!-- 通知内容 -->
              <v-col cols="12">
                <v-textarea
                  v-model="notificationForm.content"
                  :rules="[(v) => !!v || '请输入通知内容']"
                  label="通知内容"
                  required
                  rows="4"
                ></v-textarea>
              </v-col>

              <!-- 推送渠道选择 -->
              <v-col cols="12">
                <v-combobox
                  v-model="notificationForm.push_channels"
                  chips
                  multiple
                  label="推送渠道"
                  :items="['browser', 'email']"
                ></v-combobox>
              </v-col>

              <!-- 通知类型和设置 -->
              <v-col cols="12" md="4">
                <v-select
                  v-model="notificationForm.notification_type"
                  :items="notificationTypes"
                  label="通知类型"
                ></v-select>
              </v-col>

              <v-col cols="12" md="4">
                <v-switch
                  v-model="notificationForm.high_priority"
                  color="orange"
                  label="高优先级通知"
                ></v-switch>
              </v-col>

              <v-col cols="12" md="4">
                <v-switch
                  v-model="notificationForm.hidden"
                  color="info"
                  label="隐藏通知"
                ></v-switch>
              </v-col>

              <v-col cols="12" md="4">
                <NotificationLevelSelector
                  v-model="notificationForm.notification_requirement"
                  label="通知触达要求"
                  :items="notificationRequirementOptions"
                />
              </v-col>

              <!-- 可点击链接 -->
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="notificationForm.link"
                  label="可点击链接（可选）"
                  placeholder="https://example.com"
                ></v-text-field>
              </v-col>

              <!-- 目标类型和ID（可选） -->
              <v-col cols="12" md="3">
                <v-select
                  v-model="notificationForm.target_type"
                  :items="targetTypes"
                  label="目标类型（可选）"
                  clearable
                ></v-select>
              </v-col>

              <v-col cols="12" md="3">
                <v-text-field
                  v-model="notificationForm.target_id"
                  :disabled="!notificationForm.target_type"
                  label="目标ID（可选）"
                  type="number"
                ></v-text-field>
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="resetForm">重置</v-btn>
          <v-btn
            :disabled="!sendFormValid"
            :loading="sending"
            color="primary"
            @click="sendNotification"
          >
            <v-icon left>mdi-send</v-icon>
            {{ sendMode === "single" ? "发送通知" : "批量发送" }}
          </v-btn>
        </v-card-actions>
      </v-card>

      <!-- 通知列表选项卡 -->
      <v-card v-show="activeTab === 'list'">
        <v-card-title>
          <v-icon class="mr-2">mdi-format-list-bulleted</v-icon>
          通知列表
        </v-card-title>
        <v-card-text>
          <!-- 过滤器 -->
          <v-row class="mb-4">
            <v-col cols="12" sm="4">
              <v-text-field
                v-model="listFilters.search"
                clearable
                hide-details
                label="搜索通知"
                prepend-icon="mdi-magnify"
                @input="debouncedLoadNotifications"
              ></v-text-field>
            </v-col>
            <v-col cols="12" sm="3">
              <v-select
                v-model="listFilters.notification_type"
                :items="notificationTypes"
                clearable
                hide-details
                label="通知类型"
                @change="loadNotifications"
              ></v-select>
            </v-col>
            <v-col cols="12" sm="3">
              <v-switch
                v-model="listFilters.unread_only"
                hide-details
                label="仅显示未读"
                @change="loadNotifications"
              ></v-switch>
            </v-col>
            <v-col class="d-flex justify-end" cols="12" sm="2">
              <v-btn
                :disabled="loadingNotifications"
                :loading="refreshingNotifications"
                color="primary"
                @click="refreshNotifications"
              >
                <v-icon>mdi-refresh</v-icon>
                刷新
              </v-btn>
            </v-col>
          </v-row>

          <!-- 通知列表表格 -->
          <v-data-table-server
            v-model:items-per-page="notificationOptions.itemsPerPage"
            v-model:page="notificationOptions.page"
            :headers="notificationHeaders"
            :items="notifications"
            :items-length="notificationTotal"
            :loading="loadingNotifications"
            :loading-text="'加载中...'"
            :no-data-text="'暂无通知'"
            @update:options="loadNotifications"
          >
            <!-- 通知内容列 -->
            <template v-slot:item.content="{ item }">
              <div class="notification-content">
                <div class="font-weight-medium">{{ item.title }}</div>
                <div class="text-caption text--secondary">
                  {{ truncateText(item.content, 50) }}
                </div>
              </div>
            </template>

            <!-- 接收用户列 -->
            <template v-slot:item.user="{ item }">
              <div class="d-flex align-center">
                <v-avatar class="mr-2" size="24">
                  <v-img :src="getAvatarUrl(item.user_avatar)"></v-img>
                </v-avatar>
                <span>{{ item.username }}</span>
              </div>
            </template>

            <!-- 通知类型列 -->
            <template v-slot:item.notification_type="{ item }">
              <v-chip
                :color="getTypeColor(item.notification_type)"
                size="small"
              >
                {{ getTypeText(item.notification_type) }}
              </v-chip>
            </template>

            <!-- 读取状态列 -->
            <template v-slot:item.read="{ item }">
              <v-chip :color="item.read ? 'success' : 'warning'" size="small">
                {{ item.read ? "已读" : "未读" }}
              </v-chip>
            </template>

            <!-- 创建时间列 -->
            <template v-slot:item.created_at="{ item }">
              <div>{{ formatDate(item.created_at) }}</div>
              <div class="text-caption text--secondary">
                {{ formatTimeAgo(item.created_at) }}
              </div>
            </template>
          </v-data-table-server>
        </v-card-text>
      </v-card>

      <!-- 统计信息选项卡 -->
      <v-card v-show="activeTab === 'stats'">
        <v-card-title>
          <v-icon class="mr-2">mdi-chart-bar</v-icon>
          统计信息
        </v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="6">
              <v-card outlined>
                <v-card-title class="text-h6">基础统计</v-card-title>
                <v-card-text>
                  <div class="stat-item">
                    <span>总通知数：</span>
                    <strong>{{ detailedStats.total || 0 }}</strong>
                  </div>
                  <div class="stat-item">
                    <span>未读通知数：</span>
                    <strong>{{ detailedStats.unread || 0 }}</strong>
                  </div>
                  <div class="stat-item">
                    <span>今日通知：</span>
                    <strong>{{ detailedStats.today || 0 }}</strong>
                  </div>
                  <div class="stat-item">
                    <span>本周通知：</span>
                    <strong>{{ detailedStats.week || 0 }}</strong>
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" md="6">
              <v-card outlined>
                <v-card-title class="text-h6">通知类型分布</v-card-title>
                <v-card-text>
                  <div
                    class="stat-item"
                    v-for="item in detailedStats.byType"
                    :key="item.type"
                  >
                    <span>{{ item.type }}：</span>
                    <strong>{{ item.count || 0 }}</strong>
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- 全局提示 -->
      <v-snackbar
        v-model="snackbar.show"
        :color="snackbar.color"
        :timeout="snackbar.timeout"
        top
      >
        {{ snackbar.text }}
        <template v-slot:action="{ attrs }">
          <v-btn text v-bind="attrs" @click="snackbar.show = false">
            关闭
          </v-btn>
        </template>
      </v-snackbar>
    </div>
  </v-container>
</template>

<script>
import axios from "@/axios/axios";
import NotificationLevelSelector from "@/components/notifications/NotificationLevelSelector.vue";
import { debounce } from "lodash-es";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/zh-cn";

dayjs.extend(relativeTime);
dayjs.locale("zh-cn");

export default {
  name: "NotificationsAdmin",
  components: {
    NotificationLevelSelector,
  },
  data() {
    return {
      activeTab: "send",

      // 统计信息
      notificationStats: [
        { title: "总通知数", value: 0, type: "total", icon: "mdi-bell" },
        { title: "未读通知", value: 0, type: "unread", icon: "mdi-bell-alert" },
        { title: "今日发送", value: 0, type: "today", icon: "mdi-clock" },
        {
          title: "本周发送",
          value: 0,
          type: "week",
          icon: "mdi-calendar-week",
        },
      ],
      detailedStats: {},

      // 发送通知表单
      sendMode: "single",
      sendFormValid: false,
      sending: false,
      singleRecipient: "",
      batchRecipients: "",
      notificationForm: {
        recipient_type: "user_id",
        title: "",
        content: "",
        link: "",
        push_channels: ["browser"],
        hidden: false,
        high_priority: false,
        notification_type: "admin_notification",
        notification_requirement: "BASIC",
        target_type: "",
        target_id: "",
        metadata: {},
      },

      notificationRequirementOptions: [
        { title: "一般更新（BASIC）", value: "BASIC", color: "info" },
        { title: "增强动态（ENHANCED）", value: "ENHANCED", color: "primary" },
        { title: "高频动态（ALL）", value: "ALL", color: "success" },
      ],

      // 接收者类型选项
      recipientTypes: [
        { title: "用户ID", value: "user_id" },
        { title: "用户名", value: "username" },
        { title: "邮箱", value: "email" },
      ],

      // 推送渠道选项
      pushChannels: [
        { title: "浏览器通知", value: "browser" },
        { title: "邮件通知", value: "email" },
      ],

      // 目标类型选项
      targetTypes: [
        { title: "项目", value: "PROJECT" },
        { title: "用户", value: "USER" },
      ],

      // 通知类型选项
      notificationTypes: [
        { title: "管理员通知", value: "admin_notification" },
        { title: "系统公告", value: "system_announcement" },
        { title: "用户互动", value: "user_interaction" },
        { title: "功能公告", value: "feature_announcement" },
        { title: "安全提醒", value: "security_alert" },
        { title: "维护通知", value: "maintenance_notice" },
      ],

      // 通知列表
      notifications: [],
      notificationTotal: 0,
      loadingNotifications: false,
      refreshingNotifications: false,
      notificationOptions: {
        page: 1,
        itemsPerPage: 10,
        sortBy: ["created_at"],
        sortDesc: [true],
      },
      notificationHeaders: [
        { title: "ID", value: "id", width: "80px", sortable: false },
        { title: "通知内容", value: "content", sortable: false },
        { title: "接收用户", value: "user", width: "150px", sortable: false },
        {
          title: "类型",
          value: "notification_type",
          width: "120px",
          sortable: false,
        },
        { title: "状态", value: "read", width: "100px", sortable: false },
        {
          title: "创建时间",
          value: "created_at",
          width: "180px",
          sortable: false,
        },
      ],
      listFilters: {
        search: "",
        notification_type: "",
        unread_only: false,
      },

      snackbar: {
        show: false,
        text: "",
        color: "success",
        timeout: 3000,
      },
    };
  },
  methods: {
    // 发送通知
    async sendNotification() {
      if (!this.$refs.sendForm.validate()) return;

      this.sending = true;
      try {
        const payload = {
          ...this.notificationForm,
        };

        // 设置接收者
        if (this.sendMode === "single") {
          payload.recipients = this.singleRecipient;
        } else {
          payload.recipients = this.batchRecipients
            .split(",")
            .map((item) => item.trim())
            .filter((item) => item);
        }

        // 清理空值
        if (!payload.target_type) {
          delete payload.target_type;
          delete payload.target_id;
        }
        if (!payload.link) delete payload.link;

        const { data } = await axios.post("/admin/notifications/send", payload);

        if (data.success) {
          this.showSuccess(data.message);
          this.showSendResults(data.result);
        } else {
          this.showError(data.message || "发送通知失败");
        }

        this.resetForm();
        this.loadStats();
      } catch (error) {
        this.showError(error.response?.data?.message || "发送通知失败");
        console.error("Error sending notification:", error);
      } finally {
        this.sending = false;
      }
    },

    // 显示发送结果详情
    showSendResults(result) {
      if (result.failed && result.failed.length > 0) {
        const failedList = result.errors
          .map((err) => `${err.original_recipient}: ${err.error}`)
          .join("\n");
        this.showError(`部分发送失败:\n${failedList}`);
      }
    },

    // 重置表单
    resetForm() {
      this.notificationForm = {
        recipient_type: "user_id",
        title: "",
        content: "",
        link: "",
        push_channels: ["browser"],
        hidden: false,
        high_priority: false,
        notification_type: "admin_notification",
        notification_requirement: "BASIC",
        target_type: "",
        target_id: "",
        metadata: {},
      };
      this.singleRecipient = "";
      this.batchRecipients = "";
      this.$refs.sendForm?.resetValidation();
    },

    // 获取接收者标签
    getRecipientLabel() {
      const labels = {
        user_id: "接收用户ID",
        username: "接收用户名",
        email: "接收邮箱",
      };
      return labels[this.notificationForm.recipient_type] || "接收者";
    },

    // 获取接收者占位符
    getRecipientPlaceholder() {
      const placeholders = {
        user_id: "输入用户ID，如：123",
        username: "输入用户名，如：john_doe",
        email: "输入邮箱，如：user@example.com",
      };
      return placeholders[this.notificationForm.recipient_type] || "输入接收者";
    },

    // 加载统计信息
    async loadStats() {
      try {
        const { data } = await axios.get("/admin/notifications/stats");
        this.detailedStats = data.stats;

        // 更新顶部统计卡片
        this.notificationStats[0].value = data.stats.total || 0;
        this.notificationStats[1].value = data.stats.unread || 0;
        this.notificationStats[2].value = data.stats.today || 0;
        this.notificationStats[3].value = data.stats.week || 0;
      } catch (error) {
        console.error("Error loading stats:", error);
      }
    },

    // 加载通知列表
    async loadNotifications() {
      this.loadingNotifications = true;
      try {
        const params = {
          limit: this.notificationOptions.itemsPerPage,
          offset:
            (this.notificationOptions.page - 1) *
            this.notificationOptions.itemsPerPage,
        };

        if (this.listFilters.search) params.user_id = this.listFilters.search;
        if (this.listFilters.notification_type)
          params.notification_type = this.listFilters.notification_type;
        if (this.listFilters.unread_only) params.unread_only = true;

        const { data } = await axios.get("/admin/notifications/list", {
          params,
        });
        this.notifications = data.notifications;
        this.notificationTotal = data.total;
      } catch (error) {
        this.showError("加载通知列表失败");
        console.error("Error loading notifications:", error);
      } finally {
        this.loadingNotifications = false;
      }
    },

    // 刷新通知列表
    async refreshNotifications() {
      if (this.refreshingNotifications || this.loadingNotifications) return;

      this.refreshingNotifications = true;
      try {
        await this.loadNotifications();
        this.showSuccess("通知列表已更新");
      } catch (error) {
        this.showError("刷新失败");
      } finally {
        this.refreshingNotifications = false;
      }
    },

    // 工具方法
    getAvatarUrl(avatar) {
      if (!avatar) return "/default-avatar.png";
      if (avatar.startsWith("http")) return avatar;
      return `/api/avatar/${avatar}`;
    },

    getTypeText(type) {
      const option = this.notificationTypes.find((opt) => opt.value === type);
      return option ? option.title : type;
    },

    getTypeColor(type) {
      const colors = {
        admin_notification: "indigo",
        system_announcement: "blue",
        user_interaction: "green",
        feature_announcement: "purple",
        security_alert: "red",
        maintenance_notice: "orange",
      };
      return colors[type] || "grey";
    },

    formatDate(date) {
      return dayjs(date).format("YYYY-MM-DD HH:mm:ss");
    },

    formatTimeAgo(date) {
      return dayjs(date).fromNow();
    },

    truncateText(text, maxLength) {
      if (!text) return "";
      return text.length > maxLength
        ? text.substring(0, maxLength) + "..."
        : text;
    },

    showSuccess(text) {
      this.snackbar = {
        show: true,
        text,
        color: "success",
        timeout: 3000,
      };
    },

    showError(text) {
      this.snackbar = {
        show: true,
        text,
        color: "error",
        timeout: 5000,
      };
    },

    debouncedLoadNotifications: debounce(function () {
      this.loadNotifications();
    }, 300),
  },

  mounted() {
    this.loadStats();
    this.loadNotifications();
  },
};
</script>

<style lang="scss" scoped>
.notifications-admin {
  .stat-card {
    position: relative;
    overflow: hidden;
    transition: transform 0.2s;

    &:hover {
      transform: translateY(-2px);
    }

    .stat-icon {
      position: absolute;
      right: 16px;
      bottom: 16px;
      opacity: 0.2;
      font-size: 48px;
    }

    &.stat-total {
      background: linear-gradient(135deg, #1976d2, #64b5f6);
      color: white;
    }

    &.stat-unread {
      background: linear-gradient(135deg, #f57c00, #ffb74d);
      color: white;
    }

    &.stat-today {
      background: linear-gradient(135deg, #43a047, #81c784);
      color: white;
    }

    &.stat-week {
      background: linear-gradient(135deg, #7b1fa2, #ba68c8);
      color: white;
    }
  }

  .notification-content {
    max-width: 300px;
  }

  .stat-item {
    margin: 8px 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .type-stat-item {
    margin: 12px 0;
  }

  .v-tabs {
    background: transparent;
  }
}
</style>
