<template>
  <div>
    <AuthCard :subtitle="subtitle">
      <v-alert
        v-if="reason === 'session_expired'"
        type="warning"
        variant="tonal"
        class="mb-4"
        text="您的登录状态已失效，请重新登录"
      />
      <LoginForm @login-success="handleLoginSuccess" @login-error="handleLoginError"/>
    </AuthCard>
  </div>
</template>

<script>
import {useHead} from "@unhead/vue";
import {localuser} from "@/services/localAccount";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import AuthCard from "@/components/AuthCard.vue";
import LoginForm from "@/components/account/LoginForm.vue";

export default {
  components: {AuthCard, LoginForm},

  setup() {
    const route = useRoute();
    const router = useRouter();
    const authStore = useAuthStore();

    const reason = route.query.reason || null;

    const subtitle = reason === "session_expired"
      ? "会话已过期，请重新登录"
      : "登录你的账户";

    // Capture redirect from query or sessionStorage
    const redirectFromQuery = route.query.redirect
      ? decodeURIComponent(route.query.redirect)
      : null;
    if (redirectFromQuery) {
      authStore.setAuthRedirectUrl(redirectFromQuery);
    }

    // Check if user is already logged in (skip if session expired)
    if (!reason && localuser.isLogin.value === true) {
      router.push(authStore.consumeAuthRedirectUrl());
    }

    // Set page title
    useHead({
      title: "登录",
    });

    const handleLoginSuccess = (response) => {
      console.log("Login success:", response);
      router.push(authStore.consumeAuthRedirectUrl());
    };

    const handleLoginError = (error) => {
      console.error("Login error:", error);
    };

    return {
      reason,
      subtitle,
      handleLoginSuccess,
      handleLoginError,
    };
  },
};
</script>
