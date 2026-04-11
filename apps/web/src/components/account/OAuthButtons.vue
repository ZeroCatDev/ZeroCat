<template>
  <div>
    <v-divider v-if="showDivider" class="my-4">
      <span class="text-body-2 text-medium-emphasis">{{ dividerText }}</span>
    </v-divider>

    <div v-if="isLoading" class="d-flex justify-center my-4">
      <v-progress-linear color="primary" indeterminate></v-progress-linear>
    </div>

    <div v-else class="d-flex flex-wrap gap-2 justify-start mt-4">
      <v-btn
        v-for="provider in enabledProviders"
        :key="provider.id"
        :loading="loadingProvider === provider.id"
        :prepend-icon="getProviderIcon(provider.id)"
        :style="getProviderStyle(provider.id)"
        class="text-none mr-1 mb-1"
        variant="flat"
        @click="handleOAuthClick(provider.id)"
      >
        {{ provider.name }}
      </v-btn>
    </div>
  </div>
</template>

<script setup>
import {ref, onMounted} from 'vue';
import axios from '@/axios/axios';
import oauthProviders from '@/constants/oauth_providers.json';
import AuthService from '@/services/authService';

const props = defineProps({
  mode: {
    type: String,
    default: 'login', // 'login' or 'register'
    validator: (value) => ['login', 'register'].includes(value)
  },
  showDivider: {
    type: Boolean,
    default: true
  },
  dividerText: {
    type: String,
    default: '或使用以下方式登录/注册'
  }
});

const enabledProviders = ref([]);
const isLoading = ref(true);
const loadingProvider = ref(null);

const getProviderStyle = (providerId) => {
  const config = oauthProviders[providerId.toLowerCase()];
  return config?.style || oauthProviders.default.style;
};

const getProviderIcon = (providerId) => {
  const config = oauthProviders[providerId.toLowerCase()];
  return config?.icon || oauthProviders.default.icon;
};

const fetchAvailableProviders = async () => {
  isLoading.value = true;
  try {
    const response = await axios.get('/account/oauth/providers');
    if (response.data.status === 'success') {
      enabledProviders.value = response.data.data;
    }
  } catch (error) {
    console.error('Failed to fetch available OAuth providers:', error);
  } finally {
    isLoading.value = false;
  }
};

const handleOAuthClick = async (providerId) => {
  loadingProvider.value = providerId;
  try {
    window.location.href = AuthService.oauthRedirect(providerId, props.mode === 'register');
  } catch (error) {
    console.error('Failed to redirect to OAuth provider:', error);
    loadingProvider.value = null;
  }
};

onMounted(() => {
  fetchAvailableProviders();
});
</script>

<style scoped>
.v-divider {
  margin: 24px 0;
  border-color: rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
