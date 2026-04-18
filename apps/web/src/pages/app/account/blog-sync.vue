<template>
  <v-container class="blog-sync-page" max-width="960">
    <div class="mb-6">
      <h1 class="text-h4 font-weight-medium mb-1">
        <v-icon start size="28">mdi-post-outline</v-icon>博客同步
      </h1>
      <p class="text-body-2 text-medium-emphasis">
        将你所有的文章类型项目自动同步到一个 GitHub 仓库，兼容 Hexo / Hugo 博客框架。
      </p>
    </div>

    <v-card border flat class="pa-5 mb-4">
      <div class="d-flex align-center ga-3 mb-2">
        <v-icon>mdi-github</v-icon>
        <div class="flex-grow-1">
          <div class="text-subtitle-1 font-weight-medium">启用博客同步</div>
          <div class="text-caption text-medium-emphasis">提交文章时自动写入目标仓库</div>
        </div>
        <v-switch
          v-model="form.enabled"
          color="primary"
          density="comfortable"
          hide-details
          inset
        />
      </div>
    </v-card>

    <BlogSyncStatusCard
      :settings="settings"
      :projects="projects"
    />

    <v-card border flat class="pa-5 mb-4">
      <div class="text-subtitle-2 mb-2">GitHub 账号</div>
      <GitAccountPicker
        v-model="form.linkId"
        label="选择 GitHub 账号"
        class="mb-4"
        @links="onLinksLoaded"
      />

      <div v-if="form.linkId" class="mb-4">
        <div class="text-subtitle-2 mb-2">目标仓库</div>
        <GitRepoPicker
          v-model="selectedRepo"
          :link-id="form.linkId"
          :owner-login="selectedLink?.account?.login || ''"
          default-repo-name="blog"
        />
      </div>

      <v-row dense>
        <v-col cols="12" md="6">
          <v-combobox
            v-model="form.branch"
            :items="branchItems"
            label="分支"
            placeholder="main"
            variant="outlined"
            density="comfortable"
            hide-details
            clearable
            :loading="branchLoading"
          />
        </v-col>
      </v-row>

      <div v-if="form.linkId && form.repoOwner && form.repoName" class="mt-4">
        <div class="text-subtitle-2 mb-2">目录</div>
        <div class="text-caption text-medium-emphasis mb-2">
          默认目录：{{ frameworkDefaultPath }}
        </div>
        <GitDirectoryPicker
          v-model="form.directory"
          :link-id="form.linkId"
          :repo-owner="form.repoOwner"
          :repo-name="form.repoName"
          :branch="form.branch || 'main'"
        />
      </div>
    </v-card>

    <v-card border flat class="pa-5 mb-4">
      <div class="text-subtitle-2 mb-2">博客框架</div>
      <v-radio-group v-model="form.framework" inline density="comfortable" hide-details class="mb-2">
        <v-radio value="hexo" label="Hexo" />
        <v-radio value="hugo" label="Hugo" />
        <v-radio value="valaxy" label="Valaxy" />
      </v-radio-group>
      <v-text-field
        v-model="form.fileNameTemplate"
        label="文件名模板"
        placeholder="{slug}.md"
        hint="支持 {slug} {id} {name}"
        persistent-hint
        variant="outlined"
        density="comfortable"
        class="mt-2"
      />

      <div class="text-subtitle-2 mt-4 mb-1">Front Matter</div>
      <div class="d-flex flex-wrap ga-3">
        <v-checkbox v-model="form.frontMatter.includeTitle" label="标题" density="compact" hide-details />
        <v-checkbox v-model="form.frontMatter.includeDate" label="日期" density="compact" hide-details />
        <v-checkbox v-model="form.frontMatter.includeTags" label="标签" density="compact" hide-details />
        <v-checkbox v-model="form.frontMatter.includeDescription" label="描述" density="compact" hide-details />
      </div>
    </v-card>

    <v-card border flat class="pa-5 mb-4">
      <div class="text-subtitle-2 mb-2">同步范围与安全</div>
      <v-checkbox
        v-model="form.excludeReadme"
        label="排除与用户名同名的项目（通常是个人主页 README）"
        density="compact"
        hide-details
      />
      <v-checkbox
        v-model="form.allowPrivateToPublic"
        label="允许把私密项目同步到公开仓库"
        density="compact"
        hide-details
      />
    </v-card>

    <div class="d-flex justify-space-between align-center mb-6">
      <v-btn
        variant="text"
        color="error"
        :disabled="saving || !form.enabled"
        @click="disable"
      >
        禁用博客同步
      </v-btn>
      <div class="d-flex ga-2">
        <v-btn
          variant="tonal"
          :loading="resyncing"
          :disabled="!settings?.enabled"
          @click="resync"
        >
          <v-icon start size="16">mdi-sync</v-icon>全量重同步
        </v-btn>
        <v-btn
          color="primary"
          :loading="saving"
          :disabled="!canSave"
          @click="save"
        >
          保存配置
        </v-btn>
      </div>
    </div>

    <v-card border flat class="pa-0">
      <v-list density="compact">
        <v-list-subheader>文章项目 ({{ projects.length }})</v-list-subheader>
        <v-list-item v-if="!projects.length">
          <v-list-item-title class="text-medium-emphasis">暂无文章项目</v-list-item-title>
        </v-list-item>
        <v-list-item
          v-for="p in projects"
          :key="p.id"
        >
          <template #prepend>
            <v-icon size="18">mdi-file-document-outline</v-icon>
          </template>
          <v-list-item-title>{{ p.title || p.name }}</v-list-item-title>
          <v-list-item-subtitle>
            <span class="text-medium-emphasis">{{ p.name }}</span>
            <template v-if="p.syncState?.filePath">
              · {{ p.syncState.filePath }}
            </template>
            <template v-if="p.syncState?.lastSyncedAt">
              · {{ formatTime(p.syncState.lastSyncedAt) }}
            </template>
            <span v-if="p.syncState?.lastError" class="text-error ms-1">
              · 错误: {{ p.syncState.lastError }}
            </span>
          </v-list-item-subtitle>
          <template #append>
            <v-chip v-if="p.state === 'private'" size="x-small" variant="tonal">私密</v-chip>
          </template>
        </v-list-item>
      </v-list>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useHead } from '@unhead/vue';
import { useToast } from 'primevue/usetoast';
import GitSyncService from '@/services/gitSyncService';
import BlogSyncService from '@/services/blogSyncService';
import GitAccountPicker from '@/components/GitAccountPicker.vue';
import GitRepoPicker from '@/components/GitRepoPicker.vue';
import GitDirectoryPicker from '@/components/GitDirectoryPicker.vue';
import BlogSyncStatusCard from '@/components/BlogSyncStatusCard.vue';

useHead({ title: '博客同步' });

const toast = useToast();
const notify = (severity, summary, detail) => toast.add({ severity, summary, detail, life: 3000 });

const links = ref([]);
const settings = ref(null);
const projects = ref([]);
const saving = ref(false);
const resyncing = ref(false);
const branchOptions = ref([]);
const branchLoading = ref(false);
const lastErrorMap = new Map();
const frameworkDefaults = {
  hexo: 'source/_posts',
  hugo: 'content/posts',
  valaxy: 'pages/posts',
};

function onLinksLoaded(list) {
  links.value = list || [];
  if (!form.repoOwner && selectedLink.value?.account?.login) {
    form.repoOwner = selectedLink.value.account.login;
  }
}

const form = reactive({
  enabled: false,
  linkId: null,
  repoOwner: '',
  repoName: '',
  branch: 'main',
  directory: 'source/_posts',
  framework: 'hexo',
  fileNameTemplate: '{slug}.md',
  excludeReadme: true,
  allowPrivateToPublic: false,
  frontMatter: {
    includeTitle: true,
    includeDate: true,
    includeTags: true,
    includeDescription: true,
  },
});

const selectedLink = computed(() => links.value.find((l) => l.id === form.linkId));

const selectedRepo = ref(null);
const branchItems = computed(() => {
  const items = new Set(['main']);
  branchOptions.value.forEach((b) => items.add(b));
  if (selectedRepo.value?.default_branch) items.add(selectedRepo.value.default_branch);
  if (form.branch) items.add(form.branch);
  return Array.from(items);
});
const frameworkDefaultPath = computed(() => frameworkDefaults[form.framework] || 'source/_posts');

watch(selectedRepo, async (repo) => {
  if (repo) {
    form.repoOwner = repo.owner;
    form.repoName = repo.name;
    if (!form.branch) form.branch = 'main';
    await loadBranches();
  } else {
    form.repoOwner = '';
    form.repoName = '';
    branchOptions.value = [];
  }
});
watch(() => form.linkId, () => {
  selectedRepo.value = null;
  branchOptions.value = [];
});

const canSave = computed(() => {
  return form.linkId && form.repoOwner && form.repoName && form.branch && !saving.value;
});

function formatTime(value) {
  if (!value) return '';
  try { return new Date(value).toLocaleString(); } catch { return value; }
}

async function loadSettings() {
  const res = await BlogSyncService.getSettings();
  if (res.status === 'success') {
    settings.value = res.settings;
    if (res.settings) {
      Object.assign(form, {
        enabled: res.settings.enabled || false,
        linkId: res.settings.linkId || null,
        repoOwner: res.settings.repoOwner || '',
        repoName: res.settings.repoName || '',
        branch: res.settings.branch || 'main',
        directory: res.settings.directory ?? 'source/_posts',
        framework: res.settings.framework || 'hexo',
        fileNameTemplate: res.settings.fileNameTemplate || '{slug}.md',
        excludeReadme: res.settings.excludeReadme !== false,
        allowPrivateToPublic: Boolean(res.settings.allowPrivateToPublic),
      });
      if (res.settings.frontMatter) {
        Object.assign(form.frontMatter, res.settings.frontMatter);
      }
      if (res.settings.repoOwner && res.settings.repoName) {
        selectedRepo.value = {
          owner: res.settings.repoOwner,
          name: res.settings.repoName,
          full_name: `${res.settings.repoOwner}/${res.settings.repoName}`,
          default_branch: res.settings.branch || 'main',
          private: !res.settings.repoIsPublic,
          existing: true,
        };
      }
    }
  }
}

async function loadBranches() {
  if (!form.linkId || !form.repoOwner || !form.repoName) {
    branchOptions.value = [];
    return;
  }
  branchLoading.value = true;
  try {
    const res = await GitSyncService.getRepoBranches({
      linkId: form.linkId,
      repoOwner: form.repoOwner,
      repoName: form.repoName,
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

async function loadProjects() {
  const res = await BlogSyncService.listProjects();
  if (res.status === 'success') {
    projects.value = res.projects || [];
    notifySyncFailures(projects.value);
  }
}

function notifySyncFailures(list) {
  if (!Array.isArray(list)) return;
  for (const project of list) {
    const error = project?.syncState?.lastError || '';
    if (!error) {
      lastErrorMap.delete(project?.id);
      continue;
    }
    const previous = lastErrorMap.get(project?.id);
    if (previous === error) continue;
    lastErrorMap.set(project?.id, error);
    const name = project?.title || project?.name || `#${project?.id || ''}`;
    notify('error', '博客同步失败', `${name}: ${error}`);
  }
}

async function installGitHub() {
  const res = await GitSyncService.createInstallUrl(window.location.pathname);
  if (res.status === 'success' && res.url) window.open(res.url, '_blank', 'noopener');
}

async function save() {
  saving.value = true;
  try {
    const res = await BlogSyncService.updateSettings({ ...form });
    if (res.status === 'success') {
      notify('success', '已保存', '博客同步配置已更新');
      settings.value = res.settings;
      await loadProjects();
    } else {
      notify('error', '保存失败', res.message || '未知错误');
    }
  } catch (e) {
    notify('error', '保存失败', e?.response?.data?.message || e.message);
  } finally {
    saving.value = false;
  }
}

async function disable() {
  const res = await BlogSyncService.disable();
  if (res.status === 'success') {
    settings.value = res.settings;
    form.enabled = false;
    notify('success', '已禁用', '博客同步已关闭');
  }
}

async function resync() {
  resyncing.value = true;
  try {
    const res = await BlogSyncService.resyncAll();
    if (res.status === 'success') {
      notify('success', '已入队', `正在同步 ${res.total || 0} 个项目`);
      setTimeout(loadProjects, 1500);
    } else {
      notify('error', '失败', res.message || '未知错误');
    }
  } catch (e) {
    notify('error', '失败', e?.response?.data?.message || e.message);
  } finally {
    resyncing.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadSettings(), loadProjects()]);
  if (form.linkId && form.repoOwner && form.repoName) {
    await loadBranches();
  }
});
</script>

<style scoped>
.blog-sync-page {
  padding-top: 24px;
  padding-bottom: 48px;
}
</style>
