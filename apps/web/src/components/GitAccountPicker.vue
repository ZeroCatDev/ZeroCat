<template>
  <div class="git-account-picker">
    <div class="d-flex align-center ga-2 mb-2">
      <div class="text-caption text-medium-emphasis flex-grow-1">{{ label }}</div>
      <v-btn
        size="x-small"
        variant="text"
        :loading="loading"
        prepend-icon="mdi-refresh"
        @click="loadLinks"
      >刷新</v-btn>
      <v-btn
        size="x-small"
        variant="tonal"
        color="primary"
        prepend-icon="mdi-github"
        :loading="installing"
        @click="installGitHub"
      >添加账号</v-btn>
    </div>

    <v-alert
      v-if="!loading && !links.length"
      type="info"
      variant="tonal"
      density="compact"
      icon="mdi-github"
    >
      还没有绑定 GitHub 账号。点击
      <a href="javascript:void(0)" class="text-primary" @click="installGitHub">添加账号</a>
      安装 GitHub App（个人账号将自动申请 User Token）。
    </v-alert>

    <div v-else-if="loading" class="d-flex align-center ga-2 py-2">
      <v-progress-circular size="18" width="2" indeterminate />
      <span class="text-caption text-medium-emphasis">加载账号...</span>
    </div>

    <div v-else class="d-flex flex-wrap ga-2">
      <v-chip
        v-for="link in links"
        :key="link.id"
        :color="chipColor(link)"
        :variant="modelValue === link.id ? 'flat' : 'tonal'"
        size="small"
        @click="onChipClick(link)"
      >
        <v-avatar start size="18">
          <v-img v-if="link.account?.avatar_url" :src="link.account.avatar_url" />
          <v-icon v-else size="12">mdi-account</v-icon>
        </v-avatar>
        {{ link.account?.login || link.id }}
        <v-icon
          v-if="isOrgLink(link)"
          size="12"
          class="ms-1"
          title="Organization"
        >mdi-domain</v-icon>
        <v-chip
          v-if="needsUserToken(link)"
          size="x-small"
          color="warning"
          variant="flat"
          class="ms-2"
          label
        >
          <v-icon start size="12">mdi-alert</v-icon>需要操作
        </v-chip>
        <v-tooltip
          v-if="needsUserToken(link)"
          activator="parent"
          location="top"
        >个人账号缺少 App User Token，点击重新授权</v-tooltip>
      </v-chip>
    </div>

    <v-alert
      v-if="popupOpen"
      type="info"
      variant="tonal"
      density="compact"
      class="mt-2"
    >
      已打开 GitHub 授权窗口，完成后将自动刷新本页面。
    </v-alert>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import GitSyncService from '@/services/gitSyncService';

const props = defineProps({
  modelValue: { type: [String, null], default: null },
  label: { type: String, default: '选择 GitHub 账号' },
  autoSelectFirst: { type: Boolean, default: true },
  autoUserToken: { type: Boolean, default: true },
});

const emit = defineEmits(['update:modelValue', 'links']);

const links = ref([]);
const loading = ref(false);
const installing = ref(false);
const popupOpen = ref(false);
let popupWindow = null;
let popupWatcher = null;

function isOrgLink(link) {
  return String(link?.account?.type || '').toLowerCase() === 'organization';
}

function needsUserToken(link) {
  return !isOrgLink(link) && link?.userTokenBound === false;
}

function chipColor(link) {
  if (needsUserToken(link)) return 'warning';
  if (props.modelValue === link.id) return 'primary';
  return undefined;
}

function onChipClick(link) {
  if (needsUserToken(link)) {
    reauthorizeUserToken(link.id);
    return;
  }
  emit('update:modelValue', link.id);
}

async function loadLinks() {
  loading.value = true;
  try {
    const res = await GitSyncService.getLinks();
    if (res.status === 'success') {
      links.value = res.links || [];
      emit('links', links.value);
      if (props.autoSelectFirst && !props.modelValue && links.value.length) {
        emit('update:modelValue', links.value[0].id);
      }
    }
  } finally {
    loading.value = false;
  }
}

function openPopup(url) {
  const w = 720, h = 780;
  const left = window.screenX + (window.outerWidth - w) / 2;
  const top = window.screenY + (window.outerHeight - h) / 2;
  popupWindow = window.open(
    url,
    'zerocat-github-oauth',
    `width=${w},height=${h},left=${left},top=${top},status=no,menubar=no,toolbar=no`
  );
  if (!popupWindow) {
    window.location.href = url;
    return;
  }
  popupOpen.value = true;
  if (popupWatcher) clearInterval(popupWatcher);
  popupWatcher = setInterval(() => {
    if (!popupWindow || popupWindow.closed) {
      clearInterval(popupWatcher);
      popupWatcher = null;
      popupOpen.value = false;
      loadLinks();
    }
  }, 500);
}

async function installGitHub() {
  installing.value = true;
  try {
    const res = await GitSyncService.createInstallUrl(
      window.location.pathname + window.location.search,
      { autoUserToken: props.autoUserToken }
    );
    if (res.status === 'success' && res.url) openPopup(res.url);
  } finally {
    installing.value = false;
  }
}

async function reauthorizeUserToken(linkId) {
  const res = await GitSyncService.createUserTokenUrl(
    window.location.pathname + window.location.search,
    linkId
  );
  if (res.status === 'success' && res.url) openPopup(res.url);
}

function handleMessage(event) {
  if (event.origin !== window.location.origin) return;
  const data = event.data;
  if (!data || data.type !== 'zerocat:github-oauth-complete') return;
  popupOpen.value = false;
  if (popupWatcher) { clearInterval(popupWatcher); popupWatcher = null; }
  loadLinks();
}

onMounted(() => {
  window.addEventListener('message', handleMessage);
  loadLinks();
});

onBeforeUnmount(() => {
  window.removeEventListener('message', handleMessage);
  if (popupWatcher) clearInterval(popupWatcher);
});

defineExpose({ loadLinks, links, reauthorizeUserToken, installGitHub });
</script>
