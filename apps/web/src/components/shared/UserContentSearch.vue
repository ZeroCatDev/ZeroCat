<template>
  <v-card rounded="lg" border>
    <!-- Search Bar -->
    <v-card-text class="pb-2">
      <v-text-field
        v-model="keyword"
        clearable
        density="comfortable"
        hide-details
        :placeholder="searchPlaceholder"
        prepend-inner-icon="mdi-magnify"
        variant="outlined"
        rounded="lg"
        @click:clear="onClear"
        @keyup.enter="doSearch"
        @update:model-value="onInput"
      />
    </v-card-text>

    <!-- Scope Tabs -->
    <v-tabs
      v-if="scopes.length > 1"
      v-model="activeScope"
      density="comfortable"
      color="primary"
      @update:model-value="onScopeChange"
    >
      <v-tab v-for="scope in scopeOptions" :key="scope.value" :value="scope.value">
        <v-icon start size="18">{{ scope.icon }}</v-icon>
        {{ scope.label }}
      </v-tab>
    </v-tabs>

    <v-divider />

    <!-- Sort Bar (projects only) -->
    <div v-if="activeScope === 'projects'" class="d-flex align-center flex-wrap px-4 py-2 ga-2">
      <v-btn-toggle
        v-model="orderBy"
        density="compact"
        variant="outlined"
        divided
        mandatory
        @update:model-value="doSearch"
      >
        <v-btn value="time_down" size="small">
          <v-icon start size="16">mdi-clock-outline</v-icon>
          最新
        </v-btn>
        <v-btn value="view_down" size="small">
          <v-icon start size="16">mdi-poll</v-icon>
          浏览
        </v-btn>
        <v-btn value="star_down" size="small">
          <v-icon start size="16">mdi-star-outline</v-icon>
          收藏
        </v-btn>
      </v-btn-toggle>
      <v-spacer />
      <span v-if="totalCount > 0" class="text-caption text-medium-emphasis">
        共 {{ totalCount }} 个结果
      </span>
    </div>

    <div v-else-if="totalCount > 0" class="px-4 py-2">
      <span class="text-caption text-medium-emphasis">
        共 {{ totalCount }} 个结果
      </span>
    </div>

    <v-divider />

    <!-- Loading -->
    <v-progress-linear v-if="loading" color="primary" indeterminate />

    <!-- Results -->
    <v-card-text v-if="!loading">
      <!-- Projects Results -->
      <template v-if="activeScope === 'projects'">
        <show-projects
          v-if="results.projects.length"
          :projects="results.projects"
          :show-author="showAuthor"
        />
        <div v-else class="text-center py-8">
          <v-icon size="48" class="text-medium-emphasis">mdi-folder-open-outline</v-icon>
          <p class="text-body-2 text-medium-emphasis mt-2">
            {{ keyword ? '未找到匹配的作品' : '暂无作品' }}
          </p>
        </div>
      </template>

      <!-- Lists Results -->
      <template v-else-if="activeScope === 'lists'">
        <v-row v-if="results.lists.length">
          <v-col
            v-for="item in results.lists"
            :key="item.id"
            cols="12"
            sm="6"
            md="4"
            lg="3"
          >
            <v-card
              :to="'/app/projectlist/' + item.id"
              rounded="lg"
              variant="tonal"
              class="fill-height"
            >
              <v-card-item>
                <v-card-title class="text-body-1 font-weight-medium">
                  {{ item.title || item.name || '未命名列表' }}
                </v-card-title>
                <v-card-subtitle class="text-wrap">
                  {{ item.description || '暂无描述' }}
                </v-card-subtitle>
              </v-card-item>
            </v-card>
          </v-col>
        </v-row>
        <div v-else class="text-center py-8">
          <v-icon size="48" class="text-medium-emphasis">mdi-format-list-bulleted</v-icon>
          <p class="text-body-2 text-medium-emphasis mt-2">
            {{ keyword ? '未找到匹配的列表' : '暂无列表' }}
          </p>
        </div>
      </template>

      <!-- Pagination -->
      <div v-if="showPagination" class="d-flex justify-center mt-4">
        <v-pagination
          v-model="currentPage"
          :length="totalPages"
          :total-visible="7"
          rounded="circle"
          @update:model-value="onPageChange"
        />
      </div>
    </v-card-text>
  </v-card>
</template>

<script>
import showProjects from "@/components/project/showProjects.vue";
import { performSearch } from "@/services/searchService";
import { getUserPublicLists } from "@/services/projectListService";

const SCOPE_CONFIG = {
  projects: { label: "作品", icon: "mdi-view-grid-outline" },
  lists: { label: "列表", icon: "mdi-format-list-bulleted" },
};

export default {
  name: "UserContentSearch",
  components: { showProjects },
  props: {
    userId: {
      type: [Number, String],
      default: null,
    },
    scopes: {
      type: Array,
      default: () => ["projects", "lists"],
    },
    defaultScope: {
      type: String,
      default: "projects",
    },
    showAuthor: {
      type: Boolean,
      default: false,
    },
    perPage: {
      type: Number,
      default: 20,
    },
    placeholder: {
      type: String,
      default: "",
    },
  },
  data() {
    return {
      keyword: "",
      activeScope: this.defaultScope,
      orderBy: "time_down",
      currentPage: 1,
      loading: false,
      totalCount: 0,
      debounceTimer: null,
      allLists: [],
      results: {
        projects: [],
        lists: [],
      },
    };
  },
  computed: {
    scopeOptions() {
      return this.scopes
        .filter((s) => SCOPE_CONFIG[s])
        .map((s) => ({ value: s, ...SCOPE_CONFIG[s] }));
    },
    searchPlaceholder() {
      if (this.placeholder) return this.placeholder;
      const scopeLabel = SCOPE_CONFIG[this.activeScope]?.label || "";
      return `搜索${scopeLabel}...`;
    },
    totalPages() {
      return Math.max(1, Math.ceil(this.totalCount / this.perPage));
    },
    showPagination() {
      // Client-side filtered lists don't need server pagination
      if (this.activeScope === "lists" && this.userId) return false;
      return this.totalPages > 1;
    },
  },
  watch: {
    userId: {
      handler() {
        this.currentPage = 1;
        this.allLists = [];
        this.fetchData();
      },
      immediate: true,
    },
  },
  beforeUnmount() {
    clearTimeout(this.debounceTimer);
  },
  methods: {
    onInput() {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.currentPage = 1;
        this.fetchData();
      }, 350);
    },
    onClear() {
      this.keyword = "";
      this.currentPage = 1;
      this.fetchData();
    },
    doSearch() {
      clearTimeout(this.debounceTimer);
      this.currentPage = 1;
      this.fetchData();
    },
    onScopeChange() {
      this.currentPage = 1;
      this.totalCount = 0;
      this.fetchData();
    },
    onPageChange() {
      this.fetchData();
    },
    async fetchData() {
      if (this.activeScope === "lists") {
        await this.fetchLists();
      } else {
        await this.fetchProjects();
      }
    },
    async fetchProjects() {
      this.loading = true;
      try {
        const data = await performSearch({
          keyword: (this.keyword || "").trim(),
          scope: "projects",
          page: this.currentPage,
          perPage: this.perPage,
          orderBy: this.orderBy,
          state: "public",
          userId: this.userId ? [this.userId] : [],
        });
        this.results.projects = data.projects || [];
        this.totalCount = data.totalCount || 0;
      } catch (e) {
        console.error("搜索作品失败:", e);
        this.results.projects = [];
        this.totalCount = 0;
      } finally {
        this.loading = false;
      }
    },
    async fetchLists() {
      // Without userId, use search API with server-side pagination
      if (!this.userId) {
        this.loading = true;
        try {
          const data = await performSearch({
            keyword: (this.keyword || "").trim(),
            scope: "lists",
            page: this.currentPage,
            perPage: this.perPage,
          });
          this.results.lists = data.lists || [];
          this.totalCount = data.totalCount || 0;
        } catch (e) {
          console.error("搜索列表失败:", e);
          this.results.lists = [];
          this.totalCount = 0;
        } finally {
          this.loading = false;
        }
        return;
      }

      // With userId, use dedicated API + client-side keyword filtering
      if (!this.allLists.length) {
        this.loading = true;
        try {
          const response = await getUserPublicLists(this.userId);
          this.allLists =
            response.status === "success" ? response.data || [] : [];
        } catch (e) {
          console.error("获取列表失败:", e);
          this.allLists = [];
        } finally {
          this.loading = false;
        }
      }

      const kw = (this.keyword || "").trim().toLowerCase();
      if (kw) {
        this.results.lists = this.allLists.filter((item) => {
          const title = (item.title || item.name || "").toLowerCase();
          const desc = (item.description || "").toLowerCase();
          return title.includes(kw) || desc.includes(kw);
        });
      } else {
        this.results.lists = this.allLists;
      }
      this.totalCount = this.results.lists.length;
    },
  },
};
</script>
