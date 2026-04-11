<template>
  <v-card border >
    <v-card-title class="d-flex flex-wrap align-center ga-3">
      <div class="d-flex align-center ga-2">
        <v-icon size="28">mdi-github</v-icon>
        <div>
          <div class="text-h6">GitHub 同步</div>
        </div>
      </div>
      <v-spacer />
      <v-chip :color="settings?.enabled ? 'success' : 'warning'" size="small" class="text-uppercase">
        {{ settings?.enabled ? '开启' : '禁用' }}
      </v-chip>
    </v-card-title>
    <v-card-text>
      <v-alert v-if="message" :type="messageType" class="mb-4" variant="tonal">
        {{ message }}
      </v-alert>

      <div v-if="loading" class="d-flex align-center justify-center py-6">
        <v-progress-circular color="primary" indeterminate />
      </div>

      <template v-else>
        <v-row class="mb-2" dense>
          <v-col cols="12">
            <div class="d-flex align-center justify-space-between mb-3">
              <div class="d-flex flex-wrap ga-2">
                <v-btn
                  color="primary"
                  :loading="installing"
                  :disabled="!isAuthor"
                  @click="startInstall"
                >
                  添加账户
                </v-btn>
                <v-btn
                  variant="tonal"
                  :loading="loadingLinks"
                  :disabled="!isAuthor"
                  @click="loadLinks"
                >
                  刷新
                </v-btn>
              </div>
            </div>

            <v-alert v-if="!links.length" type="info" variant="tonal" class="mb-3">
              No GitHub App installations yet.
            </v-alert>

            <div v-else class="d-flex flex-wrap ga-2">
              <v-chip
                v-for="link in links"
                :key="link.id"
                variant="tonal"
                class="git-sync-chip"
                :disabled="!isAuthor"
                @click="openLinkDialog(link)"
              >

                {{ buildLinkLabel(link) }}
              </v-chip>
            </div>

            <v-dialog v-model="linkDialogOpen" max-width="420">
              <v-card>
                <v-card-title class="d-flex align-center ga-3">
                  <v-avatar size="40" color="grey-lighten-3">
                    <v-img v-if="linkAvatar(activeLink)" :src="linkAvatar(activeLink)" />
                    <v-icon v-else size="20">mdi-account</v-icon>
                  </v-avatar>
                  <div>
                    <div class="text-subtitle-1">{{ buildLinkLabel(activeLink) }}</div>
                    <div class="text-caption text-medium-emphasis">
                      {{ buildLinkSubtitle(activeLink) || 'GitHub App installation' }}
                    </div>
                  </div>
                </v-card-title>
                <v-divider />
                <v-card-text>
                  <div v-if="activeLink?.account?.login" class="text-body-2">
                    登录: {{ activeLink.account.login }}
                  </div>
                  <div v-if="activeLink?.account?.id" class="text-body-2">
                    账户ID: {{ activeLink.account.id }}
                  </div>
                  <div v-if="activeLink?.account?.type" class="text-body-2">
                    类型: {{ activeLink.account.type }}
                  </div>
                  <div v-if="activeLink?.installationId" class="text-body-2">
                    安装: #{{ activeLink.installationId }}
                  </div>
                  <div v-if="activeLink?.createdAt" class="text-body-2">
                    创建: {{ formatTime(activeLink.createdAt) }}
                  </div>
                  <div v-if="activeLink?.updatedAt" class="text-body-2">
                    更新: {{ formatTime(activeLink.updatedAt) }}
                  </div>
                </v-card-text>
                <v-card-actions class="justify-end">
                  <v-btn variant="text" @click="linkDialogOpen = false">关闭</v-btn>
                  <v-btn
                    color="error"
                    variant="tonal"
                    :loading="removingLink"
                    :disabled="!isAuthor || !activeLink?.id"
                    @click="removeLink(activeLink?.id)"
                  >
                    Delete
                  </v-btn>
                </v-card-actions>
              </v-card>
            </v-dialog>
          </v-col>

          <v-col cols="12" md="7">
            <div class="d-flex align-center justify-space-between mb-3">
              <div>
                <div class="text-subtitle-1 font-weight-medium">仓库</div>

              </div>
              <div class="d-flex align-center ga-2">

                <v-btn
                  variant="tonal"
                  :loading="loadingRepos"
                  :disabled="!isAuthor || !links.length"
                  @click="loadRepos"
                >
                  刷新
                </v-btn>
              </div>
            </div>

            <v-autocomplete
              v-model="selectedRepoItem"
              :items="repoOptions"
              item-title="title"
              item-value="value"
              :disabled="!isAuthor || !links.length"
              :loading="loadingRepos || searchingRepos"
              label="Repository"
              placeholder="搜索"
              clearable
              no-filter
              return-object
              class="mb-3"
              @update:search="onRepoSearch"
            >
              <template #item="{ item, props: itemProps }">
                <v-list-item v-bind="itemProps" :title="undefined">
                  <v-list-item-title>{{ item.raw.title }}</v-list-item-title>
                  <v-list-item-subtitle>{{ item.raw.subtitle }}</v-list-item-subtitle>
                </v-list-item>
              </template>
              <template #selection="{ item }">
                <span class="text-truncate">{{ item.raw.title }}</span>
              </template>
              <template #no-data>
                <v-list-item>
                  <v-list-item-title class="text-grey text-center">
                    {{ repoEmptyLabel }}
                  </v-list-item-title>
                </v-list-item>
              </template>
            </v-autocomplete>


            <div v-if="selectedRepoMeta" class="text-caption text-medium-emphasis mb-3">
              {{ selectedRepoMeta }}
            </div>

            <v-combobox
              v-model="form.branch"
              :items="branchOptions"
              label="分支"
              placeholder="main"
              :disabled="!isAuthor"
              clearable
              class="mb-3"
            />

            <v-text-field
              v-model="form.fileName"
              label="项目文件"
              placeholder="project.json"
              :disabled="!isAuthor"
              class="mb-3"
            />

            <v-switch
              v-model="form.includeReadme"
              color="primary"
              inset
              label="包含 README.md"
              :disabled="!isAuthor"
            />
          </v-col>
        </v-row>

        <v-divider class="my-4" />

        <div class="d-flex flex-wrap align-center ga-2">
          <v-btn
            color="primary"
            :loading="binding"
            :disabled="!isAuthor || !canBind"
            @click="bindProject"
          >
            {{ primaryActionLabel }}
          </v-btn>
          <v-btn
            variant="tonal"
            :loading="syncing"
            :disabled="!isAuthor || !settings?.enabled"
            @click="syncNow"
          >
            立刻同步
          </v-btn>
          <v-btn
            v-if="settings?.enabled"
            color="warning"
            variant="text"
            :loading="unbinding"
            :disabled="!isAuthor"
            @click="unbindProject"
          >
            关闭同步
          </v-btn>
        </div>

        <div class="d-flex flex-wrap ga-2 mt-4">
          <v-chip v-if="state?.lastSyncedAt" size="small">
            最后同步: {{ formatTime(state.lastSyncedAt) }}
          </v-chip>
          <v-chip v-if="state?.lastError" color="error" size="small">
            最后错误: {{ state.lastError }}
          </v-chip>
          <v-chip v-if="settings?.disabledReason" color="warning" size="small">
            原因: {{ settings.disabledReason }}
          </v-chip>
        </div>

        <v-alert v-if="isScratch" type="info" variant="tonal" class="mt-4">
            Scratch 项目将有额外的处理。
        </v-alert>
      </template>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { computed, getCurrentInstance, reactive, ref, watch } from 'vue';
import GitSyncService from '@/services/gitSyncService';

const props = defineProps({
  projectId: {
    type: Number,
    default: 0,
  },
  projectType: {
    type: String,
    default: '',
  },
  isAuthor: {
    type: Boolean,
    default: true,
  },
});

const instance = getCurrentInstance();
const toast = instance?.proxy?.$toast;

const loading = ref(false);
const loadingLinks = ref(false);
const loadingRepos = ref(false);
const searchingRepos = ref(false);
const installing = ref(false);
const binding = ref(false);
const unbinding = ref(false);
const syncing = ref(false);
const removingLink = ref(false);
const linkDialogOpen = ref(false);
const activeLink = ref(null);

const message = ref('');
const messageType = ref('info');

const links = ref([]);
const repos = ref([]);
const selectedRepoItem = ref(null);
const settings = ref(null);
const state = ref(null);

const projectDefaultBranch = ref('');
const projectBranches = ref([]);
const lastAutoBranch = ref('');
const desiredRepoFullName = ref('');
const repoSearchQuery = ref('');
const repoSearchToken = ref(0);
let repoSearchTimer = null;

const DEFAULT_PROJECT_FILE = 'project.json';

const form = reactive({
  branch: '',
  fileName: '',
  includeReadme: false,
});

const isScratch = computed(() => String(props.projectType || '').toLowerCase().startsWith('scratch'));

const repoUpdatedAt = (repo) => repo?.updated_at || repo?.pushed_at || repo?.created_at || null;

const repoTimestamp = (repo) => {
  const value = repoUpdatedAt(repo);
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const sortedRepos = computed(() => {
  const items = Array.isArray(repos.value) ? [...repos.value] : [];
  return items.sort((a, b) => repoTimestamp(b) - repoTimestamp(a));
});

const repoOptions = computed(() => sortedRepos.value.map((repo) => ({
  title: repo.full_name || repo.name,
  value: repo.full_name || repo.name,
  subtitle: buildRepoSubtitle(repo),
  repo,
})));


const selectedRepo = computed(() => selectedRepoItem.value?.repo || null);

const selectedRepoMeta = computed(() => {
  const repo = selectedRepo.value;
  if (!repo) return '';
  const parts = [];
  const accountName = repo?.gitAccount?.login || repo?.gitAccount?.id;
  if (accountName) {
    parts.push(`Account: ${accountName}`);
  }
  if (repo.default_branch) {
    parts.push(`Default branch: ${repo.default_branch}`);
  }
  const updatedAt = repoUpdatedAt(repo);
  if (updatedAt) {
    parts.push(`Updated: ${formatTime(updatedAt)}`);
  }
  return parts.join(' · ');
});

const repoEmptyLabel = computed(() => {
  if (!links.value.length) return 'Install the App to load repositories.';
  if (loadingRepos.value || searchingRepos.value) return 'Loading repositories...';
  if (repoSearchQuery.value && repoSearchQuery.value.trim().length >= 2) {
    return 'No repositories match your search.';
  }
  if (repoSearchQuery.value && repoSearchQuery.value.trim().length < 2) {
    return 'Type at least 2 characters to search.';
  }
  return 'No repositories found.';
});

const branchOptions = computed(() => (projectBranches.value || []).map((branch) => branch.name));

const canBind = computed(() => Boolean(selectedRepoItem.value?.repo?.gitLinkId));
const primaryActionLabel = computed(() => (settings.value?.enabled ? '保存更改' : '启用同步'));

const setMessage = (type, text) => {
  messageType.value = type || 'info';
  message.value = text || '';
};

const notify = (severity, summary, detail) => {
  if (toast?.add) {
    toast.add({ severity, summary, detail, life: 3000 });
  }
};

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const buildLinkLabel = (link) => {
  const account = link?.account?.login || link?.account?.id || 'GitHub';
  const type = link?.account?.type ? ` (${link.account.type})` : '';
  return `${account}${type}`.trim();
};

const linkAvatar = (link) => (
  link?.account?.avatar_url || link?.account?.avatarUrl || ''
);

const buildLinkSubtitle = (link) => {
  const details = [];
  if (link?.installationId) {
    details.push(`Installation #${link.installationId}`);
  }
  if (link?.updatedAt) {
    details.push(`Updated ${formatTime(link.updatedAt)}`);
  }
  return details.join(' · ');
};

const buildRepoSubtitle = (repo) => {
  const parts = [];
  const accountName = repo?.gitAccount?.login || repo?.gitAccount?.id;
  if (accountName) {
    parts.push(`Account ${accountName}`);
  }
  if (repo?.default_branch) {
    parts.push(`Default branch ${repo.default_branch}`);
  }
  if (repo?.private != null) {
    parts.push(repo.private ? 'Private' : 'Public');
  }
  const updatedAt = repoUpdatedAt(repo);
  if (updatedAt) {
    parts.push(`Updated ${formatTime(updatedAt)}`);
  }
  return parts.join(' · ');
};

const syncSelectedRepo = () => {
  if (!desiredRepoFullName.value) return;
  const match = repoOptions.value.find((item) => item.value === desiredRepoFullName.value);
  if (match) {
    selectedRepoItem.value = match;
    desiredRepoFullName.value = '';
  }
};

const ensureSelectedRepoInList = () => {
  const selected = selectedRepoItem.value?.repo;
  if (!selected) return;
  const key = selected.full_name || selected.name || selectedRepoItem.value?.value;
  if (!key) return;
  const exists = repos.value.some((repo) => (repo.full_name || repo.name) === key);
  if (!exists) {
    repos.value = [selected, ...repos.value];
  }
};

const hydrateForm = (nextSettings) => {
  if (!nextSettings) {
    form.branch = '';
    form.fileName = DEFAULT_PROJECT_FILE;
    form.includeReadme = true;
    return;
  }
  form.branch = nextSettings.branch || '';
  form.fileName = nextSettings.fileName || DEFAULT_PROJECT_FILE;
  form.includeReadme = nextSettings.includeReadme ?? true;
};

const openLinkDialog = (link) => {
  if (!link?.id) return;
  activeLink.value = link;
  linkDialogOpen.value = true;
};

const applyProjectBranchDefault = () => {
  applyAutoBranch(projectDefaultBranch.value);
};

const applyAutoBranch = (branchName) => {
  if (!branchName) return;
  if (!form.branch || form.branch === lastAutoBranch.value) {
    lastAutoBranch.value = branchName;
    form.branch = branchName;
  }
};

const applyRepoBranchDefault = (repo) => {
  const branchName = repo?.default_branch || projectDefaultBranch.value;
  if (!branchName) return;
  lastAutoBranch.value = branchName;
  form.branch = branchName;
};

const loadLinks = async () => {
  loadingLinks.value = true;
  try {
    const res = await GitSyncService.getLinks();
    links.value = res.links || [];
    if (activeLink.value && !links.value.some((link) => link.id === activeLink.value?.id)) {
      activeLink.value = null;
      linkDialogOpen.value = false;
    }
  } catch (error) {
    setMessage('error', error?.message || 'Failed to load links.');
  } finally {
    loadingLinks.value = false;
  }
};

const loadRepos = async () => {
  if (!links.value.length) {
    repos.value = [];
    selectedRepoItem.value = null;
    return;
  }
  loadingRepos.value = true;
  try {
    const res = await GitSyncService.getAllRepos();
    repos.value = res.repositories || [];
    ensureSelectedRepoInList();
    syncSelectedRepo();
    if (selectedRepoItem.value) {
      const currentKey = selectedRepoItem.value?.value || selectedRepo.value?.full_name || '';
      const nextItem = repoOptions.value.find((item) => item.value === currentKey);
      if (nextItem) {
        selectedRepoItem.value = nextItem;
      }
    }
  } catch (error) {
    setMessage('error', error?.message || 'Failed to load repositories.');
  } finally {
    loadingRepos.value = false;
  }
};

const searchRepos = async (query) => {
  if (!links.value.length) {
    repos.value = [];
    return;
  }
  const token = repoSearchToken.value + 1;
  repoSearchToken.value = token;
  searchingRepos.value = true;
  try {
    const res = await GitSyncService.searchRepos(query, { perPage: 20 });
    if (repoSearchToken.value !== token) return;
    repos.value = res.repositories || [];
    ensureSelectedRepoInList();
    syncSelectedRepo();
    if (selectedRepoItem.value) {
      const currentKey = selectedRepoItem.value?.value || selectedRepo.value?.full_name || '';
      const nextItem = repoOptions.value.find((item) => item.value === currentKey);
      if (nextItem) {
        selectedRepoItem.value = nextItem;
      }
    }
  } catch (error) {
    setMessage('error', error?.message || 'Failed to search repositories.');
  } finally {
    if (repoSearchToken.value === token) {
      searchingRepos.value = false;
    }
  }
};

const onRepoSearch = (query) => {
  repoSearchQuery.value = query;
  if (repoSearchTimer) {
    clearTimeout(repoSearchTimer);
  }
  repoSearchTimer = setTimeout(async () => {
    const trimmed = repoSearchQuery.value.trim();
    if (!trimmed || trimmed.length < 2) {
      await loadRepos();
      return;
    }
    await searchRepos(trimmed);
  }, 300);
};

const loadBranches = async () => {
  if (!props.projectId) return;
  try {
    const res = await GitSyncService.getProjectBranches(props.projectId);
    projectBranches.value = res.data || [];
  } catch (error) {
    projectBranches.value = [];
  }
};

const loadSettings = async () => {
  if (!props.projectId) return;
  loading.value = true;
  try {
    const res = await GitSyncService.getProjectSettings(props.projectId);
    settings.value = res.settings || null;
    state.value = res.state || null;
    projectDefaultBranch.value = res.projectDefaultBranch || '';
    lastAutoBranch.value = '';
    hydrateForm(settings.value);
    applyProjectBranchDefault();

    if (settings.value?.repoOwner && settings.value?.repoName) {
      const fullName = `${settings.value.repoOwner}/${settings.value.repoName}`;
      desiredRepoFullName.value = fullName;
      syncSelectedRepo();
    }
  } catch (error) {
    setMessage('error', error?.message || 'Failed to load sync settings.');
  } finally {
    loading.value = false;
  }
};

const startInstall = async () => {
  installing.value = true;
  try {
    const redirectUrl = typeof window !== 'undefined' ? window.location.href : '';
    const res = await GitSyncService.createInstallUrl(redirectUrl);
    if (res.url) {
      window.open(res.url, '_blank', 'noopener');
      notify('info', 'Install', 'Complete install, then refresh links.');
    } else {
      throw new Error(res.message || 'Missing install URL.');
    }
  } catch (error) {
    setMessage('error', error?.message || 'Failed to start install.');
  } finally {
    installing.value = false;
  }
};

const bindProject = async () => {
  if (!props.projectId || !canBind.value) return;
  binding.value = true;
  try {
    const repo = selectedRepo.value;
    const fullName = repo?.full_name || repo?.name || selectedRepoItem.value?.value || '';
    const [repoOwner, repoName] = fullName.split('/');
    const linkId = repo?.gitLinkId;
    if (!linkId || !repoOwner || !repoName) {
      throw new Error('Please select a repository.');
    }
    const res = await GitSyncService.bindProject(props.projectId, {
      linkId,
      repoOwner,
      repoName,
      branch: form.branch || projectDefaultBranch.value || undefined,
      fileName: form.fileName || DEFAULT_PROJECT_FILE,
      includeReadme: form.includeReadme,
      enabled: true,
    });

    settings.value = res.settings || settings.value;
    hydrateForm(settings.value);
    notify('success', 'Saved', 'Binding updated.');
  } catch (error) {
    setMessage('error', error?.message || 'Failed to save binding.');
  } finally {
    binding.value = false;
  }
};

const unbindProject = async () => {
  if (!props.projectId) return;
  unbinding.value = true;
  try {
    const res = await GitSyncService.unbindProject(props.projectId);
    settings.value = res.settings || settings.value;
    hydrateForm(settings.value);
    notify('success', 'Disabled', 'Sync disabled.');
  } catch (error) {
    setMessage('error', error?.message || 'Failed to disable sync.');
  } finally {
    unbinding.value = false;
  }
};

const syncNow = async () => {
  if (!props.projectId) return;
  syncing.value = true;
  try {
    const res = await GitSyncService.syncProject(props.projectId);
    if (res.status === 'success') {
      notify('success', 'Sync', 'Sync job enqueued.');
    } else {
      notify('info', 'Sync', res?.message || 'Sync requested.');
    }
  } catch (error) {
    setMessage('error', error?.message || 'Failed to enqueue sync.');
  } finally {
    syncing.value = false;
  }
};

const removeLink = async (linkId) => {
  const targetId = linkId || activeLink.value?.id;
  if (!targetId) return;
  removingLink.value = true;
  try {
    await GitSyncService.deleteLink(targetId);
    if (activeLink.value?.id === targetId) {
      activeLink.value = null;
      linkDialogOpen.value = false;
    }
    await loadLinks();
    await loadRepos();
    notify('success', 'Removed', 'Link removed.');
  } catch (error) {
    setMessage('error', error?.message || 'Failed to remove link.');
  } finally {
    removingLink.value = false;
  }
};


watch(() => props.projectId, async (value) => {
  if (!value) return;
  await loadSettings();
  await loadLinks();
  await loadBranches();
  await loadRepos();
  applyProjectBranchDefault();
}, { immediate: true });

watch(projectDefaultBranch, () => {
  applyProjectBranchDefault();
});

watch(selectedRepoItem, (value) => {
  if (!value?.repo) return;
  applyRepoBranchDefault(value.repo);
});
</script>

<style scoped>

.git-sync-chip {
  cursor: pointer;
}
</style>
