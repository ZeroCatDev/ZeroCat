<template>
  <div class="enhanced-notifications-list">
    <!-- 加载状态 -->
    <div v-if="loading" class="text-center py-8">
      <v-progress-circular
        indeterminate
        size="64"
        color="primary"
      ></v-progress-circular>
      <div class="text-body-2 mt-4">加载通知中...</div>
    </div>

    <!-- 错误状态 -->
    <v-alert
      v-else-if="error"
      type="error"
      variant="tonal"
      class="mb-4"
    >
      {{ error }}
      <template v-slot:append>
        <v-btn
          color="error"
          variant="text"
          @click="fetchNotifications"
        >
          重试
        </v-btn>
      </template>
    </v-alert>

    <!-- 通知列表 -->
    <div v-else-if="filteredNotifications.length > 0" class="notifications-container">
      <v-card
        v-for="notification in paginatedNotifications"
        :key="notification.id"
        class="notification-card mb-3"
        :class="{ 'unread': !notification.read, 'high-priority': notification.high_priority }"
        variant="outlined"
        hover
        @click="handleNotificationClick(notification)"
      >
        <v-card-text class="pa-4">
          <div class="d-flex">
            <!-- 头像/图标 -->
            <div class="notification-avatar mr-4">
              <v-avatar
                v-if="notification.actor?.avatar"
                :image="getAvatarUrl(notification.actor.avatar)"
                size="48"
              ></v-avatar>
              <v-avatar
                v-else-if="notification.template_info?.icon"
                color="primary"
                size="48"
              >
                <v-icon :icon="getIconForType(notification.template_info.icon)"></v-icon>
              </v-avatar>
              <v-avatar v-else color="grey" size="48">
                <v-icon>mdi-bell</v-icon>
              </v-avatar>

              <!-- 未读指示器 -->
              <v-badge
                v-if="!notification.read"
                color="error"
                dot
                location="bottom right"
                offset-x="2"
                offset-y="2"
              ></v-badge>
            </div>

            <!-- 通知内容 -->
            <div class="notification-content flex-1">
              <!-- 标题和时间 -->
              <div class="d-flex align-center justify-space-between mb-2">
                <div class="notification-title">
                  <h3 class="text-subtitle-1 font-weight-medium">
                    {{ getNotificationTitle(notification) }}
                  </h3>
                  <div v-if="notification.actor" class="text-caption text-grey">
                    来自 {{ notification.actor.display_name || notification.actor.username }}
                  </div>
                </div>

                <div class="notification-meta text-right">
                  <div class="text-caption text-grey mb-1">
                    {{ formatRelativeTime(notification.created_at) }}
                  </div>

                  <div class="d-flex align-center justify-end ga-1">
                    <!-- 重要标记 -->
                    <v-chip
                      v-if="notification.high_priority"
                      color="warning"
                      size="x-small"
                      variant="tonal"
                    >
                      重要
                    </v-chip>

                    <!-- 类型标记 -->
                    <v-chip
                      :color="getTypeColor(notification.type)"
                      size="x-small"
                      variant="tonal"
                    >
                      {{ getTypeLabel(notification.type) }}
                    </v-chip>
                  </div>
                </div>
              </div>

              <!-- 通知正文 -->
              <div class="notification-body mb-3">
                <p class="text-body-2 mb-0" :class="{ 'font-weight-medium': !notification.read }">
                  {{ notification.rendered_content || notification.content || '新的通知' }}
                </p>
              </div>

              <!-- 操作按钮 -->
              <div class="notification-actions d-flex align-center justify-space-between">
                <div class="d-flex align-center ga-2">
                  <v-btn
                    v-if="!notification.read"
                    size="small"
                    variant="tonal"
                    color="primary"
                    prepend-icon="mdi-check"
                    @click.stop="markAsRead(notification)"
                  >
                    标记已读
                  </v-btn>

                  <v-btn
                    v-if="notification.link || notification.redirect_url"
                    size="small"
                    variant="tonal"
                    color="success"
                    prepend-icon="mdi-open-in-new"
                    @click.stop="navigateToLink(notification)"
                  >
                    查看
                  </v-btn>
                </div>

                <div class="d-flex align-center ga-1">
                  <v-btn
                    size="x-small"
                    variant="text"
                    color="primary"
                    @click.stop="showDetails(notification)"
                  >
                    详情
                  </v-btn>

                  <v-btn
                    icon="mdi-delete-outline"
                    size="small"
                    variant="text"
                    color="error"
                    @click.stop="deleteNotification(notification)"
                  ></v-btn>
                </div>
              </div>
            </div>
          </div>
        </v-card-text>
      </v-card>

      <!-- 分页控制 -->
      <div v-if="showPagination && totalPages > 1" class="pagination-container mt-6">
        <v-pagination
          v-model="currentPage"
          :length="totalPages"
          :total-visible="7"
          variant="elevated"
          rounded
        ></v-pagination>
      </div>

      <!-- 加载更多 -->
      <div v-else-if="hasMoreNotifications" class="text-center mt-4">
        <v-btn
          color="primary"
          variant="tonal"
          :loading="loadingMore"
          @click="loadMoreNotifications"
        >
          加载更多
        </v-btn>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state text-center py-12">
      <v-icon size="96" color="grey-lighten-2">mdi-bell-off</v-icon>
      <h3 class="text-h6 mt-4 mb-2">{{ getEmptyStateText() }}</h3>
      <p class="text-body-2 text-grey mb-4">
        {{ getEmptyStateSubtext() }}
      </p>
      <v-btn
        v-if="filter !== 'all'"
        color="primary"
        variant="tonal"
        @click="clearFilters"
      >
        查看所有通知
      </v-btn>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { showSnackbar } from '@/composables/useNotifications.js';
import {
  getNotifications,
  markNotificationAsRead,
  deleteNotifications
} from '@/services/notificationService.js';
import { localuser } from "@/services/localAccount";

export default {
  name: 'EnhancedNotificationsList',
  props: {
    filter: {
      type: String,
      default: 'all'
    },
    sort: {
      type: String,
      default: 'newest'
    },
    search: {
      type: String,
      default: ''
    },
    showPagination: {
      type: Boolean,
      default: true
    },
    itemsPerPage: {
      type: Number,
      default: 10
    }
  },
  emits: ['update:unread-count', 'notification-click'],
  setup(props, { emit }) {
    const router = useRouter();

    // 状态管理
    const notifications = ref([]);
    const loading = ref(false);
    const loadingMore = ref(false);
    const error = ref(null);
    const hasMoreNotifications = ref(false);
    const loadMoreUrl = ref(null);
    const currentPage = ref(1);

    // 计算属性
    const filteredNotifications = computed(() => {
      let filtered = [...notifications.value];

      // 应用筛选
      switch (props.filter) {
        case 'unread':
          filtered = filtered.filter(n => !n.read);
          break;
        case 'read':
          filtered = filtered.filter(n => n.read);
          break;
        case 'important':
          filtered = filtered.filter(n => n.high_priority);
          break;
        case 'mention':
          filtered = filtered.filter(n => n.type === 'mention');
          break;
        case 'system':
          filtered = filtered.filter(n => n.type === 'system');
          break;
      }

      // 应用搜索
      if (props.search) {
        const searchLower = props.search.toLowerCase();
        filtered = filtered.filter(n =>
          (n.content || '').toLowerCase().includes(searchLower) ||
          (n.rendered_content || '').toLowerCase().includes(searchLower) ||
          (n.actor?.username || '').toLowerCase().includes(searchLower) ||
          (n.actor?.display_name || '').toLowerCase().includes(searchLower)
        );
      }

      // 应用排序
      switch (props.sort) {
        case 'oldest':
          filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          break;
        case 'priority':
          filtered.sort((a, b) => {
            if (a.high_priority && !b.high_priority) return -1;
            if (!a.high_priority && b.high_priority) return 1;
            return new Date(b.created_at) - new Date(a.created_at);
          });
          break;
        case 'type':
          filtered.sort((a, b) => {
            const typeA = a.type || '';
            const typeB = b.type || '';
            return typeA.localeCompare(typeB);
          });
          break;
        default: // newest
          filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }

      return filtered;
    });

    const totalPages = computed(() => {
      return Math.ceil(filteredNotifications.value.length / props.itemsPerPage);
    });

    const paginatedNotifications = computed(() => {
      if (!props.showPagination) {
        return filteredNotifications.value;
      }

      const start = (currentPage.value - 1) * props.itemsPerPage;
      const end = start + props.itemsPerPage;
      return filteredNotifications.value.slice(start, end);
    });

    // 获取头像URL
    const getAvatarUrl = (avatar) => {
      return localuser.getUserAvatar(avatar);
    };

    // 获取通知标题
    const getNotificationTitle = (notification) => {
      if (notification.template_info?.title) {
        return notification.template_info.title;
      }
      if (notification.title) {
        return notification.title;
      }
      return '新通知';
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
      return typeMap[type] || '通知';
    };

    // 获取类型颜色
    const getTypeColor = (type) => {
      const colorMap = {
        follow: 'blue',
        like: 'red',
        comment: 'green',
        fork: 'purple',
        mention: 'orange',
        system: 'grey',
        admin: 'deep-purple',
        update: 'teal'
      };
      return colorMap[type] || 'primary';
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

    // 格式化相对时间
    const formatRelativeTime = (dateString) => {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSecs < 60) return "刚刚";
      if (diffMins < 60) return `${diffMins}分钟前`;
      if (diffHours < 24) return `${diffHours}小时前`;
      if (diffDays < 30) return `${diffDays}天前`;
      return date.toLocaleDateString();
    };

    // 获取空状态文本
    const getEmptyStateText = () => {
      switch (props.filter) {
        case 'unread': return '没有未读通知';
        case 'read': return '没有已读通知';
        case 'important': return '没有重要通知';
        case 'mention': return '没有提及通知';
        case 'system': return '没有系统通知';
        default: return '暂无通知';
      }
    };

    const getEmptyStateSubtext = () => {
      if (props.search) {
        return `没有找到包含"${props.search}"的通知`;
      }
      return '当前筛选条件下没有通知';
    };

    // 获取通知数据
    const fetchNotifications = async () => {
      loading.value = true;
      error.value = null;

      try {
        const data = await getNotifications();
        notifications.value = data.notifications || [];
        loadMoreUrl.value = data.load_more_notifications || null;
        hasMoreNotifications.value = !!loadMoreUrl.value;

        // 更新未读数量
        const unreadCount = notifications.value.filter(n => !n.read).length;
        emit('update:unread-count', unreadCount);

      } catch (err) {
        error.value = '加载通知失败，请稍后重试';
        console.error('Error fetching notifications:', err);
      } finally {
        loading.value = false;
      }
    };

    // 加载更多通知
    const loadMoreNotifications = async () => {
      if (loadingMore.value || !loadMoreUrl.value) return;

      loadingMore.value = true;
      try {
        const data = await getNotifications({ url: loadMoreUrl.value });
        const newNotifications = data.notifications || [];
        notifications.value = [...notifications.value, ...newNotifications];
        loadMoreUrl.value = data.load_more_notifications || null;
        hasMoreNotifications.value = !!loadMoreUrl.value;
      } catch (err) {
        showSnackbar('加载更多通知失败', 'error');
      } finally {
        loadingMore.value = false;
      }
    };

    // 处理通知点击
    const resolveNotificationUrl = (notification) => {
      if (notification?.redirect_url) return notification.redirect_url;

      const rawLink = notification?.link;
      if (rawLink && rawLink !== 'auto' && rawLink !== 'target') {
        return rawLink;
      }

      if (notification?.actor?.username) {
        return `/${notification.actor.username}`;
      }

      return '';
    };

    const handleNotificationClick = async (notification) => {
      if (!notification.read) {
        try {
          await markNotificationAsRead(notification.id);
          notification.read = true;
          notification.read_at = new Date().toISOString();
          const unreadCount = notifications.value.filter(n => !n.read).length;
          emit('update:unread-count', unreadCount);
        } catch (error) {
          console.error('Error marking notification as read:', error);
        }
      }

      const url = resolveNotificationUrl(notification);
      if (url) {
        if (url.startsWith('http')) {
          window.open(url, '_blank');
        } else {
          router.push(url);
        }
        return;
      }

      emit('notification-click', notification);
    };

    // 标记为已读
    const markAsRead = async (notification) => {
      try {
        await markNotificationAsRead(notification.id);
        notification.read = true;
        notification.read_at = new Date().toISOString();

        const unreadCount = notifications.value.filter(n => !n.read).length;
        emit('update:unread-count', unreadCount);

        showSnackbar('已标记为已读', 'success');
      } catch (error) {
        showSnackbar('操作失败', 'error');
      }
    };

    // 导航到链接
    const navigateToLink = (notification) => {
      const url = resolveNotificationUrl(notification);
      if (url) {
        if (url.startsWith('http')) {
          window.open(url, '_blank');
        } else {
          router.push(url);
        }
      }
    };

    // 显示详情
    const showDetails = (notification) => {
      emit('notification-click', notification);
    };

    // 删除通知
    const deleteNotification = async (notification) => {
      try {
        await deleteNotifications([notification.id]);
        notifications.value = notifications.value.filter(n => n.id !== notification.id);

        const unreadCount = notifications.value.filter(n => !n.read).length;
        emit('update:unread-count', unreadCount);

        showSnackbar('通知已删除', 'success');
      } catch (error) {
        showSnackbar('删除失败', 'error');
      }
    };

    // 清除筛选
    const clearFilters = () => {
      emit('clear-filters');
    };

    // 监听筛选变化
    watch([() => props.filter, () => props.sort], () => {
      currentPage.value = 1;
    });

    // 初始化
    onMounted(() => {
      fetchNotifications();
    });

    return {
      notifications,
      loading,
      loadingMore,
      error,
      hasMoreNotifications,
      currentPage,
      filteredNotifications,
      totalPages,
      paginatedNotifications,
      getAvatarUrl,
      getNotificationTitle,
      getTypeLabel,
      getTypeColor,
      getIconForType,
      formatRelativeTime,
      getEmptyStateText,
      getEmptyStateSubtext,
      fetchNotifications,
      loadMoreNotifications,
      handleNotificationClick,
      markAsRead,
      navigateToLink,
      showDetails,
      deleteNotification,
      clearFilters
    };
  }
};
</script>

<style scoped>
.notification-card {
  cursor: pointer;
  border-left: 4px solid transparent;
}

.notification-card.unread {
  border-left-color: rgb(var(--v-theme-primary));
  background-color: rgba(var(--v-theme-primary), 0.02);
}

.notification-card.high-priority {
  border-left-color: rgb(var(--v-theme-warning));
}

.notification-card.unread.high-priority {
  border-left-color: rgb(var(--v-theme-error));
}

.notification-avatar {
  position: relative;
  flex-shrink: 0;
}

.notification-content {
  min-width: 0;
}

.notification-body p {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
