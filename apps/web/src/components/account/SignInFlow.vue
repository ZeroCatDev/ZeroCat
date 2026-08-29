<template>
  <v-card
    :flat="embedded"
    :border="!embedded"
    :rounded="embedded ? 0 : 'xl'"
    :max-width="embedded ? '100%' : 448"
    width="100%"
    :class="embedded ? 'pa-2' : 'mx-auto pa-5 pa-sm-8'"
  >
    <!-- 头部：首屏标题 / 后续步骤显示账户胶囊 -->
    <div class="text-center mb-6">
      <template v-if="step === 'identifier'">
        <v-avatar size="56" color="primary" variant="tonal" class="mb-3">
          <v-icon size="32">mdi-account-circle-outline</v-icon>
        </v-avatar>
        <h2 class="text-h5 font-weight-medium">登录</h2>
        <p class="text-body-2 text-medium-emphasis mt-1">
          使用您的 ZeroCat 账户继续
        </p>
      </template>
      <template v-else>
        <h2 class="text-h6 font-weight-medium mb-3">{{ stepTitle }}</h2>
        <v-chip
          variant="outlined"
          link
          size="large"
          @click="backToIdentifier"
        >
          <v-icon start>mdi-account-circle</v-icon>
          <span class="text-truncate" style="max-width: 220px">{{ identifier }}</span>
          <v-icon end size="small">mdi-chevron-down</v-icon>
        </v-chip>
      </template>
    </div>

    <!-- 行内错误提示 -->
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

    <v-window v-model="step" :touch="false" class="overflow-visible">
      <!-- 步骤 1：标识符 -->
      <v-window-item value="identifier">
        <v-form @submit.prevent="submitIdentifier">
          <v-text-field
            v-model="identifier"
            label="邮箱或用户名"
            type="text"
            variant="outlined"
            autocomplete="username webauthn"
            inputmode="email"
            autofocus
            :disabled="loading"
            prepend-inner-icon="mdi-account-outline"
          />

          <v-expand-transition>
            <v-alert
              v-if="accountNotFound"
              type="info"
              variant="tonal"
              density="comfortable"
              class="mb-4"
            >
              <div class="text-body-2 mb-2">该用户名尚未注册</div>
              <v-btn
                size="small"
                rounded="lg"
                color="primary"
                variant="flat"
                class="text-none"
                :to="registerLink"
                @click="onClose"
              >
                创建新账户
              </v-btn>
            </v-alert>
          </v-expand-transition>

          <v-btn
            v-if="!accountNotFound"
            type="submit"
            block
            size="large"
            rounded="lg"
            color="primary"
            variant="flat"
            class="text-none mt-1"
            :loading="loading"
            append-icon="mdi-arrow-right"
          >
            继续
          </v-btn>
        </v-form>

        <v-btn
          v-if="passkeySupported && !accountNotFound"
          block
          size="large"
          rounded="lg"
          variant="tonal"
          color="secondary"
          class="text-none mt-3"
          prepend-icon="mdi-fingerprint"
          :loading="passkeyLoading"
          @click="loginWithPasskey(false)"
        >
          使用通行密钥登录
        </v-btn>

        <OAuthButtons v-if="!accountNotFound" mode="login" divider-text="或使用以下方式登录" />

        <div class="d-flex justify-space-between mt-4">
          <v-btn
            variant="text"
            size="small"
            class="text-none"
            :to="registerLink"
            @click="onClose"
          >
            创建账户
          </v-btn>
          <v-btn
            variant="text"
            size="small"
            class="text-none"
            :to="retrieveLink"
            @click="onClose"
          >
            登录遇到问题？
          </v-btn>
        </div>
      </v-window-item>

      <!-- 步骤：通行密钥 -->
      <v-window-item value="passkey">
        <div class="text-center py-2">
          <v-icon size="56" color="secondary" class="mb-3">mdi-fingerprint</v-icon>
          <p class="text-body-2 text-medium-emphasis mb-5">
            使用您的指纹、面容或设备锁完成登录，无需输入密码。
          </p>
          <v-btn
            block
            size="large"
            rounded="lg"
            color="primary"
            variant="flat"
            class="text-none"
            prepend-icon="mdi-fingerprint"
            :loading="passkeyLoading"
            @click="loginWithPasskey(true)"
          >
            使用通行密钥登录
          </v-btn>
        </div>
        <v-btn
          v-if="otherMethods.length"
          block
          variant="text"
          class="text-none mt-2"
          @click="goChooser"
        >
          选择其他方式
        </v-btn>
      </v-window-item>

      <!-- 步骤：密码 -->
      <v-window-item value="password">
        <v-form @submit.prevent="onSubmitPassword">
          <v-text-field
            v-model="password"
            label="密码"
            variant="outlined"
            autocomplete="current-password"
            autofocus
            :type="showPassword ? 'text' : 'password'"
            :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
            :disabled="loading"
            prepend-inner-icon="mdi-lock-outline"
            @click:append-inner="showPassword = !showPassword"
          />
          <Recaptcha
            ref="recaptchaRef"
            :showNormal="true"
            recaptchaId="signin-recaptcha"
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
            登录
          </v-btn>
        </v-form>

        <v-btn
          v-if="hasPasskey"
          block
          variant="tonal"
          color="secondary"
          rounded="lg"
          class="text-none mt-3"
          prepend-icon="mdi-fingerprint"
          :loading="passkeyLoading"
          @click="loginWithPasskey(true)"
        >
          改用通行密钥
        </v-btn>

        <div class="d-flex justify-space-between mt-3">
          <v-btn
            v-if="otherMethods.length"
            variant="text"
            size="small"
            class="text-none"
            @click="goChooser"
          >
            其他方式
          </v-btn>
          <v-spacer />
          <v-btn
            variant="text"
            size="small"
            class="text-none"
            :to="retrieveLink"
            @click="onClose"
          >
            忘记密码？
          </v-btn>
        </div>
      </v-window-item>

      <!-- 步骤：邮箱验证码 -->
      <v-window-item value="email-code">
        <p class="text-body-2 text-medium-emphasis mb-4">
          我们将向该账户绑定的邮箱发送一次性验证码。
        </p>

        <template v-if="!codeSent">
          <Recaptcha
            ref="recaptchaRef"
            :showNormal="true"
            recaptchaId="signin-recaptcha"
            class="mb-2"
          />
          <v-btn
            block
            size="large"
            rounded="lg"
            color="primary"
            variant="flat"
            class="text-none"
            :loading="loading"
            @click="onSendCode"
          >
            发送验证码
          </v-btn>
        </template>

        <template v-else>
          <v-otp-input
            v-model="code"
            :length="6"
            type="number"
            autofocus
            :disabled="loading"
            @finish="verifyCode"
          />
          <v-btn
            block
            size="large"
            rounded="lg"
            color="primary"
            variant="flat"
            class="text-none mt-2"
            :loading="loading"
            @click="verifyCode"
          >
            登录
          </v-btn>
          <v-btn
            block
            variant="text"
            class="text-none mt-2"
            :disabled="countdown > 0"
            @click="onSendCode"
          >
            {{ countdown > 0 ? `${countdown}秒后可重新发送` : "重新发送验证码" }}
          </v-btn>
        </template>

        <v-btn
          v-if="otherMethods.length"
          block
          variant="text"
          class="text-none mt-2"
          @click="goChooser"
        >
          其他方式
        </v-btn>
      </v-window-item>

      <!-- 步骤：魔术链接 -->
      <v-window-item value="magic-link">
        <template v-if="!magicLinkSent">
          <p class="text-body-2 text-medium-emphasis mb-4">
            我们将向该账户绑定的邮箱发送一个登录链接，点击即可直接登录。
          </p>
          <Recaptcha
            ref="recaptchaRef"
            :showNormal="true"
            recaptchaId="signin-recaptcha"
            class="mb-2"
          />
          <v-btn
            block
            size="large"
            rounded="lg"
            color="primary"
            variant="flat"
            class="text-none"
            prepend-icon="mdi-link-variant"
            :loading="loading"
            @click="onSendMagicLink"
          >
            发送登录链接
          </v-btn>
        </template>

        <template v-else>
          <div class="text-center py-2">
            <v-icon size="56" color="success" class="mb-3">mdi-email-fast-outline</v-icon>
            <p class="text-body-1 mb-1">登录链接已发送</p>
            <p class="text-body-2 text-medium-emphasis">
              请前往该账户绑定的邮箱查收邮件并点击链接完成登录。
            </p>
          </div>
          <v-btn
            block
            variant="text"
            class="text-none mt-2"
            :disabled="countdown > 0"
            @click="onSendMagicLink"
          >
            {{ countdown > 0 ? `${countdown}秒后可重新发送` : "重新发送链接" }}
          </v-btn>
        </template>

        <v-btn
          v-if="otherMethods.length"
          block
          variant="text"
          class="text-none mt-2"
          @click="goChooser"
        >
          其他方式
        </v-btn>
      </v-window-item>

      <!-- 步骤：两步验证（TOTP） -->
      <v-window-item value="totp">
        <p class="text-body-2 text-medium-emphasis mb-4 text-center">
          请输入认证器应用中的 6 位验证码。
        </p>
        <v-otp-input
          v-model="otp"
          :length="6"
          type="number"
          autofocus
          :disabled="loading"
          @finish="verifyTotp()"
        />
        <v-btn
          block
          size="large"
          rounded="lg"
          color="primary"
          variant="flat"
          class="text-none mt-2"
          :loading="loading"
          :disabled="otp.length !== 6"
          @click="verifyTotp()"
        >
          验证并登录
        </v-btn>
        <p
          v-if="totpCountdown > 0"
          class="text-caption text-medium-emphasis text-center mt-3"
        >
          验证将在 {{ totpCountdown }} 秒后过期
        </p>
        <v-btn
          block
          variant="text"
          class="text-none mt-2"
          @click="backToIdentifier"
        >
          使用其他账户
        </v-btn>
      </v-window-item>

      <!-- 步骤：选择其他方式 -->
      <v-window-item value="chooser">
        <v-list class="py-0" bg-color="transparent">
          <v-list-item
            v-for="m in chooserMethods"
            :key="m"
            rounded="lg"
            class="mb-2 border"
            @click="selectMethod(m)"
          >
            <template #prepend>
              <v-avatar color="primary" variant="tonal" size="40">
                <v-icon>{{ methodMeta[m].icon }}</v-icon>
              </v-avatar>
            </template>
            <v-list-item-title class="font-weight-medium">
              {{ methodMeta[m].title }}
            </v-list-item-title>
            <v-list-item-subtitle>{{ methodMeta[m].subtitle }}</v-list-item-subtitle>
            <template #append>
              <v-icon size="small">mdi-chevron-right</v-icon>
            </template>
          </v-list-item>
        </v-list>
      </v-window-item>

      <!-- 步骤：仅第三方登录 -->
      <v-window-item value="oauth-only">
        <v-alert
          type="info"
          variant="tonal"
          density="comfortable"
          class="mb-4"
          text="该账户未设置密码，也未绑定可用邮箱。请使用下方绑定的第三方账户登录。"
        />
        <OAuthButtons mode="login" :show-divider="false" />
        <v-btn
          block
          variant="text"
          class="text-none mt-4"
          prepend-icon="mdi-arrow-left"
          @click="backToIdentifier"
        >
          返回
        </v-btn>
      </v-window-item>
    </v-window>
  </v-card>
</template>

<script setup>
import { ref, computed } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useSignInFlow, METHOD_META } from "@/composables/useSignInFlow";
import Recaptcha from "@/components/Recaptcha.vue";
import OAuthButtons from "@/components/account/OAuthButtons.vue";

const props = defineProps({
  // 在弹窗内使用时为 true：不绘制外层卡片边框/圆角，避免双层卡片
  embedded: { type: Boolean, default: false },
});

const emit = defineEmits(["login-success", "close"]);

const authStore = useAuthStore();
const recaptchaRef = ref(null);
const showPassword = ref(false);
const methodMeta = METHOD_META;

const onSuccess = (resp) => emit("login-success", resp);

const {
  // 状态
  step,
  identifier,
  password,
  code,
  otp,
  loading,
  passkeyLoading,
  error,
  codeSent,
  magicLinkSent,
  countdown,
  totpCountdown,
  passkeySupported,
  accountNotFound,
  // 计算
  hasPasskey,
  chooserMethods,
  otherMethods,
  // 动作
  submitIdentifier,
  loginWithPasskey,
  submitPassword,
  sendCode,
  verifyCode,
  sendMagicLink,
  verifyTotp,
  selectMethod,
  goChooser,
  backToIdentifier,
} = useSignInFlow({ onSuccess });

// 需要验证码 token 的步骤，从 Recaptcha 组件取值后透传
const getCaptcha = () => recaptchaRef.value?.getResponse() || null;
const onSubmitPassword = () => submitPassword(getCaptcha());
const onSendCode = () => sendCode(getCaptcha());
const onSendMagicLink = () => sendMagicLink(getCaptcha());
const onClose = () => emit("close");

const stepTitle = computed(
  () =>
    ({
      passkey: "使用通行密钥登录",
      password: "输入密码",
      "email-code": "邮箱验证码登录",
      "magic-link": "邮件链接登录",
      totp: "两步验证",
      chooser: "选择登录方式",
      "oauth-only": "使用第三方账户登录",
    }[step.value] || "")
);

// 保留 redirect 参数的注册 / 找回密码链接
const redirectQuery = computed(() =>
  authStore.authRedirectUrl
    ? `?redirect=${encodeURIComponent(authStore.authRedirectUrl)}`
    : ""
);
const registerLink = computed(() => `/app/account/register${redirectQuery.value}`);
const retrieveLink = computed(() => `/app/account/retrieve${redirectQuery.value}`);
</script>
