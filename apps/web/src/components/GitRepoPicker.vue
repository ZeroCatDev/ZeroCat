<template>
  <div class="git-repo-picker">
    <v-card
      v-if="selectedRepo"
      border
      flat
      class="pa-4 d-flex align-center ga-3"
      color="surface"
    >
      <v-icon size="24" :color="selectedRepo.private ? 'warning' : 'success'">
        {{ selectedRepo.private ? 'mdi-lock' : 'mdi-source-repository' }}
      </v-icon>
      <div class="flex-grow-1 min-width-0">
        <div class="text-subtitle-2 text-truncate">
          {{ selectedRepo.full_name }}
        </div>
        <div class="text-caption text-medium-emphasis">
          分支: {{ selectedRepo.default_branch || 'main' }}
          · {{ selectedRepo.private ? '私有' : '公开' }}
          <template v-if="selectedRepo.existing === false"> · 刚刚创建</template>
        </div>
      </div>
      <v-btn
        size="small"
        variant="text"
        color="error"
        prepend-icon="mdi-link-off"
        @click="disconnect"
      >
        断开连接
      </v-btn>
    </v-card>

    <template v-else>
      <v-tabs v-model="mode" density="compact" color="primary" class="mb-3">
        <v-tab value="existing" prepend-icon="mdi-source-repository">选择已有仓库</v-tab>
        <v-tab value="create" prepend-icon="mdi-plus-circle-outline">新建仓库</v-tab>
      </v-tabs>

      <v-window v-model="mode">
        <v-window-item value="existing">
          <v-text-field
            v-model="query"
            prepend-inner-icon="mdi-magnify"
            placeholder="搜索仓库..."
            variant="outlined"
            density="compact"
            hide-details
            clearable
            class="mb-3"
          />
          <div v-if="loadingRepos" class="d-flex align-center justify-center py-6">
            <v-progress-circular size="24" width="2" indeterminate />
          </div>
          <v-list v-else-if="filteredRepos.length" density="compact" class="border rounded" max-height="320" style="overflow-y: auto;">
            <v-list-item
              v-for="repo in filteredRepos"
              :key="repo.full_name || `${repo.owner?.login}/${repo.name}`"
              @click="selectRepo(repo)"
            >
              <template #prepend>
                <v-icon size="18">
                  {{ repo.private ? 'mdi-lock' : 'mdi-source-repository' }}
                </v-icon>
              </template>
              <v-list-item-title class="text-body-2">
                {{ repo.full_name || `${repo.owner?.login}/${repo.name}` }}
              </v-list-item-title>
              <v-list-item-subtitle v-if="repo.description" class="text-caption">
                {{ repo.description }}
              </v-list-item-subtitle>
              <template #append>
                <v-chip v-if="repo.default_branch" size="x-small" variant="tonal">
                  {{ repo.default_branch }}
                </v-chip>
              </template>
            </v-list-item>
          </v-list>
          <v-alert
            v-else
            type="info"
            variant="tonal"
            density="compact"
            icon="mdi-information-outline"
          >
            没有找到仓库。可以切换到"新建仓库"。
          </v-alert>
        </v-window-item>

        <v-window-item value="create">
          <v-text-field
            v-model="newRepo.name"
            :prefix="ownerPrefix ? `${ownerPrefix}/` : undefined"
            label="仓库名"
            placeholder="my-repo"
            variant="outlined"
            density="compact"
            hide-details="auto"
            :error-messages="nameError ? [nameError] : []"
            class="mb-2"
            @blur="checkAvailability"
            @update:model-value="scheduleCheck"
          >
            <template #append-inner>
              <v-progress-circular v-if="checkStatus === 'checking'" size="16" width="2" indeterminate />
              <v-icon v-else-if="checkStatus === 'available'" size="18" color="success">mdi-check-circle</v-icon>
              <v-icon v-else-if="checkStatus === 'taken'" size="18" color="error">mdi-alert-circle</v-icon>
            </template>
          </v-text-field>
          <v-textarea
            v-model="newRepo.description"
            label="描述（可选）"
            variant="outlined"
            density="compact"
            rows="2"
            auto-grow
            hide-details
            class="mb-2"
          />
          <div class="d-flex align-center ga-4 mb-3">
            <v-switch
              v-model="newRepo.private"
              label="私有"
              density="compact"
              color="primary"
              hide-details
              inset
            />
          </div>
          <div class="d-flex justify-end">
            <v-btn
              color="primary"
              :loading="creating"
              :disabled="!canCreate"
              @click="createRepo"
            >
              <v-icon start size="16">mdi-github</v-icon>创建仓库
            </v-btn>
          </div>
        </v-window-item>
      </v-window>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import GitSyncService from '@/services/gitSyncService';

const props = defineProps({
  linkId: { type: [String, null], default: null },
  ownerLogin: { type: String, default: '' },
  modelValue: { type: Object, default: null },
  defaultRepoName: { type: String, default: '' },
  defaultDescription: { type: String, default: '' },
  defaultPrivate: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'created', 'disconnect']);

const mode = ref('existing');
const query = ref('');
const repos = ref([]);
const loadingRepos = ref(false);

const newRepo = reactive({
  name: props.defaultRepoName || '',
  description: props.defaultDescription || '',
  private: props.defaultPrivate,
});
const nameError = ref('');
const checkStatus = ref('idle');
const creating = ref(false);

const ownerPrefix = computed(() => props.ownerLogin || '');
const selectedRepo = computed(() => props.modelValue);

const canCreate = computed(() => (
  !creating.value
    && !!props.linkId
    && !!newRepo.name
    && !nameError.value
    && checkStatus.value !== 'taken'
    && checkStatus.value !== 'checking'
));

const filteredRepos = computed(() => {
  const q = query.value?.trim().toLowerCase();
  if (!q) return repos.value;
  return repos.value.filter((r) => (r.full_name || '').toLowerCase().includes(q)
    || (r.description || '').toLowerCase().includes(q));
});

function isSelected(repo) {
  if (!selectedRepo.value) return false;
  return selectedRepo.value.full_name === repo.full_name;
}

function disconnect() {
  emit('update:modelValue', null);
  emit('disconnect');
}

function selectRepo(repo) {
  emit('update:modelValue', {
    owner: repo.owner?.login || props.ownerLogin,
    name: repo.name,
    full_name: repo.full_name || `${repo.owner?.login}/${repo.name}`,
    default_branch: repo.default_branch,
    private: repo.private,
    existing: true,
    raw: repo,
  });
}

async function loadRepos() {
  if (!props.linkId) { repos.value = []; return; }
  loadingRepos.value = true;
  try {
    const res = await GitSyncService.getInstallationRepos(props.linkId);
    if (res.status === 'success') {
      const list = res.repositories || [];
      repos.value = props.ownerLogin
        ? list.filter((r) => (r.owner?.login || '').toLowerCase() === props.ownerLogin.toLowerCase())
        : list;
    }
  } finally {
    loadingRepos.value = false;
  }
}

function validateName() {
  const name = (newRepo.name || '').trim();
  if (!name) { nameError.value = '仓库名不能为空'; return false; }
  if (name.length > 100 || !/^[0-9A-Za-z._-]+$/.test(name)) {
    nameError.value = '只允许字母、数字、._- 且不超过 100 字符';
    return false;
  }
  nameError.value = '';
  return true;
}

let checkTimer = null;
function scheduleCheck() {
  if (checkTimer) clearTimeout(checkTimer);
  checkTimer = setTimeout(checkAvailability, 400);
}

async function checkAvailability() {
  if (!validateName() || !props.linkId) { checkStatus.value = 'idle'; return; }
  checkStatus.value = 'checking';
  try {
    const res = await GitSyncService.checkRepoName(props.linkId, newRepo.name);
    checkStatus.value = res.status === 'success' ? (res.available ? 'available' : 'taken') : 'idle';
  } catch (e) {
    checkStatus.value = 'idle';
  }
}

async function createRepo() {
  if (!canCreate.value) return;
  creating.value = true;
  try {
    const res = await GitSyncService.createRepo({
      linkId: props.linkId,
      name: newRepo.name,
      description: newRepo.description,
      private: newRepo.private,
    });
    if (res.status === 'success' && res.repository) {
      const repo = res.repository;
      emit('update:modelValue', {
        owner: repo.owner?.login || props.ownerLogin,
        name: repo.name,
        full_name: repo.full_name || `${repo.owner?.login}/${repo.name}`,
        default_branch: repo.default_branch,
        private: repo.private,
        existing: false,
        raw: repo,
      });
      emit('created', repo);
      await loadRepos();
      mode.value = 'existing';
    }
  } finally {
    creating.value = false;
  }
}

watch(() => [props.linkId, props.ownerLogin], loadRepos);
watch(() => props.defaultRepoName, (v) => {
  if (v && !newRepo.name) newRepo.name = v;
  scheduleCheck();
});
watch(() => props.defaultPrivate, (v) => { newRepo.private = v; });

onMounted(loadRepos);

defineExpose({ loadRepos });
</script>
