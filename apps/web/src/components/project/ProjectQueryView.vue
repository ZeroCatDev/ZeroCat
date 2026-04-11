<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-card class="mb-4">
          <v-card-item>
            <v-card-title class="d-flex align-center">
              <span>{{ getTitle }}</span>
              <v-chip class="ml-2" color="primary" size="small">
                {{ total }} 个项目
              </v-chip>
            </v-card-title>
            <v-card-subtitle v-if="getDescription">
              {{ getDescription }}
            </v-card-subtitle>
          </v-card-item>
        </v-card>
      </v-col>
    </v-row>

    <v-row v-if="loading">
      <v-col class="text-center" cols="12">
        <v-progress-circular color="primary" indeterminate></v-progress-circular>
      </v-col>
    </v-row>

    <v-row v-else-if="projects.length === 0">
      <v-col cols="12">
        <v-alert type="info" variant="tonal">
          暂无项目
        </v-alert>
      </v-col>
    </v-row>

    <v-row v-else>
      <v-col
        v-for="project in projects"
        :key="project.id"
        cols="12"
        lg="3"
        md="4"
        sm="6"
        xl="2"
        xs="12"
        xxl="2"
      >
        <project-card
          :author="project.author"
          :project="project"
          :show-author="true"
        />
      </v-col>
    </v-row>

    <v-row v-if="total > limit">
      <v-col class="text-center" cols="12">
        <v-pagination
          v-model="currentPage"
          :length="Math.ceil(total / limit)"
          :total-visible="7"
          rounded="lg"
        ></v-pagination>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import {queryProjects} from "@/services/projectService";
import ProjectCard from "./ProjectCard.vue";

export default {
  name: "ProjectQueryView",
  components: {
    ProjectCard,
  },
  props: {
    type: {
      type: String,
      required: true,
      validator: (value) => ["fork", "tag", "author", "search"].includes(value),
    },
    target: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      projects: [],
      total: 0,
      limit: 20,
      currentPage: 1,
      loading: true,
    };
  },
  computed: {
    offset() {
      return (this.currentPage - 1) * this.limit;
    },
    getTitle() {
      switch (this.type) {
        case "fork":
          return "复刻项目";
        case "tag":
          return `标签: ${this.target}`;
        case "author":
          return "作者项目";
        case "search":
          return `搜索: ${this.target}`;
        default:
          return "项目列表";
      }
    },
    getDescription() {
      switch (this.type) {
        case "fork":
          return "从原项目复刻的所有项目";
        case "tag":
          return `包含 "${this.target}" 标签的所有项目`;
        case "author":
          return "该作者的所有项目";
        case "search":
          return `包含 "${this.target}" 的搜索结果`;
        default:
          return "";
      }
    },
  },
  watch: {
    currentPage() {
      this.fetchProjects();
    },
    type() {
      this.resetPagination();
      this.fetchProjects();
    },
    target() {
      this.resetPagination();
      this.fetchProjects();
    },
  },
  methods: {
    resetPagination() {
      this.currentPage = 1;
      this.total = 0;
    },
    async fetchProjects() {
      this.loading = true;
      try {
        const response = await queryProjects(
          this.type,
          this.target,
          this.limit,
          this.offset
        );
        if (response.status === "success") {
          this.projects = response.data.projects;
          this.total = response.data.total;
        } else {
          console.error("Failed to fetch projects:", response.message);
          this.projects = [];
          this.total = 0;
        }
      } catch (error) {
        console.error("Error fetching projects:", error);
        this.projects = [];
        this.total = 0;
      } finally {
        this.loading = false;
      }
    },
  },
  created() {
    this.fetchProjects();
  },
};
</script>

<style scoped>
.v-pagination {
  margin-top: 2rem;
}
</style>
