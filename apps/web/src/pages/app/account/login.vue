<template>
  <v-container class="d-flex align-center justify-center fill-height pa-4">
    <div class="mx-auto" style="width: 100%; max-width: 448px">
      <v-alert
        v-if="reason === 'session_expired'"
        type="warning"
        variant="tonal"
        rounded="lg"
        class="mb-4"
        text="您的登录状态已失效，请重新登录"
      />
      <SignInFlow @login-success="handleLoginSuccess" />
    </div>
  </v-container>
</template>

<script>
import {useHead} from "@unhead/vue";
import {localuser} from "@/services/localAccount";
import { authClient, TOKEN_REFRESHED_EVENT_NAME } from "@/axios/axios";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { onUnmounted } from "vue";
import SignInFlow from "@/components/account/SignInFlow.vue";

export default {
  components: { SignInFlow },

  setup() {
    const route = useRoute();
    const router = useRouter();
    const authStore = useAuthStore();

    const reason = route.query.reason || null;

    // Capture redirect from query or sessionStorage
    const redirectFromQuery =
      typeof route.query.redirect === "string" ? route.query.redirect : null;
    if (redirectFromQuery) {
      authStore.setAuthRedirectUrl(redirectFromQuery);
    }

    // Check if user is already logged in (skip if session expired)
    if (!reason && (localuser.isLogin.value === true || authClient.getStoredToken())) {
      authStore.navigateToAuthRedirect(router);
    }

    // 如果在其他标签页完成登录，监听 token 刷新事件并跳转
    const onTokenRefreshed = (e) => {
      try {
        const token = e?.detail?.token || authClient.getStoredToken();
        if (token) {
          authStore.navigateToAuthRedirect(router);
        }
      } catch (err) {
        console.warn("onTokenRefreshed handler error:", err);
      }
    };

    // 监听 localStorage 的变化（跨标签页登录情况）
    const onStorage = (ev) => {
      try {
        if (!ev) return;
        if (ev.key === "token" && ev.newValue) {
          authStore.navigateToAuthRedirect(router);
        }
      } catch (err) {
        console.warn("onStorage handler error:", err);
      }
    };

    window.addEventListener(TOKEN_REFRESHED_EVENT_NAME, onTokenRefreshed);
    window.addEventListener("storage", onStorage);

    // 清理监听器
    const cleanupListeners = () => {
      window.removeEventListener(TOKEN_REFRESHED_EVENT_NAME, onTokenRefreshed);
      window.removeEventListener("storage", onStorage);
    };

    // 在组件卸载时移除监听
    onUnmounted(() => {
      cleanupListeners();
    });

    // Set page title
    useHead({
      title: "登录",
    });

    const handleLoginSuccess = (response) => {
      console.log("Login success:", response);
      authStore.navigateToAuthRedirect(router);
    };

    return {
      reason,
      handleLoginSuccess,
    };
  },
};
</script>
