<template>
  <v-card border flat class="git-sync-card">
    <!-- 顶部标题 -->
    <div class="d-flex align-center ga-3 pa-4 pb-2">
      <v-avatar size="36" color="grey-lighten-4" rounded>
        <v-icon size="22">mdi-github</v-icon>
      </v-avatar>
      <div class="flex-grow-1">
        <div class="text-subtitle-1 font-weight-medium">GitHub 同步</div>
        <div class="text-caption text-medium-emphasis">
          每次提交自动推送到绑定的 GitHub 仓库
        </div>
      </div>
      <v-chip
        v-if="initialized"
        :color="isBound ? 'success' : 'default'"
        size="small"
        variant="tonal"
      >
        <v-icon start size="14">
          {{ isBound ? 'mdi-check-circle' : 'mdi-circle-outline' }}
        </v-icon>
        {{ isBound ? '已启用' : '未启用' }}
      </v-chip>
    </div>

    <v-divider />

    <!-- 加载态 -->
    <div v-if="!initialized" class="d-flex align-center justify-center pa-8">
      <v-progress-circular indeterminate color="primary" size="28" width="3" />
    </div>

    <!-- 已绑定：信息卡片 -->
    <div
      v-else-if="isBound && !editMode"
      class="pa-4"
    >
      <v-card
        variant="outlined"
        class="bound-repo-card pa-4"
        color="surface"
      >
        <div class="d-flex align-start ga-3">
          <v-avatar size="40" color="primary" rounded variant="tonal">
            <v-icon size="22">
              {{ settings.repoIsPublic === false ? 'mdi-lock' : 'mdi-source-repository' }}
            </v-icon>
          </v-avatar>

          <div class="flex-grow-1 min-width-0">
            <a
              :href="repoUrl"
              target="_blank"
              rel="noopener"
              class="text-subtitle-1 font-weight-medium text-decoration-none d-block text-truncate"
            >
              {{ settings.repoOwner }}/{{ settings.repoName }}
              <v-icon size="14" class="ms-1" style="opacity: .6">mdi-open-in-new</v-icon>
            </a>
            <div class="d-flex flex-wrap align-center ga-3 mt-1">
              <span class="text-caption d-inline-flex align-center">
                <v-icon size="14" class="me-1">mdi-source-branch</v-icon>
                {{ settings.branch || 'main' }}
              </span>
              <span v-if="settings.fileName" class="text-caption d-inline-flex align-center">
                <v-icon size="14" class="me-1">mdi-file-document-outline</v-icon>
                {{ settings.fileName }}
              </span>
            </div>

            <v-divider class="my-3" />

            <div class="d-flex flex-wrap align-center ga-2 text-caption text-medium-emphasis">
              <v-icon v-if="state?.lastSyncedAt" size="14">mdi-clock-check-outline</v-icon>
              <v-icon v-else size="14">mdi-clock-outline</v-icon>
              <template v-if="state?.lastSyncedAt">
                最后同步 {{ formatTime(state.lastSyncedAt) }}
              </template>
              <template v-else>尚未同步</template>
              <span v-if="state?.lastCommitSha" class="mx-1">·</span>
              <code v-if="state?.lastCommitSha" class="text-caption">
                {{ String(state.lastCommitSha).slice(0, 7) }}
              </code>
            </div>

            <v-alert
              v-if="state?.lastError"
              type="error"
              variant="tonal"
              density="compact"
              class="mt-2"
              icon="mdi-alert-circle-outline"
            >
              {{ state.lastError }}
            </v-alert>
          </div>
        </div>

        <v-divider class="my-3" />

        <div class="d-flex flex-wrap ga-2 justify-end">
          <v-btn
            size="small"
            variant="text"
            color="error"
            :loading="unbinding"
            :disabled="!isAuthor"
            @click="unbind"
          >
            <v-icon start size="16">mdi-link-off</v-icon>解除绑定
          </v-btn>
          <v-btn
            size="small"
            variant="text"
            :disabled="!isAuthor"
            @click="enterEditMode"
          >
            <v-icon start size="16">mdi-pencil-outline</v-icon>更换仓库
          </v-btn>
          <v-btn
            size="small"
            color="primary"
            variant="tonal"
            :loading="syncing"
            :disabled="!isAuthor"
            @click="syncNow"
          >
            <v-icon start size="16">mdi-sync</v-icon>立即同步
          </v-btn>
        </div>
      </v-card>
    </div>

    <!-- 未绑定 / 编辑态：选择器 -->
    <div v-else class="pa-4">
      <GitAccountPicker
        v-model="selectedLinkId"
        label="选择 GitHub 账号"
        class="mb-3"
        @links="onLinksLoaded"
      />

      <GitRepoPicker
        v-if="selectedLinkId"
        v-model="selectedRepo"
        :link-id="selectedLinkId"
        :owner-login="selectedLink?.account?.login || ''"
        :default-repo-name="projectName"
        :default-private="projectState === 'private'"
        @disconnect="onRepoDisconnect"
        class="mb-3"
      />

      <v-expansion-panels v-if="selectedRepo" variant="accordion" class="mb-3">
        <v-expansion-panel title="高级选项">
          <template #text>
            <v-combobox
              v-model="bindForm.branch"
              :items="branchItems"
              label="分支"
              placeholder="main"
              variant="outlined"
              density="compact"
              hide-details
              clearable
              :loading="branchLoading"
              class="mb-2"
            />
            <v-text-field
              v-model="bindForm.fileName"
              label="同步文件名"
              placeholder="project.json"
              variant="outlined"
              density="compact"
              hide-details
            />
          </template>
        </v-expansion-panel>
      </v-expansion-panels>

      <div class="d-flex justify-end ga-2">
        <v-btn
          v-if="editMode"
          variant="text"
          :disabled="binding"
          @click="cancelEdit"
        >取消</v-btn>
        <v-btn
          color="primary"
          :loading="binding"
          :disabled="!canBind"
          @click="bind"
        >
          <v-icon start size="16">mdi-link-variant</v-icon>
          {{ editMode ? '更新绑定' : '启用并绑定' }}
        </v-btn>
      </div>
    </div>
  </v-card>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, getCurrentInstance } from 'vue';
import GitSyncService from '@/services/gitSyncService';
import GitAccountPicker from './GitAccountPicker.vue';
import GitRepoPicker from './GitRepoPicker.vue';

const props = defineProps({
  projectId: { type: Number, default: 0 },
  projectType: { type: String, default: '' },
  isAuthor: { type: Boolean, default: true },
});

const instance = getCurrentInstance();
const toast = instance?.proxy?.$toast;
const notify = (severity, summary, detail) => {
  if (toast?.add) toast.add({ severity, summary, detail, life: 3000 });
};

const initialized = ref(false);
const binding = ref(false);
const unbinding = ref(false);
const syncing = ref(false);
const editMode = ref(false);

const settings = ref(null);
const state = ref(null);
const projectName = ref('');
const projectState = ref('private');
const projectDefaultBranch = ref('main');
const links = ref([]);
const selectedLinkId = ref(null);
const selectedRepo = ref(null);
const branchOptions = ref([]);
const branchLoading = ref(false);

const bindForm = reactive({ branch: 'main', fileName: '' });

const isBound = computed(() => {
  return Boolean(
    settings.value
      && settings.value.enabled
      && settings.value.repoOwner
      && settings.value.repoName
      && settings.value.linkId
  );
});

const repoUrl = computed(() => {
  if (!settings.value?.repoOwner || !settings.value?.repoName) return '#';
  return `https://github.com/${settings.value.repoOwner}/${settings.value.repoName}`;
});

const selectedLink = computed(() => links.value.find((l) => l.id === selectedLinkId.value));
const canBind = computed(() => !binding.value && !!selectedLinkId.value && !!selectedRepo.value);
const branchItems = computed(() => {
  const items = new Set(['main']);
  branchOptions.value.forEach((b) => items.add(b));
  if (selectedRepo.value?.default_branch) items.add(selectedRepo.value.default_branch);
  if (projectDefaultBranch.value) items.add(projectDefaultBranch.value);
  if (bindForm.branch) items.add(bindForm.branch);
  return Array.from(items);
});

function formatTime(value) {
  if (!value) return '';
  try { return new Date(value).toLocaleString(); } catch { return value; }
}

function onLinksLoaded(list) {
  links.value = list || [];
}

function onRepoDisconnect() {
  selectedRepo.value = null;
  branchOptions.value = [];
}

async function loadBranches() {
  if (!selectedLinkId.value || !selectedRepo.value?.owner || !selectedRepo.value?.name) {
    branchOptions.value = [];
    return;
  }
  branchLoading.value = true;
  try {
    const res = await GitSyncService.getRepoBranches({
      linkId: selectedLinkId.value,
      repoOwner: selectedRepo.value.owner,
      repoName: selectedRepo.value.name,
    });
    if (res.status === 'success') {
      branchOptions.value = (res.branches || [])
        .map((b) => b?.name || b)
        .filter(Boolean);
    } else {
      branchOptions.value = [];
    }
  } finally {
    branchLoading.value = false;
  }
}

function enterEditMode() {
  editMode.value = true;
  selectedLinkId.value = settings.value?.linkId || null;
  selectedRepo.value = null;
  bindForm.branch = settings.value?.branch || 'main';
  bindForm.fileName = settings.value?.fileName || '';
}

function cancelEdit() {
  editMode.value = false;
  selectedRepo.value = null;
  selectedLinkId.value = settings.value?.linkId || null;
}

async function loadSettings() {
  if (!props.projectId) { initialized.value = true; return; }
  initialized.value = false;
  try {
    const res = await GitSyncService.getProjectSettings(props.projectId);
    if (res.status === 'success') {
      settings.value = res.settings || null;
      state.value = res.state || null;
      projectName.value = res.projectName || '';
      projectState.value = res.projectState || 'private';
      projectDefaultBranch.value = res.projectDefaultBranch || 'main';
      bindForm.branch = settings.value?.branch || 'main';
      bindForm.fileName = settings.value?.fileName || '';
      selectedLinkId.value = settings.value?.linkId || null;
    } else {
      settings.value = null;
      state.value = null;
    }
  } catch (e) {
    settings.value = null;
    state.value = null;
  } finally {
    initialized.value = true;
  }
}

async function bind() {
  if (!canBind.value) return;
  binding.value = true;
  try {
    const res = await GitSyncService.bindProject(props.projectId, {
      linkId: selectedLinkId.value,
      repoOwner: selectedRepo.value.owner,
      repoName: selectedRepo.value.name,
      branch: bindForm.branch || 'main',
      fileName: bindForm.fileName || undefined,
      enabled: true,
    });
    if (res.status === 'success') {
      notify('success', 'GitHub 同步', '已启用并绑定仓库');
      editMode.value = false;
      selectedRepo.value = null;
      await loadSettings();
    } else {
      notify('error', 'GitHub 同步', res.message || '绑定失败');
    }
  } catch (e) {
    notify('error', 'GitHub 同步', e?.response?.data?.message || e.message);
  } finally {
    binding.value = false;
  }
}

async function unbind() {
  if (!confirm('确认解除 GitHub 仓库绑定吗？')) return;
  unbinding.value = true;
  try {
    const res = await GitSyncService.unbindProject(props.projectId);
    if (res.status === 'success') {
      notify('success', 'GitHub 同步', '已解除绑定');
      await loadSettings();
    }
  } finally {
    unbinding.value = false;
  }
}

async function syncNow() {
  syncing.value = true;
  try {
    const res = await GitSyncService.syncProject(props.projectId);
    if (res.status === 'success') {
      notify('success', '同步', '任务已入队');
      setTimeout(loadSettings, 2000);
    } else {
      notify('info', '同步', res?.message || '已请求');
    }
  } finally {
    syncing.value = false;
  }
}

watch(() => props.projectId, loadSettings);
watch(selectedRepo, async (repo) => {
  if (!repo) {
    branchOptions.value = [];
    return;
  }
  if (!bindForm.branch) bindForm.branch = 'main';
  await loadBranches();
});
onMounted(loadSettings);
</script>

<style scoped>
.bound-repo-card {
  transition: all 0.2s;
}
.min-width-0 {
  min-width: 0;
}
.bound-repo-card a:hover {
  text-decoration: underline !important;
}
</style>
