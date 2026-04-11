import { ref, computed, nextTick, getCurrentInstance } from 'vue';
import { useSudoStore } from '@/stores/sudo';

// 全局状态
const sudoDialogComponent = ref(null);
const pendingRequests = ref(new Map());

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

// 获取token
const getSudoToken = () => {
  if (!isTokenValid()) {
    return null;
  }
  return localStorage.getItem(STORAGE_KEYS.TOKEN);
};

// 检查全局状态是否已初始化
const checkInitialization = () => {
  if (!sudoDialogComponent.value) {
    throw new Error('SudoManager组件未初始化，请确保在App.vue中添加SudoManager组件并设置ref="sudoManager"');
  }
};

/**
 * 全局sudo管理composable
 * 提供统一的sudo认证接口
 */
export const useSudoManager = () => {
  const sudoStore = useSudoStore();

  /**
   * 设置sudo对话框组件引用
   * @param {Object} component - SudoManager组件实例
   */
  const setSudoDialogComponent = (component) => {
    sudoDialogComponent.value = component;
  };

  /**
   * 请求sudo认证
   * @param {Object} options - 认证选项
   * @returns {Promise<string>} sudo token
   */
  const requireSudo = async (options = {}) => {
    const {
      title = 'Sudo 认证',
      subtitle = '为了您的账户安全，请验证您的身份',
      persistent = false,
      force = false,
      userId = null
    } = options;

    // 如果已有有效的token且不强制重新认证，直接返回
    if (!force && isTokenValid()) {
      return getSudoToken();
    }

    // 如果token无效，先清除
    if (!isTokenValid()) {
      clearSudoToken();
    }

    // 检查初始化状态
    checkInitialization();

    // 生成请求ID
    const requestId = `sudo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return new Promise((resolve, reject) => {
      // 存储pending请求
      pendingRequests.value.set(requestId, { resolve, reject, options });

      // 调用组件方法
      sudoDialogComponent.value.requireSudo({
        ...options,
        requestId
      }).then(resolve).catch(reject);
    });
  };

  /**
   * 为HTTP请求添加sudo token
   * @param {Object} config - axios请求配置
   * @returns {Object} 更新后的请求配置
   */
  const addSudoToRequest = (config) => {
    const token = getSudoToken();
    if (token) {
      config.headers = config.headers || {};

      // 1. Authorization 头
      config.headers['Authorization'] = `Sudo ${token}`;

      // 2. 自定义头（备用）
      config.headers['X-Sudo-Token'] = token;

      // 3. Query参数（GET请求）
      if (config.method === 'get' || !config.data) {
        config.params = config.params || {};
        config.params.sudo_token = token;
      }

      // 4. 请求体（对于POST/PUT等请求）
      if (config.data && typeof config.data === 'object') {
        config.data.sudo_token = token;
      }
    }
    return config;
  };

  /**
   * 创建需要sudo认证的请求拦截器
   * @param {Function} axiosInstance - axios实例
   */
  const createSudoInterceptor = (axiosInstance) => {
    // 请求拦截器
    axiosInstance.interceptors.request.use(
      (config) => {
        // 检查是否需要sudo认证
        if (config.requireSudo) {
          return addSudoToRequest(config);
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // 响应拦截器 - 处理sudo token失效
    axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // 如果返回sudo token无效或需要sudo认证的错误
        if (
          error.response?.status === 403 &&
          (error.response.data?.code === 'SUDO_TOKEN_REQUIRED' ||
           error.response.data?.code === 'SUDO_TOKEN_INVALID') &&
          !originalRequest._sudoRetried
        ) {
          originalRequest._sudoRetried = true;

          try {
            // 自动获取新的sudo token
            const token = await requireSudo({
              title: '需要sudo认证',
              subtitle: '您的操作需要验证身份',
              force: true
            });

            // 重新发送请求
            originalRequest.requireSudo = true;
            return axiosInstance(originalRequest);
          } catch (sudoError) {
            // 如果用户取消认证，返回原始错误
            return Promise.reject(error);
          }
        }

        return Promise.reject(error);
      }
    );
  };

  /**
   * 格式化时间显示
   * @param {number} seconds - 秒数
   * @returns {string} 格式化后的时间字符串
   */
  const formatTime = (seconds) => {
    if (seconds <= 0) return '已过期';

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}分${remainingSeconds}秒`;
    }
    return `${remainingSeconds}秒`;
  };

  return {
    // 设置方法
    setSudoDialogComponent,

    // 核心方法
    requireSudo,
    isSudoValid: isTokenValid,
    clearSudo: clearSudoToken,
    getSudoToken,
    addSudoToRequest,
    createSudoInterceptor,

    // 工具方法
    formatTime,

    // 响应式状态 - 直接从store获取
    isLoading: computed(() => sudoStore.isLoading),
    isTokenValid: computed(() => isTokenValid()),
    tokenExpiresIn: computed(() => {
      const expiresAt = localStorage.getItem(STORAGE_KEYS.EXPIRES_AT);
      if (!expiresAt) return 0;
      const now = Math.floor(Date.now() / 1000);
      const expiry = Math.floor(new Date(expiresAt).getTime() / 1000);
      return Math.max(0, expiry - now);
    }),
    sudoToken: computed(() => getSudoToken()),
    expiresAt: computed(() => localStorage.getItem(STORAGE_KEYS.EXPIRES_AT))
  };
};

// 导出单例实例
export default useSudoManager;
