<template>
  <div class="user-blocked">
    <v-row v-if="loading">
      <v-col class="text-center" cols="12">
        <v-progress-circular color="primary" indeterminate/>
      </v-col>
    </v-row>

    <v-row v-else-if="blockedUsers.length === 0">
      <v-col class="text-center" cols="12">
        <p class="text-medium-emphasis">暂无拉黑用户</p>
      </v-col>
    </v-row>

    <template v-else>
      <v-card v-for="blockedUser in blockedUsers" :key="blockedUser.id" class="mb-3" hover>
        <v-card-item>
          <template v-slot:prepend>
            <UserHoverCard :username="blockedUser.user.username">
              <router-link :to="`/${blockedUser.user.username}`">
                <v-avatar size="50">
                  <v-img :src="localuser.getUserAvatar(blockedUser.user.avatar)" alt="用户头像"/>
                </v-avatar>
              </router-link>
            </UserHoverCard>
          </template>

          <v-card-title>
            <UserHoverCard :username="blockedUser.user.username" inline>
              <router-link :to="`/${blockedUser.user.username}`" class="text-decoration-none">
                {{ blockedUser.user.display_name }}
              </router-link>
            </UserHoverCard>
          </v-card-title>

          <v-card-subtitle class="text-truncate">{{ blockedUser.metadata.reason }} - {{ blockedUser.created_at }}
          </v-card-subtitle>

          <template v-slot:append>
            <v-btn
              :loading="unblockingId === blockedUser.user.id"
              color="error"
              size="small"
              variant="outlined"
              @click="unblockUser(blockedUser.user.id, blockedUser.user.display_name)"
            >
              取消拉黑
            </v-btn>
          </template>
        </v-card-item>

        <v-card-text v-if="blockedUser.reason" class="pt-0">
          <p class="text-caption text-medium-emphasis">
            <strong>拉黑原因:</strong> {{ blockedUser.reason }}
          </p>
        </v-card-text>
      </v-card>

      <div class="d-flex justify-center mt-4 mb-4">
        <v-btn v-if="hasMoreBlockedUsers" :loading="loadingMore" variant="tonal" @click="loadMoreBlockedUsers">
          加载更多
        </v-btn>
        <div v-else-if="blockedUsers.length > 0" class="text-medium-emphasis">
          没有更多内容了
        </div>
      </div>
    </template>

    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="3000"
    >
      {{ snackbar.text }}
      <template v-slot:actions>
        <v-btn
          variant="text"
          @click="snackbar.show = false"
        >
          关闭
        </v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script>
import request from "@/axios/axios.js";
import {localuser} from "@/services/localAccount";
import {ref, onMounted} from "vue";
import UserHoverCard from "@/components/UserHoverCard.vue";


export default {
  name: "UserBlocked",
  props: {
    userId: {
      type: Number,
      required: true
    },
    limit: {
      type: Number,
      default: 20
    },
    showAll: {
      type: Boolean,
      default: false
    },
    username: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      blockedUsers: [],
      loading: false,
      loadingMore: false,
      unblockingId: null,
      totalBlockedUsers: 0,
      page: 1,
      hasMore: true,
      snackbar: {
        show: false,
        text: "",
        color: "success"
      },

      localuser,
    };
  },
  computed: {
    hasMoreBlockedUsers() {
      return this.blockedUsers.length < this.totalBlockedUsers && this.showAll;
    }
  },
  watch: {
    userId: {
      immediate: true,
      handler(newVal, oldVal) {
        if (newVal && newVal !== oldVal) {
          this.fetchBlockedUsers();
        }
      }
    }
  },
  methods: {
    async fetchBlockedUsers(loadMore = false) {
      if (!this.userId) return;

      try {
        if (loadMore) {
          this.loadingMore = true;
        } else {
          this.loading = true;
        }

        const offset = loadMore ? this.blockedUsers.length : 0;
        const limitToUse = this.showAll ? this.limit : Math.min(this.limit, 5);

        const response = await request.get(`/follows/blocked`, {
          params: {
            limit: limitToUse,
            offset: offset
          }
        });

        if (response.data.success) {
          const data = response.data.data;

          if (loadMore) {
            this.blockedUsers = [...this.blockedUsers, ...data.blocked];
          } else {
            this.blockedUsers = data.blocked;
          }

          this.totalBlockedUsers = data.total;
        }
      } catch (error) {
        console.error("获取拉黑用户失败:", error);
      } finally {
        this.loading = false;
        this.loadingMore = false;
      }
    },
    async unblockUser(userId, displayName) {
      try {
        this.unblockingId = userId;

        await request.delete(`/follows/block/${userId}`);

        // Remove the unblocked user from the list
        this.blockedUsers = this.blockedUsers.filter(blocked => blocked.user.id !== userId);

        // Update the total count
        this.totalBlockedUsers--;

        this.showSnackbar(`已取消拉黑 ${displayName}`, "success");
      } catch (error) {
        console.error("取消拉黑失败:", error);
        this.showSnackbar(error.response.data.error.message || "操作失败，请稍后重试", "error");
      } finally {
        this.unblockingId = null;
      }
    },
    async loadMoreBlockedUsers() {
      await this.fetchBlockedUsers(true);
    },
    showSnackbar(text, color = "success") {
      this.snackbar = {
        show: true,
        text,
        color
      };
    }
  },

};
</script>

<style scoped>
.text-decoration-none {
  text-decoration: none;
  color: inherit;
}

.text-decoration-none:hover {
  text-decoration: underline;
  opacity: 0.8;
}
</style>
