<template>
  <v-dialog v-model="dialog" max-width="700px" scrollable>
    <v-card v-if="notification">
      <!-- 卡片标题 -->
      <v-card-title class="d-flex align-center justify-space-between">
        <div class="d-flex align-center">
          <v-avatar
            v-if="notification.actor?.avatar"
            :image="getAvatarUrl(notification.actor.avatar)"
            size="40"
            class="mr-3"
          ></v-avatar>
          <v-avatar
            v-else-if="notification.template_info?.icon"
            color="primary"
            size="40"
            class="mr-3"
          >
            <v-icon :icon="getIconForType(notification.template_info.icon)"></v-icon>
          </v-avatar>
          <v-avatar v-else color="grey" size="40" class="mr-3">
            <v-icon>mdi-bell</v-icon>
          </v-avatar>

          <div>
            <h3 class="text-h6">{{ getNotificationTitle() }}</h3>
            <div class="text-caption text-grey">
              {{ formatDate(notification.created_at) }}
            </div>
          </div>
        </div>

        <div class="d-flex align-center ga-1">
          <!-- 状态徽章 -->
          <v-chip
            v-if="!notification.read"
            color="error"
            size="small"
            variant="tonal"
          >
            未读
          </v-chip>

          <v-chip
            v-if="notification.high_priority"
            color="warning"
            size="small"
            variant="tonal"
          >
            重要
          </v-chip>

          <v-btn
            icon="mdi-close"
            size="small"
            variant="text"
            @click="dialog = false"
          ></v-btn>
        </div>
      </v-card-title>

      <v-divider></v-divider>

      <!-- 卡片内容 -->
      <v-card-text class="pa-6">
        <!-- 通知内容 -->
        <div class="notification-content mb-6">
          <div v-if="notification.rendered_content || notification.content" class="text-body-1 mb-4">
            {{ notification.rendered_content || notification.content }}
          </div>

          <!-- 额外信息 -->
          <div v-if="notification.data" class="additional-info">
            <v-expansion-panels variant="accordion" class="mb-4">
              <v-expansion-panel>
                <v-expansion-panel-title>
                  <v-icon start>mdi-information</v-icon>
                  详细信息
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-list density="compact">
                    <v-list-item
                      v-for="(value, key) in notification.data"
                      :key="key"
                    >
                      <v-list-item-title>{{ formatKey(key) }}</v-list-item-title>
                      <v-list-item-subtitle>{{ formatValue(value) }}</v-list-item-subtitle>
                    </v-list-item>
                  </v-list>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </div>
        </div>

        <!-- 相关链接 -->
        <div v-if="notification.link || notification.redirect_url" class="related-links mb-4">
          <h4 class="text-subtitle-1 mb-3">
            <v-icon start>mdi-link</v-icon>
            相关链接
          </h4>

          <v-card variant="outlined" class="link-card">
            <v-card-text class="pa-4">
              <div class="d-flex align-center justify-space-between">
                <div class="d-flex align-center">
                  <v-icon color="primary" class="mr-3">mdi-open-in-new</v-icon>
                  <div>
                    <div class="text-body-2 font-weight-medium">
                      {{ getLinkTitle() }}
                    </div>
                    <div class="text-caption text-grey">
                      {{ notification.link || notification.redirect_url }}
                    </div>
                  </div>
                </div>
                <v-btn
                  color="primary"
                  variant="tonal"
                  size="small"
                  prepend-icon="mdi-open-in-new"
                  @click="navigateToLink"
                >
                  访问
                </v-btn>
              </div>
            </v-card-text>
          </v-card>
        </div>

        <!-- 操作者信息 -->
        <div v-if="notification.actor" class="actor-info mb-4">
          <h4 class="text-subtitle-1 mb-3">
            <v-icon start>mdi-account</v-icon>
            来自
          </h4>

          <v-card variant="outlined" class="actor-card">
            <v-card-text class="pa-4">
              <div class="d-flex align-center">
                <v-avatar
                  v-if="notification.actor.avatar"
                  :image="getAvatarUrl(notification.actor.avatar)"
                  size="48"
                  class="mr-4"
                ></v-avatar>
                <v-avatar v-else color="grey" size="48" class="mr-4">
                  <v-icon>mdi-account</v-icon>
                </v-avatar>

                <div class="flex-1">
                  <div class="text-body-1 font-weight-medium">
                    {{ notification.actor.display_name || notification.actor.username }}
                  </div>
                  <div class="text-caption text-grey">
                    @{{ notification.actor.username }}
                  </div>
                </div>

                <v-btn
                  variant="tonal"
                  size="small"
                  prepend-icon="mdi-account"
                  @click="visitProfile"
                >
                  查看资料
                </v-btn>
              </div>
            </v-card-text>
          </v-card>
        </div>

        <!-- 元数据 -->
        <div class="metadata">
          <v-divider class="mb-4"></v-divider>

          <div class="d-flex flex-wrap ga-4">
            <div class="metadata-item">
              <span class="text-caption text-grey">类型：</span>
              <v-chip size="small" variant="tonal">
                <v-icon start :icon="getIconForType(notification.type || notification.template_info?.icon)" size="small"></v-icon>
                {{ getTypeLabel(notification.type) }}
              </v-chip>
            </div>

            <div class="metadata-item">
              <span class="text-caption text-grey">ID：</span>
              <code class="text-caption">{{ notification.id }}</code>
            </div>

            <div v-if="notification.read_at" class="metadata-item">
              <span class="text-caption text-grey">已读时间：</span>
              <span class="text-caption">{{ formatDate(notification.read_at) }}</span>
            </div>
          </div>
        </div>
      </v-card-text>

      <v-divider></v-divider>

      <!-- 卡片操作 -->
      <v-card-actions class="pa-4">
        <div class="d-flex justify-space-between w-100">
          <div class="d-flex ga-2">
            <v-btn
              v-if="notification.link || notification.redirect_url"
              color="success"
              variant="tonal"
              prepend-icon="mdi-open-in-new"
              @click="navigateToLink"
            >
              访问链接
            </v-btn>
          </div>

          <div class="d-flex ga-2">
            <v-btn
              color="error"
              variant="text"
              prepend-icon="mdi-delete"
              @click="deleteNotification"
            >
              删除
            </v-btn>

            <v-btn
              variant="outlined"
              @click="dialog = false"
            >
              关闭
            </v-btn>
          </div>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { showSnackbar } from '@/composables/useNotifications.js';
import { markNotificationAsRead, deleteNotifications } from '@/services/notificationService.js';
import { localuser } from "@/services/localAccount";

export default {
  name: 'NotificationDetailDialog',
  props: {
    modelValue: {
      type: Boolean,
      default: false
    },
    notification: {
      type: Object,
      default: null
    }
  },
  emits: ['update:modelValue', 'mark-read', 'navigate', 'delete'],
  setup(props, { emit }) {
    const router = useRouter();

    // 对话框状态
    const dialog = computed({
      get: () => props.modelValue,
      set: (value) => emit('update:modelValue', value)
    });

    // 获取头像URL
    const getAvatarUrl = (avatar) => {
      return localuser.getUserAvatar(avatar);
    };

    // 获取通知标题
    const getNotificationTitle = () => {
      if (props.notification?.title) {
        return props.notification.title;
      }
      return '通知详情';
    };

    // 获取链接标题
    const getLinkTitle = () => {
      const url = props.notification?.link || props.notification?.redirect_url;
      if (!url) return '';

      if (url.includes('/projects/')) return '查看项目';
      if (url.includes('/users/')) return '查看用户';
      if (url.includes('/comments/')) return '查看评论';
      return '相关页面';
    };

    // 获取类型标签
    const getTypeLabel = (type) => {
      const typeMap = {
        follow: '关注',
        like: '点赞',
        comment: '评论',
        fork: '复刻',
        mention: '提及',
        system: '系统',
        admin: '管理',
        update: '更新',
        project_comment: '项目评论'
      };
      return typeMap[type] || type || '通知';
    };

    // 获取图标
    const getIconForType = (iconType) => {
      const iconMap = {
        follow: "mdi-account-plus",
        like: "mdi-heart",
        comment: "mdi-comment-text",
        fork: "mdi-source-fork",
        mention: "mdi-at",
        system: "mdi-information",
        admin: "mdi-shield-account",
        update: "mdi-update",
      };
      return iconMap[iconType] || "mdi-bell";
    };

    // 格式化键名
    const formatKey = (key) => {
      const keyMap = {
        project_id: '项目ID',
        user_id: '用户ID',
        comment_id: '评论ID',
        target_type: '目标类型',
        target_id: '目标ID'
      };
      return keyMap[key] || key;
    };

    // 格式化值
    const formatValue = (value) => {
      if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
      }
      return String(value);
    };

    // 格式化日期
    const formatDate = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    // 标记为已读
    const markAsRead = async () => {
      try {
        await markNotificationAsRead(props.notification.id);
        props.notification.read = true;
        props.notification.read_at = new Date().toISOString();

        emit('mark-read', props.notification);
        showSnackbar('通知已标记为已读', 'success');
      } catch (error) {
        showSnackbar('操作失败', 'error');
      }
    };

    // 导航到链接
    const navigateToLink = () => {
      const url = props.notification?.link || props.notification?.redirect_url;
      if (url) {
        emit('navigate', url);
        router.push(url);
      }
    };

    // 访问用户资料
    const visitProfile = () => {
      if (props.notification?.actor?.username) {
        const url = `/${props.notification.actor.username}`;
        emit('navigate', url);
        router.push(url);
      }
    };

    // 删除通知
    const deleteNotification = async () => {
      try {
        await deleteNotifications([props.notification.id]);
        emit('delete', props.notification);
        dialog.value = false;
        showSnackbar('通知已删除', 'success');
      } catch (error) {
        showSnackbar('删除失败', 'error');
      }
    };

    return {
      dialog,
      getAvatarUrl,
      getNotificationTitle,
      getLinkTitle,
      getTypeLabel,
      getIconForType,
      formatKey,
      formatValue,
      formatDate,
      markAsRead,
      navigateToLink,
      visitProfile,
      deleteNotification
    };
  }
};
</script>

<style scoped>
.metadata-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

code {
  background-color: rgba(var(--v-theme-on-surface), 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
}
</style>
