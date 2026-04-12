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
                  <div v-if="isUserAccount(activeLink)" class="text-body-2">
                    App User Token: {{ activeLink?.userTokenBound ? '已授权' : '未授权' }}
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
                  <v-btn
                    v-if="isUserAccount(activeLink) && !activeLink?.userTokenBound"
                    color="primary"
                    variant="tonal"
                    :loading="authorizingUserToken"
                    :disabled="!isAuthor"
                    @click="startUserTokenAuthForLink(activeLink)"
                  >
                    授权个人账号
                  </v-btn>
                  <v-btn variant="text" @click="linkDialogOpen = false">关闭</v-btn>
                  <v-btn
                    color="error"
                    variant="tonal"
                    :loading="removingLink"
                    :disabled="!isAuthor || !activeLink?.id"
                    @click="removeLink(activeLink?.id)"
                  >
                    解绑
                  </v-btn>
                </v-card-actions>
              </v-card>
            </v-dialog>

            <v-dialog v-model="createDialogOpen" max-width="560">
              <v-card>
                <v-card-title class="d-flex align-center ga-3">
                  <v-icon size="28">mdi-source-repository</v-icon>
                  <div>
                    <div class="text-subtitle-1">创建仓库</div>
                    <div class="text-caption text-medium-emphasis">一键创建并用于同步</div>
                  </div>
                </v-card-title>
                <v-card-text>
                  <div class="git-sync-create-hero mb-4">
                    <div class="text-caption text-medium-emphasis">预览</div>
                    <div class="text-h6 git-sync-create-preview">
                      {{ createRepoPreview || '选择账号并填写名称' }}
                    </div>
                    <div class="text-caption mt-1">仓库将在所选账号下创建。</div>
                  </div>

                  <v-alert v-if="createError" type="error" variant="tonal" class="mb-3">
                    {{ createError }}
                  </v-alert>

                  <v-select
                    v-model="createForm.linkId"
                    :items="linkOptions"
                    item-title="title"
                    item-value="value"
                    label="账号"
                    :disabled="!isAuthor || !links.length"
                    class="mb-3"
                  >
                    <template #item="{ item, props: itemProps }">
                      <v-list-item v-bind="itemProps" :title="undefined">
                        <v-list-item-title>{{ item.raw.title }}</v-list-item-title>
                        <v-list-item-subtitle>{{ item.raw.subtitle }}</v-list-item-subtitle>
                      </v-list-item>
                    </template>
                  </v-select>

                  <div v-if="createLinkAccountType && createLinkAccountType !== 'organization'" class="mb-3">
                    <v-alert
                    v-if="createNeedsUserToken"
                      :type="createNeedsUserToken ? 'warning' : 'success'"
                      variant="tonal"
                      class="mb-2"
                    >
                     个人账号创建仓库需要单独授权 App User Token。
                    </v-alert>
                    <v-btn
                      v-if="createNeedsUserToken"
                      color="primary"
                      variant="tonal"
                      prepend-icon="mdi-key"
                      :loading="authorizingUserToken"
                      :disabled="!isAuthor"
                      @click="startUserTokenAuth"
                    >
                      授权个人账号
                    </v-btn>
                  </div>

                  <v-text-field
                    v-model="createForm.name"
                    label="仓库名称"
                    placeholder="zerocat-project"
                    hint="仅支持字母、数字、.-_"
                    persistent-hint
                    :disabled="!isAuthor"
                    class="mb-3"
                  />

                  <div v-if="showRepoNameStatus" class="git-sync-name-status">
                    <v-progress-circular
                      v-if="repoNameCheckStatus === 'checking'"
                      indeterminate
                      size="16"
                      width="2"
                      color="primary"
                    />
                    <v-icon
                      v-else
                      :color="repoNameStatusColor"
                      size="16"
                    >
                      {{ repoNameStatusIcon }}
                    </v-icon>
                    <span :class="['text-caption', `text-${repoNameStatusColor}`]">
                      {{ repoNameCheckMessage }}
                    </span>
                  </div>

                  <v-textarea
                    v-model="createForm.description"
                    label="描述"
                    placeholder="可选"
                    rows="2"
                    auto-grow
                    :disabled="!isAuthor"
                    class="mb-2"
                  />

                  <div class="d-flex flex-wrap align-center ga-2">
                    <v-btn-toggle
                      v-model="createForm.visibility"
                      mandatory
                      density="compact"
                      color="primary"
                      class="git-sync-visibility"
                    >
                      <v-btn value="public" prepend-icon="mdi-earth">公开</v-btn>
                      <v-btn value="private" prepend-icon="mdi-lock">私有</v-btn>
                    </v-btn-toggle>
                  </div>


                </v-card-text>
                <v-card-actions class="justify-end">
                  <v-btn variant="text" @click="createDialogOpen = false">取消</v-btn>
                  <v-btn
                    color="primary"
                    :loading="creatingRepo"
                    :disabled="!canCreateRepo"
                    @click="createRepo"
                  >
                    创建
                  </v-btn>
                </v-card-actions>
              </v-card>
            </v-dialog>

            <v-dialog v-model="fileTreeDialogOpen" max-width="720">
              <v-card>
                <v-card-title class="d-flex align-center ga-3">
                  <v-icon size="24">mdi-file-tree</v-icon>
                  <div>
                    <div class="text-subtitle-1">选择文件</div>
                    <div class="text-caption text-medium-emphasis">从仓库文件树中选择同步文件</div>
                  </div>
                  <v-spacer />
                  <v-btn icon variant="text" @click="fileTreeDialogOpen = false">
                    <v-icon size="20">mdi-close</v-icon>
                  </v-btn>
                </v-card-title>
                <v-divider />
                <v-card-text>
                  <v-alert v-if="fileTreeError" type="error" variant="tonal" class="mb-3">
                    {{ fileTreeError }}
                  </v-alert>
                  <v-alert v-if="fileTreeLimitExceeded" type="warning" variant="tonal" class="mb-3">
                    该目录子项超过100个，仅显示前100项。
                  </v-alert>

                  <div class="d-flex align-center flex-wrap ga-2 mb-3">
                    <v-btn
                      size="small"
                      variant="tonal"
                      prepend-icon="mdi-arrow-up"
                      :disabled="!fileTreePath"
                      @click="goFileTreeUp"
                    >
                      上一级
                    </v-btn>
                    <div class="text-caption text-medium-emphasis">
                      当前目录: /{{ fileTreePath || '' }}
                    </div>
                    <v-spacer />
                  </div>

                  <v-text-field
                    v-model="fileTreeSearch"
                    label="搜索文件"
                    prepend-inner-icon="mdi-magnify"
                    clearable
                    class="mb-3"
                  />

                  <div v-if="fileTreeLoading" class="d-flex align-center justify-center py-6">
                    <v-progress-circular color="primary" indeterminate />
                  </div>

                  <v-list v-else density="compact" class="git-sync-tree-list">
                    <v-list-item
                      v-for="item in fileTreeItems"
                      :key="item.path"
                      @click="handleFileTreeItem(item)"
                      class="git-sync-tree-item"
                    >
                      <template #prepend>
                        <v-icon size="18">
                          {{ item.type === 'dir' ? 'mdi-folder-outline' : 'mdi-file-outline' }}
                        </v-icon>
                      </template>
                      <v-list-item-title>{{ item.name }}</v-list-item-title>
                      <v-list-item-subtitle>{{ item.path }}</v-list-item-subtitle>
                      <template v-if="item.type === 'dir'" #append>
                        <v-icon size="16">mdi-chevron-right</v-icon>
                      </template>
                    </v-list-item>

                    <v-list-item v-if="!fileTreeItems.length">
                      <v-list-item-title class="text-center text-medium-emphasis">
                        暂无可选文件
                      </v-list-item-title>
                    </v-list-item>
                  </v-list>
                </v-card-text>
                <v-card-actions class="justify-end">
                  <v-btn variant="text" @click="fileTreeDialogOpen = false">关闭</v-btn>
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
                  color="primary"
                  variant="tonal"
                  prepend-icon="mdi-plus"
                  :disabled="!isAuthor || !links.length"
                  @click="openCreateDialog"
                >
                  创建仓库
                </v-btn>

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


            <div v-if="selectedRepoMeta || selectedRepoUrl" class="d-flex flex-wrap align-center ga-2 mb-3">
              <div v-if="selectedRepoMeta" class="text-caption text-medium-emphasis">
                {{ selectedRepoMeta }}
              </div>
              <v-btn
                v-if="selectedRepoUrl"
                size="small"
                variant="tonal"
                color="primary"
                :href="selectedRepoUrl"
                target="_blank"
                rel="noopener"
              >
                打开仓库
                <v-icon end size="14">mdi-open-in-new</v-icon>
              </v-btn>
            </div>

                  <v-expansion-panels variant="accordion" class="mb-3">
                    <v-expansion-panel>
                      <v-expansion-panel-title>高级设置</v-expansion-panel-title>
                      <v-expansion-panel-text>
                        <v-combobox
                          v-model="form.branch"
                          :items="branchOptions"
                          label="分支"
                          placeholder="main"
                          :disabled="!isAuthor"
                          clearable
                          class="mb-3"
                        />

                        <div class="d-flex align-center ga-2 mb-1">
                          <div class="text-subtitle-2">项目文件</div>
                          <v-spacer />
                          <v-btn
                            size="small"
                            variant="tonal"
                            :disabled="!isAuthor || !selectedRepoItem"
                            @click="openFileTreeDialog"
                          >
                            从仓库选择
                          </v-btn>
                        </div>

                        <v-text-field
                          v-model="form.fileName"
                          label="文件路径"
                          placeholder="project.json"
                          :disabled="!isAuthor"
                          class="mb-3"
                        />
                      </v-expansion-panel-text>
                    </v-expansion-panel>
                  </v-expansion-panels>

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
import { computed, getCurrentInstance, nextTick, reactive, ref, watch } from 'vue';
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
const createDialogOpen = ref(false);
const creatingRepo = ref(false);
const authorizingUserToken = ref(false);
const createError = ref('');

const message = ref('');
const messageType = ref('info');

const links = ref([]);
const repos = ref([]);
const selectedRepoItem = ref(null);
const settings = ref(null);
const state = ref(null);
const projectName = ref('');
const projectTitle = ref('');
const projectState = ref('private');

const projectDefaultBranch = ref('');
const projectBranches = ref([]);
const lastAutoBranch = ref('');
const desiredRepoFullName = ref('');
const repoSearchQuery = ref('');
const repoSearchToken = ref(0);
let repoSearchTimer = null;
const repoNameCheckToken = ref(0);
let repoNameCheckTimer = null;

const DEFAULT_PROJECT_FILE = 'project.json';
const DEFAULT_ARTICLE_FILE = 'README.md';

const form = reactive({
  branch: '',
  fileName: '',
  includeReadme: false,
});

const createForm = reactive({
  linkId: '',
  name: '',
  description: '',
  visibility: 'private',
  autoInit: true,
});

const repoNameCheckStatus = ref('idle');
const repoNameCheckMessage = ref('');
const checkingRepoName = ref(false);
const fileTreeDialogOpen = ref(false);
const fileTreeLoading = ref(false);
const fileTreeError = ref('');
const fileTreeEntries = ref([]);
const fileTreeSearch = ref('');
const fileTreePath = ref('');
const fileTreeLimitExceeded = ref(false);

const normalizedProjectType = computed(() => String(props.projectType || '').toLowerCase());
const isScratch = computed(() => normalizedProjectType.value.startsWith('scratch'));
const isArticle = computed(() => normalizedProjectType.value === 'article');

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

const linkOptions = computed(() => (links.value || []).map((link) => ({
  title: buildLinkLabel(link),
  value: link.id,
  subtitle: buildLinkOptionSubtitle(link),
  link,
})));


const selectedRepo = computed(() => selectedRepoItem.value?.repo || null);
const selectedRepoUrl = computed(() => (
  selectedRepo.value?.html_url || selectedRepo.value?.htmlUrl || ''
));
const selectedRepoOwner = computed(() => {
  const repo = selectedRepo.value;
  if (!repo) return '';
  if (repo.owner?.login) return repo.owner.login;
  const fullName = repo.full_name || repo.name || '';
  return fullName.includes('/') ? fullName.split('/')[0] : '';
});
const selectedRepoName = computed(() => {
  const repo = selectedRepo.value;
  if (!repo) return '';
  if (repo.name) return repo.name;
  const fullName = repo.full_name || '';
  return fullName.includes('/') ? fullName.split('/')[1] : fullName;
});

const selectedCreateLink = computed(() => (
  (links.value || []).find((link) => link.id === createForm.linkId) || null
));

const createLinkAccountType = computed(() => normalizeAccountType(selectedCreateLink.value?.account?.type));
const createNeedsUserToken = computed(() => (
  createLinkAccountType.value && createLinkAccountType.value !== 'organization'
  && !selectedCreateLink.value?.userTokenBound
));

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

const createRepoPreview = computed(() => {
  const account = selectedCreateLink.value?.account?.login || selectedCreateLink.value?.account?.id || '';
  const name = String(createForm.name || '').trim();
  if (!account && !name) return '';
  return `${account || 'account'}/${name || 'repo'}`;
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
const repoNameCheckBlocking = computed(() => (
  ['checking', 'invalid', 'taken', 'needs_token'].includes(repoNameCheckStatus.value)
));
const canCreateRepo = computed(() => (
  Boolean(props.isAuthor && createForm.linkId && String(createForm.name || '').trim())
  && !createNeedsUserToken.value
  && !repoNameCheckBlocking.value
));

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

const normalizeAccountType = (value) => String(value || '').trim().toLowerCase();

const isUserAccount = (link) => normalizeAccountType(link?.account?.type) === 'user';

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
  if (isUserAccount(link)) {
    details.push(link?.userTokenBound ? 'App User Token 已授权' : 'App User Token 未授权');
  }
  return details.join(' · ');
};

const buildLinkOptionSubtitle = (link) => {
  const parts = [];
  if (link?.account?.login) {
    parts.push(`@${link.account.login}`);
  } else if (link?.account?.id) {
    parts.push(String(link.account.id));
  }
  if (isUserAccount(link)) {
    parts.push(link?.userTokenBound ? 'App User Token 已授权' : 'App User Token 未授权');
  }
  return parts.join(' · ');
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

const buildDefaultRepoName = () => {
  const candidates = [projectName.value, projectTitle.value];
  for (const candidate of candidates) {
    const normalized = sanitizeRepoName(candidate);
    if (normalized) return normalized;
  }
  if (props.projectId) return `project-${props.projectId}`;
  return '';
};

const resolveProjectVisibility = () => {
  const normalized = String(projectState.value || '').trim().toLowerCase();
  return normalized === 'public' ? 'public' : 'private';
};

const resolveDefaultFileName = () => (
  isArticle.value ? DEFAULT_ARTICLE_FILE : DEFAULT_PROJECT_FILE
);

const resolveDefaultIncludeReadme = () => (
  isArticle.value ? false : true
);

const sanitizeRepoName = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  let next = raw.replace(/\s+/g, '-');
  next = next.replace(/[^0-9A-Za-z._-]/g, '-');
  next = next.replace(/-+/g, '-');
  next = next.replace(/^[-._]+|[-._]+$/g, '');
  return next.slice(0, 100);
};

const isValidRepoName = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return false;
  if (raw.length > 100) return false;
  return /^[0-9A-Za-z._-]+$/.test(raw);
};

const setRepoNameCheckState = (status, message = '') => {
  repoNameCheckStatus.value = status;
  repoNameCheckMessage.value = message;
};

const repoNameStatusColor = computed(() => {
  if (repoNameCheckStatus.value === 'available') return 'success';
  if (repoNameCheckStatus.value === 'taken') return 'error';
  if (repoNameCheckStatus.value === 'invalid') return 'warning';
  if (repoNameCheckStatus.value === 'needs_token') return 'warning';
  if (repoNameCheckStatus.value === 'error') return 'error';
  return 'info';
});

const repoNameStatusIcon = computed(() => {
  if (repoNameCheckStatus.value === 'available') return 'mdi-check-circle';
  if (repoNameCheckStatus.value === 'taken') return 'mdi-close-circle';
  if (repoNameCheckStatus.value === 'invalid') return 'mdi-alert-circle';
  if (repoNameCheckStatus.value === 'needs_token') return 'mdi-lock-alert';
  if (repoNameCheckStatus.value === 'error') return 'mdi-alert-circle';
  return 'mdi-information';
});

const showRepoNameStatus = computed(() => repoNameCheckStatus.value !== 'idle');

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
    form.fileName = resolveDefaultFileName();
    form.includeReadme = resolveDefaultIncludeReadme();
    return;
  }
  form.branch = nextSettings.branch || '';
  form.fileName = nextSettings.fileName || resolveDefaultFileName();
  form.includeReadme = nextSettings.includeReadme ?? resolveDefaultIncludeReadme();
};

const openLinkDialog = (link) => {
  if (!link?.id) return;
  activeLink.value = link;
  linkDialogOpen.value = true;
};

const ensureCreateLink = () => {
  if (!links.value.length) {
    createForm.linkId = '';
    return;
  }
  if (!links.value.some((link) => link.id === createForm.linkId)) {
    createForm.linkId = links.value[0]?.id || '';
  }
};

const resetCreateForm = () => {
  createError.value = '';
  createForm.name = buildDefaultRepoName();
  createForm.description = '';
  createForm.visibility = resolveProjectVisibility();
  createForm.autoInit = true;
  ensureCreateLink();
  scheduleRepoNameCheck();
};

const openCreateDialog = () => {
  resetCreateForm();
  createDialogOpen.value = true;
};

const scheduleRepoNameCheck = () => {
  if (repoNameCheckTimer) {
    clearTimeout(repoNameCheckTimer);
  }

  const name = String(createForm.name || '').trim();
  const linkId = String(createForm.linkId || '').trim();

  if (!name || !linkId) {
    setRepoNameCheckState('idle', '');
    checkingRepoName.value = false;
    return;
  }

  if (!isValidRepoName(name)) {
    setRepoNameCheckState('invalid', '名称仅支持字母、数字、.-_，且长度不超过100');
    checkingRepoName.value = false;
    return;
  }

  repoNameCheckTimer = setTimeout(async () => {
    const token = repoNameCheckToken.value + 1;
    repoNameCheckToken.value = token;
    checkingRepoName.value = true;
    setRepoNameCheckState('checking', '正在检查名称是否可用...');

    try {
      const res = await GitSyncService.checkRepoName(linkId, name);
      if (repoNameCheckToken.value !== token) return;
      const available = res?.available === true;
      setRepoNameCheckState(
        available ? 'available' : 'taken',
        available ? '名称可用' : '名称已被占用'
      );
    } catch (error) {
      if (repoNameCheckToken.value !== token) return;
      const code = error?.response?.data?.code;
      if (code === 'user_token_required') {
        setRepoNameCheckState('needs_token', '需要先授权 App User Token 才能检查名称');
      } else {
        setRepoNameCheckState('error', error?.message || '无法检查名称');
      }
    } finally {
      if (repoNameCheckToken.value === token) {
        checkingRepoName.value = false;
      }
    }
  }, 450);
};

const fileTreeItems = computed(() => {
  const entries = Array.isArray(fileTreeEntries.value) ? fileTreeEntries.value : [];
  const normalized = entries
    .map((entry) => {
      const path = String(entry?.path || '').trim();
      if (!path) return null;
      const name = String(entry?.name || '').trim() || path.split('/').pop() || path;
      return {
        path,
        name,
        type: entry?.type || '',
        size: entry?.size ?? null,
      };
    })
    .filter(Boolean);

  const keyword = String(fileTreeSearch.value || '').trim().toLowerCase();
  const filtered = keyword
    ? normalized.filter((item) => (
      item.name.toLowerCase().includes(keyword)
      || item.path.toLowerCase().includes(keyword)
    ))
    : normalized;

  return filtered.sort((a, b) => {
    const aDir = a.type === 'dir';
    const bDir = b.type === 'dir';
    if (aDir !== bDir) return aDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
});

const loadFileTree = async (path) => {
  fileTreeLoading.value = true;
  fileTreeError.value = '';
  fileTreeSearch.value = '';
  fileTreeEntries.value = [];
  fileTreeLimitExceeded.value = false;
  try {
    const repo = selectedRepo.value;
    const res = await GitSyncService.getRepoTree({
      linkId: repo?.gitLinkId,
      repoOwner: selectedRepoOwner.value,
      repoName: selectedRepoName.value,
      branch: form.branch || repo?.default_branch || projectDefaultBranch.value || undefined,
      path: path || undefined,
    });
    fileTreeEntries.value = res.entries || [];
    fileTreePath.value = res.path || path || '';
    fileTreeLimitExceeded.value = res.limitExceeded === true;
  } catch (error) {
    fileTreeError.value = error?.response?.data?.message || error?.message || '加载文件夹失败';
  } finally {
    fileTreeLoading.value = false;
  }
};

const openFileTreeDialog = async () => {
  if (!selectedRepoItem.value?.repo || !selectedRepoOwner.value || !selectedRepoName.value) {
    setMessage('warning', '请先选择仓库');
    return;
  }

  fileTreeDialogOpen.value = true;
  await loadFileTree('');
};

const goFileTreeUp = async () => {
  if (!fileTreePath.value) return;
  const parts = fileTreePath.value.split('/').filter(Boolean);
  parts.pop();
  await loadFileTree(parts.join('/'));
};

const handleFileTreeItem = async (item) => {
  if (!item?.path) return;
  if (item.type === 'dir') {
    await loadFileTree(item.path);
    return;
  }
  selectFileFromTree(item.path);
};

const selectFileFromTree = (path) => {
  if (!path) return;
  form.fileName = path;
  fileTreeDialogOpen.value = false;
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
    ensureCreateLink();
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
    projectName.value = res.projectName || '';
    projectTitle.value = res.projectTitle || '';
    projectState.value = res.projectState || 'private';
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
    const res = await GitSyncService.createInstallUrl(redirectUrl, { autoUserToken: true });
    if (res.url) {
      window.open(res.url, '_blank', 'noopener');
      notify('info', 'Install', '完成安装后会尝试授权 App User Token，请稍后刷新。');
    } else {
      throw new Error(res.message || 'Missing install URL.');
    }
  } catch (error) {
    setMessage('error', error?.message || 'Failed to start install.');
  } finally {
    installing.value = false;
  }
};

const startUserTokenAuth = async () => {
  if (!selectedCreateLink.value?.id) return;
  authorizingUserToken.value = true;
  createError.value = '';
  try {
    const redirectUrl = typeof window !== 'undefined' ? window.location.href : '';
    const res = await GitSyncService.createUserTokenUrl(redirectUrl, selectedCreateLink.value.id);
    if (res.url) {
      window.open(res.url, '_blank', 'noopener');
      notify('info', '授权', '完成授权后刷新账号列表。');
    } else {
      throw new Error(res.message || 'Missing auth URL.');
    }
  } catch (error) {
    createError.value = error?.message || '无法发起授权。';
  } finally {
    authorizingUserToken.value = false;
  }
};

const startUserTokenAuthForLink = async (link) => {
  if (!link?.id) return;
  authorizingUserToken.value = true;
  try {
    const redirectUrl = typeof window !== 'undefined' ? window.location.href : '';
    const res = await GitSyncService.createUserTokenUrl(redirectUrl, link.id);
    if (res.url) {
      window.open(res.url, '_blank', 'noopener');
      notify('info', '授权', '完成授权后刷新账号列表。');
    } else {
      throw new Error(res.message || 'Missing auth URL.');
    }
  } catch (error) {
    notify('error', '授权失败', error?.message || '无法发起授权。');
  } finally {
    authorizingUserToken.value = false;
  }
};

const createRepo = async () => {
  if (!canCreateRepo.value) return;
  creatingRepo.value = true;
  createError.value = '';
  try {
    const payload = {
      linkId: createForm.linkId,
      name: String(createForm.name || '').trim(),
      description: String(createForm.description || '').trim(),
      private: createForm.visibility === 'private',
      autoInit: true,
    };

    const res = await GitSyncService.createRepo(payload);
    const repo = res.repository || null;
    if (repo) {
      const key = repo.full_name || repo.name;
      if (key) {
        desiredRepoFullName.value = key;
        repos.value = [repo, ...repos.value.filter((item) => (item.full_name || item.name) !== key)];
        await nextTick();
        syncSelectedRepo();
        await nextTick();
      } else {
        repos.value = [repo, ...repos.value];
      }
    }
    createDialogOpen.value = false;
    notify('success', '创建成功', '仓库已创建。');
    if (props.projectId && selectedRepoItem.value?.repo?.gitLinkId) {
      await bindProject();
    }
  } catch (error) {
    createError.value = error?.message || '创建仓库失败。';
  } finally {
    creatingRepo.value = false;
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

watch([() => createForm.name, () => createForm.linkId], () => {
  if (!createDialogOpen.value) return;
  scheduleRepoNameCheck();
});

watch(createDialogOpen, (value) => {
  if (value) {
    scheduleRepoNameCheck();
  } else if (repoNameCheckTimer) {
    clearTimeout(repoNameCheckTimer);
  }
});

watch(fileTreeDialogOpen, (value) => {
  if (!value) {
    fileTreeSearch.value = '';
    fileTreeEntries.value = [];
    fileTreePath.value = '';
    fileTreeLimitExceeded.value = false;
  }
});
</script>

<style scoped>

.git-sync-chip {
  cursor: pointer;
}

.git-sync-create-hero {
  --hero-bg: linear-gradient(135deg, #e0f2ff 0%, #fef3c7 55%, #e8ffe1 100%);
  --hero-ring: rgba(14, 116, 144, 0.12);
  background: var(--hero-bg);
  border: 1px solid var(--hero-ring);
  border-radius: 16px;
  padding: 16px 18px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 16px 30px -24px rgba(14, 116, 144, 0.6);
  background-size: 200% 200%;
  animation: git-sync-hero-shift 10s ease-in-out infinite;
}

@media (prefers-color-scheme: dark) {
  .git-sync-create-hero {
    --hero-bg: linear-gradient(135deg, #0b1f2a 0%, #2a1d0d 55%, #122214 100%);
    --hero-ring: rgba(148, 163, 184, 0.18);
    box-shadow: 0 18px 34px -26px rgba(15, 23, 42, 0.8);
  }
}


.git-sync-create-preview {
  font-family: 'Noto Sans SC', 'HarmonyOS Sans', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  letter-spacing: 0.3px;
}

.git-sync-visibility {
  background: rgba(15, 23, 42, 0.04);
  border-radius: 999px;
  padding: 2px;
}

.git-sync-name-status {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: -8px;
  margin-bottom: 8px;
}

.git-sync-tree-list {
  max-height: 360px;
  overflow: auto;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 12px;
}

.git-sync-tree-item {
  cursor: pointer;
}

@keyframes git-sync-hero-shift {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}
</style>
