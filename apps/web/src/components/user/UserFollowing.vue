<template>
  <div class="user-following">
    <v-row v-if="loading">
      <v-col class="text-center" cols="12">
        <v-progress-circular color="primary" indeterminate/>
      </v-col>
    </v-row>

    <v-row v-else-if="following.length === 0">
      <v-col class="text-center" cols="12">
        <p class="text-medium-emphasis">暂无关注的用户</p>
      </v-col>
    </v-row>

    <template v-else>
      <v-card v-for="followedUser in following" :key="followedUser.id" class="mb-3" hover>
        <v-card-item>
          <template v-slot:prepend>
            <UserHoverCard :username="followedUser.user.username">
              <router-link :to="`/${followedUser.user.username}`">
                <v-avatar size="50">
                  <v-img :src="localuser.getUserAvatar(followedUser.user.avatar)"
                         alt="用户头像"/>
                </v-avatar>
              </router-link>
            </UserHoverCard>
          </template>

          <v-card-title>
            <UserHoverCard :username="followedUser.user.username" inline>
              <router-link :to="`/${followedUser.user.username}`" class="text-decoration-none">
                {{ followedUser.user.display_name }}
              </router-link>
            </UserHoverCard>
          </v-card-title>

          <v-card-subtitle class="text-truncate">{{ followedUser.created_at || '' }}</v-card-subtitle>

          <template v-slot:append>
            <div class="d-flex align-center">
              <v-chip v-if="followedUser.followsYou" class="mr-2" color="secondary" size="small">
                关注了你
              </v-chip>
              <v-btn
                v-if="localuser.user.id && localuser.user.id !== followedUser.user.id"
                :loading="unfollowingId === followedUser.user.id"
                color="primary"
                prepend-icon="mdi-account-minus"
                size="small"
                variant="outlined"
                @click="unfollowUser(followedUser.user.id, followedUser.user.display_name)"
              >
                取消关注
              </v-btn>
            </div>
          </template>
        </v-card-item>
      </v-card>

      <div class="d-flex justify-center mt-4 mb-4">
        <v-btn v-if="hasMoreFollowing" :loading="loadingMore" variant="tonal" @click="loadMoreFollowing">
          加载更多
        </v-btn>
        <div v-else-if="following.length > 0" class="text-medium-emphasis">
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
  name: "UserFollowing",
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
      following: [],
      loading: true,
      loadingMore: false,
      unfollowingId: null,
      totalFollowing: 0,
      localuser,
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
    hasMoreFollowing() {
      return this.following.length < this.totalFollowing && this.showAll;
    }
  },
  watch: {
    userId: {
      immediate: true,
      handler(newVal, oldVal) {
        if (newVal && newVal !== oldVal) {
          this.fetchFollowing();
        }
      }
    }
  },
  methods: {
    async fetchFollowing(loadMore = false) {
      if (!this.userId) return;

      try {
        if (loadMore) {
          this.loadingMore = true;
        } else {
          this.loading = true;
        }

        const offset = loadMore ? this.following.length : 0;
        const limitToUse = this.showAll ? this.limit : Math.min(this.limit, 5);

        const response = await request.get(`/follows/following/${this.userId}`, {
          params: {
            limit: limitToUse,
            offset: offset
          }
        });

        if (response.data.success) {
          const data = response.data.data;

          if (loadMore) {
            this.following = [...this.following, ...data.following];
          } else {
            this.following = data.following;
          }

          this.totalFollowing = data.total;
        }
      } catch (error) {
        console.error("获取关注用户失败:", error);
      } finally {
        this.loading = false;
        this.loadingMore = false;
      }
    },
    async unfollowUser(userId, displayName) {
      if (!this.localuser.user.id) {
        this.$router.push('/app/account/login');
        return;
      }

      try {
        this.unfollowingId = userId;

        await request.delete(`/follows/${userId}`);

        // Remove the unfollowed user from the list if viewing own following list
        if (this.userId === this.localuser.user.id) {
          this.following = this.following.filter(follow => follow.user.id !== userId);
          this.totalFollowing--;
        } else {
          // Just update the status if viewing someone else's following list
          const index = this.following.findIndex(follow => follow.user.id === userId);
          if (index !== -1) {
            this.following[index].isFollowing = false;
          }
        }

        this.showSnackbar(`已取消关注 ${displayName}`, "info");
      } catch (error) {
        console.error("取消关注失败:", error);
        this.showSnackbar(error.response.data.error.message || "操作失败，请稍后重试", "error");
      } finally {
        this.unfollowingId = null;
      }
    },
    async loadMoreFollowing() {
      await this.fetchFollowing(true);
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
