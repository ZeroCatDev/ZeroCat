<template>
  <v-card border flat class="pa-4 mb-4">
    <div class="d-flex align-center ga-3 mb-2">
      <v-icon>mdi-sync</v-icon>
      <div class="text-subtitle-1 font-weight-medium">同步状态</div>
      <v-chip size="small" variant="tonal" :color="enabled ? 'success' : 'default'">
        {{ enabled ? '已启用' : '未启用' }}
      </v-chip>
    </div>

    <div class="text-caption text-medium-emphasis">
      目标仓库：{{ repoLabel }} · 分支：{{ branchLabel }}
    </div>

    <v-divider class="my-3" />

    <v-row dense>
      <v-col cols="12" sm="4">
        <div class="text-caption text-medium-emphasis">文章项目</div>
        <div class="text-h6 font-weight-medium">{{ totalCount }}</div>
      </v-col>
      <v-col cols="12" sm="4">
        <div class="text-caption text-medium-emphasis">已同步</div>
        <div class="text-h6 font-weight-medium">{{ syncedCount }}</div>
      </v-col>
      <v-col cols="12" sm="4">
        <div class="text-caption text-medium-emphasis">同步失败</div>
        <div class="text-h6 font-weight-medium" :class="errorCount ? 'text-error' : ''">
          {{ errorCount }}
        </div>
      </v-col>
    </v-row>

    <v-divider class="my-3" />

    <div class="text-caption text-medium-emphasis">
      最近同步：{{ lastSyncedLabel }}
    </div>
    <v-alert
      v-if="lastError"
      type="error"
      variant="tonal"
      density="compact"
      class="mt-2"
      icon="mdi-alert-circle-outline"
    >
      {{ lastError }}
    </v-alert>
  </v-card>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  settings: { type: Object, default: null },
  projects: { type: Array, default: () => [] },
});

const enabled = computed(() => Boolean(props.settings?.enabled));
const repoLabel = computed(() => {
  const owner = props.settings?.repoOwner || '-';
  const name = props.settings?.repoName || '-';
  return `${owner}/${name}`;
});
const branchLabel = computed(() => props.settings?.branch || 'main');

const totalCount = computed(() => props.projects.length);
const syncedCount = computed(() => props.projects.filter((p) => p.syncState?.lastSyncedAt).length);
const errorCount = computed(() => props.projects.filter((p) => p.syncState?.lastError).length);

const lastSyncedAt = computed(() => {
  const times = props.projects
    .map((p) => p.syncState?.lastSyncedAt)
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));
  if (!times.length) return null;
  return new Date(Math.max(...times)).toISOString();
});

const lastSyncedLabel = computed(() => {
  if (!lastSyncedAt.value) return '尚未同步';
  try {
    return new Date(lastSyncedAt.value).toLocaleString();
  } catch {
    return lastSyncedAt.value;
  }
});

const lastError = computed(() => {
  const errors = props.projects
    .map((p) => p.syncState?.lastError)
    .filter(Boolean);
  if (!errors.length) return '';
  return errors[0];
});
</script>
