<template>
  <v-progress-linear
    :active="loading"
    color="primary"
    height="4"
    indeterminate

  ></v-progress-linear>
  <v-row>
    <v-col cols="12">
      <p class="mt-2 text-medium-emphasis">
        <v-chip>
          <v-icon icon="mdi-timer" start></v-icon>
          加载耗时: {{ loadTime }} ms
        </v-chip>
        <v-chip v-if="totalCount">
          <v-icon icon="mdi-counter" start></v-icon>
          总作品数量: {{ totalCount }}
        </v-chip>
      </p>
    </v-col>
  </v-row>
  <show-projects :projects="projects" :show-author="showAuthor"></show-projects>
  <br/>
  <v-pagination
    v-if="hasTotalCount"
    v-model="page"
    :length="totalPage"
    rounded="circle"
    @input="fetchProjects"
  ></v-pagination>
  <v-btn v-else color="primary" @click="loadMore">继续加载</v-btn>
  <br/>
</template>

<script>
import showProjects from "./showProjects.vue";
import request from "@/axios/axios";

export default {
  components: {showProjects},
  props: {
    url: {
      type: String,
      required: true,
    },
    showAuthor: {
      type: Boolean,
      default: true,
    },
  },
  data() {
    return {
      projects: [],
      page: 1,
      limit: 20,
      totalPage: 1,
      totalCount: 0,
      loading: false,
      loadTime: 0,
    };
  },
  computed: {
    hasTotalCount() {
      return this.totalCount > 0;
    },
  },
  methods: {
    async fetchProjects() {
      this.loading = true;
      const startTime = performance.now();
      try {
        const response = (await request.get(
          `${this.url}&curr=${this.page}&limit=${this.limit}`
        )).data;

        if (response.totalCount) {
          this.projects = response.projects;
          this.totalCount = response.totalCount;
          this.totalPage = Math.ceil(this.totalCount / this.limit);
        } else {
          this.projects = [...this.projects, ...response.projects];
        }
      } catch (error) {
        console.error("Failed to fetch projects:", error);
      } finally {
        this.loading = false;
        this.loadTime = performance.now() - startTime;
      }
    },
    loadMore() {
      this.page++;
      this.fetchProjects();
    },
  },
  watch: {
    url: {
      handler() {
        this.page = 1;
        this.fetchProjects();
      },
      immediate: true,
    },
    page: {
      handler() {
        this.fetchProjects();
      },
    },
  },
};
</script>
