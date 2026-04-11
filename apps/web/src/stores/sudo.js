import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import SudoService from '@/services/sudoService';
import PasskeyService from '@/services/passkeyService';
import { transformAssertionOptions, publicKeyCredentialToJSON } from '@/services/webauthn';

// localStorage 键名
const STORAGE_KEYS = {
  TOKEN: 'sudo_token',
  EXPIRES_AT: 'sudo_token_expires_at',
  DURATION: 'sudo_token_duration'
};

// 统一的过期检查函数
const isTokenValid = () => {
  try {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    const expiresAt = localStorage.getItem(STORAGE_KEYS.EXPIRES_AT);
    const duration = localStorage.getItem(STORAGE_KEYS.DURATION);

    if (!token || !expiresAt) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    const expiry = Math.floor(new Date(expiresAt).getTime() / 1000);

    // 检查是否已过期
    if (now >= expiry) {
      clearSudoToken();
      return false;
    }

    // 如果有duration，检查剩余时间是否小于15%
    if (duration) {
      const durationNum = parseInt(duration, 10);
      if (durationNum > 0) {
        const remainingTime = expiry - now;
        const threshold = durationNum * 0.15;
        if (remainingTime <= threshold) {
          clearSudoToken();
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    console.warn('Token validation error:', error);
    clearSudoToken();
    return false;
  }
};

// 清除token
const clearSudoToken = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.EXPIRES_AT);
    localStorage.removeItem(STORAGE_KEYS.DURATION);
  } catch (error) {
    console.warn('清除sudo token失败:', error);
  }
};

// 设置token
const setSudoToken = (token, expiresIn) => {
  if (!token || !expiresIn || expiresIn <= 0) {
    console.warn('setSudoToken: 无效参数');
    return;
  }

  try {
    const expiryTimestamp = Math.floor(Date.now() / 1000) + expiresIn;
    const expiryDate = new Date(expiryTimestamp * 1000);

    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, expiryDate.toISOString());
    localStorage.setItem(STORAGE_KEYS.DURATION, expiresIn.toString());
  } catch (error) {
    console.warn('存储sudo token失败:', error);
  }
};

// 获取token
const getSudoToken = () => {
  if (!isTokenValid()) {
    return null;
  }
  return localStorage.getItem(STORAGE_KEYS.TOKEN);
};

// 获取剩余时间
const getTokenExpiresIn = () => {
  try {
    const expiresAt = localStorage.getItem(STORAGE_KEYS.EXPIRES_AT);
    if (!expiresAt) return 0;

    const now = Math.floor(Date.now() / 1000);
    const expiry = Math.floor(new Date(expiresAt).getTime() / 1000);

    return Math.max(0, expiry - now);
  } catch (error) {
    return 0;
  }
};

export const useSudoStore = defineStore('sudo', () => {
  const isLoading = ref(false);

  const authenticateWithPassword = async (identifier, password) => {
    isLoading.value = true;

    try {
      const response = await SudoService.authenticateWithPassword(identifier, password, 'sudo');

      if (response.status === 'success' && response.data.sudo_token) {
        setSudoToken(response.data.sudo_token, response.data.expires_in);
        return { success: true, data: response.data };
      } else {
        return { success: false, message: response.message || '认证失败' };
      }
    } catch (error) {
      const message = error.response?.data?.message || error.message || '认证失败';
      return { success: false, message };
    } finally {
      isLoading.value = false;
    }
  };

  const authenticateWithEmail = async (codeId, code) => {
    isLoading.value = true;

    try {
      const response = await SudoService.authenticateWithEmail(codeId, code, 'sudo');

      if (response.status === 'success' && response.data.sudo_token) {
        setSudoToken(response.data.sudo_token, response.data.expires_in);
        return { success: true, data: response.data };
      } else {
        return { success: false, message: response.message || '认证失败' };
      }
    } catch (error) {
      const message = error.response?.data?.message || error.message || '认证失败';
      return { success: false, message };
    } finally {
      isLoading.value = false;
    }
  };

  const authenticateWithTotp = async (code) => {
    isLoading.value = true;
    try {
      const response = await SudoService.authenticateWithTotp(code, 'sudo');
      if (response.status === 'success' && response.data.sudo_token) {
        setSudoToken(response.data.sudo_token, response.data.expires_in);
        return { success: true, data: response.data };
      }
      return { success: false, message: response.message || '认证失败' };
    } catch (error) {
      const message = error.response?.data?.message || error.message || '认证失败';
      return { success: false, message };
    } finally {
      isLoading.value = false;
    }
  };

  const sendVerificationCode = async (email, userId = null) => {
    isLoading.value = true;

    try {
      const response = await SudoService.sendVerificationCode(email, 'sudo', userId);

      if (response.status === 'success') {
        return { success: true, data: response.data };
      } else {
        return { success: false, message: response.message || '发送验证码失败' };
      }
    } catch (error) {
      const message = error.response?.data?.message || error.message || '发送验证码失败';
      return { success: false, message };
    } finally {
      isLoading.value = false;
    }
  };

  const getAuthMethods = async () => {
    try {
      const response = await SudoService.getAuthMethods('sudo');

      if (response.status === 'success') {
        return { success: true, methods: response.data.available_methods || [] };
      } else {
        return { success: false, methods: ['password'], message: response.message };
      }
    } catch (error) {
      return { success: false, methods: ['password'], message: error.message };
    }
  };

  const authenticateWithPasskey = async () => {
    isLoading.value = true;
    try {
      const begin = await PasskeyService.sudoBegin();
      if (begin.status !== 'success') {
        return { success: false, message: begin.message || '无法开始Passkey验证' };
      }

      const options = transformAssertionOptions(begin.data);
      const cred = await navigator.credentials.get(options);
      const assertion = publicKeyCredentialToJSON(cred);
      const finish = await PasskeyService.sudoFinish(assertion);

      if (finish.status === 'success' && finish.data?.sudo_token) {
        setSudoToken(finish.data.sudo_token, finish.data.expires_in);
        return { success: true, data: finish.data };
      }
      return { success: false, message: finish.message || 'Passkey 验证失败' };
    } catch (error) {
      const message = error.message || 'Passkey 验证被取消或失败';
      return { success: false, message };
    } finally {
      isLoading.value = false;
    }
  };

  return {
    // 状态
    isLoading: computed(() => isLoading.value),

    // 计算属性 - 直接从localStorage读取
    isTokenValid: computed(() => isTokenValid()),
    sudoToken: computed(() => getSudoToken()),
    tokenExpiresIn: computed(() => getTokenExpiresIn()),
    expiresAt: computed(() => localStorage.getItem(STORAGE_KEYS.EXPIRES_AT)),

    // 方法
    setSudoToken,
    clearSudoToken,
    authenticateWithPassword,
    authenticateWithEmail,
    authenticateWithTotp,
    sendVerificationCode,
    getAuthMethods,
    authenticateWithPasskey,
  };
});
