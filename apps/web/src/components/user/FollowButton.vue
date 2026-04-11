<template>
  <v-btn
    :color="isFollowing ? 'primary' : 'primary'"
    :loading="loading"
    :prepend-icon="isFollowing ? 'mdi-check' : 'mdi-account-plus'"
    :variant="isFollowing ? 'outlined' : 'tonal'"
    class="follow-btn"
    @click="toggleFollow"
  >
    {{ isFollowing ? "已关注" : "关注" }}
  </v-btn>
</template>

<script>
import request from "@/axios/axios.js";
import {localuser} from "@/services/localAccount";

export default {
  name: "FollowButton",
  props: {
    userId: {
      type: Number,
      required: true
    }
  },
  data() {
    return {
      isFollowing: false,
      loading: false,
      localuser
    };
  },
  mounted() {
    this.checkFollowStatus();
  },
  methods: {
    async checkFollowStatus() {
      if (!this.localuser.id) return;

      try {
        this.loading = true;
        const response = await request.get(`/follows/check/${this.userId}`);
        if (response.data.success) {
          this.isFollowing = response.data.data.isFollowing;
        }
      } catch (error) {
        console.error("检查关注状态失败:", error);
      } finally {
        this.loading = false;
      }
    },
    async toggleFollow() {
      if (!this.localuser.id) {
        this.$router.push('/login');
        return;
      }

      try {
        this.loading = true;
        if (this.isFollowing) {
          await request.delete(`/follows/${this.userId}`);
          this.isFollowing = false;
        } else {
          await request.post(`/follows/${this.userId}`);
          this.isFollowing = true;
        }
      } catch (error) {
        console.error("关注操作失败:", error);
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>

<style scoped>
.follow-btn {
  min-width: 90px;
  transition: all 0.3s;
}
</style>
