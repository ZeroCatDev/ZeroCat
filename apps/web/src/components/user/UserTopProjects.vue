<template>
  <div class="mb-6">
    <!-- Section Header -->
    <div class="d-flex align-center justify-space-between mb-3">
      <span class="text-body-1 font-weight-medium">热门项目</span>
      <v-btn
        :to="`/${username}/?tab=projects`"
        variant="text"
        size="small"
        color="primary"
      >
        查看全部
      </v-btn>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="d-flex justify-center pa-8">
      <v-progress-circular color="primary" indeterminate />
    </div>

    <!-- Empty -->
    <v-alert v-else-if="projects.length === 0" type="info" variant="tonal" rounded="lg">
      暂无项目
    </v-alert>

    <!-- Projects Grid - GitHub style pinned repos -->
    <v-row v-else>
      <v-col
        v-for="project in projects"
        :key="project.id"
        cols="12"
        sm="6"
      >
        <v-card
          :to="`/${project.author?.username || username}/${project.name}`"
          border
          hover
          rounded="lg"
          height="100%"
        >
          <v-card-text class="d-flex flex-column h-100">
            <!-- Project Header -->
            <div class="d-flex align-center mb-2">
              <v-icon size="16" color="grey" class="mr-2">mdi-source-repository</v-icon>
              <span class="text-body-2 font-weight-bold text-primary">
                {{ project.title || project.name }}
              </span>
              <v-chip size="x-small" variant="outlined" class="ml-2">Public</v-chip>
            </div>

            <!-- Description -->
            <p class="text-caption text-medium-emphasis mb-3 flex-grow-1 project-desc">
              {{ project.description || '暂无描述' }}
            </p>

            <!-- Stats -->
            <div class="d-flex align-center ga-3 mt-auto">
              <span class="d-flex align-center text-caption">
                <v-icon size="14" class="mr-1" color="amber">mdi-star</v-icon>
                {{ formatCount(project.like_count) }}
              </span>
              <span class="d-flex align-center text-caption">
                <v-icon size="14" class="mr-1">mdi-poll</v-icon>
                {{ formatCount(project.view_count) }}
              </span>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script>
import request from "@/axios/axios";

export default {
  name: "UserTopProjects",
  props: {
    userId: {
      type: [Number, String],
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      projects: [],
      loading: false,
    };
  },
  watch: {
    userId: {
      handler() {
        this.fetchTopProjects();
      },
      immediate: true,
    },
  },
  methods: {
    async fetchTopProjects() {
      this.loading = true;
      try {
        const res = await request({
          url: `/searchapi`,
          method: "get",
          params: {
            search_userid: this.userId,
            search_orderby: "view_down",
            search_state: "public",
            limit: 6,
            curr: 1,
          },
        });
        this.projects = res.data?.projects || res.data?.data || [];
      } catch (e) {
        console.error("Failed to fetch top projects:", e);
        this.projects = [];
      } finally {
        this.loading = false;
      }
    },
    formatCount(count) {
      if (!count) return "0";
      if (count >= 10000) return (count / 10000).toFixed(1) + "w";
      if (count >= 1000) return (count / 1000).toFixed(1) + "k";
      return String(count);
    },
  },
};
</script>

<style scoped>
.project-desc {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
