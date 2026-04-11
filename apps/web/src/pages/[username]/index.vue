<template>
  <div>
    <PageAnalytics :target-id="user.id" target-type="user" />

    <v-container fluid class="profile-container pa-md-6 pa-4">
      <v-row>
        <!-- Left Sidebar -->
        <v-col cols="12" md="4" lg="3">
          <div class="profile-sidebar">
            <UserProfileSidebar
              v-if="user.id"
              :user="user"
              :username="username"
            />
          </div>
        </v-col>

        <!-- Main Content -->
        <v-col cols="12" md="8" lg="9">
          <v-card v-if="is40codeMirrorUser" rounded="lg" border class="mb-4" variant="tonal" color="info">
            <v-card-item>
              <template #prepend>
                <v-icon icon="mdi-source-branch-sync" />
              </template>
              <v-card-title>40code 镜像账户</v-card-title>
              <v-card-subtitle>该账号是从 40code 自动镜像同步而来</v-card-subtitle>
              <template #append>
                <v-btn
                  color="info"
                  variant="flat"
                  prepend-icon="mdi-open-in-new"
                  :href="mirror40codeProfileUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  前往 40code 主页
                </v-btn>
              </template>
            </v-card-item>
          </v-card>



          <!-- Home Tab -->
          <template v-if="currentTab === 'home'">
            <!-- README -->
            <v-card v-if="readmeContent" rounded="lg" border class="mb-4">
              <v-card-title class="d-flex align-center justify-space-between py-2 px-4 readme-card-header">
                <span class="text-body-2 font-weight-light">{{ username }} / README.md</span>
                <v-btn
                  v-if="isCurrentUser"
                  :to="`/${username}/articles/${username}/edit`"
                  icon="mdi-pencil-outline"
                  size="small"
                  variant="text"
                  aria-label="编辑 README"
                ></v-btn>
              </v-card-title>

              <v-card-text class="markdown-body readme-markdown-body">
                <Markdown>{{ readmeContent }}</Markdown>
              </v-card-text>
            </v-card>

            <v-card v-else-if="showReadmeLoadingCard" rounded="lg" border class="mb-4">

              <v-card-text>
                <v-skeleton-loader type="paragraph, paragraph" />
              </v-card-text>
            </v-card>

            <v-card v-else-if="showReadmePrompt" rounded="lg" border class="mb-4" variant="tonal">
              <v-card-title class="d-flex align-center py-3">
                <v-icon start size="20">mdi-file-document-plus-outline</v-icon>
                <span class="text-body-1 font-weight-bold">README.md</span>
              </v-card-title>
              <v-divider />
              <v-card-text>
                <div class="text-body-2 text-medium-emphasis mb-3">
                  还没有个人简介，创建 README 项目后可在主页展示详细介绍。
                </div>
                <div class="d-flex flex-wrap ga-2">
                  <v-btn
                    color="primary"
                    variant="elevated"
                    prepend-icon="mdi-book-open-page-variant-outline"
                    :loading="readmeLoading"
                    @click="openOrCreateReadmeProject"
                  >{{ readmeExists ? '打开 README 项目' : '创建并编辑 README 项目' }}</v-btn>

                  <v-btn
                    v-if="readmeExists"
                    variant="tonal"
                    prepend-icon="mdi-open-in-new"
                    :to="`/${username}/articles/${username}`"
                  >查看 README 页面</v-btn>
                </div>
              </v-card-text>
            </v-card>

            <!-- Top Projects -->
            <UserTopProjects
              v-if="user.id"
              :user-id="user.id"
              :username="username"
            />

            <!-- Posts with Twitter-style tabs -->
            <UserRecentPosts
              v-if="user.id"
              :user-id="user.id"
              :username="username"
              :display-name="user.display_name"
            />
          </template>

          <!-- Projects & Lists Tab -->
          <template v-if="currentTab === 'projects' || currentTab === 'lists'">
            <UserContentSearch
              :key="currentTab"
              :user-id="user.id"
              :default-scope="currentTab === 'lists' ? 'lists' : 'projects'"
              :show-author="false"
            />
          </template>

          <!-- Followers Tab -->
          <template v-if="currentTab === 'followers'">
            <v-card rounded="lg" border>
              <v-card-title class="py-3">
                <v-icon start>mdi-account-multiple</v-icon>
                <span class="font-weight-bold">关注者</span>
              </v-card-title>
              <v-divider />
              <user-followers :show-all="false" :user-id="user.id" :username="username" />
            </v-card>
          </template>

          <!-- Following Tab -->
          <template v-if="currentTab === 'following'">
            <v-card rounded="lg" border>
              <v-card-title class="py-3">
                <v-icon start>mdi-account-heart</v-icon>
                <span class="font-weight-bold">关注的人</span>
              </v-card-title>
              <v-divider />
              <user-following :show-all="false" :user-id="user.id" :username="username" />
            </v-card>
          </template>

          <!-- Timeline Tab -->
          <template v-if="currentTab === 'timeline'">
            <v-card rounded="lg" border>
              <v-card-title class="py-3">
                <v-icon start>mdi-timeline-clock</v-icon>
                <span class="font-weight-bold">{{ user.display_name }} 的动态</span>
              </v-card-title>
              <v-divider />
              <v-card-text>
                <Timeline
                  :is-loading-more="isLoadingMore"
                  :timeline="timeline"
                  @load-more="loadMoreEvents"
                />
              </v-card-text>
            </v-card>
          </template>

          <!-- Comment Tab -->
          <template v-if="currentTab === 'comment'">

                <Comment :url="'user-' + user.id" name="用户" />

          </template><v-card v-if="isAdminViewer && user.id" rounded="lg" border class="mb-4" variant="tonal" color="warning">
            <v-card-title class="d-flex align-center justify-space-between py-3">
              <div class="d-flex align-center">
                <v-icon start>mdi-bug</v-icon>
                <span class="font-weight-bold">ow_target_config 调试器</span>
              </div>
              <v-btn color="warning" prepend-icon="mdi-plus" size="small" variant="text" @click="openCreateTargetConfigDialog">
                新增
              </v-btn>
            </v-card-title>
            <v-divider />
            <v-card-text>
              <v-row dense>
                <v-col cols="12" md="3">
                  <v-text-field
                    v-model="targetConfigQuery.key"
                    clearable
                    density="compact"
                    hide-details
                    label="key 精确匹配"
                    variant="outlined"
                    @keyup.enter="applyTargetConfigFilters"
                  ></v-text-field>
                </v-col>
                <v-col cols="12" md="3">
                  <v-text-field
                    v-model="targetConfigQuery.keyLike"
                    clearable
                    density="compact"
                    hide-details
                    label="key 模糊匹配"
                    variant="outlined"
                    @keyup.enter="applyTargetConfigFilters"
                  ></v-text-field>
                </v-col>
                <v-col cols="12" md="2">
                  <v-select
                    v-model="targetConfigQuery.itemsPerPage"
                    :items="[10, 20, 50, 100, 200]"
                    density="compact"
                    hide-details
                    label="每页"
                    variant="outlined"
                    @update:model-value="applyTargetConfigFilters"
                  ></v-select>
                </v-col>
                <v-col class="d-flex ga-2" cols="12" md="4">
                  <v-btn color="primary" prepend-icon="mdi-magnify" @click="applyTargetConfigFilters">查询</v-btn>
                  <v-btn prepend-icon="mdi-refresh" variant="tonal" @click="resetTargetConfigFilters">重置</v-btn>
                </v-col>
              </v-row>

              <v-alert
                v-if="targetConfigError"
                class="mt-3"
                density="compact"
                type="error"
                variant="tonal"
              >
                {{ targetConfigError }}
              </v-alert>

              <v-data-table-server
                v-model:items-per-page="targetConfigQuery.itemsPerPage"
                v-model:page="targetConfigQuery.page"
                class="mt-3"
                :headers="targetConfigHeaders"
                :items="targetConfigItems"
                :items-length="targetConfigTotal"
                :loading="targetConfigLoading"
                item-value="id"
                @update:options="loadTargetConfigs"
              >
                <template v-slot:item.value="{ item }">
                  <pre class="target-config-value">{{ formatTargetConfigValue(item.value) }}</pre>
                </template>
                <template v-slot:item.updated_at="{ item }">
                  {{ formatDateTime(item.updated_at) }}
                </template>
                <template v-slot:item.actions="{ item }">
                  <v-btn color="primary" prepend-icon="mdi-pencil" size="small" variant="text" @click="openEditTargetConfigDialog(item)">
                    编辑
                  </v-btn>
                </template>
              </v-data-table-server>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <v-dialog v-model="targetConfigDialog.show" max-width="800px">
      <v-card>
        <v-card-title>
          {{ targetConfigDialog.isEdit ? "编辑配置" : "新增配置" }}
        </v-card-title>
        <v-card-text>
          <v-alert
            v-if="targetConfigDialog.error"
            class="mb-3"
            density="compact"
            type="error"
            variant="tonal"
          >
            {{ targetConfigDialog.error }}
          </v-alert>

          <v-text-field
            v-model="targetConfigDialog.key"
            :disabled="targetConfigDialog.isEdit"
            density="compact"
            label="配置键（key）"
            variant="outlined"
          ></v-text-field>

          <v-switch
            v-model="targetConfigDialog.parseAsJson"
            class="mb-2"
            color="primary"
            density="compact"
            hide-details
            label="按 JSON 提交（会先做 JSON.parse 校验）"
          ></v-switch>

          <v-textarea
            v-model="targetConfigDialog.valueText"
            auto-grow
            density="compact"
            label="配置值（value）"
            min-rows="6"
            variant="outlined"
          ></v-textarea>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text @click="targetConfigDialog.show = false">取消</v-btn>
          <v-btn :loading="targetConfigDialog.saving" color="primary" @click="saveTargetConfig">
            保存
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import Comment from "../../components/Comment.vue";
import { useSeo } from "@/composables/useSeo";
import { ref } from "vue";
import { localuser } from "@/services/localAccount";
import { getUserByUsername } from "../../stores/user.js";
import { getProjectInfoByNamespace, initProject } from "@/services/projectService";
import request from "../../axios/axios.js";
import Markdown from "@/components/Markdown.vue";
import "github-markdown-css";
import UserFollowers from "@/components/user/UserFollowers.vue";
import UserFollowing from "@/components/user/UserFollowing.vue";
import Timeline from "@/components/timeline/Timeline.vue";
import PageAnalytics from "@/components/analytics/PageAnalytics.vue";
import UserProfileSidebar from "@/components/user/UserProfileSidebar.vue";
import UserTopProjects from "@/components/user/UserTopProjects.vue";
import UserRecentPosts from "@/components/user/UserRecentPosts.vue";
import UserContentSearch from "@/components/shared/UserContentSearch.vue";

export default {
  components: {
    Comment,
    Markdown,
    UserFollowers,
    UserFollowing,
    Timeline,
    PageAnalytics,
    UserProfileSidebar,
    UserTopProjects,
    UserRecentPosts,
    UserContentSearch,
  },
  data() {
    return {
      username: this.$route.params.username,
      user: {},
      timeline: {
        events: [],
        pagination: {
          current: 1,
          size: 20,
          total: 0,
        },
      },
      readmeContent: "",
      readmeExists: false,
      readmeLoading: false,
      readmeChecking: true,
      isLoadingMore: false,
      targetConfigHeaders: [
        {title: "Key", key: "key", width: "240px"},
        {title: "Value", key: "value", sortable: false},
        {title: "更新时间", key: "updated_at", width: "180px"},
        {title: "操作", key: "actions", sortable: false, width: "100px"},
      ],
      targetConfigItems: [],
      targetConfigTotal: 0,
      targetConfigLoading: false,
      targetConfigError: "",
      targetConfigQuery: {
        page: 1,
        itemsPerPage: 20,
        key: "",
        keyLike: "",
      },
      targetConfigDialog: {
        show: false,
        isEdit: false,
        saving: false,
        key: "",
        valueText: "",
        parseAsJson: false,
        error: "",
      },
    };
  },
  computed: {
    currentTab() {
      return this.$route.query.tab || "home";
    },
    is40codeMirrorUser() {
      return String(this.username || '').toLowerCase().endsWith('@40code.com');
    },
    mirror40codeUserId() {
      const match = String(this.username || '').toLowerCase().match(/^(\d+)@40code\.com$/);
      if (match) {
        return Number(match[1]);
      }
      return 1;
    },
    mirror40codeProfileUrl() {
      return `https://40code.com/#page=user&id=${this.mirror40codeUserId}`;
    },
    isCurrentUser() {
      return Boolean(localuser.isLogin.value && localuser.user.value?.username === this.username);
    },
    isAdminViewer() {
      const currentUser = localuser.user.value || {};
      return currentUser.id == 1;
    },
    showReadmeLoadingCard() {
      return this.isCurrentUser && this.readmeChecking;
    },
    showReadmePrompt() {
      return this.isCurrentUser && !this.readmeChecking && !this.readmeContent;
    }
  },
  setup() {
    const pageTitle = ref("用户主页");
    const pageDescription = ref("");
    useSeo({
      title: pageTitle,
      description: pageDescription,
    });
    return {
      pageTitle,
      pageDescription,
    };
  },
  async created() {
    await this.fetchUser();
    await this.fetchReadmeContent();
    await this.fetchTimeline();
    if (this.isAdminViewer && this.user.id) {
      await this.loadTargetConfigs();
    }
  },
  methods: {
    async fetchUser() {
      this.user = await getUserByUsername(this.username);
      this.pageTitle = "" + this.user.display_name;
      this.pageDescription = `${this.user.display_name} 的 ZeroCat 个人主页`;
    },
    async fetchTimeline(page = 1) {
      try {
        const response = await request.get(`/timeline/user/${this.user.id}`, {
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
    async fetchReadmeContent() {
      this.readmeChecking = true;
      this.readmeContent = "";
      this.readmeExists = false;
      try {
        const readmeProject = await getProjectInfoByNamespace(this.username, this.username);
        if (!readmeProject?.id || readmeProject.id === 0 || readmeProject.type !== "article") {
          return;
        }

        this.readmeExists = true;

        const commitRes = await request.get(`/project/${readmeProject.id}/main/latest`);
        if (commitRes.data?.status !== "success") return;

        const token = commitRes.data.accessFileToken;
        const commitFile = commitRes.data.commit?.commit_file;
        if (!token || !commitFile) return;

        const fileRes = await request.get(
          `/project/files/${commitFile}?accessFileToken=${token}&content=true`
        );
        let raw = fileRes.data;
        if (typeof raw === "object") {
          raw = raw.index ?? "";
        }
        this.readmeContent = typeof raw === "string" ? raw : "";
      } catch (error) {
        console.error("Failed to fetch user README content:", error);
        this.readmeContent = "";
        this.readmeExists = false;
      } finally {
        this.readmeChecking = false;
      }
    },
    async openOrCreateReadmeProject() {
      if (!this.isCurrentUser) return;

      this.readmeLoading = true;
      try {
        const readmeProject = await getProjectInfoByNamespace(this.username, this.username);
        if (readmeProject?.id && readmeProject.id !== 0 && readmeProject.type === "article") {
          this.readmeExists = true;
          this.$router.push(`/${this.username}/articles/${this.username}/edit`);
          return;
        }

        const createRes = await request.post('/project/', {
          name: this.username,
          title: 'README.md',
          description: '',
          state: 'public',
          type: 'article',
          license: 'None'
        });

        if (createRes?.data?.status === 'error') {
          throw new Error(createRes?.data?.message || '创建 README 项目失败');
        }

        const projectId = createRes?.data?.data?.id ?? createRes?.data?.id;
        if (projectId) {
          await initProject(projectId, 'text');
        }

        this.readmeExists = true;
        this.$router.push(`/${this.username}/articles/${this.username}/edit`);
      } catch (error) {
        console.error('Failed to open/create README project:', error);
      } finally {
        this.readmeLoading = false;
      }
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

    formatDateTime(dateValue) {
      if (!dateValue) return "-";
      const date = new Date(dateValue);
      if (Number.isNaN(date.getTime())) return String(dateValue);
      return date.toLocaleString("zh-CN", {hour12: false});
    },

    formatTargetConfigValue(value) {
      if (value === null || value === undefined) return "";
      if (typeof value !== "string") return JSON.stringify(value, null, 2);
      try {
        return JSON.stringify(JSON.parse(value), null, 2);
      } catch {
        return value;
      }
    },

    buildTargetConfigParams() {
      const params = {
        page: this.targetConfigQuery.page,
        itemsPerPage: this.targetConfigQuery.itemsPerPage,
      };
      const key = (this.targetConfigQuery.key || "").trim();
      const keyLike = (this.targetConfigQuery.keyLike || "").trim();
      if (key) params.key = key;
      else if (keyLike) params.keyLike = keyLike;
      return params;
    },

    async loadTargetConfigs() {
      if (!this.isAdminViewer || !this.user?.id) return;

      this.targetConfigLoading = true;
      this.targetConfigError = "";
      try {
        const {data} = await request.get(`/admin/users/${this.user.id}/target-configs`, {
          params: this.buildTargetConfigParams(),
        });
        const payload = data?.data || data || {};
        this.targetConfigItems = Array.isArray(payload.items) ? payload.items : [];
        this.targetConfigTotal = Number(payload.total || 0);
      } catch (error) {
        this.targetConfigError = error?.response?.data?.message || "加载用户 ow_target_config 失败";
        console.error("Failed to load user target configs:", error);
      } finally {
        this.targetConfigLoading = false;
      }
    },

    async applyTargetConfigFilters() {
      this.targetConfigQuery.page = 1;
      await this.loadTargetConfigs();
    },

    async resetTargetConfigFilters() {
      this.targetConfigQuery.key = "";
      this.targetConfigQuery.keyLike = "";
      this.targetConfigQuery.page = 1;
      await this.loadTargetConfigs();
    },

    openCreateTargetConfigDialog() {
      this.targetConfigDialog = {
        show: true,
        isEdit: false,
        saving: false,
        key: "",
        valueText: "",
        parseAsJson: false,
        error: "",
      };
    },

    openEditTargetConfigDialog(item) {
      const rawValue = item?.value ?? "";
      let parseAsJson = false;
      let valueText = typeof rawValue === "string" ? rawValue : JSON.stringify(rawValue);
      if (typeof rawValue === "string") {
        try {
          const parsed = JSON.parse(rawValue);
          if (parsed !== null && typeof parsed !== "string") {
            parseAsJson = true;
            valueText = JSON.stringify(parsed, null, 2);
          }
        } catch {
          parseAsJson = false;
        }
      }

      this.targetConfigDialog = {
        show: true,
        isEdit: true,
        saving: false,
        key: item?.key || "",
        valueText,
        parseAsJson,
        error: "",
      };
    },

    async saveTargetConfig() {
      if (!this.isAdminViewer || !this.user?.id) return;

      const key = (this.targetConfigDialog.key || "").trim();
      if (!key) {
        this.targetConfigDialog.error = "配置键不能为空";
        return;
      }

      let requestValue = this.targetConfigDialog.valueText;
      if (this.targetConfigDialog.parseAsJson) {
        try {
          requestValue = JSON.parse(this.targetConfigDialog.valueText || "null");
        } catch {
          this.targetConfigDialog.error = "JSON 格式无效，请检查后再提交";
          return;
        }
      }

      this.targetConfigDialog.saving = true;
      this.targetConfigDialog.error = "";
      try {
        await request.put(`/admin/users/${this.user.id}/target-configs/${encodeURIComponent(key)}`, {
          value: requestValue,
        });
        this.targetConfigDialog.show = false;
        await this.loadTargetConfigs();
      } catch (error) {
        this.targetConfigDialog.error = error?.response?.data?.message || "保存 ow_target_config 失败";
        console.error("Failed to save user target config:", error);
      } finally {
        this.targetConfigDialog.saving = false;
      }
    },
  },
};
</script>

<style scoped>
.profile-container {
  max-width: 1400px;
  margin: 0 auto;
}

.profile-sidebar {
  position: sticky;
  top: 80px;
}

.readme-card-header {
  min-height: 44px;
}

.readme-markdown-body {
  background: transparent;
}

.target-config-value {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  max-height: 180px;
  overflow: auto;
}

:deep(.readme-markdown-body.markdown-body) {
  background-color: transparent;
}

@media (max-width: 959px) {
  .profile-sidebar {
    position: static;
  }
}
</style>
