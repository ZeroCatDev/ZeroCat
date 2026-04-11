<template>
  <v-container class="pa-4" fluid>
    <!-- User Profile Card -->
    <user-card
      :loading="userCardLoading"
      :s3BucketUrl="s3BucketUrl"
      :userData="userInfo"
    />

    <!-- Account Settings Section -->
    <v-card border hover>

      <v-tabs v-model="tab" bg-color="primary">
        <v-tab
          v-for="item in tabItems"
          :key="item.value"
          :prepend-icon="item.icon"
          :text="item.title"
          :to="item.to"
          :value="item.value"
          @click="tab = item.value"
        >

        </v-tab>
      </v-tabs>
      <v-card-text class="pa-4">
        <v-window v-model="tab">
          <!-- User Info Tab -->
          <v-window-item value="userInfo">
            <h3 class="text-h5 mb-4">个人资料</h3>
            <profile-editor
              :userData="userInfo"
              @error="handleError"
              @profile-updated="handleProfileUpdate"
            />
          </v-window-item>

          <!-- Username Tab -->
          <v-window-item value="username">
            <h3 class="text-h5 mb-4">修改用户名</h3>
            <username-editor
              :userData="userInfo"
              @error="handleError"
              @username-updated="handleUsernameUpdate"
            />
          </v-window-item>

          <!-- Password Tab -->
          <v-window-item value="password">
            <h3 class="text-h5 mb-4">修改密码</h3>
            <password-editor
              @error="handleError"
              @password-updated="handlePasswordUpdate"
            />
          </v-window-item>

          <!-- Avatar Tab -->
          <v-window-item value="avatar">
            <h3 class="text-h5 mb-4">更新头像</h3>
            <avatar-editor
              :s3BucketUrl="s3BucketUrl"
              :userData="userInfo"
              @error="handleError"
              @avatar-updated="handleAvatarUpdate"
            />
          </v-window-item>

          <!-- Email Tab -->
          <v-window-item value="email">
            <h3 class="text-h5 mb-4">邮箱管理</h3>
            <email-manager ref="emailManager"/>
          </v-window-item>

          <!-- OAuth Tab -->
          <v-window-item value="oauth">
            <h3 class="text-h5 mb-4">第三方账号关联</h3>
            <o-auth-manager/>
            <social-integration-manager class="mt-4" />
          </v-window-item>

          <!-- Security Tab -->
          <v-window-item value="security">
            <h3 class="text-h5 mb-4">安全管理</h3>
            <security-manager/>
          </v-window-item>

          <!-- Relationships Tab -->
          <v-window-item value="relationships">


          </v-window-item>

          <!-- Notifications Tab -->
          <v-window-item value="notifications">
            <h3 class="text-h5 mb-4">通知设置</h3>
            <notification-settings-card />
          </v-window-item>

          <!-- Tokens Tab -->
          <v-window-item value="tokens">
            <h3 class="text-h5 mb-4">API令牌管理</h3>
            <token-manager
              @error="handleError"
              @token-created="handleTokenCreated"
              @token-deleted="handleTokenDeleted"
              @token-revoked="handleTokenRevoked"
            />
          </v-window-item>
        </v-window>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script>
import {localuser} from "@/services/localAccount";
import {useHead} from "@unhead/vue";
import {getAccount} from "@/services/accountService";
import {ref, onMounted} from "vue";
import {get} from "@/services/serverConfig";

// Existing Components
import EmailManager from "@/components/EmailManager.vue";
import OAuthManager from "@/components/OAuthManager.vue";
import SecurityManager from "@/components/SecurityManager.vue";

// New Components
import UserCard from "@/components/account/UserCard.vue";
import ProfileEditor from "@/components/account/ProfileEditor.vue";
import UsernameEditor from "@/components/account/UsernameEditor.vue";
import PasswordEditor from "@/components/account/PasswordEditor.vue";
import AvatarEditor from "@/components/account/AvatarEditor.vue";
import UserFollowing from "@/components/user/UserFollowing.vue";
import UserFollowers from "@/components/user/UserFollowers.vue";
import UserBlocked from "@/components/user/UserBlocked.vue";
import TokenManager from "@/components/account/TokenManager.vue";
import NotificationSettingsCard from "@/components/NotificationSettingsCard.vue";
import SocialIntegrationManager from "@/components/SocialIntegrationManager.vue";

export default {
  components: {
    EmailManager,
    OAuthManager,
    SecurityManager,
    UserCard,
    ProfileEditor,
    UsernameEditor,
    PasswordEditor,
    AvatarEditor,
    UserFollowing,
    UserFollowers,
    UserBlocked,
    TokenManager,
    NotificationSettingsCard,
    SocialIntegrationManager,
  },
  data() {
    return {
      userCardLoading: false,
      localuser: localuser,
      userInfo: {},
      tab: "userInfo",
      tabItems: [
        {title: "用户信息", value: "userInfo", icon: "mdi-account-circle"},
        {title: "账户", value: "username", icon: "mdi-cog"},
        {title: "密码", value: "password", icon: "mdi-lock"},
        {title: "头像", value: "avatar", icon: "mdi-image"},
        {title: "邮箱", value: "email", icon: "mdi-email"},
        {title: "OAuth", value: "oauth", icon: "mdi-link-variant"},
        {title: "安全", value: "security", icon: "mdi-security"},
        {title: "关系", value: "relationships", icon: "mdi-account-group", to: "/app/account/relationships"},
        {title: "通知", value: "notifications", icon: "mdi-bell"},
        {title: "令牌", value: "tokens", icon: "mdi-key"},
        {title: "开发者", value: "developer", icon: "mdi-account-group", to: "/app/services"},

      ],
      loading: false,
      error: null,
      s3BucketUrl: '',
    };
  },
  setup() {
    useHead({title: "账户设置"});
    const s3BucketUrl = ref(null);

    onMounted(async () => {
      s3BucketUrl.value = get('s3.staticurl');
    });

    return {
      s3BucketUrl,
    };
  },
  async mounted() {
    this.s3BucketUrl = get('s3.staticurl');
  },
  async created() {
    await this.getUserById();
  },
  methods: {
    async getUserById() {
      this.userCardLoading = true;
      try {
        const response = await getAccount(localuser.user.value.id);
        this.userInfo = response.data.data;
      } catch (error) {
        this.handleError(error);
      } finally {
        this.userCardLoading = false;
      }
    },
    handleProfileUpdate(response) {
      this.showToast(
        response.data.status || "info",
        "修改个人信息",
        response.data.message
      );
      this.getUserById();
    },
    handleUsernameUpdate(response) {
      this.showToast(
        response.data.status || "info",
        "修改用户名",
        response.data.message
      );
      this.getUserById();
    },
    handlePasswordUpdate(response) {
      this.showToast(
        response.data.status || "info",
        "修改密码",
        response.data.message
      );
    },
    handleAvatarUpdate(response) {
      this.showToast(
        response.data.status || "info",
        "修改头像",
        response.data.message
      );
      this.getUserById();
    },
    handleTokenCreated(response) {
      this.showToast(
        response.data.status || "success",
        "创建令牌",
        response.data.message || "令牌创建成功"
      );
    },
    handleTokenDeleted(response) {
      this.showToast(
        "success",
        "删除令牌",
        "令牌删除成功"
      );
    },
    handleTokenRevoked(response) {
      this.showToast(
        "success",
        "吊销令牌",
        "令牌吊销成功"
      );
    },
    handleError(error) {
      this.showToast("error", "错误", error.message);
    },
    showToast(severity, summary, detail) {
      this.$toast.add({severity, summary, detail, life: 3000});
    },
  },
};
</script>

<style scoped>
.v-card {
  transition: all 0.3s ease;
}

@media (max-width: 600px) {
  .v-tabs .v-tab {
    min-width: 0;
    padding: 0 8px;
  }
}
</style>
