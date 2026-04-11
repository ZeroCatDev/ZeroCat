<template>
  <div>
    <v-card class="mb-6" border>
      <v-card-title class="text-h6">账户安全</v-card-title>
      <v-card-text>
        <div class="d-flex flex-wrap align-center ga-3">
          <v-chip :color="twoFA.enabled ? 'success' : 'warning'" variant="tonal" prepend-icon="mdi-shield-key">
            2FA：{{ twoFA.enabled ? '已启用' : '未启用' }}
          </v-chip>
          <v-chip :color="passkeySupported ? 'primary' : 'grey'" variant="tonal" prepend-icon="mdi-fingerprint">
            Passkey：{{ passkeySupported ? '受支持' : '不支持' }}
          </v-chip>
        </div>
        <div class="mt-4 d-flex ga-3">
          <v-btn color="primary" variant="flat" @click="handleTwoFASetup" :loading="twoFALoading" v-if="!twoFA.enabled">
            启用 2FA
          </v-btn>
          <v-btn color="error" variant="text" @click="disableTwoFA" :loading="twoFALoading" v-if="twoFA.enabled">
            禁用 2FA
          </v-btn>
          <v-btn color="secondary" variant="tonal" :disabled="!passkeySupported" @click="registerPasskey" :loading="passkeyLoading">
            注册 Passkey
          </v-btn>
          <v-btn color="secondary" variant="tonal" @click="showOsRemovalDialog = true">
            如何删除 Passkey
          </v-btn>
        </div>
        <div v-if="twoFA.qr" class="mt-4">
          <v-img :src="twoFA.qr" max-width="220" class="mx-auto" />
          <div class="text-caption text-center mt-2">使用认证器App扫描二维码，然后点击下方按钮输入验证码完成启用</div>
          <div class="d-flex justify-center mt-3">
            <v-btn color="primary" variant="flat" @click="showTotpDialog = true" :loading="twoFALoading">输入验证码并完成</v-btn>
          </div>
        </div>

        <v-divider class="my-6" />

        <div>
          <h4 class="text-h6 mb-3">已注册的 Passkey</h4>
          <v-alert v-if="!isLoadingPasskeys && passkeys.length === 0" type="info" variant="tonal" text="还没有注册任何 Passkey"></v-alert>
          <v-data-table
            v-else
            :headers="passkeyHeaders"
            :items="passkeys"
            :loading="isLoadingPasskeys"
            class="elevation-1 rounded-lg"
            loading-text="加载 Passkey 列表..."
            no-data-text="没有找到 Passkey"
          >
            <template v-slot:item.credential_id="{ item }">
              <code class="text-caption">{{ truncateId(item.credential_id) }}</code>
            </template>
            <template v-slot:item.transports="{ item }">
              <div class="d-flex ga-1 flex-wrap">
                <v-chip
                  v-for="t in (item.transports || [])"
                  :key="t"
                  size="small"
                  variant="tonal"
                  color="primary"
                  :text="t"
                />
              </div>
            </template>
            <template v-slot:item.counter="{ item }">
              {{ item.counter ?? 0 }}
            </template>
            <template v-slot:item.registered_at="{ item }">
              {{ formatRegisteredAt(item.registered_at) }}
            </template>
            <template v-slot:item.actions="{ item }">
              <v-btn
                color="error"
                variant="text"
                size="small"
                :loading="deletingId === item.credential_id"
                @click="confirmDeletePasskey(item.credential_id)"
              >
                删除
              </v-btn>
            </template>
          </v-data-table>
        </div>
      </v-card-text>
    </v-card>
    <div class="mb-6">
      <h4 class="text-h6 mb-3">登录设备</h4>
      <v-alert v-if="activeTokens.length === 0 && !isLoadingTokens" class="mb-3" text="没有活跃的会话"
               type="info"></v-alert>
      <v-data-table
        v-else
        :headers="tokenHeaders"
        :items="activeTokens"
        :loading="isLoadingTokens"
        class="elevation-1 rounded-lg"
        loading-text="加载会话列表..."
        no-data-text="没有找到活跃会话"
      >
        <template v-slot:item.created_at="{ item }">
          {{ formatDate(item.created_at) }}
        </template>

        <template v-slot:item.device_info="{ item }">
          <div class="d-flex align-center">

            {{ item.device_info?.os || '未知' }} ({{ item.device_info?.browser || '未知' }})
            <v-chip
              v-if="item.is_current"
              color="success"
              size="small"
              text="当前"
            ></v-chip>
          </div>
        </template>
        <template v-slot:item.ip_address="{ item }">
          {{ item.ip_address }}
        </template>
        <template v-slot:item.ip_location="{ item }">
          <span v-if="item.ip_location">
            {{ formatIpLocation(item.ip_location) }}
          </span>
          <span v-else>-</span>
        </template>
        <template v-slot:item.activity_count="{ item }">
          <v-chip
            :color="getActivityColor(item.activity_count)"
            :text="getActivityText(item.activity_count)"
            size="small"
          ></v-chip>
        </template>

        <template v-slot:item.actions="{ item }">
          <v-btn
            :disabled="isLoadingTokens || isPerformingAction"
            :loading="loadingTokenId === item.id"
            color="error"
            size="small"
            variant="text"
            @click="handleRevokeToken(item.id)"
          >
            <v-icon>mdi-logout</v-icon>
            结束会话
          </v-btn>
        </template>
      </v-data-table>
    </div>

    <div class="d-flex gap-4 mt-6">
      <v-btn
        :disabled="isPerformingAction || isLoadingTokens"
        :loading="isLoggingOutAll"
        color="error"
        prepend-icon="mdi-logout-variant"
        @click="confirmLogoutAll"
      >
        退出所有会话
      </v-btn>
    </div>

    <!-- 确认对话框 -->
    <v-dialog v-model="showConfirmDialog" max-width="500">
      <v-card>
        <v-card-title class="text-h5">{{ confirmDialogTitle }}</v-card-title>
        <v-card-text>{{ confirmDialogText }}</v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" variant="text" @click="showConfirmDialog = false">取消</v-btn>
          <v-btn color="error" variant="flat" @click="executeConfirmedAction">确认</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- OS passkey removal hint dialog -->
    <v-dialog v-model="showOsRemovalDialog" max-width="720">
      <v-card>
        <v-card-title class="text-h6">同时在本机移除 Passkey（可选）</v-card-title>
        <v-card-text>
          <div class="mb-3">您已从账户中删除该 Passkey。为了确保本机不再保留该凭据，请按您的设备系统到设置中删除本地 Passkey：</div>
          <v-expansion-panels multiple v-model="defaultOsPanel">
            <v-expansion-panel>
              <v-expansion-panel-title prepend-icon="mdi-microsoft-windows">Windows 10/11</v-expansion-panel-title>
              <v-expansion-panel-text>
                <ul>
                  <li>打开 设置 → 账户 → 登录选项 → Passkeys</li>
                  <li>或 控制面板 → 凭据管理器 → Web 凭据，找到相关网站的 WebAuthn 凭据并删除</li>
                  <li>Chrome 浏览器：在地址栏输入 <a href="chrome://settings/passkeys" target="_blank" rel="noopener">chrome://settings/passkeys</a></li>
                </ul>
              </v-expansion-panel-text>
            </v-expansion-panel>
            <v-expansion-panel>
              <v-expansion-panel-title prepend-icon="mdi-apple">macOS</v-expansion-panel-title>
              <v-expansion-panel-text>
                <ul>
                  <li>系统设置 → 密码 → 找到对应网站条目 → 删除 Passkey</li>
                  <li>或 Safari → 偏好设置 → 密码</li>
                </ul>
              </v-expansion-panel-text>
            </v-expansion-panel>
            <v-expansion-panel>
              <v-expansion-panel-title prepend-icon="mdi-apple-ios">iOS / iPadOS</v-expansion-panel-title>
              <v-expansion-panel-text>
                <ul>
                  <li>设置 → 密码 → 搜索对应网站 → 删除 Passkey</li>
                </ul>
              </v-expansion-panel-text>
            </v-expansion-panel>
            <v-expansion-panel>
              <v-expansion-panel-title prepend-icon="mdi-android">Android</v-expansion-panel-title>
              <v-expansion-panel-text>
                <ul>
                  <li>设置 → Google → 密码管理器 → Passkeys</li>
                  <li>或 Chrome 浏览器地址栏输入 <a href="chrome://settings/passkeys" target="_blank" rel="noopener">chrome://settings/passkeys</a></li>
                </ul>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
          <v-alert class="mt-4" type="info" variant="tonal" text="若在其它设备也注册过该 Passkey，请在那些设备上重复上述步骤。" />
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" variant="flat" @click="showOsRemovalDialog = false">我已了解</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div><!-- existing template above -->
  <TotpDialog
    v-model="showTotpDialog"
    title="输入 TOTP 验证码"
    subtitle="请在认证器中查看 6 位验证码"
    :loading="twoFALoading"
    :error-message="twoFAError"
    @confirm="handleTotpConfirm"
  />
  <!-- OS passkey removal hint dialog -->
  <v-dialog v-model="showOsRemovalDialog" max-width="720">
    <v-card>
      <v-card-title class="text-h6">同时在本机移除 Passkey（可选）</v-card-title>
      <v-card-text>
        <div class="mb-3">您已从账户中删除该 Passkey。为了确保本机不再保留该凭据，请按您的设备系统到设置中删除本地 Passkey：</div>
        <v-expansion-panels multiple v-model="defaultOsPanel">
          <v-expansion-panel>
            <v-expansion-panel-title prepend-icon="mdi-microsoft-windows">Windows 10/11</v-expansion-panel-title>
            <v-expansion-panel-text>
              <ul>
                <li>打开 设置 → 账户 → 登录选项 → Passkeys</li>
                <li>或 控制面板 → 凭据管理器 → Web 凭据，找到相关网站的 WebAuthn 凭据并删除</li>
                <li>Edge 浏览器：在地址栏输入 <a href="edge://settings/passkeys" target="_blank" rel="noopener">edge://settings/passkeys</a></li>
              </ul>
            </v-expansion-panel-text>
          </v-expansion-panel>
          <v-expansion-panel>
            <v-expansion-panel-title prepend-icon="mdi-apple">macOS</v-expansion-panel-title>
            <v-expansion-panel-text>
              <ul>
                <li>系统设置 → 密码 → 找到对应网站条目 → 删除 Passkey</li>
                <li>或 Safari → 偏好设置 → 密码</li>
              </ul>
            </v-expansion-panel-text>
          </v-expansion-panel>
          <v-expansion-panel>
            <v-expansion-panel-title prepend-icon="mdi-apple-ios">iOS / iPadOS</v-expansion-panel-title>
            <v-expansion-panel-text>
              <ul>
                <li>设置 → 密码 → 搜索对应网站 → 删除 Passkey</li>
              </ul>
            </v-expansion-panel-text>
          </v-expansion-panel>
          <v-expansion-panel>
            <v-expansion-panel-title prepend-icon="mdi-android">Android</v-expansion-panel-title>
            <v-expansion-panel-text>
              <ul>
                <li>设置 → Google → 密码管理器 → Passkeys</li>
                <li>或 Chrome 浏览器地址栏输入 <a href="chrome://settings/passkeys" target="_blank" rel="noopener">chrome://settings/passkeys</a></li>
              </ul>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
        <v-alert class="mt-4" type="info" variant="tonal" text="若在其它设备也注册过该 Passkey，请在那些设备上重复上述步骤。" />
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="primary" variant="flat" @click="showOsRemovalDialog = false">我已了解</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
 </template>

 <script>
import {localuser} from '@/services/localAccount';
import {formatDistance, format} from 'date-fns';
import {zhCN} from 'date-fns/locale';
import TwoFAService from '@/services/twofaService';
import PasskeyService from '@/services/passkeyService';
import { useSudoManager } from '@/composables/useSudoManager';
import { transformRegistrationOptions, publicKeyCredentialToJSON } from '@/services/webauthn';
import QRCode from 'qrcode';
import TotpDialog from '@/components/TotpDialog.vue';

export default {
  name: 'SecurityManager',
  components: { TotpDialog },
  data() {
    return {
      twoFA: { enabled: false, qr: '', token: '' },
      twoFALoading: false,
      twoFAError: '',
      showTotpDialog: false,
      passkeyLoading: false,
      passkeySupported: !!(window.PublicKeyCredential),
      activeTokens: [],
      isLoadingTokens: false,
      isLoggingOutAll: false,
      loadingTokenId: null,
      isPerformingAction: false,
      showConfirmDialog: false,
      confirmDialogTitle: '',
      confirmDialogText: '',
      confirmedAction: null,
      // OS passkey removal hint dialog
      showOsRemovalDialog: false,
      defaultOsPanel: [],
      tokenHeaders: [
        {title: '创建时间', key: 'created_at', sortable: true},
        {title: '设备信息', key: 'device_info', sortable: false},
        {title: 'IP地址', key: 'ip_address', sortable: true},
        {title: 'IP属地', key: 'ip_location', sortable: true},
        {title: '操作', key: 'actions', sortable: false},
      ],

      // Passkeys
      passkeys: [],
      passkeyHeaders: [
        { title: 'Credential ID', key: 'credential_id' },
        { title: 'Transports', key: 'transports' },
        { title: 'Counter', key: 'counter' },
        { title: '注册时间', key: 'registered_at' },
        { title: '操作', key: 'actions', sortable: false },
      ],
      isLoadingPasskeys: false,
      deletingId: null,
    };
  },
  setup() {
    const sudoManager = useSudoManager();
    return { sudoManager };
  },
  mounted() {
    this.loadData();
    this.loadTwoFAStatus();
    this.loadPasskeys();
    // determine default OS panel for hint dialog
    this.defaultOsPanel = [this.mapOsToPanel(this.detectOs())].filter(i => i !== null);
  },
  methods: {
    async loadTwoFAStatus() {
      try {
        const res = await TwoFAService.getStatus();
        if (res.status === 'success') {
          this.twoFA.enabled = !!res.data?.enabled;
        }
      } catch (e) {}
    },

    async handleTwoFASetup() {
      this.twoFALoading = true;
      try {
        const sudoToken = await this.sudoManager.requireSudo({
          title: '启用 2FA',
          subtitle: '为保障账户安全，请验证您的身份',
          persistent: true,
        });
        const res = await TwoFAService.setup(sudoToken);
        if (res.status === 'success') {
          const { otpauth_url } = res.data;
          this.twoFA.qr = await QRCode.toDataURL(otpauth_url);
        } else {
          this.$toast.add({ severity: 'error', summary: '错误', detail: res.message, life: 3000 });
        }
      } catch (e) {
        if (e?.type !== 'cancel') {
          this.$toast.add({ severity: 'error', summary: '错误', detail: e.message, life: 3000 });
        }
      } finally {
        this.twoFALoading = false;
      }
    },

    async activateTwoFA() {
      if (!this.twoFA.token) return;
      this.twoFALoading = true;
      try {
        const sudoToken = await this.sudoManager.requireSudo({
          title: '启用 2FA',
          subtitle: '为保障账户安全，请再次验证您的身份',
          persistent: true,
        });
        const res = await TwoFAService.activate(this.twoFA.token, sudoToken);
        if (res.status === 'success') {
          this.twoFA.qr = '';
          this.twoFA.token = '';
          this.twoFA.enabled = true;
          this.$toast.add({ severity: 'success', summary: '成功', detail: '2FA 已启用', life: 3000 });
        } else {
          this.$toast.add({ severity: 'error', summary: '错误', detail: res.message, life: 3000 });
        }
      } catch (e) {
        if (e?.type !== 'cancel') {
          this.$toast.add({ severity: 'error', summary: '错误', detail: e.message, life: 3000 });
        }
      } finally {
        this.twoFALoading = false;
      }
    },

    async handleTotpConfirm(token) {
      if (!token) return;
      this.twoFAError = '';
      this.twoFA.token = token;
      await this.activateTwoFA();
    },

    async disableTwoFA() {
      this.twoFALoading = true;
      try {
        const sudoToken = await this.sudoManager.requireSudo({
          title: '禁用 2FA',
          subtitle: '这是敏感操作，请验证您的身份',
          persistent: true,
        });
        const res = await TwoFAService.disable(sudoToken);
        if (res.status === 'success') {
          this.twoFA.enabled = false;
          this.$toast.add({ severity: 'success', summary: '成功', detail: '2FA 已禁用', life: 3000 });
        } else {
          this.$toast.add({ severity: 'error', summary: '错误', detail: res.message, life: 3000 });
        }
      } catch (e) {
        if (e?.type !== 'cancel') {
          this.$toast.add({ severity: 'error', summary: '错误', detail: e.message, life: 3000 });
        }
      } finally {
        this.twoFALoading = false;
      }
    },

    async registerPasskey() {
      this.passkeyLoading = true;
      try {
        const sudoToken = await this.sudoManager.requireSudo({
          title: '注册 Passkey',
          subtitle: '为保障账户安全，请验证您的身份',
          persistent: true,
        });
        const begin = await PasskeyService.beginRegistration(sudoToken);
        if (begin.status !== 'success') {
          this.$toast.add({ severity: 'error', summary: '错误', detail: begin.message, life: 3000 });
          return;
        }
        const options = transformRegistrationOptions(begin.data);
        const cred = await navigator.credentials.create(options);
        const attestation = publicKeyCredentialToJSON(cred);
        const finish = await PasskeyService.finishRegistration(attestation, sudoToken);
        if (finish.status === 'success') {
          this.$toast.add({ severity: 'success', summary: '成功', detail: 'Passkey 已注册', life: 3000 });
          await this.loadPasskeys();
        } else {
          this.$toast.add({ severity: 'error', summary: '错误', detail: finish.message, life: 3000 });
        }
      } catch (e) {
        if (e?.type !== 'cancel') {
          this.$toast.add({ severity: 'error', summary: '错误', detail: e.message, life: 3000 });
        }
      } finally {
        this.passkeyLoading = false;
      }
    },
    async loadPasskeys() {
      this.isLoadingPasskeys = true;
      try {
        const res = await PasskeyService.list();
        if (res?.status === 'success' && Array.isArray(res.data)) {
          this.passkeys = res.data;
        } else {
          this.passkeys = [];
        }
      } catch (e) {
        this.$toast.add({ severity: 'error', summary: '错误', detail: e.message || '加载 Passkey 失败', life: 3000 });
      } finally {
        this.isLoadingPasskeys = false;
      }
    },
    truncateId(id) {
      if (!id) return '-';
      if (id.length <= 16) return id;
      return `${id.slice(0, 8)}...${id.slice(-6)}`;
    },
    formatRegisteredAt(ts) {
      if (!ts) return '-';
      try {
        const date = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
        return format(date, 'yyyy-MM-dd HH:mm:ss');
      } catch (e) {
        return '-';
      }
    },
    async confirmDeletePasskey(credentialId) {
      this.confirmDialogTitle = '确认删除 Passkey';
      this.confirmDialogText = '删除后该凭据将无法用于登录。确定要继续吗？';
      this.confirmedAction = () => this.deletePasskey(credentialId);
      this.showConfirmDialog = true;
    },
    async deletePasskey(credentialId) {
      if (!credentialId) return;
      this.deletingId = credentialId;
      try {
        const sudoToken = await this.sudoManager.requireSudo({
          title: '删除 Passkey',
          subtitle: '为保障账户安全，请验证您的身份',
          persistent: true,
        });
        const res = await PasskeyService.deleteCredential(credentialId, sudoToken);
        if (res?.status === 'success') {
          this.$toast.add({ severity: 'success', summary: '成功', detail: 'Passkey 已删除', life: 3000 });
          await this.loadPasskeys();
          // After server-side removal, suggest removing local device passkey
          this.defaultOsPanel = [this.mapOsToPanel(this.detectOs())].filter(i => i !== null);
          this.showOsRemovalDialog = true;
        } else {
          this.$toast.add({ severity: 'error', summary: '错误', detail: res?.message || '删除失败', life: 3000 });
        }
      } catch (e) {
        if (e?.type !== 'cancel') {
          this.$toast.add({ severity: 'error', summary: '错误', detail: e.message || '删除失败', life: 3000 });
        }
      } finally {
        this.deletingId = null;
      }
    },
    detectOs() {
      const ua = navigator.userAgent || navigator.vendor || (window && window.opera) || '';
      const platform = navigator.platform || '';
      if (/windows/i.test(ua)) return 'windows';
      if (/macintosh|mac os x/i.test(ua)) return 'macos';
      if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
      if (/android/i.test(ua)) return 'android';
      return 'other';
    },
    mapOsToPanel(os) {
      switch (os) {
        case 'windows': return 0;
        case 'macos': return 1;
        case 'ios': return 2;
        case 'android': return 3;
        default: return null;
      }
    },
    async loadData() {
      await this.loadActiveTokens();
    },
    async loadActiveTokens() {
      this.isLoadingTokens = true;
      try {
        this.activeTokens = await localuser.getActiveTokens();
      } catch (error) {
        console.error('获取会话列表失败:', error);
        this.$toast.add({
          severity: 'error',
          summary: '错误',
          detail: '获取会话列表失败',
          life: 3000,
        });
      } finally {
        this.isLoadingTokens = false;
      }
    },

    getActivityColor(count) {
      if (!count) return 'grey';
      if (count < 5) return 'info';
      if (count < 20) return 'primary';
      if (count < 50) return 'success';
      return 'purple';
    },

    formatIpLocation(ipLocation) {
      if (!ipLocation) return '-';

      // 如果ipLocation是字符串，尝试解析它
      let locationData = ipLocation;
      if (typeof ipLocation === 'string') {
        try {
          locationData = JSON.parse(ipLocation);
        } catch (e) {
          return ipLocation; // 如果解析失败，直接返回原始字符串
        }
      }

      let location = locationData.address;

      return location || '-';
    },
    formatDate(dateString) {
      if (!dateString) return '-';
      const date = new Date(dateString);
      const now = new Date();

      // 如果是当天的日期，使用"x小时前"的格式
      const formattedDate = formatDistance(date, now, {
        addSuffix: true,
        locale: zhCN,
      });

      // 添加具体日期时间的提示
      const fullDate = format(date, 'yyyy-MM-dd HH:mm:ss');

      return `${formattedDate} (${fullDate})`;
    },
    async handleRevokeToken(tokenId) {
      this.loadingTokenId = tokenId;
      this.isPerformingAction = true;

      try {
        const success = await localuser.revokeToken(tokenId);
        if (success) {
          this.$toast.add({
            severity: 'success',
            summary: '成功',
            detail: '会话已成功结束',
            life: 3000,
          });
          await this.loadActiveTokens();
        } else {
          this.$toast.add({
            severity: 'error',
            summary: '错误',
            detail: '会话结束失败',
            life: 3000,
          });
        }
      } catch (error) {
        console.error('会话结束失败:', error);
        this.$toast.add({
          severity: 'error',
          summary: '错误',
          detail: '会话结束失败',
          life: 3000,
        });
      } finally {
        this.loadingTokenId = null;
        this.isPerformingAction = false;
      }
    },
    confirmLogoutAll() {
      this.confirmDialogTitle = '确认退出所有会话';
      this.confirmDialogText = '这将使所有会话立即失效，包括当前会话。您需要重新登录才能继续使用。确定要执行此操作吗？';
      this.confirmedAction = this.logoutAllSessions;
      this.showConfirmDialog = true;
    },
    async logoutAllSessions() {
      this.isLoggingOutAll = true;

      try {
        const success = await localuser.logoutAllDevices(); // 后端端点名称未更改，但概念上是会话
        if (success) {
          this.$toast.add({
            severity: 'success',
            summary: '成功',
            detail: '已成功退出所有会话',
            life: 3000,
          });
          // 重定向到登录页面
          this.$router.push('/app/account/login');
        } else {
          this.$toast.add({
            severity: 'error',
            summary: '错误',
            detail: '退出所有会话失败',
            life: 3000,
          });
        }
      } catch (error) {
        console.error('退出所有会话失败:', error);
        this.$toast.add({
          severity: 'error',
          summary: '错误',
          detail: '退出所有会话失败',
          life: 3000,
        });
      } finally {
        this.isLoggingOutAll = false;
      }
    },
    executeConfirmedAction() {
      if (typeof this.confirmedAction === 'function') {
        this.confirmedAction();
      }
      this.showConfirmDialog = false;
    },
  },
};
</script>
