<template>
  <div class="git-directory-picker">
    <div class="d-flex align-center ga-2 mb-2">
      <v-icon size="18">mdi-folder-outline</v-icon>
      <v-breadcrumbs :items="crumbs" density="compact" class="pa-0 text-body-2">
        <template #divider>
          <v-icon size="12">mdi-chevron-right</v-icon>
        </template>
        <template #item="{ item }">
          <a
            href="javascript:void(0)"
            class="text-primary"
            @click="navigate(item.path)"
          >{{ item.title }}</a>
        </template>
      </v-breadcrumbs>
      <v-spacer />
      <v-btn
        v-if="currentPath"
        size="x-small"
        variant="text"
        prepend-icon="mdi-arrow-up"
        @click="goUp"
      >上一级</v-btn>
      <v-btn
        size="x-small"
        variant="tonal"
        color="primary"
        prepend-icon="mdi-check"
        :disabled="!canSelectCurrent"
        @click="pickCurrent"
      >
        选择此目录
      </v-btn>
    </div>

    <v-card variant="outlined" class="pa-0" max-height="320" style="overflow-y: auto;">
      <div v-if="loading" class="d-flex align-center justify-center py-6">
        <v-progress-circular size="20" width="2" indeterminate />
      </div>
      <v-list v-else density="compact" class="py-0">
        <v-list-item v-if="!directories.length && !files.length">
          <v-list-item-title class="text-caption text-medium-emphasis">（空目录）</v-list-item-title>
        </v-list-item>
        <v-list-item
          v-for="dir in directories"
          :key="dir.path"
          @click="enter(dir)"
        >
          <template #prepend>
            <v-icon size="18" color="amber-darken-2">mdi-folder</v-icon>
          </template>
          <v-list-item-title class="text-body-2">{{ dir.name }}</v-list-item-title>
        </v-list-item>
        <v-list-item
          v-for="file in files"
          :key="file.path"
          :disabled="true"
        >
          <template #prepend>
            <v-icon size="18" color="grey">mdi-file-outline</v-icon>
          </template>
          <v-list-item-title class="text-body-2 text-medium-emphasis">{{ file.name }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-card>

    <v-alert
      v-if="limitExceeded"
      type="warning"
      variant="tonal"
      density="compact"
      class="mt-2"
      icon="mdi-alert-outline"
    >
      文件数超过 {{ limit }}，仅展示前 {{ limit }} 项。
    </v-alert>

    <v-text-field
      v-model="manualPath"
      label="或手动输入路径"
      placeholder="source/_posts"
      variant="outlined"
      density="compact"
      hide-details
      class="mt-3"
      @blur="useManual"
    >
    </v-text-field>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import GitSyncService from '@/services/gitSyncService';

const props = defineProps({
  modelValue: { type: String, default: '' },
  linkId: { type: [String, null], default: null },
  repoOwner: { type: String, default: '' },
  repoName: { type: String, default: '' },
  branch: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue']);

const currentPath = ref('');
const entries = ref([]);
const loading = ref(false);
const limit = ref(100);
const limitExceeded = ref(false);
const manualPath = ref(props.modelValue || '');

const directories = computed(() => entries.value.filter((e) => e.type === 'dir'));
const files = computed(() => entries.value.filter((e) => e.type !== 'dir'));

const crumbs = computed(() => {
  const parts = currentPath.value ? currentPath.value.split('/').filter(Boolean) : [];
  const list = [{ title: `${props.repoOwner}/${props.repoName}`, path: '' }];
  let acc = '';
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part;
    list.push({ title: part, path: acc });
  }
  return list;
});

const canSelectCurrent = computed(() => !!(props.linkId && props.repoOwner && props.repoName));

async function loadTree(path = '') {
  if (!canSelectCurrent.value) return;
  loading.value = true;
  try {
    const res = await GitSyncService.getRepoTree({
      linkId: props.linkId,
      repoOwner: props.repoOwner,
      repoName: props.repoName,
      branch: props.branch || undefined,
      path: path || undefined,
    });
    if (res.status === 'success') {
      entries.value = res.entries || [];
      limit.value = res.limit || 100;
      limitExceeded.value = Boolean(res.limitExceeded);
      currentPath.value = res.path || '';
    }
  } finally {
    loading.value = false;
  }
}

function navigate(path) {
  loadTree(path);
}

function enter(dir) {
  loadTree(dir.path);
}

function goUp() {
  const parts = currentPath.value.split('/').filter(Boolean);
  parts.pop();
  loadTree(parts.join('/'));
}

function pickCurrent() {
  const p = currentPath.value || '';
  manualPath.value = p;
  emit('update:modelValue', p);
}

let manualTimer = null;
const normalizeManualPath = (value) => String(value || '').trim().replace(/^\/+|\/+$/g, '');

function useManual() {
  const p = normalizeManualPath(manualPath.value);
  if (p === props.modelValue) return;
  emit('update:modelValue', p);
}

function scheduleManualUpdate(value) {
  if (manualTimer) clearTimeout(manualTimer);
  manualTimer = setTimeout(() => {
    const p = normalizeManualPath(value);
    if (p === props.modelValue) return;
    emit('update:modelValue', p);
  }, 200);
}

watch(() => [props.linkId, props.repoOwner, props.repoName, props.branch], () => loadTree(''));
watch(() => props.modelValue, (v) => { if (v !== manualPath.value) manualPath.value = v || ''; });
watch(manualPath, (v) => scheduleManualUpdate(v));

onMounted(() => loadTree(props.modelValue || ''));
</script>
