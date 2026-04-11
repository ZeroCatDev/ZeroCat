<template>
  <div class="composer-toolbar" :class="{ 'composer-toolbar--compact': compact }">
    <div class="toolbar-actions">
      <!-- 图片上传 -->
      <v-tooltip text="图片" location="bottom">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-bind="tooltipProps"
            icon
            size="small"
            variant="text"
            color="primary"
            :disabled="disabled || assetsCount >= 4"
            @click="$emit('upload')"
          >
            <v-icon size="20">mdi-image-outline</v-icon>
          </v-btn>
        </template>
      </v-tooltip>

      <!-- 表情选择 -->
      <v-menu
        v-model="emojiMenuOpen"
        :close-on-content-click="false"
        location="bottom start"
        :z-index="2100"
      >
        <template #activator="{ props: menuProps }">
          <v-tooltip text="表情" location="bottom">
            <template #activator="{ props: tooltipProps }">
              <v-btn
                v-bind="{ ...menuProps, ...tooltipProps }"
                icon
                size="small"
                variant="text"
                color="primary"
                :disabled="disabled"
              >
                <v-icon size="20">mdi-emoticon-outline</v-icon>
              </v-btn>
            </template>
          </v-tooltip>
        </template>
        <v-card class="emoji-menu" min-width="340" max-width="380">
          <div v-if="recentEmojis.length" class="emoji-recent">
            <div class="emoji-recent-header">
              <span class="emoji-recent-title">最近使用</span>
            </div>
            <div class="emoji-recent-list">
              <v-btn
                v-for="emoji in recentEmojis"
                :key="emoji"
                variant="text"
                size="small"
                class="emoji-recent-item"
                @click="selectRecentEmoji(emoji)"
              >
                <span
                  class="emoji-recent-item-content"
                  v-html="renderTwemojiEmoji(emoji)"
                />
              </v-btn>
            </div>
          </div>
          <emoji-picker
            ref="emojiPickerRef"
            class="emoji-picker-panel"
            @emoji-click="handleEmojiClick"
          />
        </v-card>
      </v-menu>

      <!-- 嵌入内容 -->
      <v-menu
        v-model="embedMenuOpen"
        :close-on-content-click="false"
        location="bottom start"
        :z-index="2100"
      >
        <template #activator="{ props: menuProps }">
          <v-tooltip text="嵌入内容" location="bottom">
            <template #activator="{ props: tooltipProps }">
              <v-btn
                v-bind="{ ...menuProps, ...tooltipProps }"
                icon
                size="small"
                variant="text"
                :color="hasEmbed ? 'success' : 'primary'"
                :disabled="disabled"
              >
                <v-icon size="20">mdi-link-plus</v-icon>
              </v-btn>
            </template>
          </v-tooltip>
        </template>
        <v-card class="embed-menu" min-width="340" max-width="400">
          <v-card-text class="pa-3">
            <!-- 快捷嵌入插槽 -->
            <slot name="embed-quick" />

            <!-- 手动嵌入 -->
            <div class="embed-section-label">手动添加</div>
            <v-tabs v-model="localEmbedType" density="compact" class="mb-3">
              <v-tab value="project">项目</v-tab>
              <v-tab value="list">列表</v-tab>
              <v-tab value="user">用户</v-tab>
            </v-tabs>

            <v-window v-model="localEmbedType">
              <!-- 项目选择 -->
              <v-window-item value="project">
                <ProjectSelector
                  v-model="selectedProjectId"
                  compact
                  label="选择项目"
                  placeholder="输入ID或用户名/项目名"
                  density="compact"
                  hide-details
                  :default-only-mine="true"
                  class="mb-2"
                  @select="onProjectSelect"
                />

                <template v-if="selectedProjectId">
                  <!-- 分支选择 -->
                  <v-autocomplete
                    v-model="localEmbedBranch"
                    :items="branches"
                    :loading="loadingBranches"
                    label="分支（可选）"
                    placeholder="选择分支"
                    density="compact"
                    variant="outlined"
                    hide-details
                    clearable
                    class="mb-2"
                    @update:model-value="onBranchSelect"
                  >
                    <template #item="{ item, props: itemProps }">
                      <v-list-item v-bind="itemProps">
                        <template #prepend>
                          <v-icon size="18" color="primary">mdi-source-branch</v-icon>
                        </template>
                      </v-list-item>
                    </template>
                  </v-autocomplete>

                  <!-- 提交选择 -->
                  <v-autocomplete
                    v-model="localEmbedCommit"
                    :items="commits"
                    :loading="loadingCommits"
                    item-value="id"
                    item-title="displayTitle"
                    label="提交（可选）"
                    placeholder="选择提交"
                    density="compact"
                    variant="outlined"
                    hide-details
                    clearable
                    class="mb-2"
                    :disabled="!localEmbedBranch"
                  >
                    <template #item="{ item, props: itemProps }">
                      <v-list-item v-bind="itemProps" :title="undefined">
                        <template #prepend>
                          <v-icon size="18" color="secondary">mdi-source-commit</v-icon>
                        </template>
                        <v-list-item-title class="text-body-2">
                          {{ item.raw.message || '无提交信息' }}
                        </v-list-item-title>
                        <v-list-item-subtitle class="text-caption">
                          <code class="text-primary">{{ item.raw.id?.slice(0, 7) }}</code>
                          <span v-if="item.raw.time" class="ml-2">
                            {{ formatCommitTime(item.raw.time) }}
                          </span>
                        </v-list-item-subtitle>
                      </v-list-item>
                    </template>
                    <template #selection="{ item }">
                      <code class="text-primary">{{ item.raw.id?.slice(0, 7) }}</code>
                      <span class="ml-1 text-truncate" style="max-width: 150px">
                        {{ item.raw.message }}
                      </span>
                    </template>
                  </v-autocomplete>
                </template>
              </v-window-item>

              <!-- 列表选择 -->
              <v-window-item value="list">
                <ListSelector
                  v-model="selectedListId"
                  label="选择列表"
                  placeholder="搜索列表..."
                  density="compact"
                  hide-details
                  class="mb-2"
                  @select="onListSelect"
                />
              </v-window-item>

              <!-- 用户选择 -->
              <v-window-item value="user">
                <UserSelector
                  v-model="selectedUserId"
                  label="选择用户"
                  placeholder="搜索用户名..."
                  density="compact"
                  hide-details
                  class="mb-2"
                  @select="onUserSelect"
                />
              </v-window-item>
            </v-window>

            <v-btn
              block
              color="primary"
              variant="flat"
              size="small"
              :disabled="!canAddEmbed"
              :loading="addingEmbed"
              @click="handleAddEmbed"
            >
              添加
            </v-btn>
          </v-card-text>
        </v-card>
      </v-menu>

      <!-- 扩展插槽 -->
      <slot name="actions" />
    </div>

    <div class="toolbar-right">
      <!-- 字数统计圆环 -->
      <div class="toolbar-counter">
        <v-progress-circular
          :model-value="countProgress"
          :size="compact ? 20 : 24"
          :width="2"
          :color="countColor"
          bg-color="grey-lighten-2"
        />
        <span
          v-if="showCountNumber"
          class="toolbar-counter-text"
          :class="countTextClass"
        >
          {{ countRemaining }}
        </span>
      </div>

      <template v-if="!hideSubmit">
        <v-divider vertical class="mx-2" />

        <!-- 发布按钮 -->
        <v-btn
          color="primary"
          variant="flat"
          :size="compact ? 'small' : 'default'"
          :disabled="disabled || !canSubmit"
          :loading="submitting"
          class="toolbar-submit"
          @click="$emit('submit')"
        >
          {{ submitLabel }}
        </v-btn>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import 'emoji-picker-element';
import twemoji from 'twemoji';
import { TWEMOJI_SVG_OPTIONS } from '@/utils/twemoji';
import { getBranchs } from '@/services/projectService';
import axios from '@/axios/axios';
import { get as getCacheKv, set as setCacheKv } from '@/services/cachekv';
import { localuser } from '@/services/localAccount';
import ProjectSelector from '@/components/shared/ProjectSelector.vue';
import ListSelector from '@/components/shared/ListSelector.vue';
import UserSelector from '@/components/shared/UserSelector.vue';

const props = defineProps({
  disabled: { type: Boolean, default: false },
  assetsCount: { type: Number, default: 0 },
  hasEmbed: { type: Boolean, default: false },
  charCount: { type: Number, default: 0 },
  charLimit: { type: Number, default: 280 },
  compact: { type: Boolean, default: false },
  hideSubmit: { type: Boolean, default: false },
  canSubmit: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  submitLabel: { type: String, default: '发布' }
});

const emit = defineEmits(['upload', 'add-embed', 'submit', 'emoji-select']);

// 嵌入菜单状态
const emojiMenuOpen = ref(false);
const emojiPickerRef = ref(null);
const embedMenuOpen = ref(false);
const localEmbedType = ref('project');
const addingEmbed = ref(false);
let emojiShadowObserver = null;
let emojiParseFrame = null;
let emojiRetryTimer = null;
let applyingPickerTwemoji = false;
const recentEmojis = ref([]);

const TWEMOJI_STYLE_ID = 'zerocat-twemoji-style';
const RECENT_EMOJI_KEY = 'composer_recent_emojis';
const MAX_RECENT_EMOJIS = 24;

const hasAccessToken = () => {
  try {
    return !!localuser?.isLogin?.value;
  } catch {
    return false;
  }
};

const normalizeRecentEmojis = (value) => {
  if (!Array.isArray(value)) return [];
  const list = [];
  const seen = new Set();
  for (const item of value) {
    const emoji = String(item || '').trim();
    if (!emoji || seen.has(emoji)) continue;
    seen.add(emoji);
    list.push(emoji);
    if (list.length >= MAX_RECENT_EMOJIS) break;
  }
  return list;
};

const loadRecentEmojis = async () => {
  if (!hasAccessToken()) {
    recentEmojis.value = [];
    return;
  }
  try {
    const value = await getCacheKv(RECENT_EMOJI_KEY);
    if (value == null) {
      recentEmojis.value = [];
      return;
    }
    if (typeof value === 'string') {
      try {
        recentEmojis.value = normalizeRecentEmojis(JSON.parse(value));
      } catch {
        recentEmojis.value = normalizeRecentEmojis([value]);
      }
      return;
    }
    recentEmojis.value = normalizeRecentEmojis(value);
  } catch (error) {
    console.error('Failed to load recent emojis:', error);
    recentEmojis.value = [];
  }
};

const saveRecentEmojis = async (list) => {
  if (!hasAccessToken()) return;
  try {
    await setCacheKv(RECENT_EMOJI_KEY, list);
  } catch (error) {
    console.error('Failed to save recent emojis:', error);
  }
};

const pushRecentEmoji = async (emoji) => {
  const normalized = String(emoji || '').trim();
  if (!normalized) return;
  const next = normalizeRecentEmojis([normalized, ...recentEmojis.value]);
  recentEmojis.value = next;
  await saveRecentEmojis(next);
};

const renderTwemojiEmoji = (emoji) => {
  const value = String(emoji || '').trim();
  if (!value) return '';
  return twemoji.parse(value, TWEMOJI_SVG_OPTIONS);
};

const ensureTwemojiStyleInShadow = (shadowRoot) => {
  if (!shadowRoot || shadowRoot.getElementById(TWEMOJI_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = TWEMOJI_STYLE_ID;
  style.textContent = `
    /* Disable skin tone picker UI entirely. */
    .skintone-button-wrapper,
    #skintone-button,
    #skintone-list,
    #skintone-description {
      display: none !important;
      pointer-events: none !important;
    }

    img.twemoji {
      width: 1.2em;
      height: 1.2em;
      margin: 0;
      vertical-align: -0.2em;
      pointer-events: none;
    }
  `;
  shadowRoot.appendChild(style);
};

const applyTwemojiToPicker = () => {
  const picker = emojiPickerRef.value;
  const shadowRoot = picker?.shadowRoot;
  if (!shadowRoot) return;

  ensureTwemojiStyleInShadow(shadowRoot);

  applyingPickerTwemoji = true;
  try {
    twemoji.parse(shadowRoot, TWEMOJI_SVG_OPTIONS);
  } finally {
    applyingPickerTwemoji = false;
  }
};

const scheduleApplyTwemojiToPicker = () => {
  if (emojiParseFrame != null) return;
  emojiParseFrame = window.requestAnimationFrame(() => {
    emojiParseFrame = null;
    applyTwemojiToPicker();
  });
};

const stopEmojiObserver = () => {
  if (emojiRetryTimer != null) {
    window.clearTimeout(emojiRetryTimer);
    emojiRetryTimer = null;
  }
  if (emojiParseFrame != null) {
    window.cancelAnimationFrame(emojiParseFrame);
    emojiParseFrame = null;
  }
  if (emojiShadowObserver) {
    emojiShadowObserver.disconnect();
    emojiShadowObserver = null;
  }
};

const startEmojiObserver = () => {
  const picker = emojiPickerRef.value;
  const shadowRoot = picker?.shadowRoot;
  if (!shadowRoot) return;

  stopEmojiObserver();

  emojiShadowObserver = new MutationObserver((mutations) => {
    if (applyingPickerTwemoji) return;
    if (mutations.length) {
      scheduleApplyTwemojiToPicker();
    }
  });

  emojiShadowObserver.observe(shadowRoot, {
    childList: true,
    subtree: true
  });
};

// 项目相关
const selectedProjectId = ref(null);
const selectedProject = ref(null);
const localEmbedBranch = ref('');
const localEmbedCommit = ref('');

// 分支和提交
const branches = ref([]);
const commits = ref([]);
const loadingBranches = ref(false);
const loadingCommits = ref(false);

// 列表和用户
const selectedListId = ref(null);
const selectedList = ref(null);
const selectedUserId = ref(null);
const selectedUser = ref(null);

// 是否可以添加嵌入
const canAddEmbed = computed(() => {
  if (localEmbedType.value === 'project') {
    return !!selectedProjectId.value;
  }
  if (localEmbedType.value === 'list') {
    return !!selectedListId.value;
  }
  if (localEmbedType.value === 'user') {
    return !!selectedUserId.value;
  }
  return false;
});

// 项目选择处理
const onProjectSelect = async (project) => {
  selectedProject.value = project;
  localEmbedBranch.value = '';
  localEmbedCommit.value = '';
  commits.value = [];

  if (project?.id) {
    await loadBranches(project.id);
  } else {
    branches.value = [];
  }
};

// 加载分支
const loadBranches = async (projectId) => {
  loadingBranches.value = true;
  try {
    const res = await getBranchs(projectId);
    // API 返回格式: { status, message, data: [{id, name, description, latest_commit_hash}] }
    const branchList = res?.data || res?.branches || res || [];
    branches.value = branchList.map((b) => (typeof b === 'string' ? b : b.name || b.branch));
    // 不默认选中分支
    localEmbedBranch.value = '';
  } catch (e) {
    console.error('Failed to load branches:', e);
    branches.value = [];
  } finally {
    loadingBranches.value = false;
  }
};

// 分支选择处理
const onBranchSelect = async (branch) => {
  localEmbedCommit.value = '';
  if (branch && selectedProjectId.value) {
    await loadCommits(selectedProjectId.value, branch);
  } else {
    commits.value = [];
  }
};

// 加载提交历史
const loadCommits = async (projectId, branch) => {
  loadingCommits.value = true;
  try {
    const res = await axios.get('/project/commits', {
      params: { projectid: projectId, branch, limit: 20 }
    });
    // API 返回格式: { status, message, data: [{id, commit_date, commit_message, author, ...}] }
    const commitList = res.data?.data || res.data?.commits || res.data || [];
    commits.value = commitList.map((c) => ({
      ...c,
      // 兼容字段名
      message: c.commit_message || c.message || '',
      time: c.commit_date || c.time || '',
      displayTitle: `${c.id?.slice(0, 7)} - ${c.commit_message || c.message || '无信息'}`
    }));
  } catch (e) {
    console.error('Failed to load commits:', e);
    commits.value = [];
  } finally {
    loadingCommits.value = false;
  }
};

// 列表选择处理
const onListSelect = (list) => {
  selectedList.value = list;
};

// 用户选择处理
const onUserSelect = (user) => {
  selectedUser.value = user;
};

const handleEmojiClick = (event) => {
  const emoji = event?.detail?.unicode || event?.detail?.emoji?.unicode;
  if (!emoji) return;
  pushRecentEmoji(emoji);
  emit('emoji-select', emoji);
};

const selectRecentEmoji = (emoji) => {
  if (!emoji) return;
  pushRecentEmoji(emoji);
  emit('emoji-select', emoji);
};

watch(emojiMenuOpen, async (open) => {
  if (open) {
    await loadRecentEmojis();
    await nextTick();
    scheduleApplyTwemojiToPicker();
    emojiRetryTimer = window.setTimeout(() => {
      emojiRetryTimer = null;
      scheduleApplyTwemojiToPicker();
    }, 180);
    startEmojiObserver();
    return;
  }
  stopEmojiObserver();
});

onBeforeUnmount(() => {
  stopEmojiObserver();
});

// 格式化提交时间
const formatCommitTime = (time) => {
  if (!time) return '';
  const date = new Date(time);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 2592000000) return `${Math.floor(diff / 86400000)} 天前`;

  return date.toLocaleDateString('zh-CN');
};

const handleAddEmbed = () => {
  let embed;

  if (localEmbedType.value === 'project') {
    if (!selectedProjectId.value) return;
    embed = { type: 'project', id: Number(selectedProjectId.value) };
    if (localEmbedBranch.value?.trim()) embed.branch = localEmbedBranch.value.trim();
    if (localEmbedCommit.value?.trim()) embed.commit = localEmbedCommit.value.trim();
  } else if (localEmbedType.value === 'list') {
    if (!selectedListId.value) return;
    embed = { type: 'list', id: Number(selectedListId.value) };
  } else if (localEmbedType.value === 'user') {
    if (!selectedUserId.value) return;
    embed = { type: 'user', id: Number(selectedUserId.value) };
  }

  if (!embed) return;

  emit('add-embed', embed);
  embedMenuOpen.value = false;
  resetEmbedForm();
};

const resetEmbedForm = () => {
  selectedProjectId.value = null;
  selectedProject.value = null;
  localEmbedBranch.value = '';
  localEmbedCommit.value = '';
  branches.value = [];
  commits.value = [];
  selectedListId.value = null;
  selectedList.value = null;
  selectedUserId.value = null;
  selectedUser.value = null;
};

// 监听分支变化自动加载提交
watch(localEmbedBranch, (newBranch) => {
  if (newBranch && selectedProjectId.value) {
    loadCommits(selectedProjectId.value, newBranch);
  }
});

// 剩余字数
const countRemaining = computed(() => props.charLimit - props.charCount);

// 进度百分比
const countProgress = computed(() => {
  if (props.charLimit <= 0) return 0;
  return Math.min(100, Math.max(0, (props.charCount / props.charLimit) * 100));
});

// 颜色
const countColor = computed(() => {
  if (countRemaining.value < 0) return 'error';
  if (countRemaining.value <= 20) return 'warning';
  return 'primary';
});

// 是否显示数字
const showCountNumber = computed(() => countRemaining.value <= 20);

// 数字样式
const countTextClass = computed(() => ({
  'text-error': countRemaining.value < 0,
  'text-warning': countRemaining.value >= 0 && countRemaining.value <= 20
}));
</script>

<style scoped>
.composer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.composer-toolbar--compact {
  padding-top: 6px;
}

.toolbar-actions {
  display: flex;
  gap: 2px;
  margin-left: -8px;
}

.toolbar-right {
  display: flex;
  align-items: center;
}

.toolbar-counter {
  display: flex;
  align-items: center;
  gap: 6px;
}

.toolbar-counter-text {
  font-size: 13px;
  font-weight: 600;
  min-width: 24px;
  text-align: right;
}

.composer-toolbar--compact .toolbar-counter-text {
  font-size: 12px;
}

.toolbar-submit {
  min-width: 80px;
  font-weight: 700;
  border-radius: 20px;
}

.emoji-menu {
  border-radius: 12px !important;
  overflow: hidden;
}

.emoji-picker-panel {
  width: 100%;
  min-height: 380px;
}

.emoji-recent {
  padding: 10px 12px 8px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  background: rgba(var(--v-theme-on-surface), 0.02);
}

.emoji-recent-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.emoji-recent-title {
  font-size: 12px;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.62);
}

.emoji-recent-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.emoji-recent-item {
  min-width: 30px;
  width: 30px;
  height: 30px !important;
  padding: 0 !important;
  border-radius: 8px;
}

.emoji-recent-item-content {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.emoji-recent-item-content :deep(img.twemoji) {
  width: 1.2em;
  height: 1.2em;
  margin: 0;
  vertical-align: -0.2em;
}

.composer-toolbar--compact .toolbar-submit {
  min-width: 64px;
  border-radius: 18px;
}

/* 嵌入菜单 */
.embed-menu {
  border-radius: 12px !important;
}

.embed-section-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  margin-bottom: 8px;
}

.embed-menu :deep(.v-tabs) {
  min-height: 32px;
}

.embed-menu :deep(.v-tab) {
  min-width: 0;
  padding: 0 12px;
  font-size: 13px;
  text-transform: none;
}

.embed-menu :deep(.v-autocomplete) {
  font-size: 14px;
}

.embed-menu :deep(code) {
  font-size: 12px;
  background: rgba(var(--v-theme-primary), 0.1);
  padding: 1px 4px;
  border-radius: 3px;
}
</style>
