<template>
  <v-container>
    <v-row v-if="loading">
      <v-col class="text-center" cols="12">
        <v-progress-circular color="primary" indeterminate></v-progress-circular>
      </v-col>
    </v-row>

    <template v-else>
      <v-row>
        <v-col cols="12">
          <v-card class="mb-4">
            <v-card-title class="d-flex align-center">
              <span>{{ listInfo.title || '未命名列表' }}</span>
              <v-chip :color="listInfo.state === 'public' ? 'success' : 'warning'" class="ml-2" size="small">
                {{ listInfo.state === 'public' ? '公开' : '私密' }}
              </v-chip>
              <v-spacer></v-spacer>
              <v-btn
                color="primary"
                icon="mdi-share-variant"
                size="small"
                variant="text"
                @click="handleShareList"
                class="mr-1"
              ></v-btn>
              <v-btn
                v-if="isOwner"
                color="primary"
                icon="mdi-pencil"
                size="small"
                variant="text"
                @click="openEditDialog"
              ></v-btn>
            </v-card-title>

            <v-card-subtitle v-if="listInfo.description">
              {{ listInfo.description }}
            </v-card-subtitle>

            <v-card-text>
              <div class="d-flex align-center mb-2">
                <v-avatar class="mr-2" size="24">
                  <v-img :src="getUserAvatar(listInfo.author)" alt="用户头像"></v-img>
                </v-avatar>
                <span class="text-caption">{{ listInfo.author?.display_name || listInfo.author?.username || '未知用户' }}</span>
              </div>
              <div class="d-flex flex-wrap">
                <span class="text-caption mr-4">创建于: {{ formatDate(listInfo.createTime) }}</span>
                <span class="text-caption">更新于: {{ formatDate(listInfo.updateTime) }}</span>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12">
          <RelatedPostsPanel
            type="list"
            :id="listId"
          />
        </v-col>
      </v-row>

      <v-row v-if="!hasProjects">
        <v-col class="text-center" cols="12">
          <v-alert type="info" variant="tonal">
            此列表暂无项目
          </v-alert>
        </v-col>
      </v-row>

      <v-row v-else>
        <v-col cols="12">
          <h3 class="text-h6 mb-4">项目列表</h3>
          <v-row>
            <v-col
              v-for="project in listInfo.projects"
              :key="project.id"
              cols="12" lg="3" md="4" sm="6"
            >
              <project-card
                :author="project.author"
                :project="project"
                :show-author="true"
              />
            </v-col>
          </v-row>
        </v-col>
      </v-row>
    </template>

    <v-dialog v-model="editDialog" max-width="600px">
      <EditProjectListConfig
        :callback="fetchProjectList"
        :close="() => editDialog = false"
        :listid="listId"
      />
    </v-dialog>
  </v-container>
</template>

<script>
import request from "../../axios/axios";
import EditProjectListConfig from "./EditProjectListConfig.vue";
import {localuser} from "../../services/localAccount";
import { openFloatingPostBar } from "@/composables/useFloatingPostBar";
import ProjectCard from '../project/ProjectCard.vue';
import RelatedPostsPanel from '../posts/RelatedPostsPanel.vue';
import {ref, onMounted} from "vue";


export default {
  props: {
    listId: {
      type: String,
      required: true,
    },
  },
  components: {
    EditProjectListConfig,
    ProjectCard,
    RelatedPostsPanel
  },
  setup() {

    const getUserAvatar = (user) => {
      if (!user || !user.avatar) return '';
      return localuser.getUserAvatar(user.avatar);
    };

    return {
      localuser,
      getUserAvatar,
    };
  },
  data() {
    return {
      loading: true,
      listInfo: {},
      isOwner: false,
      editDialog: false,
      error: null,
    };
  },
  computed: {
    hasProjects() {
      return this.listInfo.projects && this.listInfo.projects.length > 0;
    }
  },
  async created() {
    await this.fetchProjectList();
  },
  methods: {
    async fetchProjectList() {
      this.loading = true;
      try {
        const response = await request.get(`/projectlist/lists/listid/${this.listId}`);
        if (response.data.status === "success") {
          this.listInfo = response.data.data;

          // 检查当前用户是否是列表所有者
          const currentUser = localuser.user.value;
          this.isOwner = currentUser && currentUser.id === this.listInfo.authorid;

        } else {
          this.$toast.add({
            severity: "error",
            summary: "错误",
            detail: response.data.message || "获取列表失败",
            life: 3000,
          });
        }
      } catch (error) {
        console.error("获取列表失败:", error);
        this.$toast.add({
          severity: "error",
          summary: "错误",
          detail: "获取列表失败",
          life: 3000,
        });
      } finally {
        this.loading = false;
      }
    },

    openEditDialog() {
      this.editDialog = true;
    },

    handleShareList() {
      openFloatingPostBar({
        text: `@${this.listInfo.author?.username} 的列表「${this.listInfo.title || ''}」`,
        embed: { type: 'list', id: this.listId },
        placeholder: `分享关于这个列表的内容...`
      });
    },

    formatDate(dateString) {
      if (!dateString) return '未知';
      const date = new Date(dateString);
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    }
  }
};
</script>

<style scoped>
.v-card-title {
  word-break: break-word;
}
</style>


