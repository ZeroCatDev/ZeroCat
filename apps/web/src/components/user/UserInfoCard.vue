<template>
  <v-card border class="user-info-card">
    <v-card-item>
      <template v-slot:prepend>
        <v-avatar size="96">
          <v-img
            v-if="user.avatar"
            :alt="user.display_name"
            :src="localuser.getUserAvatar(user.avatar)"
          />
          <v-icon v-else icon="mdi-account" size="48"></v-icon>
        </v-avatar>
      </template>
      <v-card-title>{{ user.display_name || user.username || '加载中...' }}</v-card-title>
      <v-card-subtitle>@{{ user.username || '...' }}</v-card-subtitle>
    </v-card-item>

    <v-card-text v-if="user.bio" class="mt-2">
      {{ user.bio }}
    </v-card-text>

    <v-card-text class="d-flex gap-2">
      <v-chip
        v-if="user.role"
        :color="getRoleColor(user.role)"
        size="small"
        variant="flat"
      >
        {{ getRoleLabel(user.role) }}
      </v-chip>
      <!-- <v-chip
         size="small"
         :prepend-icon="!user.verified ? 'mdi-check-decagram' : ''"
         :color="!user.verified ? 'success' : 'default'"
         variant="flat"
       >
         {{ !user.verified ? '已验证' : '未验证' }}
       </v-chip>-->
    </v-card-text>

    <v-divider></v-divider>

    <v-card-text class="d-flex justify-space-around py-3">
      <div class="text-center">
        <div class="text-h6">{{ user.project_count || 0 }}</div>
        <div class="text-caption">作品</div>
      </div>
      <v-divider vertical></v-divider>
      <div class="text-center">
        <div class="text-h6">{{ user.following_count || 0 }}</div>
        <div class="text-caption">关注</div>
      </div>
      <v-divider vertical></v-divider>
      <div class="text-center">
        <div class="text-h6">{{ user.followers_count || 0 }}</div>
        <div class="text-caption">粉丝</div>
      </div>
    </v-card-text>

    <v-card-actions v-if="user.id && user.id !== localuser?.id">
      <v-spacer></v-spacer>
      <user-relation-controls
        :display-name="user.display_name"
        :user-id="user.id"
        :username="user.username"
      />
    </v-card-actions>
  </v-card>
</template>

<script>
import {localuser} from "@/services/localAccount";
import UserRelationControls from "./UserRelationControls.vue";
import request from "@/axios/axios";
import {ref, onMounted} from "vue";


export default {
  name: "UserInfoCard",
  components: {
    UserRelationControls
  },
  props: {
    userId: {
      type: [Number, String],
      default: null
    },
    username: {
      type: String,
      default: null
    },
    user: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      loading: false,
      error: null,
      localuser,
    };
  },
  methods: {
    getRoleColor(role) {
      const colors = {
        admin: 'error',
        moderator: 'warning',
        user: 'primary'
      };
      return colors[role] || 'default';
    },
    getRoleLabel(role) {
      const labels = {
        admin: '管理员',
        moderator: '版主',
        user: '用户'
      };
      return labels[role] || role;
    },
    async fetchUserInfo() {
      this.loading = true;
      try {
        let endpoint = this.userId ? `/user/id/${this.userId}` : `/user/name/${this.username}`;
        const response = await request.get(endpoint);
        if (response.data.status === 'success') {
          this.user = response.data.data;
        } else {
          throw new Error(response.data.message);
        }
      } catch (error) {
        console.error('Error fetching user info:', error);
        this.error = error.message;
      } finally {
        this.loading = false;
      }
    }
  },
  watch: {
    userId: {
      handler: 'fetchUserInfo',
      immediate: true
    },
    username: {
      handler: 'fetchUserInfo',
      immediate: true
    }
  }
};
</script>

<style scoped>
.user-info-card {
  max-width: 100%;
  transition: transform 0.2s;
}

.user-info-card:hover {
  transform: translateY(-2px);
}
</style>
