<template>
  <v-container class="d-flex align-center justify-center fill-height pa-4">
    <v-card border rounded="xl" max-width="448" width="100%" class="mx-auto pa-5 pa-sm-8">
      <div class="text-center mb-6">
        <v-avatar size="56" color="primary" variant="tonal" class="mb-3">
          <v-icon size="32">mdi-lock-reset</v-icon>
        </v-avatar>
        <h2 class="text-h5 font-weight-medium">重置密码</h2>
        <p class="text-body-2 text-medium-emphasis mt-1">
          {{ step === 2 ? "请查收邮件完成重置" : "输入邮箱以接收重置链接" }}
        </p>
      </div>

      <v-expand-transition>
        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          density="comfortable"
          class="mb-4"
          :text="error"
        />
      </v-expand-transition>

      <v-window v-model="step" :touch="false">
        <!-- 步骤 1：输入邮箱 + 人机验证 -->
        <v-window-item :value="1">
          <v-form @submit.prevent="sendLink">
            <v-text-field
              v-model="email"
              label="邮箱"
              type="email"
              variant="outlined"
              autocomplete="email"
              inputmode="email"
              autofocus
              prepend-inner-icon="mdi-email-outline"
              :rules="emailRules"
            />
            <Recaptcha
              ref="recaptchaRef"
              :showNormal="true"
              recaptchaId="reset-recaptcha"
              class="mb-2"
            />
            <v-btn
              type="submit"
              block
              size="large"
              rounded="lg"
              color="primary"
              variant="flat"
              class="text-none"
              :loading="loading"
            >
              发送重置链接
            </v-btn>
          </v-form>
        </v-window-item>

        <!-- 步骤 2：已发送确认 -->
        <v-window-item :value="2">
          <div class="text-center py-2">
            <v-icon size="56" color="success" class="mb-3">mdi-email-fast-outline</v-icon>
            <p class="text-body-1 mb-1">重置链接已发送</p>
            <p class="text-body-2 text-medium-emphasis">
              如果该邮箱已注册，我们已向其发送密码重置链接。请查收邮件并点击其中的链接设置新密码。
            </p>
          </div>
          <v-btn
            block
            variant="text"
            class="text-none mt-2"
            :disabled="countdown > 0"
            @click="sendLink"
          >
            {{ countdown > 0 ? `${countdown}秒后可重新发送` : "重新发送" }}
          </v-btn>
        </v-window-item>
      </v-window>

      <div class="d-flex justify-space-between mt-4">
        <v-btn variant="text" size="small" class="text-none" :to="loginLink">
          返回登录
        </v-btn>
        <v-btn variant="text" size="small" class="text-none" :to="registerLink">
          创建账户
        </v-btn>
      </div>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, computed } from "vue";
import { useRoute } from "vue-router";
import { useHead } from "@unhead/vue";
import { useAuthStore } from "@/stores/auth";
import AuthService from "@/services/authService";
import Recaptcha from "@/components/Recaptcha.vue";

useHead({ title: "重置密码" });

const route = useRoute();
const authStore = useAuthStore();
const recaptchaRef = ref(null);

const email = ref("");
const step = ref(1);
const loading = ref(false);
const error = ref("");
const countdown = ref(0);

const emailRules = [
  (v) => !!v || "请输入邮箱",
  (v) => /.+@.+\..+/.test(v) || "邮箱格式不正确",
];

// 捕获 redirect 参数
const redirectFromQuery =
  typeof route.query.redirect === "string" ? route.query.redirect : null;
if (redirectFromQuery) authStore.setAuthRedirectUrl(redirectFromQuery);

const redirectQuery = computed(() =>
  authStore.authRedirectUrl
    ? `?redirect=${encodeURIComponent(authStore.authRedirectUrl)}`
    : ""
);
const loginLink = computed(() => `/app/account/login${redirectQuery.value}`);
const registerLink = computed(() => `/app/account/register${redirectQuery.value}`);

let countdownTimer = null;
const startCountdown = (seconds = 60) => {
  clearInterval(countdownTimer);
  countdown.value = seconds;
  countdownTimer = setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0) clearInterval(countdownTimer);
  }, 1000);
};

const sendLink = async () => {
  if (countdown.value > 0) return;
  error.value = "";
  if (!/.+@.+\..+/.test(email.value)) {
    error.value = "请输入有效的邮箱地址";
    return;
  }
  loading.value = true;
  try {
    const captcha = recaptchaRef.value?.getResponse() || null;
    const resp = await AuthService.sendPasswordResetCode(email.value.trim(), captcha);
    if (resp?.status === "success") {
      step.value = 2;
      startCountdown(60);
    } else {
      error.value = resp?.message || "发送失败，请重试";
    }
  } catch (e) {
    error.value = e?.response?.data?.message || e?.message || "发送失败，请重试";
  } finally {
    loading.value = false;
    recaptchaRef.value?.resetCaptcha?.();
  }
};
</script>
