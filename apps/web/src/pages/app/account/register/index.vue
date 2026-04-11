<template>
  <div>
    <AuthCard subtitle="创建你的账户">
      <v-form ref="registerForm">
        <v-row>
          <v-col cols="12">
            <v-text-field
              v-model="email"
              :rules="emailRules"
              label="邮箱"
              required
              type="email"
              variant="outlined"
            ></v-text-field>
            <v-text-field
              v-model="username"
              :rules="usernameRules"
              label="用户名"
              required
              type="text"
              variant="outlined"
            ></v-text-field>
            <v-text-field
              v-model="password"
              :append-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
              :rules="passwordRules"
              :type="showPassword ? 'text' : 'password'"
              label="密码"
              required
              variant="outlined"
              @click:append="showPassword = !showPassword"
            ></v-text-field>
          </v-col>

          <v-col cols="12">
            <Recaptcha ref="recaptcha" recaptchaId="recaptcha-div" />
          </v-col>

          <v-col cols="12">
            <v-dialog persistent>
              <template v-slot:activator="{ props: activatorProps }">
                <v-btn
                  :loading="loading"
                  append-icon="mdi-arrow-right"
                  class="text-none"
                  color="primary"
                  rounded="xl"
                  size="large"
                  text="注册"
                  v-bind="activatorProps"
                  variant="flat"
                ></v-btn>
              </template>

              <template v-slot:default="{ isActive }">
                <v-card title="您正在使用由ZeroCat零猫社区提供的服务">
                  <v-card-text>
                    <div class="mb-2">
                      你需要同意
                      <v-tooltip location="bottom">
                        <template v-slot:activator="{ props }">
                          <a
                            href="/app/legal/privacy"
                            target="_blank"
                            v-bind="props"
                            @click.stop
                          >
                            ZeroCat零猫社区隐私政策
                          </a>
                        </template>
                        ZeroCat零猫社区隐私政策
                      </v-tooltip>
                    </div>

                    <v-checkbox v-model="agreement.privacy">
                      <template v-slot:label>
                        <div>我已阅读并同意隐私政策</div>
                      </template>
                    </v-checkbox>

                    <div class="mb-2">
                      我们将在中国大陆安全的存储您的数据，我们暂不提供自助删除您的个人数据，如果您希望删除您的数据，您需要优先选择联系我们
                    </div>

                    <v-checkbox v-model="agreement.datadelete">
                      <template v-slot:label>
                        <div>
                          我理解并同意我无法自助删除我的个人数据，在需要时我会主动联系管理员删除
                        </div>
                      </template>
                    </v-checkbox>

                    <div class="mb-2">
                      在 ZeroCat 上，你需要遵守
                      <v-tooltip location="bottom">
                        <template v-slot:activator="{ props }">
                          <a
                            href="/legal/community-guidelines"
                            target="_blank"
                            v-bind="props"
                            @click.stop
                          >
                            社区行为准则
                          </a>
                        </template>
                        社区行为准则
                      </v-tooltip>
                    </div>

                    <v-checkbox v-model="agreement.rules">
                      <template v-slot:label>
                        <div>我已阅读并同意将会遵守社区行为准则</div>
                      </template>
                    </v-checkbox>

                    <div class="mb-2">
                      你需要同意
                      <v-tooltip location="bottom">
                        <template v-slot:activator="{ props }">
                          <a
                            href="/app/legal/terms"
                            target="_blank"
                            v-bind="props"
                            @click.stop
                          >
                            ZeroCat零猫社区用户协议
                          </a>
                        </template>
                        ZeroCat零猫社区用户协议
                      </v-tooltip>
                    </div>

                    <v-checkbox v-model="agreement.terms">
                      <template v-slot:label>
                        <div>我已阅读并同意用户协议</div>
                      </template>
                    </v-checkbox>

                    <v-btn
                      :loading="loading"
                      append-icon="mdi-arrow-right"
                      class="text-none mt-4"
                      color="primary"
                      rounded="xl"
                      size="large"
                      text="注册"
                      variant="flat"
                      @click="register"
                    ></v-btn>

                    <v-alert
                      border="start"
                      class="mt-4"
                      density="comfortable"
                      type="warning"
                      variant="tonal"
                    >
                      对于技术手段绕过此页面的行为视为对 ZeroCat
                      的基础设施进行攻击，涉嫌非法入侵计算机系统，我们将保留追究法律责任的权利，违规获得的账户不被授权访问网站，账户将不受保护，如果您同意以上内容，请点击"复选框"以完成注册流程。
                    </v-alert>
                  </v-card-text>

                  <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn
                      text="取消"
                      @click="
                        isActive.value = false;
                        resetAgreement();
                      "
                    ></v-btn>
                  </v-card-actions>
                </v-card>
              </template>
            </v-dialog>
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
              text="找回密码"
              :to="retrieveLink"
              variant="text"
            ></v-btn>
          </v-col>

          <v-col cols="12">
            <OAuthButtons mode="register" />
          </v-col>
        </v-row>
      </v-form>
    </AuthCard>
    <LoadingDialog :show="loading" text="正在注册" />
  </div>
</template>

<script>
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { localuser } from "@/services/localAccount";
import { useAuthStore } from "@/stores/auth";
import AuthService from "@/services/authService";
import LoadingDialog from "@/components/LoadingDialog.vue";
import Recaptcha from "@/components/Recaptcha.vue";
import AuthCard from "@/components/AuthCard.vue";
import { useHead } from "@unhead/vue";
import oauthProviders from "@/constants/oauth_providers.json";
import OAuthButtons from "@/components/account/OAuthButtons.vue";

export default {
  components: { LoadingDialog, Recaptcha, AuthCard, OAuthButtons },

  setup() {
    const route = useRoute();
    const router = useRouter();
    const authStore = useAuthStore();
    const registerForm = ref(null);

    // Capture redirect from query or sessionStorage
    const redirectFromQuery = route.query.redirect
      ? decodeURIComponent(route.query.redirect)
      : null;
    if (redirectFromQuery) {
      authStore.setAuthRedirectUrl(redirectFromQuery);
    }

    // State variables
    const email = ref("");
    const username = ref("");
    const password = ref("");
    const loading = ref(false);
    const showPassword = ref(false);
    const recaptcha = ref(null);

    const agreement = ref({
      privacy: false,
      terms: false,
      rules: false,
      datadelete: false,
    });

    // Validation rules
    const emailRules = [
      (v) => !!v || "必须填写邮箱",
      (v) => /.+@.+\..+/.test(v) || "不符合格式",
    ];

    const usernameRules = [
      (v) => !!v || "必须填写用户名",
      (v) => v.length >= 3 || "用户名至少需要3个字符",
      (v) => v.length <= 20 || "用户名最多20个字符",
    ];

    const passwordRules = [
      (v) => !!v || "必须填写密码",
      (v) => v.length >= 8 || "密码至少需要8个字符",
      (v) =>
        (/[A-Za-z]/.test(v) && /[0-9]/.test(v)) || "密码必须包含字母和数字",
    ];

    // OAuth providers
    const providers = Object.entries(oauthProviders)
      .filter(([key]) => key !== "default")
      .map(([key, value]) => ({
        id: key,
        ...value,
      }));

    // Check if user is already logged in
    if (localuser.isLogin.value === true) {
      router.push(authStore.consumeAuthRedirectUrl());
    }

    // Set page title
    useHead({
      title: "注册",
    });

    const resetAgreement = () => {
      agreement.value = {
        privacy: false,
        terms: false,
        rules: false,
        datadelete: false,
      };
    };

    const validateAgreement = () => {
      for (const key in agreement.value) {
        if (agreement.value[key] === false) {
          showErrorToast("请先阅读并同意相关协议");
          return false;
        }
      }
      return true;
    };

    const register = async () => {
      try {
        if (!validateAgreement()) return;

        loading.value = true;

        // Get the recaptcha token using the correct method
        const recaptchaToken = recaptcha.value?.getResponse() || null;

        // Create registration data
        const data = {
          email: email.value,
          username: username.value,
          password: password.value,
          captcha: recaptchaToken,
          skipPassword: false,
        };

        // Call the register API
        const response = await AuthService.register(data);

        if (response.status === "success") {
          if (response.needVerify) {
            // Store email and temporary token for verification
            localStorage.setItem("verificationEmail", email.value);
            if (response.temporaryToken) {
              localStorage.setItem(
                "verificationToken",
                response.temporaryToken
              );
            }

            // Redirect to verification page
            router.push("/app/account/register/verify");
          } else {
            showSuccessToast(response.message || "注册成功");

            if (response.needPassword) {
              router.push("/app/account/register/setup-password");
            } else {
              router.push(authStore.consumeAuthRedirectUrl());
            }
          }
        } else {
          showErrorToast(response.message || "注册失败");
        }
      } catch (error) {
        console.error(error);
        const errorMessage =
          error.response?.data?.message || "注册失败，请稍后再试";
        showErrorToast(errorMessage);
      } finally {
        loading.value = false;
      }
    };

    const registerWithOAuth = (provider) => {
      window.location.href = AuthService.oauthRedirect(provider, true);
    };

    const showSuccessToast = (message) => {
      // Try different toast systems
      if (window.$toast) {
        window.$toast.add({
          severity: "success",
          summary: "成功",
          detail: message,
          life: 3000,
        });
      } else if (window.$notify) {
        window.$notify({
          title: "成功",
          message: message,
          type: "success",
        });
      } else {
        console.log("Success:", message);
        alert(message);
      }
    };

    const showErrorToast = (message) => {
      // Try different toast systems
      if (window.$toast) {
        window.$toast.add({
          severity: "error",
          summary: "错误",
          detail: message,
          life: 3000,
        });
      } else if (window.$notify) {
        window.$notify({
          title: "错误",
          message: message,
          type: "error",
        });
      } else {
        console.error("Error:", message);
        alert(message);
      }
    };

    // Redirect-preserving links
    const redirectQuery = computed(() => {
      const url = authStore.authRedirectUrl;
      return url ? `?redirect=${encodeURIComponent(url)}` : '';
    });
    const loginLink = computed(() => `/app/account/login${redirectQuery.value}`);
    const retrieveLink = computed(() => `/app/account/retrieve${redirectQuery.value}`);

    return {
      email,
      username,
      password,
      loading,
      showPassword,
      agreement,
      emailRules,
      usernameRules,
      passwordRules,
      recaptcha,
      registerForm,
      register,
      resetAgreement,
      registerWithOAuth,
      showSuccessToast,
      showErrorToast,
      providers,
      loginLink,
      retrieveLink,
    };
  },
};
</script>

<style scoped>
.v-divider {
  margin: 24px 0;
  border-color: rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
