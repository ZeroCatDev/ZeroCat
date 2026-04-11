<template>
  <v-container>
    <v-tabs v-model="tab" align="center" bg-color="primary">
      <v-tab value="all">全部动态</v-tab>
      <v-tab value="following">关注的人</v-tab>
    </v-tabs>

    <v-tabs-window v-model="tab">
      <v-tabs-window-item value="all">
        <v-card class="mt-4" variant="flat">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" color="primary" icon="mdi-timeline-clock"/>
            我的动态
          </v-card-title>
          <v-card-text>
            <Timeline
              :is-loading-more="isLoadingMore"
              :timeline="timeline"
              @load-more="loadMoreEvents"
            />
          </v-card-text>
        </v-card>
      </v-tabs-window-item>

      <v-tabs-window-item value="following">
        <v-card class="mt-4" variant="flat">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" color="primary" icon="mdi-account-group"/>
            关注的人的动态
          </v-card-title>
          <v-card-text>
            <Timeline
              :is-loading-more="isLoadingFollowingMore"
              :timeline="followingTimeline"
              @load-more="loadMoreFollowingEvents"
            />
          </v-card-text>
        </v-card>
      </v-tabs-window-item>
    </v-tabs-window>
  </v-container>
</template>

<script>
import {useHead} from "@unhead/vue";
import request from "@/axios/axios.js";
import Timeline from "@/components/timeline/Timeline.vue";

export default {
  name: 'MyTimeline',
  components: {
    Timeline
  },
  data() {
    return {
      tab: 'all',
      timeline: {
        events: [],
        pagination: {
          current: 1,
          size: 20,
          total: 0
        }
      },
      followingTimeline: {
        events: [],
        pagination: {
          current: 1,
          size: 20,
          total: 0
        }
      },
      isLoadingMore: false,
      isLoadingFollowingMore: false
    };
  },
  setup() {
    useHead({
      title: "我的动态 - ZeroCat",
    });
  },
  created() {
    this.fetchTimeline();
    this.fetchFollowingTimeline();
  },
  methods: {
    async fetchTimeline(page = 1) {
      try {
        const response = await request.get('/timeline/me', {
          params: {
            page,
            limit: this.timeline.pagination.size
          }
        });

        if (response.data.status === 'success') {
          if (page === 1) {
            this.timeline = response.data.data;
          } else {
            this.timeline.events = [
              ...this.timeline.events,
              ...response.data.data.events
            ];
            this.timeline.pagination = response.data.data.pagination;
          }
        }
      } catch (error) {
        console.error('Failed to fetch timeline:', error);
      }
    },
    async fetchFollowingTimeline(page = 1) {
      try {
        const response = await request.get('/timeline/following', {
          params: {
            page,
            limit: this.followingTimeline.pagination.size
          }
        });

        if (response.data.status === 'success') {
          if (page === 1) {
            this.followingTimeline = response.data.data;
          } else {
            this.followingTimeline.events = [
              ...this.followingTimeline.events,
              ...response.data.data.events
            ];
            this.followingTimeline.pagination = response.data.data.pagination;
          }
        }
      } catch (error) {
        console.error('Failed to fetch following timeline:', error);
      }
    },
    async loadMoreEvents() {
      if (this.isLoadingMore) return;

      try {
        this.isLoadingMore = true;
        await this.fetchTimeline(this.timeline.pagination.current + 1);
      } finally {
        this.isLoadingMore = false;
      }
    },
    async loadMoreFollowingEvents() {
      if (this.isLoadingFollowingMore) return;

      try {
        this.isLoadingFollowingMore = true;
        await this.fetchFollowingTimeline(this.followingTimeline.pagination.current + 1);
      } finally {
        this.isLoadingFollowingMore = false;
      }
    }
  }
};
</script>

<style scoped>
.v-card {
  transition: transform 0.2s;
}

.v-card:hover {
  transform: translateY(-2px);
}

.v-tabs {
  margin-bottom: 16px;
}
</style>
