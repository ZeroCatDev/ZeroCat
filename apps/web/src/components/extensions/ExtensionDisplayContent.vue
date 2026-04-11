<template>
  <div>
    <!-- 加载状态 -->
    <v-container
      v-if="loading"
      class="d-flex justify-center align-center"
      style="min-height: 400px"
    >
      <v-progress-circular
        indeterminate
        size="64"
        color="primary"
      ></v-progress-circular>
    </v-container>

    <!-- 主要内容 -->
    <div v-else-if="extension">
      <!-- 扩展头部信息卡片 -->
      <v-container>
        <v-card variant="elevated" border>
          <v-card-item>
            <v-card-title>
              {{ extension?.project?.title || "扩展" }}
            </v-card-title>
            <v-card-subtitle>
              {{ extension?.project?.description || "暂无描述" }}
            </v-card-subtitle>

            <v-row>
              <v-col cols="auto">
                <v-chip
                  v-if="isOwner"
                  :color="getStatusColor(extension.status)"
                  variant="tonal"
                  size="default"
                  class="mr-2"
                >
                  {{ getStatusText(extension.status) }}
                </v-chip>
                <v-chip
                  :color="extension?.scratchCompatible ? 'orange' : 'grey'"
                  variant="tonal"
                  prepend-icon="mdi-puzzle"
                >
                  {{
                    extension?.scratchCompatible ? "兼容Scratch" : "独立扩展"
                  }}
                </v-chip>
              </v-col>
            </v-row>
          </v-card-item>
        </v-card>
      </v-container>

      <!-- 主要内容区域 -->
      <v-container>
        <v-row>
          <v-col cols="12" lg="8">
            <!-- 扩展详细信息卡片 -->
            <ExtensionDetailsCard
              :extension-id="extensionId"
              :extension="extension"
              :is-owner="isOwner"
              :update-loading="updateLoading"
              @update-to-latest="handleUpdateToLatestCommit"
            />
          </v-col>

          <!-- 侧边栏 -->
          <v-col cols="12" lg="4">
            <!-- 示例项目卡片 -->
            <v-card
              v-if="extension?.sample_project"
              border
              class="mb-6"
              :to="`/${extension?.sample_project?.author?.username}/${extension?.sample_project?.name}`"
            >
              <v-card-title> 示例项目 </v-card-title>
              <v-card-item>
                <v-card-title>{{
                  extension.sample_project.title
                }}</v-card-title>
                <v-card-subtitle
                  >by
                  {{
                    extension.sample_project.description || "ZeroCat 上的项目"
                  }}</v-card-subtitle
                >
              </v-card-item>
            </v-card>
          </v-col>
        </v-row>
      </v-container>

      <!-- 扩展管理卡片 (仅扩展所有者可见) -->
      <v-container v-if="isOwner && extension">
        <v-card border>
          <v-card-title> 扩展管理 </v-card-title>

          <v-card-text>
            <!-- 管理操作按钮 -->
            <v-row class="mb-6">
              <v-col cols="12" md="auto">
                <v-btn
                  color="primary"
                  prepend-icon="mdi-pencil"
                  variant="elevated"
                  @click="showEditDialog = true"
                >
                  编辑扩展
                </v-btn>
              </v-col>
              <v-col cols="12" md="auto">
                <v-btn
                  v-if="extension.status === 'developing'"
                  color="success"
                  prepend-icon="mdi-upload"
                  variant="elevated"
                  :loading="submitLoading"
                  @click="handleSubmitExtension"
                >
                  提交审核
                </v-btn>
              </v-col>
              <v-col cols="12" md="auto" class="ml-auto">
                <v-btn
                  color="error"
                  prepend-icon="mdi-delete"
                  variant="outlined"
                  @click="showDeleteDialog = true"
                >
                  删除扩展
                </v-btn>
              </v-col>
            </v-row>

            <!-- 状态时间线 -->
            <v-card variant="tonal">
              <v-card-title class="d-flex align-center">
                <v-icon class="mr-2">mdi-history</v-icon>
                开发历史
              </v-card-title>
              <v-card-text>
                <v-timeline density="compact" side="end">
                  <v-timeline-item dot-color="primary" size="small">
                    <div class="mb-1">
                      <strong>扩展创建</strong>
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      <TimeAgo :date="extension.created_at" />
                    </div>
                  </v-timeline-item>

                  <v-timeline-item
                    v-if="extension.updated_at !== extension.created_at"
                    dot-color="warning"
                    size="small"
                  >
                    <div class="mb-1">
                      <strong>最后更新</strong>
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      <TimeAgo :date="extension.updated_at" />
                    </div>
                  </v-timeline-item>

                  <v-timeline-item
                    :dot-color="getStatusColor(extension.status)"
                    size="small"
                  >
                    <div class="mb-1">
                      <strong>{{ getStatusText(extension.status) }}</strong>
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      当前状态
                    </div>
                  </v-timeline-item>
                </v-timeline>
              </v-card-text>
            </v-card>
          </v-card-text>
        </v-card>
      </v-container>
    </div>

    <!-- 扩展不存在 -->
    <v-container v-else-if="!extension" class="text-center py-8">
      <v-icon size="64" color="grey-lighten-1">mdi-puzzle-remove</v-icon>
      <p class="text-h6 mt-4 text-grey-darken-1">扩展不存在</p>
      <p class="text-body-2 text-grey">找不到指定的扩展信息</p>

      <!-- 如果是用户自己的项目，显示创建扩展按钮 -->
      <v-btn
        v-if="isCurrentUserProject"
        class="mt-4 mr-2"
        color="success"
        prepend-icon="mdi-plus"
        @click="showCreateExtensionDialog = true"
      >
        创建扩展
      </v-btn>

      <v-btn class="mt-4" to="/app/extensions" color="primary">
        返回扩展列表
      </v-btn>
    </v-container>

    <!-- 编辑扩展对话框 -->
    <ExtensionEditDialog
      v-if="extension"
      v-model="showEditDialog"
      :extension="extension"
      @updated="handleExtensionUpdated"
    />

    <!-- 删除扩展对话框 -->
    <v-dialog v-if="extension" v-model="showDeleteDialog" max-width="400">
      <v-card>
        <v-card-title>删除扩展</v-card-title>
        <v-card-text>
          确定要删除扩展"{{
            extension?.project?.title || extension?.name
          }}"吗？此操作不可撤销。
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="showDeleteDialog = false">取消</v-btn>
          <v-btn
            color="error"
            :loading="deleteLoading"
            @click="handleDeleteExtension"
          >
            删除
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 创建扩展确认对话框 -->
    <v-dialog v-model="showCreateExtensionDialog" max-width="400">
      <v-card>
        <v-card-title>创建扩展</v-card-title>
        <v-card-text>
          确定要为此项目创建扩展吗？
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="showCreateExtensionDialog = false">取消</v-btn>
          <v-btn
            color="success"
            :loading="createExtensionLoading"
            @click="handleCreateExtension"
          >
            创建
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 消息提示 -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color">
      {{ snackbar.message }}
    </v-snackbar>
  </div>
</template>

<script>
import request from "@/axios/axios";
import { localuser } from "@/services/localAccount";
import { useHead } from "@unhead/vue";
import TimeAgo from "@/components/TimeAgo.vue";
import ExtensionDetailsCard from "@/components/extensions/ExtensionDetailsCard.vue";
import ExtensionEditDialog from "@/components/extensions/ExtensionEditDialog.vue";
import ProjectInfoCard from "../project/ProjectInfoCard.vue";

export default {
  name: "ExtensionDisplayContent",
  components: {
    TimeAgo,
    ExtensionDetailsCard,
    ExtensionEditDialog,
  },
  props: {
    extensionId: {
      type: [String, Number],
      required: false,
    },
    projectId: {
      type: [String, Number],
      required: false,
    },
    scope: {
      type: String,
      default: "my", // 'my' or 'public'
    },
  },
  emits: [
    "extension-deleted", // 只保留删除事件，用于父页面路由跳转
  ],
  data() {
    return {
      loading: true,
      extension: null,
      localuser,

      // Dialog states
      showEditDialog: false,
      showDeleteDialog: false,
      showCreateExtensionDialog: false,
      deleteLoading: false,
      createExtensionLoading: false,

      // API loading states
      submitLoading: false,
      updateLoading: false,

      // Snackbar
      snackbar: {
        show: false,
        message: "",
        color: "success",
      },
    };
  },
  computed: {
    isOwner() {
      if (!this.extension || !localuser.isLogin.value) return false;
      return localuser.user.value?.id === this.extension?.project?.author?.id;
    },

    isCurrentUserProject() {
      if (!localuser.isLogin.value || !this.$route.params.username) return false;
      return localuser.user.value?.username === this.$route.params.username;
    },
  },
  watch: {
    extensionId: {
      immediate: true,
      handler(newId) {
        if (newId) {
          this.fetchExtensionDetail();
        }
      },
    },
    projectId: {
      immediate: true,
      handler(newId) {
        if (newId) {
          this.fetchExtensionDetail();
        }
      },
    },
  },
  methods: {
    async fetchExtensionDetail() {
      this.loading = true;
      if (!this.extensionId && !this.projectId) {
        // 保持 loading 状态，等待 ID 通过 props 传入
        return;
      }
      try {
        let response;
        if (this.projectId) {
          // 使用项目ID获取扩展详情
          response = await request.get(
            `/extensions/detailbyprojectid/${this.projectId}`
          );
        } else {
          // 使用扩展ID获取详情
          response = await request.get(
            `/extensions/detail/${this.extensionId}`
          );
        }
        console.log("Extension detail response:", response);
        if (response.status == 200) {
          console.log("Extension detail data:", response.data.data);
          this.extension = response.data.data;
          this.updatePageTitle();
        } else {
          this.extension = null;
        }
      } catch (error) {
        console.error("Failed to fetch extension detail:", error);
        this.extension = null;
      } finally {
        this.loading = false;
      }
    },

    async handleSubmitExtension() {
      if (!this.extension || !this.isOwner) return;
      this.submitLoading = true;
      try {
        const response = await request.post(
          `/extensions/manager/submit/${this.extension.id}`
        );
        if (response.data.status === "success") {
          this.showMessage("提交审核成功", "success");
          await this.fetchExtensionDetail();
        } else {
          this.showMessage(response.data.message || "提交失败", "error");
        }
      } catch (error) {
        console.error("Failed to submit extension:", error);
        this.showMessage("提交失败", "error");
      } finally {
        this.submitLoading = false;
      }
    },

    async handleUpdateToLatestCommit() {
      if (!this.extension || !this.isOwner) return;
      this.updateLoading = true;
      try {
        const response = await request.post(
          `/extensions/manager/update/${this.extension.id}`
        );
        if (response.data.status === "success") {
          this.showMessage("更新到最新提交成功", "success");
          await this.fetchExtensionDetail();
        } else {
          this.showMessage(response.data.message || "更新失败", "error");
        }
      } catch (error) {
        console.error("Failed to update commit:", error);
        this.showMessage("更新失败", "error");
      } finally {
        this.updateLoading = false;
      }
    },

    async handleExtensionUpdated() {
      await this.fetchExtensionDetail();
      // 扩展更新后会通过fetchExtensionDetail重新更新页面标题
    },

    async handleDeleteExtension() {
      if (!this.extension || !this.isOwner) return;

      this.deleteLoading = true;
      try {
        const response = await request.delete(
          `/extensions/manager/${this.extension.id}`
        );
        if (response.data.status === "success") {
          this.showMessage("删除扩展成功", "success");
          this.$router.push("/app/extensions");
          this.showDeleteDialog = false;
        } else {
          this.showMessage(response.data.message || "删除扩展失败", "error");
        }
      } catch (error) {
        console.error("Failed to delete extension:", error);
        this.showMessage("删除扩展失败", "error");
      } finally {
        this.deleteLoading = false;
      }
    },

    async handleCreateExtension() {
      if (!this.projectId || !this.isCurrentUserProject) return;

      this.createExtensionLoading = true;
      try {
        const payload = {
          projectid: this.projectId,
          scratchCompatible: false // 默认值，可以根据需要调整
        };
        const response = await request.post('/extensions/manager/create', payload);

        if (response.data.status === 'success') {
          this.showMessage('创建扩展成功', 'success');
          this.showCreateExtensionDialog = false;
          // 重新加载扩展详情
          await this.fetchExtensionDetail();
        } else {
          this.showMessage(response.data.message || '创建扩展失败', 'error');
        }
      } catch (error) {
        console.error('Failed to create extension:', error);
        this.showMessage('创建扩展失败', 'error');
      } finally {
        this.createExtensionLoading = false;
      }
    },

    getStatusColor(status) {
      const colorMap = {
        developing: "primary",
        pending: "warning",
        verified: "success",
        rejected: "error",
      };
      return colorMap[status] || "grey";
    },

    getStatusText(status) {
      const textMap = {
        developing: "开发中",
        pending: "待审核",
        verified: "上架",
        rejected: "已拒绝",
      };
      return textMap[status] || "未知";
    },

    showMessage(message, color = "success") {
      this.snackbar = {
        show: true,
        message,
        color,
      };
    },

    updatePageTitle() {
      if (this.extension) {
        document.title = `${this.extension.project?.title || "扩展"} - ZeroCat`;
      }
    },

    // 公开方法供父组件调用
    async refresh() {
      await this.fetchExtensionDetail();
    },
  },
};
</script>
