<template>
  <div class="d-flex align-center justify-center pa-4">
    <v-card border class="pa-4 pt-7" max-width="448" rounded="lg">
      <v-card-title class="text-h5 font-weight-semibold">
        {{ pageTitle }}
      </v-card-title>

      <v-card-subtitle>{{ pageSubtitle }}</v-card-subtitle>

      <v-card-text v-if="loading">
        <v-progress-circular class="mx-auto d-block mb-4" color="primary" indeterminate></v-progress-circular>
        <p class="text-center">正在验证您的登录链接...</p>
      </v-card-text>

      <v-card-text v-else-if="error">
        <v-alert border="start" class="mb-4" type="error" variant="tonal">
          {{ error }}
        </v-alert>
        <p class="text-body-2">
          验证链接可能已失效或已被使用。请尝试重新获取登录链接，或使用其他方式登录。
        </p>
      </v-card-text>

      <v-card-text v-else-if="success">
        <v-alert border="start" class="mb-4" type="success" variant="tonal">
          {{ success }}
        </v-alert>
        <p class="text-body-2">
          您已成功登录，即将跳转到主页...
        </p>
      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn
          :disabled="loading || countdown > 0"
          color="primary"
          to="/app/account/login"
          variant="text"
        >
          {{ countdown > 0 ? `${countdown}秒后跳转` : '返回登录' }}
        </v-btn>
        <v-btn
          :disabled="loading || !loginSuccess || countdown > 0"
          color="primary"
          to="/app/dashboard"
          variant="flat"
        >
          去主页
        </v-btn>
      </v-card-actions>
    </v-card>
  </div>
</template>

<script>
import {ref, computed, onMounted, onBeforeUnmount} from "vue";
import {useRoute, useRouter} from "vue-router";
import {useHead} from "@unhead/vue";
import {localuser} from "@/services/localAccount";
import {useAuthStore} from "@/stores/auth";
import AuthService from "@/services/authService";

export default {
  setup() {
    const route = useRoute();
    const router = useRouter();
    const authStore = useAuthStore();

    // State variables
    const loading = ref(true);
    const error = ref("");
    const success = ref("");
    const loginSuccess = ref(false);
    const countdown = ref(0);
    const redirectTimer = ref(null);
    const countdownTimer = ref(null);

    const pageTitle = computed(() => {
      if (loading.value) return "正在验证登录";
      if (error.value) return "验证失败";
      return "验证成功";
    });

    const pageSubtitle = computed(() => {
      if (loading.value) return "请稍候，正在处理您的登录请求";
      if (error.value) return "登录链接验证失败";
      return "您已成功登录";
    });

    // Set page title
    useHead({
      title: "魔术链接验证",
    });

    onMounted(async () => {
      if (localuser.isLogin.value === true) {
        router.push(authStore.consumeAuthRedirectUrl());
        return;
      }

      const token = route.query.token;

      if (!token) {
        loading.value = false;
        error.value = "缺少验证令牌，无法完成验证";
        return;
      }

      try {
        const response = await AuthService.validateMagicLink(token);

        if (response.status === "success") {
          loading.value = false;
          success.value = response.message || "登录成功！";
          loginSuccess.value = true;

          // Start redirect countdown
          countdown.value = 5;
          countdownTimer.value = setInterval(() => {
            countdown.value--;
            if (countdown.value <= 0) {
              clearInterval(countdownTimer.value);
            }
          }, 1000);

          // Redirect after delay
          redirectTimer.value = setTimeout(() => {
            const redirectUrl = response.callback?.redirect || authStore.consumeAuthRedirectUrl();
            router.push(redirectUrl);
          }, 5000);
        } else {
          loading.value = false;
          error.value = response.message || "验证失败";
        }
      } catch (error) {
        loading.value = false;
        error.value = error.response?.data?.message || "验证过程中发生错误";
      }
    });

    onBeforeUnmount(() => {
      if (redirectTimer.value) clearTimeout(redirectTimer.value);
      if (countdownTimer.value) clearInterval(countdownTimer.value);
    });

    return {
      loading,
      error,
      success,
      loginSuccess,
      countdown,
      pageTitle,
      pageSubtitle,
    };
  }
};
</script>
