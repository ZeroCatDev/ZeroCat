import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import AuthService from "@/services/authService";
import PasskeyService from "@/services/passkeyService";
import TwoFAService from "@/services/twofaService";
import {
  transformAssertionOptions,
  publicKeyCredentialToJSON,
} from "@/services/webauthn";

// 各认证方式的展示元数据（用于「其他方式」列表）
export const METHOD_META = {
  passkey: {
    icon: "mdi-fingerprint",
    title: "通行密钥",
    subtitle: "使用指纹、面容或设备锁，最快捷安全",
  },
  password: {
    icon: "mdi-form-textbox-password",
    title: "密码登录",
    subtitle: "使用账户密码登录",
  },
  "email-code": {
    icon: "mdi-email-outline",
    title: "邮箱验证码",
    subtitle: "发送一次性验证码到邮箱",
  },
  "magic-link": {
    icon: "mdi-link-variant",
    title: "登录链接",
    subtitle: "发送魔术链接到邮箱，点击即登录",
  },
};

const EMAIL_RE = /.+@.+\..+/;

/**
 * 新版登录流程状态机。
 * 集中管理步骤、共享状态与所有动作，调用现有 service。
 * @param {{ onSuccess?: (resp:any)=>void }} options
 */
export function useSignInFlow(options = {}) {
  const { onSuccess } = options;

  // —— 步骤与共享状态 ——
  const step = ref("identifier"); // identifier | passkey | password | email-code | magic-link | totp | chooser | oauth-only
  const identifier = ref("");
  const password = ref("");
  const code = ref("");
  const otp = ref(""); // TOTP 输入
  const availableMethods = ref([]); // 来自 /auth/methods 的原始数组
  const challenge = ref(null); // 2FA: { challenge_id, expires_in }
  const displayName = ref("");
  const accountNotFound = ref(false); // 标识符解析后账户不存在

  // —— UI 状态 ——
  const loading = ref(false);
  const passkeyLoading = ref(false);
  const error = ref("");
  const codeSent = ref(false);
  const magicLinkSent = ref(false);
  const countdown = ref(0); // 验证码重发倒计时
  const totpCountdown = ref(0); // 2FA 过期倒计时

  // —— 能力探测 ——
  const passkeySupported = !!(
    typeof window !== "undefined" && window.PublicKeyCredential
  );

  // —— 计算属性 ——
  const isEmail = computed(() => EMAIL_RE.test(identifier.value.trim()));
  const hasPasskey = computed(
    () => passkeySupported && availableMethods.value.includes("passkey")
  );
  const hasPassword = computed(() => availableMethods.value.includes("password"));
  // 邮箱类方式只要账户绑定了邮箱即可使用（后端支持用用户名解析到邮箱）
  const hasEmailMethod = computed(() => availableMethods.value.includes("email"));

  // 账户实际可用、且当前标识符可走的方式（已按「快速现代优先」排序）
  const chooserMethods = computed(() => {
    const out = [];
    if (hasPasskey.value) out.push("passkey");
    if (hasPassword.value) out.push("password");
    if (hasEmailMethod.value) {
      out.push("email-code");
      out.push("magic-link");
    }
    return out;
  });

  // 当前步骤之外、可切换的其他方式（供「选择其他方式」列表）
  const otherMethods = computed(() =>
    chooserMethods.value.filter((m) => m !== step.value)
  );

  // —— 计时器与条件式 UI 句柄（需在卸载时清理）——
  let countdownTimer = null;
  let totpTimer = null;
  let conditionalAbort = null;

  const startCountdown = (seconds = 60) => {
    clearInterval(countdownTimer);
    countdown.value = seconds;
    countdownTimer = setInterval(() => {
      countdown.value -= 1;
      if (countdown.value <= 0) clearInterval(countdownTimer);
    }, 1000);
  };

  const startTotpCountdown = (seconds) => {
    clearInterval(totpTimer);
    totpCountdown.value = Math.max(0, Math.floor(seconds || 0));
    if (!totpCountdown.value) return;
    totpTimer = setInterval(() => {
      totpCountdown.value -= 1;
      if (totpCountdown.value <= 0) clearInterval(totpTimer);
    }, 1000);
  };

  // —— 统一响应处理 ——
  const handleLoginResponse = (resp) => {
    if (!resp) {
      error.value = "登录失败，请重试";
      return;
    }
    if (resp.status === "success") {
      displayName.value = resp.display_name || displayName.value;
      onSuccess?.(resp);
      return;
    }
    if (resp.status === "need_2fa") {
      challenge.value = resp.data || null;
      otp.value = "";
      error.value = "";
      step.value = "totp";
      startTotpCountdown(resp.data?.expires_in);
      return;
    }
    // 错误
    error.value = resp.message || "登录失败";
    // 账户无密码：移除密码方式并引导到其他方式
    if (resp.code === "NO_PASSWORD") {
      availableMethods.value = availableMethods.value.filter(
        (m) => m !== "password"
      );
      goToBestMethodOrChooser();
    }
  };

  const handleError = (e) => {
    error.value =
      e?.response?.data?.message || e?.message || "发生错误，请稍后再试";
  };

  // 根据可用方式选择落点
  const goToBestMethodOrChooser = () => {
    const methods = chooserMethods.value;
    if (!methods.length) {
      step.value = "oauth-only";
      return;
    }
    const primary = methods[0];
    step.value = primary === "passkey" ? "passkey" : primary; // password | email-code
  };

  // —— 动作：标识符解析 ——
  const submitIdentifier = async () => {
    error.value = "";
    accountNotFound.value = false;
    const id = identifier.value.trim();
    if (!id) {
      error.value = "请输入邮箱或用户名";
      return;
    }
    loading.value = true;
    try {
      const result = await AuthService.getAuthMethods(id, "login");
      if (result.accountExists === false) {
        accountNotFound.value = true;
        return;
      }
      availableMethods.value = result.availableMethods || [];
      goToBestMethodOrChooser();
    } catch (e) {
      handleError(e);
    } finally {
      loading.value = false;
    }
  };

  // —— 动作：通行密钥 ——
  // useIdentifier=false 时为无用户名（discoverable）登录，可在首屏直接使用
  const loginWithPasskey = async (useIdentifier = true) => {
    if (!passkeySupported) {
      error.value = "当前浏览器不支持通行密钥";
      return;
    }
    abortConditional();
    error.value = "";
    passkeyLoading.value = true;
    try {
      const begin = await PasskeyService.beginLogin(
        useIdentifier ? identifier.value.trim() || undefined : undefined
      );
      if (begin.status !== "success") {
        error.value = begin.message || "通行密钥登录失败";
        return;
      }
      const cred = await navigator.credentials.get(
        transformAssertionOptions(begin.data)
      );
      const assertion = publicKeyCredentialToJSON(cred);
      const finish = await PasskeyService.finishLogin(assertion);
      handleLoginResponse(finish);
    } catch (e) {
      // 用户取消属正常操作，不显示为错误
      if (e?.name === "NotAllowedError" || e?.name === "AbortError") {
        error.value = "";
      } else {
        error.value = e?.message || "通行密钥登录被取消或失败";
      }
    } finally {
      passkeyLoading.value = false;
    }
  };

  // —— 动作：密码 ——
  const submitPassword = async (captcha = null) => {
    error.value = "";
    if (!password.value) {
      error.value = "请输入密码";
      return;
    }
    loading.value = true;
    try {
      const resp = await AuthService.loginWithPassword(
        identifier.value.trim(),
        password.value,
        captcha
      );
      handleLoginResponse(resp);
    } catch (e) {
      handleError(e);
    } finally {
      loading.value = false;
    }
  };

  // —— 动作：邮箱验证码 ——
  const sendCode = async (captcha = null) => {
    if (countdown.value > 0) return;
    error.value = "";
    loading.value = true;
    try {
      const resp = await AuthService.sendLoginCode(
        identifier.value.trim(),
        captcha
      );
      if (resp.status === "success") {
        codeSent.value = true;
        startCountdown(60);
      } else {
        error.value = resp.message || "发送验证码失败";
      }
    } catch (e) {
      handleError(e);
    } finally {
      loading.value = false;
    }
  };

  const verifyCode = async () => {
    error.value = "";
    if (!code.value || code.value.length < 4) {
      error.value = "请输入收到的验证码";
      return;
    }
    loading.value = true;
    try {
      const resp = await AuthService.loginWithCode(
        identifier.value.trim(),
        code.value
      );
      handleLoginResponse(resp);
    } catch (e) {
      handleError(e);
    } finally {
      loading.value = false;
    }
  };

  // —— 动作：魔术链接 ——
  const sendMagicLink = async (captcha = null) => {
    if (countdown.value > 0) return;
    error.value = "";
    loading.value = true;
    try {
      const redirect = `${window.location.origin}/app/account/magiclink/validate`;
      const resp = await AuthService.generateMagicLink(
        identifier.value.trim(),
        redirect,
        captcha
      );
      if (resp.status === "success") {
        magicLinkSent.value = true;
        startCountdown(60);
      } else {
        error.value = resp.message || "发送登录链接失败";
      }
    } catch (e) {
      handleError(e);
    } finally {
      loading.value = false;
    }
  };

  // —— 动作：TOTP 二次验证 ——
  const verifyTotp = async (token) => {
    const value = token ?? otp.value;
    if (!challenge.value?.challenge_id) {
      error.value = "验证已失效，请重新登录";
      return;
    }
    if (!value || value.length !== 6) {
      error.value = "请输入 6 位验证码";
      return;
    }
    error.value = "";
    loading.value = true;
    try {
      const resp = await TwoFAService.loginTotp(
        challenge.value.challenge_id,
        value
      );
      if (resp.status === "success") {
        handleLoginResponse(resp);
      } else {
        error.value = resp.message || "验证码无效，请重试";
        otp.value = "";
      }
    } catch (e) {
      handleError(e);
      otp.value = "";
    } finally {
      loading.value = false;
    }
  };

  // —— 导航 ——
  const selectMethod = (method) => {
    error.value = "";
    code.value = "";
    codeSent.value = false;
    magicLinkSent.value = false;
    step.value = method;
  };

  const goChooser = () => {
    error.value = "";
    step.value = "chooser";
  };

  // 回到第一步换账户（保留已输入标识符）
  const backToIdentifier = () => {
    abortConditional();
    clearInterval(totpTimer);
    step.value = "identifier";
    password.value = "";
    code.value = "";
    otp.value = "";
    challenge.value = null;
    error.value = "";
    codeSent.value = false;
    magicLinkSent.value = false;
    accountNotFound.value = false;
  };

  // —— 条件式 UI（通行密钥自动填充）——
  const abortConditional = () => {
    if (conditionalAbort) {
      try {
        conditionalAbort.abort();
      } catch {
        /* noop */
      }
      conditionalAbort = null;
    }
  };

  const armConditionalPasskey = async () => {
    if (!passkeySupported || !navigator.credentials) return;
    try {
      if (
        typeof PublicKeyCredential.isConditionalMediationAvailable !==
          "function" ||
        !(await PublicKeyCredential.isConditionalMediationAvailable())
      ) {
        return;
      }
      const begin = await PasskeyService.beginLogin();
      if (begin.status !== "success") return;
      conditionalAbort = new AbortController();
      const cred = await navigator.credentials.get({
        ...transformAssertionOptions(begin.data),
        mediation: "conditional",
        signal: conditionalAbort.signal,
      });
      if (!cred) return;
      const assertion = publicKeyCredentialToJSON(cred);
      const finish = await PasskeyService.finishLogin(assertion);
      handleLoginResponse(finish);
    } catch {
      // 条件式 UI 为渐进增强，失败/中止静默忽略
    }
  };

  onMounted(() => {
    armConditionalPasskey();
  });

  onBeforeUnmount(() => {
    clearInterval(countdownTimer);
    clearInterval(totpTimer);
    abortConditional();
  });

  return {
    // 状态
    step,
    identifier,
    password,
    code,
    otp,
    availableMethods,
    challenge,
    displayName,
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
    isEmail,
    hasPasskey,
    hasPassword,
    hasEmailMethod,
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
  };
}

export default useSignInFlow;
