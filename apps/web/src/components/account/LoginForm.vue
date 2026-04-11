<template>
  <v-form>
    <v-row>
      <!-- 登录方式切换 -->
      <v-col cols="12">
        <v-tabs v-model="loginType" class="mb-4">
          <v-tab value="password" variant="text">密码登录</v-tab>
          <v-tab value="code" variant="text">验证码登录</v-tab>
          <v-tab value="magiclink" variant="text">魔术链接登录</v-tab>
        </v-tabs>

        <v-text-field
          v-model="email"
          :rules="emailRules"
          label="邮箱"
          type="text"
          variant="outlined"
        ></v-text-field>

        <!-- 密码登录 -->
        <v-text-field
          v-if="loginType === 'password'"
          v-model="password"
          :append-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
          :rules="passwordRules"
          :type="showPassword ? 'text' : 'password'"
          label="密码"
          variant="outlined"
          @click:append="showPassword = !showPassword"
        ></v-text-field>

        <!-- 验证码登录 -->
        <template v-if="loginType === 'code'">
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
            {{ countdown > 0 ? `${countdown}秒后重新发送` : "发送验证码" }}
          </v-btn>
        </template>
      </v-col>

      <v-col cols="12">
        <Recaptcha
          ref="recaptcha"
          :showNormal="true"
          recaptchaId="recaptcha-div"
          @bindClose="handleBindClose"
          @bindError="handleBindError"
          @bindVerified="handleBindVerified"
        />
      </v-col>

      <v-col cols="12">
        <v-btn
          :loading="loading"
          :text="getLoginButtonText()"
          append-icon="mdi-arrow-right"
          class="text-none"
          color="primary"
          rounded="xl"
          size="large"
          variant="flat"
          @click="handleLoginAction"
        ></v-btn>

      </v-col>

      <v-col v-if="showLinks" cols="12">
        <v-btn
          append-icon="mdi-arrow-right"
          class="text-none"
          color="white"
          rounded="xl"
          size="large"
          text="注册"
          :to="registerLink"
          variant="text"
          @click="handleClose"
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
          @click="handleClose"
        ></v-btn>
      </v-col>
      <v-col v-if="showOAuth" cols="12">
        <v-btn
          v-if="isPasskeySupported"
          class="ml-3 text-none"
          variant="tonal"
          color="secondary"
          prepend-icon="mdi-fingerprint"
          :loading="passkeyLoading"
          @click="loginWithPasskey"
        >
          使用 Passkey 一键登录
        </v-btn>
        <OAuthButtons divider-text="或使用以下方式登录" mode="login"/>
      </v-col>
    </v-row>
  </v-form>
  <LoadingDialog :show="loading" text="登录中"/>
  <TotpDialog
    v-model="showTotpDialog"
    title="二次验证"
    subtitle="请在认证器中获取 6 位验证码"
    :loading="totpLoading"
    :error-message="totpError"
    @confirm="handleTotpConfirm"
  />
</template>

<script>
import AuthService from "@/services/authService";
import PasskeyService from "@/services/passkeyService";
import TwoFAService from "@/services/twofaService";
import { transformAssertionOptions, publicKeyCredentialToJSON } from "@/services/webauthn";
import LoadingDialog from "@/components/LoadingDialog.vue";
import Recaptcha from "@/components/Recaptcha.vue";
import OAuthButtons from "@/components/account/OAuthButtons.vue";
import TotpDialog from "@/components/TotpDialog.vue";
import { useAuthStore } from "@/stores/auth";

export default {
  name: "LoginForm",
  components: { LoadingDialog, Recaptcha, OAuthButtons, TotpDialog },
  emits: ["login-success", "login-error", "close"],
  props: {
    showLinks: { type: Boolean, default: true },
    showOAuth: { type: Boolean, default: true },
    redirectPath: { type: String, default: "/app/dashboard" },
  },
  data() {
    return {
      // capability
      isPasskeySupported: !!(window.PublicKeyCredential),

      // form state
      email: "",
      password: "",
      verificationCode: "",
      loginType: "password",

      // ui state
      countdown: 0,
      loading: false,
      passkeyLoading: false,
      showPassword: false,
      magicLinkSent: false,

      // 2FA state
      twoFAChallenge: null,
      showTotpDialog: false,
      totpLoading: false,
      totpError: '',

      // validation
      rules: {
        required: (value) => !!value || "此字段为必填项",
        length: (value) => value?.length === 6 || "验证码必须是6位数字",
      },
      emailRules: [
        (value) => !!value || "必须填写邮箱",
        (value) => /.+@.+\..+/.test(value) || "不符合格式",
      ],
      passwordRules: [
        (value) => !!value || "必须填写密码",
      ],
    };
  },
  methods: {
    handleClose() {
      this.$emit("close");
    },

    getLoginButtonText() {
      if (this.loginType === "password") return "登录";
      if (this.loginType === "code") return this.verificationCode ? "登录" : "发送验证码";
      if (this.loginType === "magiclink") return this.magicLinkSent ? "已发送，请检查邮箱" : "发送登录链接";
      return "登录";
    },

    async handleLoginAction() {
      switch (this.loginType) {
        case "password":
          await this.loginWithPassword();
          break;
        case "code":
          if (this.verificationCode) await this.loginWithCode();
          else await this.sendVerificationCode();
          break;
        case "magiclink":
          await this.sendMagicLink();
          break;
      }
    },

    async loginWithPassword() {
      if (!this.email || !this.password) {
        this.showErrorToast("请输入邮箱和密码");
        return;
      }

      this.loading = true;
      try {
        const captcha = this.$refs.recaptcha?.getResponse() || null;
        const response = await AuthService.loginWithPassword(this.email, this.password, captcha);
        await this.handleLoginResponse(response);
      } catch (error) {
        this.handleError(error);
      } finally {
        this.loading = false;
      }
    },

    async loginWithCode() {
      if (!this.email || !this.verificationCode) {
        this.showErrorToast("请输入邮箱和验证码");
        return;
      }

      this.loading = true;
      try {
        const response = await AuthService.loginWithCode(this.email, this.verificationCode);
        await this.handleLoginResponse(response);
      } catch (error) {
        this.handleError(error);
      } finally {
        this.loading = false;
      }
    },

    async sendVerificationCode() {
      if (this.countdown > 0) return;
      if (!this.email || !/.+@.+\..+/.test(this.email)) {
        this.showErrorToast("请输入正确的邮箱地址");
        return;
      }

      this.loading = true;
      try {
        const captcha = this.$refs.recaptcha?.getResponse() || null;
        const response = await AuthService.sendLoginCode(this.email, captcha);
        if (response.status === "success") {
          this.showSuccessToast("验证码已发送");
          this.startCountdown();
        } else {
          this.showErrorToast(response.message);
        }
      } catch (error) {
        this.handleError(error);
      } finally {
        this.loading = false;
      }
    },

    async sendMagicLink() {
      if (this.magicLinkSent) return;
      if (!this.email || !/.+@.+\..+/.test(this.email)) {
        this.showErrorToast("请输入正确的邮箱地址");
        return;
      }

      this.loading = true;
      try {
        const captcha = this.$refs.recaptcha?.getResponse() || null;
        if (!captcha) {
          this.showErrorToast("请完成人机验证");
          this.loading = false;
          return;
        }
        const response = await AuthService.generateMagicLink(
          this.email,
          window.location.origin + "/app/account/magiclink/validate",
          captcha
        );
        if (response.status === "success") {
          this.showSuccessToast("登录链接已发送到您的邮箱");
          this.magicLinkSent = true;
        } else {
          this.showErrorToast(response.message);
        }
      } catch (error) {
        this.handleError(error);
      } finally {
        this.loading = false;
      }
    },

    async handleLoginResponse(response) {
      if (response.status === "success") {
        this.showSuccessToast("登录成功，欢迎回来，" + response.display_name);
        this.$emit("login-success", response);
      } else if (response.status === "need_2fa") {
        this.twoFAChallenge = response.data;
        this.promptTotpDialog();
      } else {
        this.showErrorToast(response.message);
        this.$emit("login-error", response);
      }
    },

    promptTotpDialog() {
      this.totpError = '';
      this.showTotpDialog = true;
    },

    async handleTotpConfirm(token) {
      if (!this.twoFAChallenge?.challenge_id) return;
      this.totpLoading = true;
      this.totpError = '';
      try {
        const totpRes = await TwoFAService.loginTotp(this.twoFAChallenge.challenge_id, token);
        if (totpRes.status === 'success') {
          this.showTotpDialog = false;
          await this.handleLoginResponse(totpRes);
        } else {
          this.totpError = totpRes.message || '验证码无效，请重试';
        }
      } catch (e) {
        this.totpError = e?.response?.data?.message || e?.message || '验证失败';
      } finally {
        this.totpLoading = false;
      }
    },

    async loginWithPasskey() {
      if (!this.isPasskeySupported) return;
      this.passkeyLoading = true;
      try {
        const begin = await PasskeyService.beginLogin();
        if (begin.status !== "success") {
          this.showErrorToast(begin.message || "Passkey 登录失败");
          return;
        }
        const options = transformAssertionOptions(begin.data);
        const cred = await navigator.credentials.get(options);
        const assertion = publicKeyCredentialToJSON(cred);
        const finish = await PasskeyService.finishLogin(assertion);
        await this.handleLoginResponse(finish);
      } catch (e) {
        this.showErrorToast(e.message || "Passkey 登录被取消或失败");
      } finally {
        this.passkeyLoading = false;
      }
    },

    handleError(error) {
      const message = error?.response?.data?.message || error?.message || "发生错误";
      this.showErrorToast(message);
      this.$emit("login-error", { message });
    },

    showSuccessToast(message) {
      if (this.$toast) {
        this.$toast.add({ severity: "success", summary: "成功", detail: message, life: 3000 });
      }
    },

    showErrorToast(message) {
      if (this.$toast) {
        this.$toast.add({ severity: "error", summary: "错误", detail: message, life: 3000 });
      }
    },

    startCountdown() {
      this.countdown = 60;
      const timer = setInterval(() => {
        this.countdown--;
        if (this.countdown <= 0) clearInterval(timer);
      }, 1000);
    },

    // ReCAPTCHA handlers
    handleBindVerified() {
      if (this.loginType === "code" && !this.verificationCode) {
        this.sendVerificationCode();
      }
    },

    handleBindError() {
      this.showErrorToast("验证失败，请重试");
    },

    handleBindClose() {
      // no-op for now
    },
  },
  watch: {
    loginType() {
      this.verificationCode = "";
      this.magicLinkSent = false;
      this.$nextTick(() => {
        if (this.$refs.recaptcha) this.$refs.recaptcha.resetCaptcha();
      });
    },
  },
  computed: {
    redirectQuery() {
      const authStore = useAuthStore();
      const url = authStore.authRedirectUrl;
      return url ? `?redirect=${encodeURIComponent(url)}` : '';
    },
    registerLink() {
      return `/app/account/register${this.redirectQuery}`;
    },
    retrieveLink() {
      return `/app/account/retrieve${this.redirectQuery}`;
    },
  },
};
</script>
