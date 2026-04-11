<template>
  <v-row class="follow-stats">
    <v-col>
      <v-btn :to="`/${username}?tab=followers`" class="stats-btn" variant="text">
        <span class="font-weight-bold">{{ followersCount }}</span>
        <span class="text-body-2 text-medium-emphasis">关注者</span>
      </v-btn>
    </v-col>
    <v-col>
      <v-btn :to="`/${username}?tab=following`" class="stats-btn" variant="text">
        <span class="font-weight-bold">{{ followingCount }}</span>
        <span class="text-body-2 text-medium-emphasis">正在关注</span>
      </v-btn>
    </v-col>
  </v-row>
</template>

<script>
import request from "@/axios/axios.js";

export default {
  name: "FollowStats",
  props: {
    userId: {
      type: Number,
      required: true
    },
    username: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      followersCount: 0,
      followingCount: 0,
      loading: false
    };
  },
  mounted() {
    this.fetchFollowStats();
  },
  watch: {
    userId: {
      handler() {
        this.fetchFollowStats();
      },
    },
  },
  methods: {
    async fetchFollowStats() {
      try {
        this.loading = true;

        // Fetch followers
        const followersResponse = await request.get(`/follows/followers/${this.userId}`, {
          params: {limit: 1, offset: 0}
        });

        if (followersResponse.data.success) {
          this.followersCount = followersResponse.data.data.total;
        }

        // Fetch following
        const followingResponse = await request.get(`/follows/following/${this.userId}`, {
          params: {limit: 1, offset: 0}
        });

        if (followingResponse.data.success) {
          this.followingCount = followingResponse.data.data.total;
        }
      } catch (error) {
        console.error("获取关注统计失败:", error);
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>

<style scoped>
.follow-stats {
  margin: 8px 0;
}

.stats-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: auto;
  padding: 8px 0;
}

.stats-btn .font-weight-bold {
  font-size: 1.1rem;
  margin-bottom: 4px;
}
</style>
