<template>
  <div class="oauth-binding">
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">mdi-link-variant</v-icon>
        <h5>已绑定</h5>
      </v-card-title>
      <v-card-text>
        <v-row>
          <v-col v-for="(account, index) in oauthAccounts"
                 :key="index"
                 cols="12" md="4" sm="6">
            <v-card class="oauth-account-card" elevation="2" @click="showAccountDetails(account)">
              <v-card-text>
                <div class="d-flex align-center mb-2">
                  <v-avatar :color="getProviderStyle(account.contact_type.replace('oauth_', '')).backgroundColor"
                            class="mr-3" size="40">
                    <v-icon :color="getProviderStyle(account.contact_type.replace('oauth_', '')).color">
                      {{ getProviderIcon(account.contact_type) }}
                    </v-icon>
                  </v-avatar>
                  <div>
                    <div class="text-h6">{{ getProviderName(account.contact_type) }}</div>
                    <div class="text-caption">ID: {{ account.contact_id }}</div>
                  </div>
                </div>
                <v-chip :color="account.verified ? 'success' : 'warning'" class="mr-2" small>
                  {{ account.verified ? '已验证' : '未验证' }}
                </v-chip>
                <v-chip :color="account.is_primary ? 'primary' : 'grey'" class="mr-2" small>
                  {{ account.is_primary ? '主账号' : '关联账号' }}
                </v-chip>
                <div class="mt-2 text-caption">
                  绑定时间: {{ formatDate(account.created_at) }}
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
        <v-alert v-if="message" :type="messageType" class="mt-4">{{ message }}</v-alert>
      </v-card-text>
    </v-card>

    <!-- 账号详细信息对话框 -->
    <v-dialog v-model="showDetailsDialog" max-width="500">
      <v-card>
        <v-card-title class="headline d-flex align-center">
          <v-avatar
            :color="getProviderStyle(selectedAccount?.contact_type?.replace('oauth_', '') || '').backgroundColor"
            class="mr-3" size="40">
            <v-icon :color="getProviderStyle(selectedAccount?.contact_type?.replace('oauth_', '') || '').color">
              {{ getProviderIcon(selectedAccount?.contact_type || '') }}
            </v-icon>
          </v-avatar>
          {{ selectedAccount ? getProviderName(selectedAccount.contact_type) : '' }} 账号详情
        </v-card-title>
        <v-card-text>
          <v-list dense>
            <v-list-item>
              <v-list-item-content>
                <v-list-item-subtitle class="text--primary mb-1">绑定 ID</v-list-item-subtitle>
                <v-list-item-title>{{ selectedAccount?.contact_id || '-' }}</v-list-item-title>
              </v-list-item-content>
            </v-list-item>

            <v-list-item v-if="selectedAccount?.metadata">
              <v-list-item-content>
                <v-list-item-subtitle class="text--primary mb-1">平台用户 ID</v-list-item-subtitle>
                <v-list-item-title>{{ selectedAccount.metadata.id || '-' }}</v-list-item-title>
              </v-list-item-content>
            </v-list-item>

            <v-list-item v-if="selectedAccount?.metadata">
              <v-list-item-content>
                <v-list-item-subtitle class="text--primary mb-1">用户名</v-list-item-subtitle>
                <v-list-item-title>{{ selectedAccount.metadata.name || '-' }}</v-list-item-title>
              </v-list-item-content>
            </v-list-item>

            <v-list-item v-if="selectedAccount?.metadata">
              <v-list-item-content>
                <v-list-item-subtitle class="text--primary mb-1">邮箱</v-list-item-subtitle>
                <v-list-item-title>{{ selectedAccount.metadata.email || '-' }}</v-list-item-title>
              </v-list-item-content>
            </v-list-item>

            <v-list-item>
              <v-list-item-content>
                <v-list-item-subtitle class="text--primary mb-1">验证状态</v-list-item-subtitle>
                <v-list-item-title>
                  <v-chip :color="selectedAccount?.verified ? 'success' : 'warning'" small>
                    {{ selectedAccount?.verified ? '已验证' : '未验证' }}
                  </v-chip>
                </v-list-item-title>
              </v-list-item-content>
            </v-list-item>

            <v-list-item>
              <v-list-item-content>
                <v-list-item-subtitle class="text--primary mb-1">账号类型</v-list-item-subtitle>
                <v-list-item-title>
                  <v-chip :color="selectedAccount?.is_primary ? 'primary' : 'grey'" small>
                    {{ selectedAccount?.is_primary ? '主账号' : '关联账号' }}
                  </v-chip>
                </v-list-item-title>
              </v-list-item-content>
            </v-list-item>

            <v-list-item>
              <v-list-item-content>
                <v-list-item-subtitle class="text--primary mb-1">绑定时间</v-list-item-subtitle>
                <v-list-item-title>{{ selectedAccount ? formatDate(selectedAccount.created_at) : '-' }}
                </v-list-item-title>
              </v-list-item-content>
            </v-list-item>

            <v-list-item>
              <v-list-item-content>
                <v-list-item-subtitle class="text--primary mb-1">最后更新</v-list-item-subtitle>
                <v-list-item-title>{{ selectedAccount ? formatDate(selectedAccount.updated_at) : '-' }}
                </v-list-item-title>
              </v-list-item-content>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text @click="showDetailsDialog = false">关闭</v-btn>
          <v-btn
            :disabled="!selectedAccount"
            color="error"
            text
            @click="prepareUnlink"
          >
            <v-icon left>mdi-link-variant-off</v-icon>
            解除绑定
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 解绑确认对话框 -->
    <v-dialog v-model="showUnlinkDialog" max-width="500">
      <v-card>
        <v-card-title class="headline">
          <v-icon color="warning" left>mdi-alert</v-icon>
          确认解除绑定
        </v-card-title>
        <v-card-text>
          <p class="mb-2">您确定要解除以下 OAuth 账号的绑定吗？</p>
          <v-alert dense text type="warning">
            <strong>提供商：</strong>{{ selectedAccount ? getProviderName(selectedAccount.contact_type) : '' }}<br>
            <strong>绑定 ID：</strong>{{ selectedAccount?.contact_id || '-' }}<br>
            <template v-if="selectedAccount?.metadata">
              <strong>用户名：</strong>{{ selectedAccount.metadata.name || '-' }}<br>
              <strong>平台邮箱：</strong>{{ selectedAccount.metadata.email || '-' }}
            </template>
          </v-alert>
          <p class="mt-2 text-caption">解除绑定后，您需要重新进行身份验证才能重新绑定此账号。</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text @click="showUnlinkDialog = false">取消</v-btn>
          <v-btn :loading="unlinking" color="error" @click="unlinkOAuth">
            <v-icon left>mdi-link-variant-off</v-icon>
            确认解除绑定
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 可绑定的 OAuth 提供商 -->
    <v-card class="mt-4" border>
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">mdi-link-plus</v-icon>
        <h5>可绑定</h5>
      </v-card-title>
      <v-card-text>
        <v-row class="mt-2">
          <v-col v-for="(provider, index) in filteredProviders"
                 :key="index"
                 cols="12" md="4" sm="6">
            <v-btn
              :style="getProviderStyle(provider.id)"
              block
              class="text-none"
              height="50"
              @click="bindProvider(provider.id)"
            >
              <v-icon left>{{ getProviderIcon(provider.id) }}</v-icon>
              绑定 {{ provider.name }}
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
import {ref, onMounted, computed} from 'vue';
import axios from '@/axios/axios';
import {localuser} from '@/services/localAccount';
import VerifyEmail from '@/components/verifyEmail.vue';
import oauthProviders from '@/constants/oauth_providers.json';
import { useSudoManager } from '@/composables/useSudoManager';

const sudoManager = useSudoManager();
const oauthAccounts = ref([]);
const message = ref('');
const messageType = ref('info');
const showVerifyDialog = ref(false);
const showUnlinkDialog = ref(false);
const primaryEmail = ref('');
const selectedAccount = ref(null);
const availableProviders = ref([]);
const BASE_API = import.meta.env.VITE_APP_BASE_API;
const showDetailsDialog = ref(false);
const unlinking = ref(false);

const getProviderIcon = (providerId) => {
  const id = providerId.replace('oauth_', '').toLowerCase();
  return oauthProviders[id]?.icon || oauthProviders.default.icon;
};

const getProviderName = (providerId) => {
  const id = providerId.replace('oauth_', '').toLowerCase();
  return oauthProviders[id]?.name || id.charAt(0).toUpperCase() + id.slice(1);
};

const getProviderStyle = (providerId) => {
  return oauthProviders[providerId]?.style || oauthProviders.default.style;
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const fetchOAuthAccounts = async () => {
  try {
    const response = await axios.post('/account/oauth/bound', {userid: localuser.user.value.id});
    if (response.data.status === 'success') {
      oauthAccounts.value = response.data.data;
    } else {
      message.value = response.data.message;
      messageType.value = 'error';
    }
  } catch (error) {
    message.value = error.response?.data?.message || '获取绑定的 OAuth 账号失败';
    messageType.value = 'error';
  }
};

const fetchUserEmails = async () => {
  try {
    const response = await axios.get('/account/emails');
    if (response.data.status === 'success') {
      const emails = response.data.data;
      const primary = emails.find(email => email.is_primary);
      if (primary) {
        primaryEmail.value = primary.contact_value;
      }
    } else {
      message.value = response.data.message;
      messageType.value = 'error';
    }
  } catch (error) {
    message.value = error.response?.data?.message || '获取邮箱列表失败';
    messageType.value = 'error';
  }
};

const fetchAvailableProviders = async () => {
  try {
    const response = await axios.get('/account/oauth/providers');
    if (response.data.status === 'success') {
      availableProviders.value = response.data.data;
    } else {
      message.value = response.data.message;
      messageType.value = 'error';
    }
  } catch (error) {
    message.value = error.response?.data?.message || '获取可绑定的 OAuth 提供商失败';
    messageType.value = 'error';
  }
};

const showAccountDetails = (account) => {
  selectedAccount.value = account;
  showDetailsDialog.value = true;
};

const prepareUnlink = () => {
  showDetailsDialog.value = false;
  showUnlinkDialog.value = true;
};

const unlinkOAuth = async () => {
  if (!selectedAccount.value) return;

  unlinking.value = true;
  try {
    const sudoToken = await sudoManager.requireSudo({
      title: '解绑 OAuth 账号',
      subtitle: `您正在尝试解绑 ${getProviderName(selectedAccount.value.contact_type)} 账号。此操作需要验证您的身份。`,
      persistent: true
    });

    const response = await axios.post('/account/unlink-oauth', {
      provider: selectedAccount.value.contact_type
    }, {
      headers: {
        'X-Sudo-Token': sudoToken
      }
    });

    if (response.data.status === 'success') {
      message.value = '成功解绑 OAuth 账号';
      messageType.value = 'success';
      fetchOAuthAccounts();
      showUnlinkDialog.value = false;
    } else {
      message.value = response.data.message || '解绑失败';
      messageType.value = 'error';
    }
  } catch (error) {
    if (error.type !== 'cancel') {
      message.value = error.response?.data?.message || '解绑 OAuth 账号失败';
      messageType.value = 'error';
    }
  } finally {
    unlinking.value = false;
    selectedAccount.value = null;
  }
};

const bindProvider = (providerId) => {
  window.location.href = `${BASE_API}/account/oauth/bind/${providerId}?token=${localuser.getToken()}`;
};

const filteredProviders = computed(() => {
  // 获取已绑定的提供商类型列表，移除 oauth_ 前缀
  const boundProviders = oauthAccounts.value.map(account =>
    account.contact_type.toLowerCase().replace('oauth_', '')
  );
  // 过滤掉已绑定的提供商
  return availableProviders.value.filter(provider =>
    !boundProviders.includes(provider.id.toLowerCase())
  );
});

onMounted(() => {
  fetchOAuthAccounts();
  fetchUserEmails();
  fetchAvailableProviders();
});
</script>

<style scoped>
.oauth-account-card {
  transition: all 0.3s ease;
  cursor: pointer;
}

.oauth-account-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1) !important;
}
</style>
