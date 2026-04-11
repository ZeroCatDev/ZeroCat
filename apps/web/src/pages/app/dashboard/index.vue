<template>
  <v-container fluid>
    <v-navigation-drawer>
      <v-card-title
        class="text-subtitle-1 font-weight-bold d-flex align-center"
      >
        我的项目
        <v-spacer></v-spacer>
        <v-btn
          color="success"
          prepend-icon="mdi-plus"
          size="small"
          to="/app/new"
          variant="tonal"
        >新建
        </v-btn
        >
      </v-card-title>

      <v-card-text class="pt-2 pb-0">
        <v-text-field
          v-model="search.title"
          class="mb-2"
          density="compact"
          hide-details
          label="项目名称"
          placeholder="输入项目名称搜索"
          single-line
          variant="outlined"
          @input="searchProjects"
          @keyup.enter="searchProjects"
        ></v-text-field>
      </v-card-text>

      <v-list density="compact">
        <template v-if="isLoadingTopProjects">
          <v-skeleton-loader type="text" width="80%"/>
        </template>
        <template v-else-if="topProjects.length === 0">
          <v-list-item>
            <v-list-item-title class="text-center text-medium-emphasis">
              暂无项目
            </v-list-item-title>
          </v-list-item>
        </template>
        <template v-else>
          <v-list-item
            v-for="project in topProjects"
            :key="project.id"
            :to="`/${project.author.username}/${project.name}`"
          >
            <template v-slot:prepend>
              <v-avatar size="32">
                <v-img
                  :src="localuser.getUserAvatar(project.author.avatar)"
                />
              </v-avatar>
            </template>
            <v-list-item-title class="text-body-2 d-flex align-center">
              {{ project.title }}
              <v-chip
                v-if="project.state === 'private'"
                class="ml-2"
                color="error"
                size="x-small"
              >私密
              </v-chip
              >
            </v-list-item-title>
            <v-list-item-subtitle class="text-caption">
              {{ project.description }}
            </v-list-item-subtitle>
            <template v-slot:append>
              <div class="d-flex align-center gap-2">
                <div class="d-flex align-center">
                  <v-icon class="mr-1" size="small">mdi-eye</v-icon>
                  <span class="text-caption">{{ project.view_count }}</span>
                </div>
                <div class="d-flex align-center">
                  <v-icon class="mr-1" size="small">mdi-star</v-icon>
                  <span class="text-caption">{{ project.star_count }}</span>
                </div>
              </div>
            </template>
          </v-list-item>
        </template>
      </v-list>
      <v-card-actions class="justify-center">
        <v-btn block class="text-none" to="/app/project" variant="text">
          查看全部
          <v-icon end>mdi-chevron-right</v-icon>
        </v-btn>
      </v-card-actions>
    </v-navigation-drawer>
    <v-row>
      <!-- Main Content -->
      <v-col cols="12" md="9">
        <!-- Feed -->
        <SearchComponent mode="dialog"/>
        <br/>
        <v-card class="mb-4" variant="flat">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" color="primary" icon="mdi-timeline-clock"/>
            时间线
          </v-card-title>
          <v-card-text>
            <Timeline
              :is-loading-more="isLoadingMore"
              :timeline="timeline"
              @load-more="loadMoreEvents"
            />
          </v-card-text>
        </v-card>

        <v-card-title class="text-subtitle-1 font-weight-bold">
          <v-icon start>mdi-compass</v-icon>
          热门项目
        </v-card-title>
        <v-card-text class="pa-2">
          <v-row>
            <v-col
              v-for="project in exploreProjects"
              :key="project.id"
              cols="3"
              lg="3"
              md="4"
              sm="4"
              xl="3"
            >
              <project-card
                :author="project.author"
                :project="project"
                :show-author="true"
                :to="project.author ? `/${project.author.username}/${project.name}` : `/app/link/project?id=${project.id}`"
              />
            </v-col>
          </v-row>
          <!-- Loading indicator -->
          <div class="d-flex justify-center my-4">
            <v-progress-linear
              v-if="isLoadingExplore"
              color="primary"
              indeterminate
            ></v-progress-linear>
            <v-chip
              v-else-if="!exploreSearch.hasMore"
              color="primary"
              variant="flat"
            >
              已加载全部项目
            </v-chip>
          </div>
          <!-- Infinite scroll trigger -->
          <div
            v-intersect="{
              handler: onIntersect,
              options: {
                threshold: [0, 0.5, 1.0],
              },
            }"
            style="height: 20px"
          ></div>
        </v-card-text>
      </v-col>
      <v-col cols="12" md="3">
        <!-- Recent Activity -->
        <v-card variant="tonal">
          <v-card-title class="text-subtitle-1 font-weight-bold">
            <v-icon start>mdi-clock-outline</v-icon>
            最近活动
          </v-card-title>
          <v-list density="compact">
            <v-list-item
              v-for="activity in recentActivities"
              :key="activity.id"
            >
              <template v-slot:prepend>
                <v-icon :color="activity.color" size="small">{{
                  activity.icon
                  }}
                </v-icon>
              </template>
              <v-list-item-title class="text-body-2">{{
                activity.text
                }}
              </v-list-item-title>
              <v-list-item-subtitle>
                <TimeAgo :date="activity.date"/>
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card>
        <!-- Explore Projects -->
        <v-card class="mt-4" variant="flat"></v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import {useHead} from "@unhead/vue";
import request from "@/axios/axios";
import Timeline from "@/components/timeline/Timeline.vue";
import TimeAgo from "@/components/TimeAgo.vue";
import ProjectCard from "@/components/project/ProjectCard.vue";
import {localuser} from "@/services/localAccount";


export default {
  name: "Dashboard",
  components: {
    Timeline,
    TimeAgo,
    ProjectCard,
  },
  data() {
    return {
      localuser,
      isLoadingTopProjects: false,
      isLoadingExplore: false,
      search: {
        title: "",
        state: "public",
        limit: 10,
      },
      exploreSearch: {
        page: 1,
        limit: 20,
        hasMore: true,
      },
      topProjects: [],
      latestProjects: [],
      exploreProjects: [],
      timeline: {
        events: [],
        pagination: {
          current: 1,
          size: 20,
          total: 0,
        },
      },
      isLoadingMore: false,
      recentActivities: [],

      projects: [],
      loading: false,
      error: null,
      localuser,
      loadMoreTrigger: null,
    };
  },
  methods: {
    async fetchTopProjects() {
      this.isLoadingTopProjects = true;
      try {
        if (this.search.title != "") {
          this.search.limit = 40;
        }
        const response = await request.get(`/searchapi`, {
          params: {
            search_userid: this.localuser.user.id,
            search_title: this.search.title,
            search_state: this.search.state,
            limit: this.search.limit,
          },
        });
        if (response.data && response.data.projects) {
          this.topProjects = response.data.projects;
        }
      } catch (error) {
        console.error("Failed to fetch top projects:", error);
        this.topProjects = [];
      } finally {
        this.isLoadingTopProjects = false;
      }
    },
    async fetchLatestProjects() {
      try {
        const response = await request.get("/projectlist/latest", {
          params: {
            limit: 6,
            state: "public",
          },
        });
        if (response.data.status === "success") {
          this.latestProjects = response.data.data;
        }
      } catch (error) {
        console.error("Failed to fetch latest projects:", error);
      }
    },
    async fetchTimeline(page = 1) {
      try {
        const response = await request.get("/timeline/following", {
          params: {
            page,
            limit: this.timeline.pagination.size,
          },
        });
        if (response.data.status === "success") {
          if (page === 1) {
            this.timeline = response.data.data;
          } else {
            this.timeline.events = [
              ...this.timeline.events,
              ...response.data.data.events,
            ];
            this.timeline.pagination = response.data.data.pagination;
          }
        }
      } catch (error) {
        console.error("Failed to fetch timeline:", error);
      }
    },
    async fetchRecentActivities() {
      try {
        const response = await request.get("/timeline/me", {
          params: {
            page: 1,
            limit: 100,
          },
        });

        if (response.data.status === "success") {
          this.recentActivities = response.data.data.events.map((event) => ({
            id: event.id,
            text: event.event_data?.project_title || event.type,
            icon: this.getEventIcon(event.type),
            color: this.getEventColor(event.type),
            date: event.created_at,
          }));
        }
      } catch (error) {
        console.error("Failed to fetch recent activities:", error);
      }
    },
    getEventIcon(type) {
      const iconMap = {
        project_create: "mdi-plus-circle",
        project_publish: "mdi-upload",
        project_fork: "mdi-source-fork",
        project_delete: "mdi-delete",
        user_profile_update: "mdi-account-edit",
        project_commit: "mdi-source-commit",
        project_rename: "mdi-rename-box",
        project_info_update: "mdi-file-document-edit",
      };
      return iconMap[type] || "mdi-bell";
    },
    getEventColor(type) {
      const colorMap = {
        project_create: "success",
        project_publish: "info",
        project_fork: "warning",
        project_delete: "error",
        user_profile_update: "info",
        project_commit: "info",
        project_rename: "warning",
        project_info_update: "info",
      };
      return colorMap[type] || "primary";
    },
    resetSearch() {
      this.search = {
        title: "",
        state: "public",
      };
      this.fetchTopProjects();
    },
    async searchProjects() {
      await this.fetchTopProjects();
    },
    async loadMoreEvents() {
      if (this.isLoadingMore) return;

      try {
        this.isLoadingMore = true;
        await this.fetchTimeline(this.timeline.pagination.current + 1);
      } finally {
        this.isLoadingMore = false;
      }
    },
    async loadMoreExploreProjects() {
      if (this.isLoadingExplore || !this.exploreSearch.hasMore) return;

      this.isLoadingExplore = true;
      try {
        const response = await request.get("/searchapi", {
          params: {
            search_title: "",
            search_state: "public",
            search_orderby: "view_down",
            curr: this.exploreSearch.page,
            limit: this.exploreSearch.limit,
          },
        });

        if (response.data && response.data.projects) {
          if (response.data.projects.length === 0) {
            this.exploreSearch.hasMore = false;
            return;
          }

          this.exploreProjects = [
            ...this.exploreProjects,
            ...response.data.projects,
          ];
          this.exploreSearch.page++;
        }
      } catch (error) {
        console.error("Failed to fetch more explore projects:", error);
      } finally {
        this.isLoadingExplore = false;
      }
    },
    onIntersect(isIntersecting) {
      if (isIntersecting) {
        this.loadMoreExploreProjects();
      }
    },
  },
  async mounted() {
    await Promise.all([
      this.fetchTopProjects(),
      this.fetchLatestProjects(),
      this.fetchTimeline(),
      this.fetchRecentActivities(),
      this.loadMoreExploreProjects(),
    ]);
  },
  created() {
    useHead({
      title: "Dashboard - ZeroCat",
    });

  },
};
</script>

<style scoped>
.v-card {
  transition: transform 0.2s, box-shadow 0.2s;
}

.v-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1) !important;
}

.v-list-item {
  transition: background-color 0.2s;
}

.v-list-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.05);
}

.text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gap-2 {
  gap: 8px;
}
</style>
