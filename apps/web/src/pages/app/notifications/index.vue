<template>
  <v-container class="notifications-page pa-0">
    <div class="notifications-page__header d-flex align-center justify-space-between">
      <h1 class="notifications-page__title">通知</h1>
      <v-btn
        variant="text"
        size="small"
        color="primary"
        @click="markAllAsRead"
      >
        全部已读
      </v-btn>
    </div>

    <Suspense>
      <notifications-card-content
        ref="notificationsContentRef"
        :show-pagination="true"
        :auto-fetch="true"
        :use-window-scroll="true"
      />
      <template #fallback>
        <div class="d-flex justify-center align-center py-6">
          <v-progress-circular indeterminate></v-progress-circular>
        </div>
      </template>
    </Suspense>
  </v-container>
</template>

<script>
import NotificationsCardContent from '@/components/NotificationsCardContent.vue';

export default {
  name: 'NotificationsPage',
  components: {
    NotificationsCardContent
  },
  methods: {
    markAllAsRead() {
      this.$refs.notificationsContentRef?.markAllAsRead();
    }
  }
};
</script>

<style scoped>
.notifications-page {
  max-width: 1040px;
  margin: 0 auto;
}

.notifications-page__header {
  padding-top: 18px;
  padding-bottom: 10px;
}

.notifications-page__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
}

@media (max-width: 960px) {
  .notifications-page {
    max-width: 100%;
  }

  .notifications-page__header {
    padding: 12px 8px 8px;
  }
}
</style>
