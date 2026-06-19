<template>
  <v-container class="d-flex align-center justify-center fill-height pa-4">
    <v-card border rounded="xl" max-width="448" width="100%" class="mx-auto pa-5 pa-sm-8">
      <!-- 头部 -->
      <div class="text-center mb-4">
        <v-avatar size="56" color="primary" variant="tonal" class="mb-3">
          <v-icon size="32">{{ headerIcon }}</v-icon>
        </v-avatar>
        <h2 class="text-h5 font-weight-medium">创建账户</h2>
        <p class="text-body-2 text-medium-emphasis mt-1">{{ subtitle }}</p>
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

      <!-- 校验注册令牌中 -->
      <div v-if="view === 'loading'" class="text-center py-8">
        <v-progress-circular indeterminate color="primary" size="40" />
      </div>

      <!-- 令牌无效 -->
      <template v-else-if="view === 'invalid'">
        <v-alert
          type="warning"
          variant="tonal"
          density="comfortable"
          class="mb-4"
          text="注册链接无效或已过期，请重新开始。"
        />
        <v-btn
          block
          size="large"
          rounded="lg"
          color="primary"
          variant="flat"
          class="text-none"
          to="/app/account/register"
        >
          重新开始注册
        </v-btn>
      </template>

      <!-- 模式 A：录入邮箱 -->
      <template v-else-if="view === 'email'">
        <v-form @submit.prevent="submitEmail">
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
            recaptchaId="register-recaptcha"
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
            append-icon="mdi-arrow-right"
            :loading="loading"
          >
            继续
          </v-btn>
        </v-form>
        <OAuthButtons mode="register" divider-text="或使用以下方式注册" />
        <div class="d-flex justify-center mt-4">
          <v-btn variant="text" size="small" class="text-none" :to="loginLink">
            已有账户？登录
          </v-btn>
        </div>
      </template>

      <!-- 模式 A：邮件已发送 -->
      <template v-else-if="view === 'sent'">
        <div class="text-center py-2">
          <v-icon size="56" color="success" class="mb-3">mdi-email-fast-outline</v-icon>
          <p class="text-body-1 mb-1">请查收邮件</p>
          <p class="text-body-2 text-medium-emphasis">
            我们已向 <strong>{{ email }}</strong> 发送了一封邮件。
          </p>
        </div>
        <v-btn
          block
          variant="text"
          class="text-none mt-2"
          :disabled="countdown > 0"
          @click="submitEmail"
        >
          {{ countdown > 0 ? `${countdown}秒后可重新发送` : "重新发送" }}
        </v-btn>
        <v-btn block variant="text" class="text-none" @click="view = 'email'">
          使用其他邮箱
        </v-btn>
      </template>

      <!-- 模式 B：注册继续（邮箱已验证） -->
      <template v-else-if="view === 'continue'">
        <div class="d-flex justify-center mb-4">
          <v-chip variant="tonal" color="success" prepend-icon="mdi-check-circle">
            <span class="text-truncate" style="max-width: 240px">{{ verifiedEmail }}</span>
            &nbsp;已验证
          </v-chip>
        </div>

        <v-progress-linear
          :model-value="(step / 3) * 100"
          color="primary"
          height="4"
          rounded
          class="mb-5"
        />

        <v-window v-model="step" :touch="false">
          <!-- 用户名（实时校验格式与占用） -->
          <v-window-item :value="1">
            <v-form @submit.prevent="next">
              <v-text-field
                v-model="username"
                label="用户名"
                type="text"
                variant="outlined"
                autocomplete="username"
                autofocus
                prepend-inner-icon="mdi-account-outline"
                :hint="usernameCheck.status === 'idle' ? '2-20 位，小写字母开头，仅含小写字母、数字与单个下划线' : ''"
                persistent-hint
                :loading="usernameCheck.status === 'checking'"
                :error="usernameCheck.status === 'error'"
                :error-messages="usernameCheck.status === 'error' ? [usernameCheck.message] : []"
                :messages="usernameCheck.status === 'ok' ? [usernameCheck.message] : []"
              >
                <template #append-inner>
                  <v-icon v-if="usernameCheck.status === 'ok'" color="success">mdi-check-circle</v-icon>
                  <v-icon v-else-if="usernameCheck.status === 'error'" color="error">mdi-alert-circle</v-icon>
                </template>
              </v-text-field>
              <v-btn
                type="submit"
                block
                size="large"
                rounded="lg"
                color="primary"
                variant="flat"
                class="text-none mt-1"
                append-icon="mdi-arrow-right"
                :disabled="!canProceed"
              >
                继续
              </v-btn>
            </v-form>
          </v-window-item>

          <!-- 密码（实时强度） -->
          <v-window-item :value="2">
            <v-form @submit.prevent="next">
              <v-text-field
                v-model="password"
                label="设置密码"
                variant="outlined"
                autocomplete="new-password"
                autofocus
                :type="showPassword ? 'text' : 'password'"
                prepend-inner-icon="mdi-lock-outline"
                :error="password.length > 0 && !passwordValid"
                :error-messages="password.length > 0 && !passwordValid ? ['密码至少 8 位，且需包含字母和数字'] : []"
              >
                <template #append-inner>
                  <v-icon style="cursor: pointer" @click="showPassword = !showPassword">
                    {{ showPassword ? "mdi-eye" : "mdi-eye-off" }}
                  </v-icon>
                </template>
              </v-text-field>
              <div v-if="password" class="mb-4">
                <v-progress-linear
                  :model-value="passwordStrength.percent"
                  :color="passwordStrength.color"
                  height="6"
                  rounded
                  class="mb-1"
                />
                <span class="text-caption" :class="`text-${passwordStrength.color}`">
                  密码强度：{{ passwordStrength.label }}
                </span>
              </div>
              <v-btn
                type="submit"
                block
                size="large"
                rounded="lg"
                color="primary"
                variant="flat"
                class="text-none"
                append-icon="mdi-arrow-right"
                :disabled="!canProceed"
              >
                继续
              </v-btn>
            </v-form>
          </v-window-item>

          <!-- 条款并完成 -->
          <v-window-item :value="3">
            <p class="text-body-2 text-medium-emphasis mb-2">
              请阅读并同意以下条款以完成注册：
            </p>
            <v-checkbox v-model="agreement.privacy" density="compact" hide-details>
              <template #label>
                <span class="text-body-2">我已阅读并同意
                  <a href="/app/legal/privacy" target="_blank" @click.stop>隐私政策</a>
                </span>
              </template>
            </v-checkbox>
            <v-checkbox v-model="agreement.terms" density="compact" hide-details>
              <template #label>
                <span class="text-body-2">我已阅读并同意
                  <a href="/app/legal/terms" target="_blank" @click.stop>用户协议</a>
                </span>
              </template>
            </v-checkbox>
            <v-checkbox v-model="agreement.rules" density="compact" hide-details>
              <template #label>
                <span class="text-body-2">我将遵守
                  <a href="/legal/community-guidelines" target="_blank" @click.stop>社区行为准则</a>
                </span>
              </template>
            </v-checkbox>
            <v-checkbox v-model="agreement.datadelete" density="compact" hide-details>
              <template #label>
                <span class="text-body-2">我理解数据存储于中国大陆且需联系管理员删除</span>
              </template>
            </v-checkbox>

            <v-btn
              block
              size="large"
              rounded="lg"
              color="primary"
              variant="flat"
              class="text-none mt-4"
              :loading="loading"
              :disabled="!canProceed"
              @click="complete"
            >
              完成注册
            </v-btn>
          </v-window-item>
        </v-window>

        <div v-if="step > 1" class="mt-4">
          <v-btn
            variant="text"
            size="small"
            class="text-none"
            prepend-icon="mdi-arrow-left"
            @click="step -= 1"
          >
            上一步
          </v-btn>
        </div>
      </template>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useHead } from "@unhead/vue";
import { localuser } from "@/services/localAccount";
import { useAuthStore } from "@/stores/auth";
import AuthService from "@/services/authService";
import Recaptcha from "@/components/Recaptcha.vue";
import OAuthButtons from "@/components/account/OAuthButtons.vue";

useHead({ title: "注册" });

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const recaptchaRef = ref(null);

const token = ref(typeof route.query.token === "string" ? route.query.token : "");
const view = ref(token.value ? "loading" : "email"); // loading | invalid | email | sent | continue
const step = ref(1);
const loading = ref(false);
const error = ref("");
const countdown = ref(0);

const email = ref("");
const verifiedEmail = ref("");
const username = ref("");
const password = ref("");
const showPassword = ref(false);
const usernameCheck = ref({ status: "idle", message: "" });
const agreement = ref({ privacy: false, terms: false, rules: false, datadelete: false });

// 捕获 redirect 参数
const redirectFromQuery =
  typeof route.query.redirect === "string" ? route.query.redirect : null;
if (redirectFromQuery) authStore.setAuthRedirectUrl(redirectFromQuery);
// 未携带令牌且已登录 → 直接跳转
if (!token.value && localuser.isLogin.value === true) {
  authStore.navigateToAuthRedirect(router);
}

const headerIcon = computed(() =>
  view.value === "continue" ? "mdi-account-check-outline" : "mdi-account-plus-outline"
);
const subtitle = computed(() => {
  if (view.value === "continue") {
    return { 1: "为你的账户取一个用户名", 2: "设置一个安全的密码", 3: "最后一步：同意条款" }[step.value] || "";
  }
  if (view.value === "sent") return "邮件已发送";
  return "输入你的邮箱";
});

const emailRules = [
  (v) => !!v || "请输入邮箱",
  (v) => /.+@.+\..+/.test(v) || "邮箱格式不正确",
];

// —— 密码强度 ——
const passwordValid = computed(
  () =>
    password.value.length >= 8 &&
    /[A-Za-z]/.test(password.value) &&
    /[0-9]/.test(password.value)
);
const passwordStrength = computed(() => {
  const v = password.value;
  if (!v) return { percent: 0, label: "", color: "error" };
  let score = 0;
  if (v.length >= 8) score += 1;
  if (v.length >= 12) score += 1;
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) score += 1;
  if (/[0-9]/.test(v)) score += 1;
  if (/[^A-Za-z0-9]/.test(v)) score += 1;
  if (score <= 2) return { percent: 33, label: "弱", color: "error" };
  if (score === 3) return { percent: 66, label: "中", color: "warning" };
  return { percent: 100, label: "强", color: "success" };
});

const allAgreed = computed(() => Object.values(agreement.value).every(Boolean));

const canProceed = computed(() => {
  if (step.value === 1) return usernameCheck.value.status === "ok";
  if (step.value === 2) return passwordValid.value;
  if (step.value === 3) return allAgreed.value;
  return false;
});

const redirectQuery = computed(() =>
  authStore.authRedirectUrl
    ? `?redirect=${encodeURIComponent(authStore.authRedirectUrl)}`
    : ""
);
const loginLink = computed(() => `/app/account/login${redirectQuery.value}`);

// —— 用户名实时占用校验（带防抖）——
const usernameFormatError = (v) => {
  if (v.length < 2) return "用户名至少需要 2 个字符";
  if (v.length > 20) return "用户名不能超过 20 个字符";
  if (!/^[a-z]/.test(v)) return "用户名必须以小写字母开头";
  if (!/^[a-z0-9]+(_[a-z0-9]+)*$/.test(v))
    return "只能含小写字母、数字，下划线不能连续或位于首尾";
  return null;
};
let usernameTimer = null;
watch(username, (v) => {
  clearTimeout(usernameTimer);
  const val = (v || "").trim();
  if (!val) {
    usernameCheck.value = { status: "idle", message: "" };
    return;
  }
  const fmt = usernameFormatError(val);
  if (fmt) {
    usernameCheck.value = { status: "error", message: fmt };
    return;
  }
  usernameCheck.value = { status: "checking", message: "" };
  usernameTimer = setTimeout(async () => {
    const result = await AuthService.checkRegisterAvailability({ username: val });
    if (username.value.trim() !== val) return;
    const r = result.username;
    usernameCheck.value = r
      ? { status: r.valid && r.available ? "ok" : "error", message: r.message }
      : { status: "error", message: "检查失败，请重试" };
  }, 500);
});

let countdownTimer = null;
const startCountdown = (seconds = 60) => {
  clearInterval(countdownTimer);
  countdown.value = seconds;
  countdownTimer = setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0) clearInterval(countdownTimer);
  }, 1000);
};

onBeforeUnmount(() => {
  clearTimeout(usernameTimer);
  clearInterval(countdownTimer);
});

// 携带令牌 → 校验并进入注册继续
onMounted(async () => {
  if (!token.value) return;
  const result = await AuthService.validateRegisterToken(token.value);
  if (result?.status === "success" && result.data?.email) {
    verifiedEmail.value = result.data.email;
    view.value = "continue";
  } else {
    view.value = "invalid";
    error.value = result?.message || "注册链接无效或已过期";
  }
});

// 模式 A：提交邮箱
const submitEmail = async () => {
  if (countdown.value > 0) return;
  error.value = "";
  if (!/.+@.+\..+/.test(email.value)) {
    error.value = "请输入有效的邮箱地址";
    return;
  }
  loading.value = true;
  try {
    const captcha = recaptchaRef.value?.getResponse() || null;
    const resp = await AuthService.beginRegister(email.value.trim(), captcha);
    if (resp?.status === "success") {
      view.value = "sent";
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

// 模式 B：步骤导航
const next = () => {
  error.value = "";
  if (!canProceed.value) return;
  if (step.value < 3) step.value += 1;
};

// 模式 B：完成注册
const complete = async () => {
  if (!allAgreed.value) {
    error.value = "请先阅读并同意相关条款";
    return;
  }
  error.value = "";
  loading.value = true;
  try {
    const resp = await AuthService.completeRegister(
      token.value,
      username.value.trim(),
      password.value
    );
    if (resp?.status === "success" && !resp.needLogin) {
      // 已自动登录
      authStore.navigateToAuthRedirect(router);
    } else if (resp?.status === "success") {
      router.push("/app/account/login");
    } else {
      error.value = resp?.message || "注册失败";
      // 用户名/邮箱可能被占用，回到用户名步骤
      if (resp?.message && resp.message.includes("用户名")) step.value = 1;
    }
  } catch (e) {
    error.value = e?.response?.data?.message || e?.message || "注册失败，请稍后再试";
  } finally {
    loading.value = false;
  }
};
</script>
