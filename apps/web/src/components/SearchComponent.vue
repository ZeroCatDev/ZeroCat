<template>
  <div class="search-component">
    <v-form @submit.prevent="handleSearch">
      <div class="search-input-row">
        <v-text-field
          v-model="searchQuery"
          :loading="isLoading"
          class="search-input"
          clearable
          hide-details
          label="搜索"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          @keyup.enter="handleSearch"
        />
        <v-btn
          :loading="isLoading"
          class="search-button"
          color="primary"
          height="56"
          min-width="56"
          @click="handleSearch"
        >
          <v-icon>mdi-magnify</v-icon>
        </v-btn>
      </div>
    </v-form>

    <v-card v-if="!searchQuery.trim()" class="suggestions-card mt-3" flat>
      <v-card-text>
        <div v-if="searchHistory.length">
          <div class="text-subtitle-2 mb-2">搜索历史</div>
          <div class="d-flex flex-wrap ga-2">
            <v-chip
              v-for="(term, index) in searchHistory"
              :key="`${term}-${index}`"
              size="small"
              @click="handleHistoryClick(term)"
            >
              {{ term }}
            </v-chip>
          </div>
        </div>
      </v-card-text>
    </v-card>

    <template v-if="mode === 'page' && hasSearched">
      <div class="mt-4">
        <!-- Scope Tabs -->
        <v-tabs
          v-model="activeScope"
          color="primary"
          density="comfortable"
          @update:model-value="handleScopeChange"
        >
          <v-tab v-for="scopeItem in scopeOptions" :key="scopeItem.value" :value="scopeItem.value">
            {{ scopeItem.label }}
          </v-tab>
        </v-tabs>

        <!-- Filter Chips -->
        <div class="d-flex flex-wrap align-center ga-2 mt-3 mb-1">
          <!-- Order: projects -->
          <v-menu v-if="activeScope === 'projects'" v-model="menus.order">
            <template #activator="{ props: menuProps }">
              <v-chip
                v-bind="menuProps"
                :color="filters.orderBy ? 'primary' : undefined"
                :variant="filters.orderBy ? 'flat' : 'text'"
                border
                size="small"
              >
                {{ orderLabel || '排序' }}
                <template #append>
                  <v-icon v-if="filters.orderBy" size="16" @click.stop.prevent="setFilter('orderBy', '')">mdi-close-circle</v-icon>
                  <v-icon v-else size="16">mdi-chevron-down</v-icon>
                </template>
              </v-chip>
            </template>
            <v-list density="compact" min-width="150">
              <v-list-item
                v-for="opt in projectOrderOptions"
                :key="opt.value"
                :active="filters.orderBy === opt.value"
                @click="setFilter('orderBy', opt.value)"
              >
                <v-list-item-title>{{ opt.label }}</v-list-item-title>
              </v-list-item>
              <template v-if="filters.orderBy">
                <v-divider />
                <v-list-item @click="setFilter('orderBy', '')">
                  <v-list-item-title class="text-error">清除</v-list-item-title>
                </v-list-item>
              </template>
            </v-list>
          </v-menu>

          <!-- State: projects, lists -->
          <v-menu v-if="showStateFilter" v-model="menus.state">
            <template #activator="{ props: menuProps }">
              <v-chip
                v-bind="menuProps"
                :color="filters.state ? 'primary' : undefined"
                :variant="filters.state ? 'flat' : 'text'"
                border
                size="small"
              >
                {{ stateLabel || '状态' }}
                <template #append>
                  <v-icon v-if="filters.state" size="16" @click.stop.prevent="setFilter('state', '')">mdi-close-circle</v-icon>
                  <v-icon v-else size="16">mdi-chevron-down</v-icon>
                </template>
              </v-chip>
            </template>
            <v-list density="compact" min-width="120">
              <v-list-item
                v-for="opt in projectStateOptions"
                :key="opt.value"
                :active="filters.state === opt.value"
                @click="setFilter('state', opt.value)"
              >
                <v-list-item-title>{{ opt.label }}</v-list-item-title>
              </v-list-item>
              <template v-if="filters.state">
                <v-divider />
                <v-list-item @click="setFilter('state', '')">
                  <v-list-item-title class="text-error">清除</v-list-item-title>
                </v-list-item>
              </template>
            </v-list>
          </v-menu>

          <!-- Type: projects -->
          <v-menu v-if="activeScope === 'projects'" v-model="menus.type" :close-on-content-click="false">
            <template #activator="{ props: menuProps }">
              <v-chip
                v-bind="menuProps"
                :color="filters.type ? 'primary' : undefined"
                :variant="filters.type ? 'flat' : 'text'"
                border
                size="small"
              >
                {{ typeLabel || '类型' }}
                <template #append>
                  <v-icon v-if="filters.type" size="16" @click.stop.prevent="setFilter('type', '')">mdi-close-circle</v-icon>
                  <v-icon v-else size="16">mdi-chevron-down</v-icon>
                </template>
              </v-chip>
            </template>
            <v-card min-width="260" max-height="380">
              <v-card-text class="pa-3 pb-0">
                <v-text-field
                  v-model="typeSearchQuery"
                  density="compact"
                  hide-details
                  placeholder="搜索项目类型..."
                  variant="outlined"
                  clearable
                  prepend-inner-icon="mdi-magnify"
                  autofocus
                />
              </v-card-text>
              <v-list density="compact" max-height="260" class="overflow-y-auto">
                <v-list-item
                  v-for="lang in filteredLanguages"
                  :key="lang.key"
                  :active="filters.type === lang.key"
                  @click="selectType(lang.key)"
                >
                  <template #prepend>
                    <v-icon size="18" class="mr-2">{{ lang.icon }}</v-icon>
                  </template>
                  <v-list-item-title>{{ lang.name }}</v-list-item-title>
                </v-list-item>
                <v-list-item v-if="!filteredLanguages.length" disabled>
                  <v-list-item-title class="text-medium-emphasis">无匹配结果</v-list-item-title>
                </v-list-item>
              </v-list>
              <template v-if="filters.type">
                <v-divider />
                <v-card-actions class="pa-2">
                  <v-btn block size="small" variant="text" color="error" @click="setFilter('type', '')">清除选择</v-btn>
                </v-card-actions>
              </template>
            </v-card>
          </v-menu>

          <!-- User: projects, posts, lists, project_files -->
          <v-menu v-if="showUserFilter" v-model="menus.user" :close-on-content-click="false">
            <template #activator="{ props: menuProps }">
              <v-chip
                v-bind="menuProps"
                :color="selectedUser ? 'primary' : undefined"
                :variant="selectedUser ? 'flat' : 'text'"
                border
                size="small"
              >
                <template v-if="selectedUser">
                  {{ selectedUser.display_name || selectedUser.username || ('用户 #' + selectedUser.id) }}
                </template>
                <template v-else>用户</template>
                <template #append>
                  <v-icon v-if="selectedUser" size="16" @click.stop.prevent="clearUser">mdi-close-circle</v-icon>
                  <v-icon v-else size="16">mdi-chevron-down</v-icon>
                </template>
              </v-chip>
            </template>
            <v-card min-width="300">
              <v-card-text class="pa-3">
                <UserSelector
                  :model-value="selectedUser ? selectedUser.id : null"
                  label="搜索用户"
                  placeholder="输入用户名..."
                  density="compact"
                  hide-details
                  @select="onUserSelected"
                />
              </v-card-text>
              <template v-if="selectedUser">
                <v-divider />
                <v-card-actions class="pa-2">
                  <v-btn block size="small" variant="text" color="error" @click="clearUser">清除选择</v-btn>
                </v-card-actions>
              </template>
            </v-card>
          </v-menu>

          <!-- Tags: projects -->
          <template v-if="activeScope === 'projects'">
            <v-chip
              v-for="tag in selectedTags"
              :key="'st-' + tag"
              size="small"
              color="primary"
              variant="flat"
              closable
              @click:close="removeTag(tag)"
            >
              #{{ tag }}
            </v-chip>
            <v-menu v-model="menus.tags" :close-on-content-click="false">
              <template #activator="{ props: menuProps }">
                <v-chip
                  v-bind="menuProps"
                  size="small"
                  variant="text"
                  border
                  append-icon="mdi-plus"
                >
                  标签
                </v-chip>
              </template>
              <v-card min-width="260" max-height="380">
                <v-card-text class="pa-3 pb-0">
                  <v-text-field
                    v-model="tagSearchQuery"
                    density="compact"
                    hide-details
                    placeholder="搜索标签..."
                    variant="outlined"
                    clearable
                    prepend-inner-icon="mdi-magnify"
                    :loading="tagSuggestionsLoading"
                    autofocus
                    @update:model-value="onTagSearchInput"
                    @keyup.enter="addTagFromInput"
                  />
                </v-card-text>
                <v-list density="compact" max-height="230" class="overflow-y-auto">
                  <v-list-item
                    v-for="tag in tagSuggestions"
                    :key="'sug-' + tag.name"
                    @click="addTag(tag.name)"
                  >
                    <v-list-item-title>
                      #{{ tag.name }}
                      <span class="text-medium-emphasis ml-1">({{ tag.count || 0 }})</span>
                    </v-list-item-title>
                    <template #append>
                      <v-icon v-if="selectedTags.includes(tag.name)" size="16" color="primary">mdi-check</v-icon>
                    </template>
                  </v-list-item>
                  <v-list-item v-if="tagSearchQuery && !tagSuggestionsLoading && !tagSuggestions.length" disabled>
                    <v-list-item-title class="text-medium-emphasis">无匹配标签</v-list-item-title>
                  </v-list-item>
                  <v-list-item v-if="!tagSearchQuery && !tagSuggestions.length" disabled>
                    <v-list-item-title class="text-medium-emphasis">输入关键词搜索标签</v-list-item-title>
                  </v-list-item>
                </v-list>
                <template v-if="tagSearchQuery && tagSearchQuery.trim()">
                  <v-divider />
                  <v-card-actions class="pa-2">
                    <v-btn block size="small" variant="tonal" color="primary" @click="addTagFromInput">
                      添加 "{{ tagSearchQuery.trim() }}"
                    </v-btn>
                  </v-card-actions>
                </template>
              </v-card>
            </v-menu>
          </template>

          <!-- Clear All Filters -->
          <v-chip v-if="hasActiveFilters" size="small" variant="text" @click="resetFilters">
            <v-icon start size="14">mdi-close-circle-outline</v-icon>
            清除筛选
          </v-chip>

          <v-spacer />

          <span v-if="totalCount > 0" class="text-caption text-medium-emphasis">
            共 {{ totalCount }} 个结果
          </span>
        </div>

        <v-divider class="mb-3" />

        <!-- Initial Loading -->
        <div v-if="isLoading && currentScopeItemCount === 0" class="d-flex justify-center py-8">
          <v-progress-circular indeterminate color="primary" size="32" width="3" />
        </div>

        <!-- Results -->
        <div v-else>
          <!-- Projects -->
          <template v-if="activeScope === 'projects'">
            <v-row v-if="results.projects.length">
              <v-col
                v-for="project in results.projects"
                :key="`project-${project.id}`"
                cols="12"
                sm="6"
                md="4"
                lg="3"
              >
                <ProjectCard :project="project" :author="project.author" :show-author="true" />
              </v-col>
            </v-row>
            <div v-else-if="!isLoading" class="text-center py-8">
              <v-icon size="48" class="text-medium-emphasis">mdi-folder-open-outline</v-icon>
              <p class="text-body-2 text-medium-emphasis mt-2">未找到项目结果</p>
            </div>
          </template>

          <!-- Posts -->
          <template v-else-if="activeScope === 'posts'">
            <PostList
              v-if="results.posts.length"
              :items="results.posts"
              :includes="{ posts: {} }"
              :loading="false"
              :loading-more="false"
              :has-more="false"
              empty-title="暂无帖子"
              empty-text="未找到匹配帖子"
              :infinite-scroll="false"
              @deleted="onPostDeleted"
            />
            <div v-else-if="!isLoading" class="text-center py-8">
              <v-icon size="48" class="text-medium-emphasis">mdi-message-text-outline</v-icon>
              <p class="text-body-2 text-medium-emphasis mt-2">未找到帖子结果</p>
            </div>
          </template>

          <!-- Users -->
          <template v-else-if="activeScope === 'users'">
            <v-list v-if="results.users.length" lines="two">
              <v-list-item
                v-for="user in results.users"
                :key="`user-${user.id || user.username}`"
                :to="`/${user.username || user.name}`"
              >
                <template #prepend>
                  <v-avatar size="40" class="mr-3">
                    <v-img :src="getUserAvatar(user.avatar)" :alt="user.display_name || user.username" />
                  </v-avatar>
                </template>
                <v-list-item-title>
                  {{ user.display_name || user.username || ('用户 #' + user.id) }}
                  <span class="text-medium-emphasis ml-1">@{{ user.username || user.name || user.id }}</span>
                </v-list-item-title>
                <v-list-item-subtitle>
                  {{ user.bio || user.description || '这个用户还没有简介。' }}
                </v-list-item-subtitle>
                <template #append>
                  <div class="d-flex ga-3 text-caption text-medium-emphasis">
                    <span>关注 {{ user.following_count || 0 }}</span>
                    <span>粉丝 {{ user.followers_count || 0 }}</span>
                  </div>
                </template>
              </v-list-item>
            </v-list>
            <div v-else-if="!isLoading" class="text-center py-8">
              <v-icon size="48" class="text-medium-emphasis">mdi-account-search-outline</v-icon>
              <p class="text-body-2 text-medium-emphasis mt-2">未找到用户结果</p>
            </div>
          </template>

          <!-- Lists -->
          <template v-else-if="activeScope === 'lists'">
            <v-list v-if="results.lists.length" lines="two">
              <v-list-item
                v-for="list in results.lists"
                :key="`list-${list.id}`"
                :to="`/app/projectlist/${list.id}`"
              >
                <template #prepend>
                  <v-icon class="mr-3">mdi-format-list-bulleted</v-icon>
                </template>
                <v-list-item-title>{{ list.title || list.name || ('列表 #' + list.id) }}</v-list-item-title>
                <v-list-item-subtitle>{{ list.description || '暂无描述' }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
            <div v-else-if="!isLoading" class="text-center py-8">
              <v-icon size="48" class="text-medium-emphasis">mdi-format-list-bulleted</v-icon>
              <p class="text-body-2 text-medium-emphasis mt-2">未找到列表结果</p>
            </div>
          </template>

          <!-- Project Files -->
          <template v-else-if="activeScope === 'project_files'">
            <v-list v-if="results.projectFiles.length" lines="two">
              <v-list-item
                v-for="file in results.projectFiles"
                :key="`file-${file.id || file.sha256 || file.path}`"
                :href="file.url || file.downloadUrl"
                :target="file.url || file.downloadUrl ? '_blank' : undefined"
              >
                <template #prepend>
                  <v-icon class="mr-3">mdi-file-outline</v-icon>
                </template>
                <v-list-item-title>{{ file.filename || file.path || file.name || '项目文件' }}</v-list-item-title>
                <v-list-item-subtitle>{{ file.projectTitle || file.projectName || file.sha256 || '' }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
            <div v-else-if="!isLoading" class="text-center py-8">
              <v-icon size="48" class="text-medium-emphasis">mdi-file-search-outline</v-icon>
              <p class="text-body-2 text-medium-emphasis mt-2">未找到项目文件结果</p>
            </div>
          </template>

          <!-- Tags -->
          <template v-else-if="activeScope === 'tags'">
            <div v-if="results.tags.length" class="d-flex flex-wrap ga-2 py-2">
              <v-chip
                v-for="tag in results.tags"
                :key="`tag-${tag.name}`"
                color="primary"
                variant="tonal"
                @click="searchByTag(tag.name)"
              >
                #{{ tag.name }} ({{ tag.count || 0 }})
              </v-chip>
            </div>
            <div v-else-if="!isLoading" class="text-center py-8">
              <v-icon size="48" class="text-medium-emphasis">mdi-tag-search-outline</v-icon>
              <p class="text-body-2 text-medium-emphasis mt-2">未找到标签结果</p>
            </div>
          </template>

          <!-- Load More Sentinel -->
          <div v-if="hasMore" ref="loadMoreRef" class="d-flex justify-center py-4">
            <v-progress-circular v-if="isLoadingMore" indeterminate color="primary" size="24" width="2" />
          </div>

          <!-- End of Results -->
          <div v-else-if="currentScopeItemCount > 0" class="text-center py-3">
            <span class="text-caption text-medium-emphasis">已加载全部结果</span>
          </div>
        </div>
      </div>
    </template>
  </div>

  <v-snackbar v-model="showError" :timeout="3000" color="error">
    {{ errorMessage }}
    <template #actions>
      <v-btn color="white" variant="text" @click="showError = false">关闭</v-btn>
    </template>
  </v-snackbar>
</template>

<script>
import { localuser } from '@/services/localAccount';
import ProjectCard from '@/components/project/ProjectCard.vue';
import PostList from '@/components/posts/PostList.vue';
import UserSelector from '@/components/shared/UserSelector.vue';
import Fuse from 'fuse.js';
import programmingLanguages from '@/constants/programming_languages';
import specialLanguages from '@/constants/special_languages';
import { SEARCH_SCOPES, addToSearchHistory, loadSearchHistory, normalizeSearchQuery, performSearch } from '@/services/searchService';

const allLanguages = { ...specialLanguages, ...programmingLanguages };
const languageList = Object.entries({ ...specialLanguages, ...programmingLanguages }).map(([key, val]) => ({
  key,
  name: val.name,
  icon: val.icon || 'mdi-code-tags'
}));
const languageFuse = new Fuse(languageList, {
  keys: ['key', 'name'],
  threshold: 0.4
});

const SCOPE_LABELS = {
  projects: '项目',
  users: '用户',
  posts: '帖子',
  project_files: '文件',
  lists: '列表',
  tags: '标签'
};

export default {
  name: 'SearchComponent',
  components: {
    ProjectCard,
    PostList,
    UserSelector
  },
  props: {
    mode: {
      type: String,
      default: 'page',
      validator: (value) => ['page', 'dialog'].includes(value)
    }
  },
  emits: ['search-submitted'],
  data() {
    return {
      searchQuery: '',
      activeScope: 'projects',
      currentPage: 1,
      activePerPage: 20,
      isLoading: false,
      isLoadingMore: false,
      hasSearched: false,
      showError: false,
      errorMessage: '',
      totalCount: 0,
      searchHistory: [],
      filters: {
        orderBy: '',
        state: '',
        type: '',
        postType: '',
        userStatus: ''
      },
      selectedUser: null,
      selectedTags: [],
      typeSearchQuery: '',
      tagSearchQuery: '',
      tagSuggestions: [],
      tagSuggestionsLoading: false,
      results: {
        projects: [],
        users: [],
        posts: [],
        projectFiles: [],
        lists: [],
        tags: []
      },
      menus: {
        order: false,
        state: false,
        type: false,
        user: false,
        tags: false,
        postType: false,
        userStatus: false
      }
    };
  },
  computed: {
    scopeOptions() {
      return SEARCH_SCOPES.map((scope) => ({ value: scope, label: SCOPE_LABELS[scope] }));
    },
    dynamicPerPage() {
      const display = this.$vuetify?.display;
      if (this.activeScope === 'projects') {
        if (display?.lgAndUp) return 20;
        if (display?.md) return 15;
        return 10;
      }
      if (this.activeScope === 'tags') return 30;
      return 20;
    },
    currentScopeItemCount() {
      switch (this.activeScope) {
        case 'projects': return this.results.projects.length;
        case 'users': return this.results.users.length;
        case 'posts': return this.results.posts.length;
        case 'project_files': return this.results.projectFiles.length;
        case 'lists': return this.results.lists.length;
        case 'tags': return this.results.tags.length;
        default: return 0;
      }
    },
    hasMore() {
      if (!this.hasSearched || this.isLoading) return false;
      return this.currentScopeItemCount < this.totalCount;
    },
    hasActiveFilters() {
      return !!(
        this.filters.orderBy ||
        this.filters.state ||
        this.filters.type ||
        this.filters.postType ||
        this.filters.userStatus ||
        this.selectedUser ||
        this.selectedTags.length
      );
    },
    showUserFilter() {
      return ['projects', 'posts', 'lists', 'project_files'].includes(this.activeScope);
    },
    showStateFilter() {
      return ['projects', 'lists'].includes(this.activeScope);
    },
    orderLabel() {
      const opt = this.projectOrderOptions.find((o) => o.value === this.filters.orderBy);
      return opt ? opt.label : '';
    },
    stateLabel() {
      const opt = this.projectStateOptions.find((o) => o.value === this.filters.state);
      return opt ? opt.label : '';
    },
    typeLabel() {
      if (!this.filters.type) return '';
      const lang = allLanguages[this.filters.type];
      return lang ? lang.name : this.filters.type;
    },
    filteredLanguages() {
      if (!this.typeSearchQuery) return languageList;
      return languageFuse.search(this.typeSearchQuery).map((r) => r.item);
    },
    projectOrderOptions() {
      return [
        { label: '观看量升序', value: 'view_up' },
        { label: '观看量降序', value: 'view_down' },
        { label: '时间升序', value: 'time_up' },
        { label: '时间降序', value: 'time_down' },
        { label: 'ID 升序', value: 'id_up' },
        { label: 'ID 降序', value: 'id_down' },
        { label: '收藏升序', value: 'star_up' },
        { label: '收藏降序', value: 'star_down' }
      ];
    },
    projectStateOptions() {
      return [
        { label: '公开', value: 'public' },
        { label: '私有', value: 'private' },
        { label: '草稿', value: 'draft' }
      ];
    }
  },
  watch: {
    '$route.query': {
      immediate: true,
      handler(query) {
        if (this.mode !== 'page') return;
        const normalized = normalizeSearchQuery(query || {});
        this.applyQueryState(normalized);
        const hasKeywordParam = Object.prototype.hasOwnProperty.call(query || {}, 'keyword')
          || Object.prototype.hasOwnProperty.call(query || {}, 'q');
        if (normalized.keyword || hasKeywordParam) {
          this.doSearch();
        } else {
          this.hasSearched = false;
        }
      }
    }
  },
  async created() {
    this.searchHistory = await loadSearchHistory();
  },
  beforeUnmount() {
    this.cleanupInfiniteScroll();
    clearTimeout(this._tagSearchTimeout);
  },
  methods: {
    // --- Infinite Scroll ---
    setupInfiniteScroll() {
      this.cleanupInfiniteScroll();
      this.$nextTick(() => {
        const el = this.$refs.loadMoreRef;
        if (!el) return;
        this._observer = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting && this.hasMore && !this.isLoadingMore && !this.isLoading) {
              this.loadMore();
            }
          },
          { rootMargin: '300px', threshold: 0 }
        );
        this._observer.observe(el);
      });
    },
    cleanupInfiniteScroll() {
      if (this._observer) {
        this._observer.disconnect();
        this._observer = null;
      }
    },

    // --- State Management ---
    parseCommaList(input) {
      return String(input || '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    },
    applyQueryState(normalized) {
      this.searchQuery = normalized.keyword || '';
      this.activeScope = normalized.scope || 'projects';
      this.currentPage = 1;
      this.filters.orderBy = normalized.orderBy || '';
      this.filters.state = normalized.state || '';
      this.filters.type = normalized.type || '';
      this.filters.postType = normalized.postType || '';
      this.filters.userStatus = normalized.userStatus || '';

      if (normalized.userId && normalized.userId.length > 0) {
        const uid = normalized.userId[0];
        if (!this.selectedUser || this.selectedUser.id !== uid) {
          this.selectedUser = { id: uid, display_name: `用户 #${uid}`, username: String(uid) };
        }
      } else {
        this.selectedUser = null;
      }

      this.selectedTags = Array.isArray(normalized.tags) ? [...normalized.tags] : [];
    },
    buildPayload() {
      return {
        keyword: this.searchQuery.trim(),
        scope: this.activeScope,
        page: this.currentPage,
        perPage: this.activePerPage || this.dynamicPerPage,
        orderBy: this.filters.orderBy,
        state: this.filters.state,
        type: this.filters.type,
        postType: this.filters.postType,
        userStatus: this.filters.userStatus,
        userId: this.selectedUser ? [this.selectedUser.id] : [],
        tags: [...this.selectedTags]
      };
    },
    buildRouteQuery(payload) {
      const query = {
        keyword: payload.keyword,
        scope: payload.scope
      };
      if (payload.orderBy) query.orderBy = payload.orderBy;
      if (payload.state) query.state = payload.state;
      if (payload.type) query.type = payload.type;
      if (payload.postType) query.postType = payload.postType;
      if (payload.userStatus) query.userStatus = payload.userStatus;
      if (payload.userId && payload.userId.length) query.userId = payload.userId;
      if (payload.tags && payload.tags.length) query.tags = payload.tags;
      return query;
    },
    clearResults() {
      this.results = {
        projects: [],
        users: [],
        posts: [],
        projectFiles: [],
        lists: [],
        tags: []
      };
      this.totalCount = 0;
    },
    applyResults(data, append) {
      this.totalCount = Number(data.totalCount || 0);
      const merge = (existing, incoming) => (append ? [...existing, ...incoming] : incoming);
      this.results.projects = merge(this.results.projects, data.projects || []);
      this.results.users = merge(this.results.users, data.users || []);
      this.results.posts = merge(this.results.posts, data.posts || []);
      this.results.projectFiles = merge(this.results.projectFiles, data.projectFiles || []);
      this.results.lists = merge(this.results.lists, data.lists || []);
      this.results.tags = merge(this.results.tags, data.tags || []);
    },

    // --- Search Actions ---
    async doSearch() {
      this.currentPage = 1;
      this.activePerPage = this.dynamicPerPage;
      this.clearResults();
      this.isLoading = true;
      this.hasSearched = true;

      try {
        const data = await performSearch(this.buildPayload());
        this.applyResults(data, false);
      } catch (error) {
        this.errorMessage = error?.message || '搜索失败';
        this.showError = true;
      } finally {
        this.isLoading = false;
        this.setupInfiniteScroll();
      }
    },
    async loadMore() {
      if (this.isLoadingMore || this.isLoading || !this.hasMore) return;
      this.currentPage++;
      this.isLoadingMore = true;

      try {
        const data = await performSearch(this.buildPayload());
        this.applyResults(data, true);
      } catch (error) {
        this.currentPage--;
        this.errorMessage = error?.message || '加载更多失败';
        this.showError = true;
      } finally {
        this.isLoadingMore = false;
        this.setupInfiniteScroll();
      }
    },
    async handleSearch() {
      const keyword = this.searchQuery.trim();
      if (keyword) {
        this.searchHistory = await addToSearchHistory(keyword, this.searchHistory);
      }
      const payload = this.buildPayload();

      if (this.mode === 'dialog') {
        this.$emit('search-submitted');
        await this.$router.push({ path: '/app/search', query: this.buildRouteQuery(payload) });
        return;
      }

      await this.$router.replace({ path: this.$route.path, query: this.buildRouteQuery(payload) });
    },
    async handleScopeChange(scope) {
      this.activeScope = scope;
      if (this.mode !== 'page' || (!this.searchQuery.trim() && !this.hasSearched)) return;
      const payload = this.buildPayload();
      payload.scope = scope;
      await this.$router.replace({ path: this.$route.path, query: this.buildRouteQuery(payload) });
    },

    // --- Filters ---
    setFilter(key, value) {
      this.filters[key] = value;
      this.applyFilters();
    },
    async applyFilters() {
      if (this.mode !== 'page' || (!this.searchQuery.trim() && !this.hasSearched)) return;
      await this.$router.replace({ path: this.$route.path, query: this.buildRouteQuery(this.buildPayload()) });
    },
    applyFilterAndClose(menuKey) {
      this.menus[menuKey] = false;
      this.applyFilters();
    },
    resetFilters() {
      this.filters.orderBy = '';
      this.filters.state = '';
      this.filters.type = '';
      this.filters.postType = '';
      this.filters.userStatus = '';
      this.selectedUser = null;
      this.selectedTags = [];
      this.applyFilters();
    },
    onUserSelected(user) {
      this.selectedUser = user;
      this.menus.user = false;
      this.applyFilters();
    },
    clearUser() {
      this.selectedUser = null;
      this.applyFilters();
    },
    clearTags() {
      this.selectedTags = [];
      this.applyFilters();
    },
    addTag(name) {
      const tag = (name || '').trim();
      if (!tag || this.selectedTags.includes(tag)) return;
      this.selectedTags.push(tag);
      this.tagSearchQuery = '';
      this.tagSuggestions = [];
      this.applyFilters();
    },
    removeTag(name) {
      this.selectedTags = this.selectedTags.filter((t) => t !== name);
      this.applyFilters();
    },
    addTagFromInput() {
      const tag = (this.tagSearchQuery || '').trim();
      if (tag) {
        this.addTag(tag);
      }
    },
    onTagSearchInput() {
      clearTimeout(this._tagSearchTimeout);
      const q = (this.tagSearchQuery || '').trim();
      if (!q) {
        this.tagSuggestions = [];
        return;
      }
      this._tagSearchTimeout = setTimeout(async () => {
        this.tagSuggestionsLoading = true;
        try {
          const data = await performSearch({ keyword: q, scope: 'tags', perPage: 20 });
          this.tagSuggestions = data.tags || [];
        } catch (e) {
          this.tagSuggestions = [];
        } finally {
          this.tagSuggestionsLoading = false;
        }
      }, 300);
    },
    selectType(key) {
      this.filters.type = key;
      this.menus.type = false;
      this.typeSearchQuery = '';
      this.applyFilters();
    },
    handleHistoryClick(term) {
      this.searchQuery = term;
      this.handleSearch();
    },
    searchByTag(tagName) {
      if (!this.selectedTags.includes(tagName)) {
        this.selectedTags.push(tagName);
      }
      if (this.activeScope !== 'projects') {
        this.activeScope = 'projects';
      }
      this.applyFilters();
    },
    getUserAvatar(avatar) {
      if (!avatar) return '/default-avatar.png';
      return localuser.getUserAvatar(avatar);
    },
    onPostDeleted(postId) {
      this.results.posts = this.results.posts.filter((post) => (post?.id ?? post?.postId) !== postId);
    }
  }
};
</script>

<style scoped>
.search-component {
  display: flex;
  flex-direction: column;
}

.search-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-input {
  flex: 1;
}

.search-button {
  flex-shrink: 0;
}

.suggestions-card {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 12px;
}
</style>

