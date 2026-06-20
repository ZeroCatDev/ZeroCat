import { computed } from "vue";
import { localuser } from "@/services/localAccount";

/**
 * 统一的账户 UI 状态：乐观已登录 + 鉴权完成前展示骨架，避免登录按钮闪屏。
 */
export function useAccountState() {
  const authReady = computed(() => localuser.authReady.value);
  const hasAuthHint = computed(() => localuser.hasAuthHint.value);
  const isLogin = computed(() => localuser.isLogin.value);
  const user = computed(() => localuser.user.value);

  const authPending = computed(() => !authReady.value && hasAuthHint.value);
  const showGuestUI = computed(() => authReady.value && !isLogin.value);
  const showAuthenticatedUI = computed(() => isLogin.value);

  return {
    authReady,
    hasAuthHint,
    isLogin,
    user,
    authPending,
    showGuestUI,
    showAuthenticatedUI,
  };
}
