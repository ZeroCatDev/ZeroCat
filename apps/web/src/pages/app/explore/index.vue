<template>
  <v-container fluid class="explore-page">
    <div class="explore-shell">
      <v-row>
        <v-col cols="12" md="3" lg="2" class="pe-md-4">
          <v-card class="filter-card" rounded="xl" variant="tonal">
            <v-card-item>
              <v-card-title class="d-flex align-center ga-2 text-subtitle-1">
                <v-icon icon="mdi-tune-variant" />
                探索筛选
              </v-card-title>
            </v-card-item>

            <v-card-text class="pt-0">
              <v-text-field
                v-model="search.keyword"
                clearable
                density="comfortable"
                hide-details
                label="搜索项目"
                prepend-inner-icon="mdi-magnify"
                variant="outlined"
                @keydown.enter="handleSearch"
              />
              <div class="mt-3 d-flex ga-2">
                <v-btn
                  block
                  color="primary"
                  prepend-icon="mdi-magnify"
                  @click="handleSearch"
                >
                  搜索
                </v-btn>
                <v-btn
                  block
                  prepend-icon="mdi-refresh"
                  variant="tonal"
                  @click="resetSearch"
                >
                  重置
                </v-btn>
              </div>

              <div class="filter-section-title mt-6">
                <v-icon icon="mdi-tag-multiple-outline" size="18" />
                标签
              </div>
              <v-chip-group
                v-model="activeTag"
                class="mt-2"
                column
                mandatory
                selected-class="selected-chip"
                @update:model-value="applyTag"
              >
                <v-chip
                  v-for="tag in tagOptions"
                  :key="tag.value"
                  :value="tag.value"
                  filter
                  size="small"
                  variant="flat"
                >
                  {{ tag.label }}
                </v-chip>
              </v-chip-group>

              <div class="filter-section-title mt-5">
                <v-icon icon="mdi-sort" size="18" />
                排序
              </div>
              <div class="order-list mt-2">
                <v-btn
                  v-for="item in orderitems"
                  :key="item.type"
                  block
                  class="mb-2 justify-start"
                  :color="search.orderBy === item.type ? 'primary' : undefined"
                  :prepend-icon="item.icon"
                  :variant="search.orderBy === item.type ? 'flat' : 'text'"
                  @click="changeOrder(item.type)"
                >
                  {{ item.name }}
                </v-btn>
              </div>

              <div class="filter-section-title mt-4">
                <v-icon icon="mdi-shape-outline" size="18" />
                类型
              </div>
              <v-chip-group
                v-model="activeType"
                class="mt-2"
                column
                mandatory
                selected-class="selected-chip"
                @update:model-value="applyType"
              >
                <v-chip
                  v-for="type in typeOptions"
                  :key="type.value"
                  :prepend-icon="type.icon"
                  :value="type.value"
                  filter
                  size="small"
                  variant="flat"
                >
                  {{ type.label }}
                </v-chip>
              </v-chip-group>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="9" lg="10">
          <v-card
            title="查看 猜你喜欢"
            to="/app/recommend"
            border
            rounded="xl"
            hover
            subtitle="基于AI的智能推荐"
            class="mb-2"
            append-icon="mdi-arrow-right"
          ></v-card>

          <div class="result-topbar">
            <div class="text-h6 mb-2">项目探索</div>
            <div class="d-flex flex-wrap ga-2">
              <v-chip prepend-icon="mdi-counter">
                {{ projects.length }} / {{ totalCount || "?" }}
              </v-chip>
              <v-chip prepend-icon="mdi-timer-outline">
                {{ lastLoadTime }} ms
              </v-chip>
              <v-chip prepend-icon="mdi-sort">
                {{ currentOrderLabel }}
              </v-chip>
            </div>
          </div>

          <v-progress-linear
            :active="isLoading"
            class="mt-3"
            color="primary"
            height="4"
            indeterminate
          />

          <show-projects
            v-if="projects.length"
            :projects="projects"
            :show-author="false"
            class="mt-4"
          />

          <v-alert
            v-else-if="!isLoading"
            class="mt-4"
            type="info"
            variant="tonal"
          >
            暂无项目结果
          </v-alert>

          <div v-if="hasMore" ref="loadMoreRef" class="load-more-wrapper">
            <v-progress-circular
              v-if="isLoadingMore"
              color="primary"
              indeterminate
              size="26"
              width="3"
            />
            <v-btn
              v-else
              color="primary"
              prepend-icon="mdi-chevron-down"
              variant="text"
              @click="loadMore"
            >
              加载更多
            </v-btn>
          </div>

          <div
            v-else-if="projects.length"
            class="load-end text-medium-emphasis"
          >
            已加载全部项目
          </div>
        </v-col>
      </v-row>
    </div>
  </v-container>

  <v-snackbar v-model="showError" color="error" timeout="3000">
    {{ errorMessage }}
    <template #actions>
      <v-btn color="white" variant="text" @click="showError = false"
        >关闭</v-btn
      >
    </template>
  </v-snackbar>
</template>

<script>
  import { useSeo } from "@/composables/useSeo";
  import showProjects from "@/components/project/showProjects.vue";
  import languages from "@/constants/programming_languages.js";
  import specialTypes from "@/constants/special_languages.js";
  import { performSearch } from "@/services/searchService";

  const DEFAULT_PER_PAGE = 12;
  const DEFAULT_ORDER = "view_down";

  const DEFAULT_SEARCH = Object.freeze({
    keyword: "",
    orderBy: DEFAULT_ORDER,
  });

  export default {
    components: { showProjects },
    setup() {
      useSeo({
        title: "探索项目",
        description:
          "浏览 ZeroCat 社区的编程作品，发现精彩的 Scratch、Python 等编程项目。",
      });
    },
    data() {
      return {
        search: {
          ...DEFAULT_SEARCH,
        },
        activeTag: "all",
        activeType: "all",
        tagOptions: [
          { label: "全部", value: "all" },
          { label: "动画", value: "动画" },
          { label: "音乐", value: "音乐" },
          { label: "游戏", value: "游戏" },
          { label: "故事", value: "故事" },
          { label: "教程", value: "教程" },
        ],
        orderitems: [
          { name: "热门程度", type: "view_down", icon: "mdi-fire" },
          { name: "更新时间", type: "time_down", icon: "mdi-clock-outline" },
          { name: "星标最多", type: "star_down", icon: "mdi-star-outline" },
          {
            name: "观看最多",
            type: "view_down",
            icon: "mdi-arrow-up-bold-circle-outline",
          },
        ],
        typeOptions: [
          { label: "全部类型", value: "all", icon: "mdi-shape-outline" },
        ],
        projects: [],
        page: 1,
        totalCount: 0,
        hasMore: true,
        isLoading: false,
        isLoadingMore: false,
        lastLoadTime: 0,
        showError: false,
        errorMessage: "",
        infiniteObserver: null,
      };
    },
    computed: {
      currentOrderLabel() {
        return (
          this.orderitems.find((item) => item.type === this.search.orderBy)
            ?.name || "热门程度"
        );
      },
    },
    methods: {
      mergeProjects(incoming, replace = false) {
        const merged = replace ? [...incoming] : [...this.projects, ...incoming];
        const uniqueById = new Map();
        merged.forEach((project) => {
          if (!project || typeof project !== "object") return;
          const key =
            project.id ?? `${project.name || ""}-${project.title || ""}`;
          if (!uniqueById.has(key)) uniqueById.set(key, project);
        });
        this.projects = Array.from(uniqueById.values());
      },
      buildPayload() {
        const type = this.activeType === "all" ? "" : this.activeType;
        const tags = this.activeTag === "all" ? [] : [this.activeTag];

        return {
          scope: "projects",
          keyword: String(this.search.keyword || "").trim(),
          page: this.page,
          perPage: DEFAULT_PER_PAGE,
          orderBy: this.search.orderBy || DEFAULT_ORDER,
          type,
          tags,
        };
      },
      async fetchProjects({ reset = false } = {}) {
        if (this.isLoading || this.isLoadingMore) return;
        if (!reset && !this.hasMore) return;

        if (reset) {
          this.page = 1;
          this.projects = [];
          this.totalCount = 0;
          this.hasMore = true;
        }

        const startTime = performance.now();
        if (reset || !this.projects.length) {
          this.isLoading = true;
        } else {
          this.isLoadingMore = true;
        }

        try {
          const payload = this.buildPayload();
          const data = await performSearch(payload);
          const incoming = Array.isArray(data.projects) ? data.projects : [];
          this.totalCount = Number(data.totalCount || 0);
          this.mergeProjects(incoming, reset);

          if (this.totalCount > 0) {
            this.hasMore = this.projects.length < this.totalCount;
          } else {
            this.hasMore = incoming.length >= payload.perPage;
          }
        } catch (error) {
          this.errorMessage = error?.message || "加载失败";
          this.showError = true;
          if (!reset && this.page > 1) {
            this.page -= 1;
          }
        } finally {
          this.lastLoadTime = Math.round(performance.now() - startTime);
          this.isLoading = false;
          this.isLoadingMore = false;
          this.$nextTick(() => {
            this.setupInfiniteScroll();
          });
        }
      },
      async handleSearch() {
        this.page = 1;
        await this.fetchProjects({ reset: true });
      },
      async loadMore() {
        if (!this.hasMore || this.isLoading || this.isLoadingMore) return;
        this.page += 1;
        await this.fetchProjects();
      },
      async resetSearch() {
        this.search = { ...DEFAULT_SEARCH };
        this.activeTag = "all";
        this.activeType = "all";
        await this.handleSearch();
      },
      async applyTag() {
        await this.handleSearch();
      },
      async applyType() {
        await this.handleSearch();
      },
      async changeOrder(orderType) {
        if (!orderType || this.search.orderBy === orderType) return;
        this.search.orderBy = orderType;
        await this.handleSearch();
      },
      buildTypeOptions() {
        const options = [
          { label: "全部", value: "all", icon: "mdi-shape-outline" },
        ];
        const added = new Set();
        for (const key in specialTypes) {
          [specialTypes, languages].forEach((source) => {
            const info = source?.[key];
            if (info && !added.has(key)) {
              added.add(key);
              options.push({
                label: info.name || key,
                value: key,
                icon: info.icon || "mdi-shape",
              });
            }
          });
        }
        this.typeOptions = options;
      },
      setupInfiniteScroll() {
        this.cleanupInfiniteScroll();
        if (!this.hasMore) return;

        const target = this.$refs.loadMoreRef;
        if (!target || typeof IntersectionObserver === "undefined") return;

        this.infiniteObserver = new IntersectionObserver(
          (entries) => {
            const entry = entries[0];
            if (entry?.isIntersecting) {
              this.loadMore();
            }
          },
          {
            rootMargin: "220px 0px",
            threshold: 0,
          },
        );

        this.infiniteObserver.observe(target);
      },
      cleanupInfiniteScroll() {
        if (!this.infiniteObserver) return;
        this.infiniteObserver.disconnect();
        this.infiniteObserver = null;
      },
    },
    async mounted() {
      this.buildTypeOptions();
      await this.fetchProjects({ reset: true });
    },
    beforeUnmount() {
      this.cleanupInfiniteScroll();
    },
  };
</script>

<style scoped>
.explore-page {
  padding: 20px 18px 36px;
}

.explore-shell {
  width: 100%;
  max-width: 1800px;
  margin: 0 auto;
}

.filter-card {
  position: sticky;
  top: 84px;
}

.filter-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.75);
}

.selected-chip {
  background: rgba(var(--v-theme-primary), 0.18);
  color: rgb(var(--v-theme-primary));
}

.order-list :deep(.v-btn) {
  border-radius: 10px;
}

.result-topbar {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 14px;
  padding: 14px 16px;
  background: rgba(var(--v-theme-surface), 0.55);
}

.load-more-wrapper {
  display: flex;
  justify-content: center;
  padding: 24px 12px 40px;
}

.load-end {
  text-align: center;
  padding: 20px 12px 36px;
}

@media (max-width: 959px) {
  .explore-page {
    padding: 14px 10px 24px;
  }

  .filter-card {
    position: static;
  }
}
</style>
