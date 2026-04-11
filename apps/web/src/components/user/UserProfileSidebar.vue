<template>
  <div>
    <!-- Avatar -->
    <v-avatar :size="$vuetify.display.smAndDown ? 120 : 260" class="mb-4">
      <v-img :src="localuser.getUserAvatar(user.avatar)" />
    </v-avatar>

    <!-- Name & Username -->
    <div class="mb-1">
      <div class="text-h5 font-weight-bold">{{ user.display_name }}</div>
      <div class="text-body-1 text-medium-emphasis">{{ username }}</div>
    </div>

    <!-- Role / Status -->
    <div class="d-flex flex-wrap ga-2 mb-3" v-if="user.type === 'administrator' || !user.isActive">
      <v-chip v-if="user.type === 'administrator'" color="primary" size="small">
        <v-icon start size="14">mdi-shield-crown</v-icon>
        管理员
      </v-chip>
      <v-chip v-if="!user.isActive" color="error" size="small">
        <v-icon start size="14">mdi-alert-circle</v-icon>
        异常
      </v-chip>
    </div>

    <!-- Bio -->
    <p v-if="user.bio" class="text-body-2 mb-4">{{ user.bio }}</p>

    <!-- Actions -->
    <div class="mb-4">
      <v-btn
        v-if="isCurrentUser"
        variant="tonal"
        block
        rounded="lg"
        to="/app/account"
      >
        编辑个人资料
      </v-btn>
      <user-relation-controls
        v-else
        :display-name="user.display_name"
        :user-id="user.id"
        :username="username"
      />
    </div>

    <div v-if="user.id" class="mb-4">
      <ObjectNotificationLevelControl
        target-type="USER"
        :target-id="user.id"
      />
    </div>

    <!-- Follow Stats - GitHub style -->
    <div class="d-flex align-center ga-3 mb-4 text-body-2">
      <v-icon size="16" class="text-medium-emphasis">mdi-account-group-outline</v-icon>
      <router-link :to="`/${username}?tab=followers`" class="follow-link">
        <strong>{{ followersCount }}</strong> 粉丝
      </router-link>
      <span class="text-medium-emphasis">&middot;</span>
      <router-link :to="`/${username}?tab=following`" class="follow-link">
        <strong>{{ followingCount }}</strong> 关注
      </router-link>
    </div>

    <!-- Meta Info -->
    <v-list density="compact" class="bg-transparent pa-0 text-body-2">
      <v-list-item v-if="user.location" class="px-0" min-height="32">
        <template #prepend>
          <v-icon size="16" class="mr-3 text-medium-emphasis">mdi-map-marker-outline</v-icon>
        </template>
        <v-list-item-title class="text-body-2">{{ user.location }}</v-list-item-title>
      </v-list-item>

      <v-list-item v-if="user.url" class="px-0" min-height="32">
        <template #prepend>
          <v-icon size="16" class="mr-3 text-medium-emphasis">mdi-link-variant</v-icon>
        </template>
        <v-list-item-title class="text-body-2">
          <a :href="user.url" target="_blank" class="text-primary text-decoration-none">{{ displayUrl }}</a>
        </v-list-item-title>
      </v-list-item>

      <v-list-item v-if="user.birthday" class="px-0" min-height="32">
        <template #prepend>
          <v-icon size="16" class="mr-3 text-medium-emphasis">mdi-cake-variant-outline</v-icon>
        </template>
        <v-list-item-title class="text-body-2">{{ formatDate(user.birthday) }}</v-list-item-title>
      </v-list-item>

      <v-list-item class="px-0" min-height="32">
        <template #prepend>
          <v-icon size="16" class="mr-3 text-medium-emphasis">mdi-calendar-outline</v-icon>
        </template>
        <v-list-item-title class="text-body-2">
          <TimeAgo :date="user.regTime" /> 加入
        </v-list-item-title>
      </v-list-item>
    </v-list>
  </div>
</template>

<script>
import UserRelationControls from "@/components/user/UserRelationControls.vue";
import TimeAgo from "@/components/TimeAgo.vue";
import ObjectNotificationLevelControl from "@/components/notifications/ObjectNotificationLevelControl.vue";
import { localuser } from "@/services/localAccount";
import request from "@/axios/axios.js";

export default {
  name: "UserProfileSidebar",
  components: {
    UserRelationControls,
    TimeAgo,
    ObjectNotificationLevelControl,
  },
  props: {
    user: {
      type: Object,
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      localuser,
      followersCount: 0,
      followingCount: 0,
    };
  },
  computed: {
    isCurrentUser() {
      return (
        localuser.user.value?.id &&
        Number(localuser.user.value.id) === Number(this.user.id)
      );
    },
    displayUrl() {
      try {
        const url = new URL(this.user.url);
        return url.hostname + (url.pathname !== "/" ? url.pathname : "");
      } catch {
        return this.user.url;
      }
    },
  },
  watch: {
    "user.id": {
      handler() {
        this.fetchFollowStats();
      },
      immediate: true,
    },
  },
  methods: {
    formatDate(dateStr) {
      return new Date(dateStr).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    },
    async fetchFollowStats() {
      if (!this.user.id) return;
      try {
        const [followersRes, followingRes] = await Promise.all([
          request.get(`/follows/followers/${this.user.id}`, { params: { limit: 1, offset: 0 } }),
          request.get(`/follows/following/${this.user.id}`, { params: { limit: 1, offset: 0 } }),
        ]);
        if (followersRes.data.success) {
          this.followersCount = followersRes.data.data.total;
        }
        if (followingRes.data.success) {
          this.followingCount = followingRes.data.data.total;
        }
      } catch (e) {
        console.error("Failed to fetch follow stats:", e);
      }
    },
  },
};
</script>

<style scoped>
.follow-link {
  color: inherit;
  text-decoration: none;
}

.follow-link:hover {
  color: rgb(var(--v-theme-primary));
}
</style>
