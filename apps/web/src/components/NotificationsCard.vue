<template>
  <v-card :elevation="menuMode ? undefined : 0" :class="{ 'v-card--flat bg-transparent': !menuMode }">
    <!-- 卡片标题和控制区 -->
    <template v-if="showHeader">
      <v-card-title class="d-flex align-center justify-space-between">
        <div>
          <v-icon start>mdi-bell</v-icon>
          我的通知
          <v-badge
            v-if="unreadCount > 0"
            :content="unreadCount"
            class="ml-2"
            color="error"
            inline
          ></v-badge>
        </div>
        <v-btn
          :disabled="!hasUnread"
          variant="text"
          @click="contentRef?.markAllAsRead()"
        >
          标记全部已读
        </v-btn>
      </v-card-title>
      <v-divider></v-divider>
    </template>

    <!-- 选项卡 (仅在menuMode=true时显示) -->
    <template v-if="menuMode">
      <Suspense>
        <NotificationsCardContent
          ref="contentRef"
          :autoFetch="autoFetch"
          :maxHeight="'420px'"
          :maxItems="6"
          :autoLoadMore="false"
          @update:unread-count="updateUnreadCount"
        />
        <template #fallback>
          <div class="d-flex justify-center align-center py-4">
            <v-progress-circular indeterminate></v-progress-circular>
          </div>
        </template>
      </Suspense>
    </template>

    <!-- 仅通知内容 (menuMode=false) -->
    <template v-else>
      <Suspense>
        <NotificationsCardContent
          ref="contentRef"
          :autoFetch="autoFetch"
          :maxHeight="'auto'"
          :show-pagination="showPagination"
          :useWindowScroll="true"
          @update:unread-count="updateUnreadCount"
        />
        <template #fallback>
          <div class="d-flex justify-center align-center py-4">
            <v-progress-circular indeterminate></v-progress-circular>
          </div>
        </template>
      </Suspense>
    </template>
  </v-card>
</template>

<script>
import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import { useNotificationStore } from "@/stores/notification";
import NotificationsCardContent from "./NotificationsCardContent.vue";

export default {
  name: "NotificationsCard",
  components: {
    NotificationsCardContent,
  },
  props: {
    autoFetch: {
      type: Boolean,
      default: true,
    },
    menuMode: {
      type: Boolean,
      default: false,
    },
    showHeader: {
      type: Boolean,
      default: true,
    },
    maxHeight: {
      type: String,
      default: "auto",
    },
    showPagination: {
      type: Boolean,
      default: false,
    },
  },
  setup() {
    const contentRef = ref(null);
    const notificationStore = useNotificationStore();
    const { unreadCount } = storeToRefs(notificationStore);
    const hasUnread = computed(() => unreadCount.value > 0);

    const updateUnreadCount = (count) => {
      notificationStore.setUnreadCount(count);
    };

    const checkUnreadNotifications = async () => {
      return notificationStore.fetchUnreadCount();
    };

    const fetchNotifications = () => {
      if (contentRef.value) {
        contentRef.value.fetchNotifications();
      }
    };

    return {
      contentRef,
      unreadCount,
      hasUnread,
      updateUnreadCount,
      checkUnreadNotifications,
      fetchNotifications,
    };
  },
};
</script>
