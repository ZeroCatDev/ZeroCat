<template>
  <div class="sudo-manager">
    <!-- Sudo认证对话框 -->
    <SudoDialog
      v-model="showDialog"
      :title="dialogConfig.title"
      :subtitle="dialogConfig.subtitle"
      :persistent="dialogConfig.persistent"
      :user-id="currentUserId"
      @success="handleAuthSuccess"
      @cancel="handleAuthCancel"
      @error="handleAuthError"
      ref="sudoDialog"
    />

    <!-- 可选：显示当前sudo状态的小组件 -->
    <div v-if="showStatus && sudoStore.isTokenValid" class="sudo-status">
      <v-chip
        color="success"
        variant="tonal"
        size="small"
        prepend-icon="mdi-shield-check"
      >
        Sudo已激活 ({{ formatTime(sudoStore.tokenExpiresIn) }})
      </v-chip>
    </div>
  </div>
</template>

<script>
import { getCurrentInstance, onMounted } from 'vue';
import { useSudoStore } from '@/stores/sudo';
import SudoDialog from './SudoDialog.vue';
import { useSudoManager } from '@/composables/useSudoManager';

export default {
  name: 'SudoManager',

  components: {
    SudoDialog
  },

  props: {
    showStatus: {
      type: Boolean,
      default: false
    },
    userId: {
      type: Number,
      default: null
    }
  },

  data() {
    return {
      sudoStore: useSudoStore(),
      showDialog: false,
      pendingRequests: new Map(),
      currentUserId: this.userId,
      dialogConfig: {
        title: 'Sudo 认证',
        subtitle: '为了您的账户安全，请验证您的身份',
        persistent: false
      }
    };
  },

  computed: {
    hasPendingRequests() {
      return this.pendingRequests.size > 0;
    }
  },

  methods: {
    formatTime(seconds) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;

      if (minutes > 0) {
        return `${minutes}分${remainingSeconds}秒`;
      }
      return `${remainingSeconds}秒`;
    },

    /**
     * 请求sudo认证
     * @param {Object} options - 认证选项
     * @returns {Promise<string>} sudo token
     */
    async requireSudo(options = {}) {
      const {
        title = 'Sudo 认证',
        subtitle = '为了您的账户安全，请验证您的身份',
        persistent = false,
        force = false,
        userId = null
      } = options;

      // 如果已有有效的token且不强制重新认证，直接返回
      if (!force && this.sudoStore.isTokenValid) {
        return this.sudoStore.sudoToken;
      }

      // 生成请求ID
      const requestId = `sudo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return new Promise((resolve, reject) => {
        // 存储pending请求
        this.pendingRequests.set(requestId, { resolve, reject });

        // 更新对话框配置
        this.dialogConfig = { title, subtitle, persistent };
        this.currentUserId = userId || this.userId;

        // 显示对话框
        this.showDialog = true;
      });
    },


    /**
     * 检查sudo token是否有效
     * @returns {boolean}
     */
    isSudoValid() {
      return this.sudoStore.isTokenValid;
    },

    /**
     * 清除sudo token
     */
    clearSudo() {
      this.sudoStore.clearSudoToken();
    },

    /**
     * 获取当前sudo token
     * @returns {string|null}
     */
    getSudoToken() {
      return this.sudoStore.sudoToken;
    },

    /**
     * 为HTTP请求添加sudo token
     * @param {Object} config - axios请求配置
     * @returns {Object} 更新后的请求配置
     */
    addSudoToRequest(config) {
      const token = this.getSudoToken();
      if (token && this.isSudoValid()) {
        // 多种方式传递sudo token，按优先级排序
        config.headers = config.headers || {};

        // 1. Authorization 头
        config.headers['Authorization'] = `Sudo ${token}`;

        // 2. 自定义头（备用）
        config.headers['X-Sudo-Token'] = token;

        // 3. 请求体（对于POST/PUT等请求）
        if (config.data && typeof config.data === 'object') {
          config.data.sudo_token = token;
        }
      }
      return config;
    },

    // 事件处理器
    handleAuthSuccess(data) {
      // 解析所有pending请求
      for (const [requestId, { resolve }] of this.pendingRequests) {
        resolve(data.sudo_token);
      }
      this.pendingRequests.clear();
      this.showDialog = false;
    },

    handleAuthCancel() {
      // 拒绝所有pending请求
      const error = new Error('用户取消认证');
      error.type = 'cancelled';

      for (const [requestId, { reject }] of this.pendingRequests) {
        reject(error);
      }
      this.pendingRequests.clear();
      this.showDialog = false;
    },

    handleAuthError(error) {
      // 拒绝所有pending请求
      const authError = new Error(error);
      authError.type = 'auth_failed';

      for (const [requestId, { reject }] of this.pendingRequests) {
        reject(authError);
      }
      this.pendingRequests.clear();
      this.showDialog = false;
    }
  },

  computed: {
    isLoading() {
      return this.sudoStore.isLoading;
    },
    tokenExpiresIn() {
      return this.sudoStore.tokenExpiresIn;
    }
  },

  created() {
    // 初始化时将组件实例传递给 useSudoManager
    const { setSudoDialogComponent } = useSudoManager();
    setSudoDialogComponent(this);
  },

  mounted() {
    // 由于我们现在直接从 localStorage 读取，不需要初始化加载
    // 数据会在访问时自动从 localStorage 获取
  }
}

</script>

<style scoped>
.sudo-manager {
  position: relative;
}

.sudo-status {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
}

@media (max-width: 768px) {
  .sudo-status {
    top: 10px;
    right: 10px;
  }
}
</style>
