<template>
  <!-- 桌面端：下拉菜单 -->
  <v-menu v-if="!isMobile" :close-on-content-click="false" location="bottom end">
    <template #activator="{ props }">
      <v-btn icon variant="text" v-bind="props">
        <v-badge
          :model-value="unreadCount > 0"
          :content="unreadCount > 99 ? '99+' : unreadCount"
          color="error"
        >
          <v-icon>mdi-bell-outline</v-icon>
        </v-badge>
      </v-btn>
    </template>
    <v-card min-width="380px" max-width="460px">
      <v-card-item>
        <template #prepend>
          <v-icon>mdi-bell</v-icon>
        </template>
        <v-card-title>通知</v-card-title>
        <template #append>
          <v-btn
            v-if="unreadCount > 0"
            variant="text"
            size="small"
            @click="handleMarkAllRead"
          >
            全部已读
          </v-btn>
        </template>
      </v-card-item>
      <v-divider />
      <Suspense>
        <NotificationsCardContent
          :autoFetch="true"
          :maxItems="6"
          :autoLoadMore="false"
          @update:unread-count="updateUnreadCount"
        />
      </Suspense>
    </v-card>
  </v-menu>

  <!-- 小屏：全屏弹窗 -->
  <template v-else>
    <v-btn icon variant="text" @click="dialog = true">
      <v-badge
        :model-value="unreadCount > 0"
        :content="unreadCount > 99 ? '99+' : unreadCount"
        color="error"
      >
        <v-icon>mdi-bell-outline</v-icon>
      </v-badge>
    </v-btn>
    <v-dialog v-model="dialog" fullscreen transition="dialog-bottom-transition">
      <v-card class="d-flex flex-column" style="height: 100%">
        <v-toolbar>
          <v-btn icon="mdi-close" variant="text" @click="dialog = false" />
          <v-toolbar-title>通知</v-toolbar-title>
          <v-toolbar-items>
            <v-btn
              v-if="unreadCount > 0"
              variant="text"
              @click="handleMarkAllRead"
            >
              全部已读
            </v-btn>
          </v-toolbar-items>
        </v-toolbar>
        <v-divider />
        <div class="flex-grow-1" style="overflow: hidden; min-height: 0">
          <Suspense>
            <NotificationsCardContent
              :autoFetch="true"
              :useWindowScroll="false"
              @update:unread-count="updateUnreadCount"
            />
          </Suspense>
        </div>
      </v-card>
    </v-dialog>
  </template>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { storeToRefs } from 'pinia';
import { useNotificationStore } from '@/stores/notification';
import NotificationsCardContent from './NotificationsCardContent.vue';

const notificationStore = useNotificationStore();
const { unreadCount } = storeToRefs(notificationStore);

const dialog = ref(false);
const isMobile = ref(false);
let mq = null;

const checkDevice = () => {
  isMobile.value = window.matchMedia('(max-width: 768px)').matches;
};

onMounted(() => {
  checkDevice();
  mq = window.matchMedia('(max-width: 768px)');
  mq.addEventListener('change', checkDevice);
});

onBeforeUnmount(() => {
  mq?.removeEventListener('change', checkDevice);
});

const updateUnreadCount = (count) => {
  notificationStore.setUnreadCount(count);
};

const handleMarkAllRead = async () => {
  await notificationStore.markAllAsRead();
};
</script>
