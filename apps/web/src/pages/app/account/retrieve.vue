<template>
  <div>
    <AuthCard subtitle="重设密码">
      <v-form @submit.prevent>
        <v-row>
          <v-col cols="12">
            <v-text-field
              v-model="email"
              :disabled="step > 1"
              :rules="emailRules"
              label="邮箱"
              type="text"
              variant="outlined"
            ></v-text-field>
          </v-col>

          <v-col v-if="step >= 2" cols="12">
            <v-text-field
              v-model="verificationCode"
              :rules="[rules.required, rules.length]"
              label="验证码"
              maxlength="6"
              variant="outlined"
            ></v-text-field>
            <v-btn
              :disabled="countdown > 0"
              class="mb-4"
              variant="text"
              @click="sendVerificationCode"
            >
              {{ countdown > 0 ? `${countdown}秒后重新发送` : "重新发送验证码" }}
            </v-btn>
          </v-col>

          <v-col v-if="step >= 2" cols="12">
            <v-text-field
              v-model="password"
              :append-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
              :rules="passwordRules"
              :type="showPassword ? 'text' : 'password'"
              label="新密码"
              variant="outlined"
              @click:append="showPassword = !showPassword"
            ></v-text-field>
            <v-text-field
              v-model="confirmPassword"
              :append-icon="showConfirmPassword ? 'mdi-eye' : 'mdi-eye-off'"
              :rules="confirmPasswordRules"
              :type="showConfirmPassword ? 'text' : 'password'"
              label="确认密码"
              variant="outlined"
              @click:append="showConfirmPassword = !showConfirmPassword"
            ></v-text-field>
          </v-col>

          <v-col cols="12">
            <Recaptcha ref="recaptcha" recaptchaId="retrieve-recaptcha-div" />
          </v-col>

          <v-col cols="12">
            <v-btn
              :loading="loading"
              :text="step === 1 ? '获取验证码' : '重设密码'"
              append-icon="mdi-arrow-right"
              class="text-none"
              color="primary"
              rounded="xl"
              size="large"
              variant="flat"
              @click="step === 1 ? sendVerificationCode() : resetPassword()"
            ></v-btn>
          </v-col>

          <v-col cols="12">
            <v-btn
              append-icon="mdi-arrow-right"
              class="text-none"
              color="white"
              rounded="xl"
              size="large"
              text="登录"
              :to="loginLink"
              variant="text"
            ></v-btn>
            <v-btn
              append-icon="mdi-arrow-right"
              class="text-none"
              color="white"
              rounded="xl"
              size="large"
              text="注册"
              :to="registerLink"
              variant="text"
            ></v-btn>
          </v-col>
        </v-row>
      </v-form>
    </AuthCard>
    <LoadingDialog :show="loading" :text="loadingText" />
  </div>
</template>

<script>
import {computed, ref} from "vue";
import {useRoute, useRouter} from "vue-router";
import {localuser} from "@/services/localAccount";
import {useAuthStore} from "@/stores/auth";
import AuthService from "@/services/authService";
import LoadingDialog from "@/components/LoadingDialog.vue";
import Recaptcha from "@/components/Recaptcha.vue";
import AuthCard from "@/components/AuthCard.vue";
import {useHead} from "@unhead/vue";

export default {
  components: {LoadingDialog, Recaptcha, AuthCard},

  setup() {
    const route = useRoute();
    const router = useRouter();
    const authStore = useAuthStore();
    const recaptcha = ref(null);

    // Capture redirect from query or sessionStorage
    const redirectFromQuery = route.query.redirect
      ? decodeURIComponent(route.query.redirect)
      : null;
    if (redirectFromQuery) {
      authStore.setAuthRedirectUrl(redirectFromQuery);
    }

    const email = ref("");
    const verificationCode = ref("");
    const password = ref("");
    const confirmPassword = ref("");
    const codeId = ref("");
    const step = ref(1);
    const loading = ref(false);
    const countdown = ref(0);
    const showPassword = ref(false);
    const showConfirmPassword = ref(false);
    const loadingText = ref("处理中...");

    const rules = {
      required: (value) => !!value || "此字段为必填项",
      length: (value) => value?.length === 6 || "验证码必须是6位数字",
    };

    const emailRules = [
      (v) => !!v || "必须填写邮箱",
      (v) => /.+@.+\..+/.test(v) || "不符合格式",
    ];

    const passwordRules = [
      (v) => !!v || "必须填写密码",
      (v) => v.length >= 8 || "密码至少需要8个字符",
      (v) => (
        (/[A-Za-z]/.test(v) && /[0-9]/.test(v)) || "密码必须包含字母和数字"
      ),
    ];

    const confirmPasswordRules = computed(() => [
      (v) => !!v || "必须确认密码",
      (v) => v === password.value || "两次输入的密码不一致",
    ]);

    if (localuser.isLogin.value === true) {
      router.push(authStore.consumeAuthRedirectUrl());
    }

    useHead({
      title: "重设密码",
    });

    const showSuccessToast = (message) => {
      if (window?.$toast?.add) {
        window.$toast.add({
          severity: "success",
          summary: "成功",
          detail: message,
          life: 3000,
        });
      } else {
        console.log(message);
      }
    };

    const showErrorToast = (message) => {
      if (window?.$toast?.add) {
        window.$toast.add({
          severity: "error",
          summary: "错误",
          detail: message,
          life: 3000,
        });
      } else {
        console.error(message);
      }
    };

    const startCountdown = () => {
      countdown.value = 60;
      const timer = setInterval(() => {
        countdown.value--;
        if (countdown.value <= 0) {
          clearInterval(timer);
        }
      }, 1000);
    };

    const sendVerificationCode = async () => {
      if (countdown.value > 0) return;

      if (!email.value || !/.+@.+\..+/.test(email.value)) {
        showErrorToast("请输入正确的邮箱地址");
        return;
      }

      const captcha = recaptcha.value?.getResponse() || null;
      if (!captcha) {
        showErrorToast("请完成人机验证");
        return;
      }

      loading.value = true;
      loadingText.value = "正在发送验证码...";

      try {
        const response = await AuthService.sendPasswordResetCode(email.value, captcha);
        const nextCodeId = response?.data?.code_id || response?.code_id || "";

        if (response?.status === "success" && nextCodeId) {
          codeId.value = nextCodeId;
          step.value = 2;
          showSuccessToast(response.message || "验证码已发送到您的邮箱");
          startCountdown();
        } else if (response?.status === "success" && !nextCodeId) {
          showErrorToast("验证码发送成功，但未获取到 code_id");
        } else {
          showErrorToast(response?.message || "发送验证码失败");
        }
      } catch (error) {
        showErrorToast(error.response?.data?.message || error.message || "发送验证码失败");
      } finally {
        loading.value = false;
        recaptcha.value?.resetCaptcha?.();
      }
    };

    const resetPassword = async () => {
      if (!codeId.value) {
        showErrorToast("缺少 code_id，请重新获取验证码");
        return;
      }

      if (!verificationCode.value || verificationCode.value.length !== 6) {
        showErrorToast("请输入6位验证码");
        return;
      }

      if (!password.value || password.value !== confirmPassword.value) {
        showErrorToast("请确保输入了密码且两次输入一致");
        return;
      }

      loading.value = true;
      loadingText.value = "正在重设密码...";

      try {
        const response = await AuthService.resetPasswordWithCode(
          codeId.value,
          verificationCode.value,
          password.value
        );

        if (response?.status === "success") {
          showSuccessToast(response.message || "密码重置成功，请使用新密码登录");
          setTimeout(() => {
            router.push(loginLink.value);
          }, 1200);
        } else {
          showErrorToast(response?.message || "重置密码失败");
        }
      } catch (error) {
        showErrorToast(error.response?.data?.message || error.message || "重置密码失败");
      } finally {
        loading.value = false;
      }
    };

    // Redirect-preserving links
    const redirectQuery = computed(() => {
      const url = authStore.authRedirectUrl;
      return url ? `?redirect=${encodeURIComponent(url)}` : '';
    });
    const loginLink = computed(() => `/app/account/login${redirectQuery.value}`);
    const registerLink = computed(() => `/app/account/register${redirectQuery.value}`);

    return {
      email,
      verificationCode,
      password,
      confirmPassword,
      recaptcha,
      step,
      loading,
      countdown,
      showPassword,
      showConfirmPassword,
      loadingText,
      rules,
      emailRules,
      passwordRules,
      confirmPasswordRules,
      sendVerificationCode,
      resetPassword,
      loginLink,
      registerLink,
    };
  },
};
</script>
