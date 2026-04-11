<template>
  <div class="token-debug-container">
    <v-card class="pa-4">
      <v-card-title>Token Debug Tool</v-card-title>
      <v-card-subtitle>测试和调试用户身份验证令牌API</v-card-subtitle>

      <v-divider class="my-3"></v-divider>

      <!-- 当前Token状态 -->
      <v-card class="mb-4" outlined>
        <v-card-title class="subtitle-1">
          当前Token状态
          <v-spacer></v-spacer>
          <v-btn color="primary" small @click="refreshTokenState">
            <v-icon left small>mdi-refresh</v-icon>
            刷新
          </v-btn>
        </v-card-title>
        <v-card-text>
          <v-simple-table dense>
            <tbody>
            <tr>
              <td class="font-weight-bold">登录状态</td>
              <td>
                <v-chip
                  :color="isLogin ? 'success' : 'error'"
                  small
                  text-color="white"
                >
                  {{ isLogin ? '已登录' : '未登录' }}
                </v-chip>
              </td>
            </tr>
            <tr>
              <td class="font-weight-bold">Access Token</td>
              <td class="text-truncate" style="max-width: 300px;">
                {{ token || '无' }}
              </td>
            </tr>
            <tr>
              <td class="font-weight-bold">Access Token有效性</td>
              <td>
                <v-chip
                  :color="isTokenValid ? 'success' : 'error'"
                  small
                  text-color="white"
                >
                  {{ isTokenValid ? '有效' : '无效' }}
                </v-chip>
                <span v-if="tokenExpiration > 0" class="ml-2">
                    (剩余{{ formatTime(tokenExpiration) }})
                  </span>
              </td>
            </tr>
            <tr>
              <td class="font-weight-bold">Refresh Token</td>
              <td>(HttpOnly Cookie, 不可读取)</td>
            </tr>
            <tr>
              <td class="font-weight-bold">Refresh Token有效性</td>
              <td>
                <v-chip
                  :color="isRefreshTokenValid ? 'success' : 'error'"
                  small
                  text-color="white"
                >
                  {{ isRefreshTokenValid ? '有效' : '无效' }}
                </v-chip>
              </td>
            </tr>
            </tbody>
          </v-simple-table>
        </v-card-text>
      </v-card>

      <!-- API操作区域 -->
      <v-expansion-panels>
        <!-- 自动刷新令牌设置 -->
        <v-expansion-panel>
          <v-expansion-panel-header>
            自动刷新令牌设置
          </v-expansion-panel-header>
          <v-expansion-panel-content>
            <v-card flat>
              <v-card-text>
                <v-alert class="mb-3" outlined type="info">
                  自动刷新功能已默认启用，将在令牌即将过期前自动更新，保持登录状态。
                </v-alert>

                <div class="d-flex align-center mb-3">
                  <span class="mr-2">自动刷新状态:</span>
                  <v-chip
                    :color="isAutoRefreshActive ? 'success' : 'grey'"
                    small
                    text-color="white"
                  >
                    {{ isAutoRefreshActive ? '已启用' : '已停用' }}
                  </v-chip>

                  <v-spacer></v-spacer>

                  <v-btn
                    v-if="isAutoRefreshActive"
                    :disabled="!isLogin"
                    color="warning"
                    small
                    @click="stopAutoRefresh"
                  >
                    临时停用自动刷新
                  </v-btn>
                  <v-btn
                    v-else
                    :disabled="!isLogin"
                    color="primary"
                    small
                    @click="startAutoRefresh"
                  >
                    重新启用自动刷新
                  </v-btn>
                </div>

                <div v-if="tokenExpiration > 0" class="d-flex align-center mb-4">
                  <v-icon
                    :color="tokenExpiration <= 300 ? 'error' : 'success'"
                    class="mr-2"
                    small
                  >
                    {{ tokenExpiration <= 300 ? 'mdi-clock-alert-outline' : 'mdi-clock-outline' }}
                  </v-icon>
                  <span>
                    当前令牌有效期还剩：<strong>{{ formatTime(tokenExpiration) }}</strong>
                    <span v-if="tokenExpiration <= 300"> (即将过期)</span>
                  </span>
                </div>

                <v-alert v-if="autoRefreshStatus" :type="autoRefreshStatus.type" outlined text>
                  {{ autoRefreshStatus.message }}
                </v-alert>

                <v-btn
                  :disabled="!isLogin"
                  :loading="checkingStatus"
                  class="mb-4"
                  color="primary"
                  @click="checkTokenRefreshStatus"
                >
                  检查刷新状态
                </v-btn>
              </v-card-text>
            </v-card>
          </v-expansion-panel-content>
        </v-expansion-panel>

        <!-- 刷新Token -->
        <v-expansion-panel>
          <v-expansion-panel-header>
            刷新访问令牌 (Refresh Token)
          </v-expansion-panel-header>
          <v-expansion-panel-content>
            <v-card flat>
              <v-card-text>
                <p class="mb-3">手动刷新Access Token，使用当前的Refresh Token获取新的Access Token。</p>
                <v-btn
                  :disabled="!isRefreshTokenValid"
                  :loading="refreshLoading"
                  color="primary"
                  @click="refreshAccessToken"
                >
                  刷新令牌
                </v-btn>
              </v-card-text>
            </v-card>
          </v-expansion-panel-content>
        </v-expansion-panel>

        <!-- 获取设备列表 -->
        <v-expansion-panel>
          <v-expansion-panel-header>
            获取设备列表
          </v-expansion-panel-header>
          <v-expansion-panel-content>
            <v-card flat>
              <v-card-text>
                <v-btn
                  :disabled="!isLogin"
                  :loading="devicesLoading"
                  class="mb-4"
                  color="primary"
                  @click="fetchDevicesList"
                >
                  获取设备列表
                </v-btn>

                <div v-if="devicesData && devicesData.length > 0">
                  <v-simple-table>
                    <thead>
                    <tr>
                      <th>设备ID</th>
                      <th>设备名称</th>
                      <th>最后登录时间</th>
                      <th>IP地址</th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr v-for="device in devicesData" :key="device.id">
                      <td>{{ device.id }}</td>
                      <td>{{ device.device_name }}</td>
                      <td>{{ formatDate(device.last_login) }}</td>
                      <td>{{ device.ip }}</td>
                    </tr>
                    </tbody>
                  </v-simple-table>
                </div>
                <v-alert v-else-if="devicesData" outlined type="info">
                  没有设备数据
                </v-alert>
              </v-card-text>
            </v-card>
          </v-expansion-panel-content>
        </v-expansion-panel>

        <!-- 获取活跃令牌列表 -->
        <v-expansion-panel>
          <v-expansion-panel-header>
            获取活跃令牌列表
          </v-expansion-panel-header>
          <v-expansion-panel-content>
            <v-card flat>
              <v-card-text>
                <v-checkbox
                  v-model="includeLocation"
                  :disabled="!isLogin"
                  label="包含位置信息"
                ></v-checkbox>
                <v-btn
                  :disabled="!isLogin"
                  :loading="tokensLoading"
                  class="mb-4"
                  color="primary"
                  @click="fetchActiveTokens"
                >
                  获取活跃令牌
                </v-btn>

                <div v-if="tokensData && tokensData.length > 0">
                  <v-simple-table>
                    <thead>
                    <tr>
                      <th>令牌ID</th>
                      <th>设备名称</th>
                      <th>创建时间</th>
                      <th>过期时间</th>
                      <th>位置信息</th>
                      <th>操作</th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr v-for="token in tokensData" :key="token.id">
                      <td>{{ token.id }}</td>
                      <td>{{ token.device_name }}</td>
                      <td>{{ formatDate(token.created_at) }}</td>
                      <td>{{ formatDate(token.expires_at) }}</td>
                      <td>{{ token.location || '无' }}</td>
                      <td>
                        <v-btn
                          :loading="revokeLoading === token.id"
                          color="error"
                          small
                          text
                          @click="revokeSelectedToken(token.id)"
                        >
                          撤销
                        </v-btn>
                        <v-btn
                          color="info"
                          small
                          text
                          @click="getTokenDetail(token.id)"
                        >
                          详情
                        </v-btn>
                      </td>
                    </tr>
                    </tbody>
                  </v-simple-table>
                </div>
                <v-alert v-else-if="tokensData" outlined type="info">
                  没有活跃令牌数据
                </v-alert>
              </v-card-text>
            </v-card>
          </v-expansion-panel-content>
        </v-expansion-panel>

        <!-- 令牌详情 -->
        <v-expansion-panel v-if="tokenDetail">
          <v-expansion-panel-header>
            令牌详情 #{{ tokenDetail.id }}
          </v-expansion-panel-header>
          <v-expansion-panel-content>
            <v-card flat>
              <v-card-text>
                <v-simple-table dense>
                  <tbody>
                  <tr v-for="(value, key) in tokenDetail" :key="key">
                    <td class="font-weight-bold">{{ formatKey(key) }}</td>
                    <td>{{ formatValue(key, value) }}</td>
                  </tr>
                  </tbody>
                </v-simple-table>
              </v-card-text>
            </v-card>
          </v-expansion-panel-content>
        </v-expansion-panel>

        <!-- 登出所有设备 -->
        <v-expansion-panel>
          <v-expansion-panel-header class="error--text">
            登出所有设备
          </v-expansion-panel-header>
          <v-expansion-panel-content>
            <v-card flat>
              <v-card-text>
                <v-alert class="mb-3" outlined type="warning">
                  警告：此操作将使所有设备上的会话失效，包括当前会话。
                </v-alert>
                <v-btn
                  :disabled="!isLogin"
                  :loading="logoutAllLoading"
                  color="error"
                  @click="confirmLogoutAllDevices"
                >
                  登出所有设备
                </v-btn>
              </v-card-text>
            </v-card>
          </v-expansion-panel-content>
        </v-expansion-panel>
      </v-expansion-panels>

      <!-- 响应数据 -->
      <v-card v-if="lastResponse" class="mt-4" outlined>
        <v-card-title class="subtitle-1">
          最近API响应
          <v-spacer></v-spacer>
          <v-btn icon small @click="lastResponse = null">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-card-text>
          <div class="d-flex align-center mb-2">
            <div class="font-weight-bold mr-2">状态:</div>
            <v-chip
              :color="getStatusColor(lastResponseStatus)"
              small
              text-color="white"
            >
              {{ lastResponseStatus }}
            </v-chip>
            <div class="ml-4 font-weight-bold mr-2">响应时间:</div>
            <span>{{ lastResponseTime }}ms</span>
          </div>
          <v-divider class="my-2"></v-divider>
          <div class="response-body pa-3">
            <pre>{{ formattedResponse }}</pre>
          </div>
        </v-card-text>
      </v-card>

      <!-- 确认对话框 -->
      <v-dialog v-model="confirmDialog" max-width="400">
        <v-card>
          <v-card-title>确认操作</v-card-title>
          <v-card-text>
            {{ confirmMessage }}
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="grey darken-1" text @click="confirmDialog = false">
              取消
            </v-btn>
            <v-btn color="error" text @click="confirmAction">
              确认
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-card>
  </div>
</template>

<script>
import {localuser} from '@/services/localAccount';
import request from '@/axios/axios';

export default {
  name: 'TokenDebugPage',

  data() {
    return {
      // Token状态
      isLogin: false,
      token: null,
      isTokenValid: false,
      isRefreshTokenValid: false,
      tokenExpiration: 0,

      // 自动刷新状态
      isAutoRefreshActive: false,
      autoRefreshStatus: null,
      checkingStatus: false,
      isAutoRefreshEnabled: localuser.AUTO_REFRESH_ENABLED,

      // 设备列表
      devicesData: null,
      devicesLoading: false,

      // 令牌列表
      tokensData: null,
      tokensLoading: false,
      includeLocation: true,

      // 令牌详情
      tokenDetail: null,
      tokenDetailLoading: false,

      // 操作加载状态
      refreshLoading: false,
      revokeLoading: null,
      logoutAllLoading: false,

      // 确认对话框
      confirmDialog: false,
      confirmMessage: '',
      pendingAction: null,
      pendingParams: null,

      // 响应数据
      lastResponse: null,
      lastResponseStatus: null,
      lastResponseTime: null
    };
  },

  computed: {
    formattedResponse() {
      if (!this.lastResponse) return '';
      try {
        return JSON.stringify(this.lastResponse, null, 2);
      } catch (e) {
        return String(this.lastResponse);
      }
    }
  },

  mounted() {
    this.refreshTokenState();
    this.checkAutoRefreshStatus();
  },

  methods: {
    // 刷新状态
    refreshTokenState() {
      this.isLogin = localuser.isLogin;
      this.token = localuser.getToken();
      this.isTokenValid = localuser.isTokenValid();
      this.isRefreshTokenValid = localuser.isRefreshTokenValid();
      this.tokenExpiration = localuser.getTokenExpirationTime();
      this.checkAutoRefreshStatus();
    },

    // 检查自动刷新状态
    checkAutoRefreshStatus() {
      this.isAutoRefreshActive = localuser.TokenRefreshScheduler
        ? localuser.TokenRefreshScheduler.isActive()
        : false;

      // 如果是初始状态，且自动刷新已启用，则尝试检查一次令牌状态
      if (!this.autoRefreshStatus && this.isLogin && this.isAutoRefreshEnabled) {
        this.checkTokenRefreshStatus();
      }
    },

    // 检查令牌刷新状态
    async checkTokenRefreshStatus() {
      this.checkingStatus = true;
      try {
        const startTime = Date.now();
        // 调用服务检查令牌状态
        const expirationTime = localuser.getTokenExpirationTime();
        const refreshNeeded = expirationTime <= 0 || expirationTime <= 5 * 60;

        this.lastResponseTime = Date.now() - startTime;

        this.autoRefreshStatus = {
          type: refreshNeeded ? 'warning' : 'success',
          message: refreshNeeded
            ? `令牌将在${this.formatTime(expirationTime)}后过期，需要刷新`
            : `令牌状态良好，还有${this.formatTime(expirationTime)}过期`
        };

        this.lastResponse = {
          token_expiration: expirationTime,
          refresh_needed: refreshNeeded,
          auto_refresh_active: this.isAutoRefreshActive
        };
        this.lastResponseStatus = 200;
      } catch (error) {
        this.handleError(error);
      } finally {
        this.checkingStatus = false;
      }
    },

    // 启动自动刷新
    async startAutoRefresh() {
      try {
        const startTime = Date.now();
        localuser.startTokenRefreshTimer();
        this.lastResponseTime = Date.now() - startTime;

        this.checkAutoRefreshStatus();
        this.autoRefreshStatus = {
          type: 'success',
          message: '令牌自动刷新已重新启用'
        };

        this.lastResponse = {
          status: "success",
          message: "自动刷新功能已重新启用",
          active: true
        };
        this.lastResponseStatus = 200;
      } catch (error) {
        this.handleError(error);
      }
    },

    // 停止自动刷新
    async stopAutoRefresh() {
      try {
        const startTime = Date.now();
        localuser.stopTokenRefreshTimer();
        this.lastResponseTime = Date.now() - startTime;

        this.checkAutoRefreshStatus();
        this.autoRefreshStatus = {
          type: 'warning',
          message: '令牌自动刷新已临时停用（刷新页面或重新登录后将自动恢复）'
        };

        this.lastResponse = {
          status: "success",
          message: "自动刷新功能已临时停用",
          active: false
        };
        this.lastResponseStatus = 200;
      } catch (error) {
        this.handleError(error);
      }
    },

    // 刷新令牌
    async refreshAccessToken() {
      this.refreshLoading = true;
      try {
        const startTime = Date.now();
        const success = await localuser.refreshAccessToken();
        this.lastResponseTime = Date.now() - startTime;

        this.lastResponse = {success, message: success ? '令牌刷新成功' : '令牌刷新失败'};
        this.lastResponseStatus = success ? 200 : 400;

        // 刷新状态
        this.refreshTokenState();
      } catch (error) {
        this.handleError(error);
      } finally {
        this.refreshLoading = false;
      }
    },

    // 获取设备列表
    async fetchDevicesList() {
      this.devicesLoading = true;
      try {
        const startTime = Date.now();
        const devices = await localuser.getDevices();
        this.lastResponseTime = Date.now() - startTime;

        this.devicesData = devices;
        this.lastResponse = {
          status: "success",
          data: devices
        };
        this.lastResponseStatus = 200;
      } catch (error) {
        this.handleError(error);
      } finally {
        this.devicesLoading = false;
      }
    },

    // 获取活跃令牌
    async fetchActiveTokens() {
      this.tokensLoading = true;
      try {
        const startTime = Date.now();
        const tokens = await localuser.getActiveTokens(this.includeLocation);
        this.lastResponseTime = Date.now() - startTime;

        this.tokensData = tokens;
        this.lastResponse = {
          status: "success",
          data: tokens
        };
        this.lastResponseStatus = 200;
      } catch (error) {
        this.handleError(error);
      } finally {
        this.tokensLoading = false;
      }
    },

    // 获取令牌详情
    async getTokenDetail(tokenId) {
      this.tokenDetailLoading = true;
      try {
        const startTime = Date.now();
        const details = await localuser.getTokenDetails(tokenId, this.includeLocation);
        this.lastResponseTime = Date.now() - startTime;

        this.tokenDetail = details;
        this.lastResponse = {
          status: "success",
          data: details
        };
        this.lastResponseStatus = 200;
      } catch (error) {
        this.handleError(error);
      } finally {
        this.tokenDetailLoading = false;
      }
    },

    // 撤销指定令牌
    async revokeSelectedToken(tokenId) {
      this.confirmMessage = `确定要撤销令牌 #${tokenId} 吗？`;
      this.pendingAction = this.doRevokeToken;
      this.pendingParams = tokenId;
      this.confirmDialog = true;
    },

    // 执行撤销令牌
    async doRevokeToken(tokenId) {
      this.revokeLoading = tokenId;
      try {
        const startTime = Date.now();
        const success = await localuser.revokeToken(tokenId);
        this.lastResponseTime = Date.now() - startTime;

        this.lastResponse = {
          status: success ? "success" : "error",
          message: success ? "令牌已成功撤销" : "撤销令牌失败"
        };
        this.lastResponseStatus = success ? 200 : 400;

        // 如果撤销成功，刷新令牌列表
        if (success) {
          await this.fetchActiveTokens();
          // 如果当前详情是被撤销的令牌，清除详情
          if (this.tokenDetail && this.tokenDetail.id === tokenId) {
            this.tokenDetail = null;
          }
        }
      } catch (error) {
        this.handleError(error);
      } finally {
        this.revokeLoading = null;
      }
    },

    // 确认登出所有设备
    confirmLogoutAllDevices() {
      this.confirmMessage = "确定要登出所有设备吗？此操作将使所有设备上的会话失效，包括当前会话。";
      this.pendingAction = this.doLogoutAllDevices;
      this.confirmDialog = true;
    },

    // 执行登出所有设备
    async doLogoutAllDevices() {
      this.logoutAllLoading = true;
      try {
        const startTime = Date.now();
        const success = await localuser.logoutAllDevices();
        this.lastResponseTime = Date.now() - startTime;

        this.lastResponse = {
          status: success ? "success" : "error",
          message: success ? "已成功登出所有设备" : "登出所有设备失败"
        };
        this.lastResponseStatus = success ? 200 : 400;

        // 刷新状态
        this.refreshTokenState();
      } catch (error) {
        this.handleError(error);
      } finally {
        this.logoutAllLoading = false;
      }
    },

    // 确认操作
    confirmAction() {
      this.confirmDialog = false;
      if (this.pendingAction) {
        this.pendingAction(this.pendingParams);
        this.pendingAction = null;
        this.pendingParams = null;
      }
    },

    // 处理错误
    handleError(error) {
      console.error("API Error:", error);
      this.lastResponse = {
        status: "error",
        message: error.message || "未知错误",
        error: error.toString()
      };
      this.lastResponseStatus = error.response?.status || 500;
    },

    // 格式化日期
    formatDate(dateString) {
      if (!dateString) return '未知';
      const date = new Date(dateString);
      return date.toLocaleString();
    },

    // 格式化时间
    formatTime(seconds) {
      if (seconds < 60) return `${seconds}秒`;
      if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
      return `${Math.floor(seconds / 3600)}小时${Math.floor((seconds % 3600) / 60)}分`;
    },

    // 格式化对象属性键名
    formatKey(key) {
      return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    },

    // 格式化对象属性值
    formatValue(key, value) {
      if (value === null || value === undefined) return '无';
      if (key.includes('time') || key.includes('date') || key.includes('at')) {
        return this.formatDate(value);
      }
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return value;
    },

    // 获取状态颜色
    getStatusColor(status) {
      if (!status) return 'grey';
      if (status >= 200 && status < 300) return 'success';
      if (status >= 300 && status < 400) return 'info';
      if (status >= 400 && status < 500) return 'warning';
      return 'error';
    }
  }
};
</script>

<style scoped>
.token-debug-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px;
}

.response-body {
  max-height: 500px;
  overflow: auto;
  background-color: #f5f5f5;
  border-radius: 4px;
}

pre {
  white-space: pre-wrap;
  word-break: break-word;
}

.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
