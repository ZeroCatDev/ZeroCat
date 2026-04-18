<template>
  <v-container class="d-flex align-center justify-center" style="min-height: 60vh;">
    <v-card class="pa-6 text-center" max-width="420" border flat>
      <v-icon
        size="48"
        :color="isSuccess ? 'success' : 'error'"
        class="mb-3"
      >
        {{ isSuccess ? 'mdi-check-circle' : 'mdi-alert-circle' }}
      </v-icon>
      <div class="text-h6 mb-2">
        {{ isSuccess ? 'GitHub 授权完成' : 'GitHub 授权失败' }}
      </div>
      <div class="text-body-2 text-medium-emphasis mb-4">
        <template v-if="isSuccess">
          {{ step === 'user-token' ? 'App User Token 已绑定。' : 'GitHub App 已安装。' }}
          窗口将自动关闭…
        </template>
        <template v-else>
          {{ message || '请重试或联系支持。' }}
        </template>
      </div>
      <v-btn
        v-if="!isSuccess"
        color="primary"
        variant="tonal"
        @click="closeSelf"
      >
        关闭窗口
      </v-btn>
    </v-card>
  </v-container>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useHead } from '@unhead/vue';

useHead({ title: 'GitHub 授权' });

const route = useRoute();
const router = useRouter();

const status = computed(() => String(route.query.status || '').toLowerCase());
const step = computed(() => String(route.query.step || 'install'));
const message = computed(() => String(route.query.message || ''));
const redirect = computed(() => String(route.query.redirect || ''));
const isSuccess = computed(() => status.value === 'success');

function closeSelf() {
  try { window.close(); } catch (e) {}
}

function notifyOpener() {
  const payload = {
    type: 'zerocat:github-oauth-complete',
    status: status.value,
    step: step.value,
    message: message.value,
  };
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, window.location.origin);
    }
  } catch (e) {}
}

onMounted(() => {
  notifyOpener();
  if (window.opener && !window.opener.closed) {
    setTimeout(() => { try { window.close(); } catch (e) {} }, 1200);
  } else if (isSuccess.value) {
    const target = redirect.value && redirect.value.startsWith('/') ? redirect.value : '/app/account/developer';
    setTimeout(() => router.replace(target), 1500);
  }
});
</script>
