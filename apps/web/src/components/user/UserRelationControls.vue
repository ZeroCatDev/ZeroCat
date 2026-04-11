<template>
  <div>
    <v-btn
      :color="'primary'"
      :loading="followLoading"
      :prepend-icon="isFollowing ? 'mdi-check' : 'mdi-account-plus'"
      :variant="isFollowing ? 'outlined' : 'tonal'"
      rounded="pill"
      @click="toggleFollow"
    >
      {{ isFollowing ? "已关注" : "关注" }}
    </v-btn>

    <v-menu location="bottom">
      <template v-slot:activator="{ props }">
        <v-btn
          class="ml-2"
          icon="mdi-dots-vertical"
          size="small"
          v-bind="props"
          variant="text"
        ></v-btn>
      </template>
      <v-list density="compact" width="150">
        <v-list-item
          :class="{ 'text-error': !isBlocking }"
          :prepend-icon="
            isBlocking ? 'mdi-account-cancel' : 'mdi-account-remove'
          "
          :title="isBlocking ? '取消拉黑' : '拉黑用户'"
          @click="toggleBlock"
        ></v-list-item>
        <v-list-item
          v-if="isFollowing"
          prepend-icon="mdi-account-remove"
          title="取消关注"
          @click="toggleFollow"
        ></v-list-item>
        <!--<v-divider></v-divider>
        <v-list-item
          prepend-icon="mdi-message-text"
          title="发送私信"
          @click="sendMessage"
        ></v-list-item>
        <v-list-item
          prepend-icon="mdi-alert-circle"
          title="举报用户"
          @click="reportUser"
        ></v-list-item>-->
      </v-list>
    </v-menu>

    <v-dialog v-model="blockDialog" max-width="400px">
      <v-card>
        <v-card-title class="text-h5 text-center pa-4">
          {{ isBlocking ? "取消拉黑用户" : "拉黑用户" }}
        </v-card-title>
        <v-card-text class="pa-4">
          <p v-if="isBlocking">
            确定要取消拉黑
            <strong>{{ targetUsername }}</strong>
            吗？取消拉黑后，该用户可以查看您的内容并与您互动。
          </p>
          <p v-else>
            确定要拉黑
            <strong>{{ targetUsername }}</strong>
            吗？拉黑后，该用户将无法关注您，也无法查看您的动态或与您互动。
          </p>
          <v-textarea
            v-if="!isBlocking"
            v-model="blockReason"
            class="mt-4"
            hide-details
            label="拉黑原因（可选）"
            placeholder="请简要说明拉黑原因..."
            rows="3"
            variant="outlined"
          ></v-textarea>
        </v-card-text>
        <v-card-actions class="pa-4 pt-0">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="blockDialog = false"> 取消</v-btn>
          <v-btn
            :color="isBlocking ? 'primary' : 'error'"
            :loading="blockLoading"
            variant="tonal"
            @click="confirmBlockAction"
          >
            {{ isBlocking ? "取消拉黑" : "拉黑" }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="3000">
      {{ snackbar.text }}
      <template v-slot:actions>
        <v-btn variant="text" @click="snackbar.show = false"> 关闭</v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script>
import request from "@/axios/axios.js";
import {localuser} from "@/services/localAccount";

export default {
  name: "UserRelationControls",
  props: {
    userId: {
      type: Number,
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    displayName: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      isFollowing: false,
      isBlocking: false,
      followLoading: false,
      blockLoading: false,
      blockDialog: false,
      blockReason: "",
      localuser,
      targetUsername: this.displayName || this.username,
      snackbar: {
        show: false,
        text: "",
        color: "success",
      },
    };
  },
  mounted() {
    if (this.localuser.user.id) {
      this.checkRelationships();
    }
  },
  watch: {
    userId: {
      handler() {
        this.checkRelationships();
      },
      immediate: true,
    },
  },
  methods: {
    async checkRelationships() {
      if (!this.localuser.user.id) return;

      try {
        const response = await request.get(
          `/follows/relationships/${this.userId}`
        );
        if (response.data.success) {
          const {isFollowing, isBlocking} = response.data.data;
          this.isFollowing = isFollowing;
          this.isBlocking = isBlocking;
        }
      } catch (error) {
        console.error("检查用户关系失败:", error);
      }
    },
    async toggleFollow() {
      if (!this.localuser.user.id) {
        this.$router.push("/login");
        return;
      }

      try {
        this.followLoading = true;
        if (this.isFollowing) {
          await request.delete(`/follows/${this.userId}`);
          this.isFollowing = false;
          this.showSnackbar(`已取消关注 ${this.targetUsername}`, "info");
        } else {
          await request.post(`/follows/${this.userId}`);
          this.isFollowing = true;
          this.showSnackbar(`已成功关注 ${this.targetUsername}`, "success");
        }
      } catch (error) {
        console.error("关注操作失败:", error);
        this.showSnackbar(error.response.data.error.message || "操作失败，请稍后重试", "error");
      } finally {
        this.followLoading = false;
      }
    },
    toggleBlock() {
      if (!this.localuser.user.id) {
        this.$router.push("/login");
        return;
      }

      this.blockDialog = true;
    },
    async confirmBlockAction() {
      try {
        this.blockLoading = true;

        if (this.isBlocking) {
          await request.delete(`/follows/block/${this.userId}`);
          this.isBlocking = false;
          this.showSnackbar(`已取消拉黑 ${this.targetUsername}`, "success");
        } else {
          const payload = this.blockReason ? {reason: this.blockReason} : {};
          await request.post(`/follows/block/${this.userId}`, payload);
          this.isBlocking = true;

          // If user was following, automatically unfollow when blocked
          if (this.isFollowing) {
            await request.delete(`/follows/${this.userId}`);
            this.isFollowing = false;
          }

          this.showSnackbar(`已拉黑 ${this.targetUsername}`, "success");
        }

        this.blockDialog = false;
        this.blockReason = "";
      } catch (error) {
        console.error("拉黑操作失败:", error);
        this.showSnackbar(error.response.data.error.message || "操作失败，请稍后重试", "error");
      } finally {
        this.blockLoading = false;
      }
    },
    sendMessage() {
      // Placeholder for sending private message functionality
      this.showSnackbar("私信功能即将上线", "info");
    },
    reportUser() {
      // Placeholder for reporting user functionality
      this.showSnackbar("举报功能即将上线", "info");
    },
    showSnackbar(text, color = "success") {
      this.snackbar.text = text;
      this.snackbar.color = color;
      this.snackbar.show = true;
    },
  },
};
</script>
