<template>
  <v-container>
    <div class="extensions-admin">
      <!-- 统计信息卡片 -->
      <v-row class="mb-4">
        <v-col
          v-for="stat in extensionStats"
          :key="stat.title"
          cols="12"
          md="3"
          sm="6"
        >
          <v-card :class="['stat-card', `stat-${stat.type}`]" elevation="2">
            <v-card-text>
              <div class="text-overline mb-2">{{ stat.title }}</div>
              <div class="text-h4">{{ stat.value }}</div>
              <v-icon class="stat-icon" large>{{ stat.icon }}</v-icon>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- 搜索和过滤工具栏 -->
      <v-card class="mb-4">
        <v-card-text>
          <v-row align="center">
            <v-col cols="12" sm="3">
              <v-text-field
                v-model="searchQuery"
                clearable
                hide-details
                label="搜索扩展"
                prepend-icon="mdi-magnify"
                @input="debouncedSearch"
              ></v-text-field>
            </v-col>
            <v-col cols="12" sm="2">
              <v-select
                v-model="statusFilter"
                :items="statusOptions"
                clearable
                hide-details
                label="状态过滤"
                prepend-icon="mdi-filter"
                @change="loadExtensions"
              ></v-select>
            </v-col>
            <v-col cols="12" sm="2">
              <ProjectSelector v-model="projectIdFilter" :multiple="false" />
              <v-text-field
                v-model="projectIdFilter"
                clearable
                hide-details
                label="项目ID"
                prepend-icon="mdi-folder"
                type="number"
                @input="debouncedSearch"
              ></v-text-field>
            </v-col>
            <v-col cols="12" sm="2">
              <v-text-field
                v-model="authorIdFilter"
                clearable
                hide-details
                label="作者ID"
                prepend-icon="mdi-account"
                type="number"
                @input="debouncedSearch"
              ></v-text-field>
            </v-col>
            <v-col class="d-flex justify-end" cols="12" sm="3">
              <v-btn
                :disabled="loading"
                :loading="refreshing"
                color="primary"
                @click="refreshData"
              >
                <v-icon :class="{ rotate: refreshing }" left>mdi-refresh</v-icon>
                刷新
              </v-btn>
              <v-btn
                class="ml-2"
                color="info"
                @click="openAutoApproveDialog"
              >
                <v-icon left>mdi-account-check</v-icon>
                自动过审用户
              </v-btn>
              <v-btn
                class="ml-2"
                color="success"
                @click="createExtension"
              >
                <v-icon left>mdi-plus</v-icon>
                新建扩展
              </v-btn>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- 扩展列表表格 -->
      <v-card>
        <v-data-table-server
          v-model:items-per-page="options.itemsPerPage"
          v-model:page="options.page"
          :headers="headers"
          :items="extensions"
          :items-length="total"
          :loading="loading"
          :loading-text="'加载中...'"
          :no-data-text="'暂无数据'"
          :no-results-text="'未找到匹配的数据'"
          @update:options="loadExtensions"
        >
          <!-- 扩展信息列 -->
          <template v-slot:item.project="{ item }">
            <div class="d-flex align-center">
              <v-avatar class="mr-2" size="32">
                <v-img
                  :alt="item.project?.title || '扩展'"
                  :src="getExtensionImage(item.image)"
                ></v-img>
              </v-avatar>
              <div>
                <div class="font-weight-medium">{{ item.project?.title || '未知扩展' }}</div>
                <div class="caption grey--text">{{ item.project?.name || '未知名称' }}</div>
              </div>
            </div>
          </template>

          <!-- 作者信息列 -->
          <template v-slot:item.author="{ item }">
            <div v-if="item.project?.author">
              <div class="font-weight-medium">{{ item.project.author.display_name }}</div>
              <div class="caption grey--text">@{{ item.project.author.username }}</div>
            </div>
            <div v-else class="grey--text">未知作者</div>
          </template>

          <!-- 状态列自定义渲染 -->
          <template v-slot:item.status="{ item }">
            <v-chip
              :color="getStatusColor(item.status)"
              class="status-chip"
              small
            >
              {{ getStatusText(item.status) }}
            </v-chip>
          </template>

          <!-- 分支和提交信息列 -->
          <template v-slot:item.branch="{ item }">
            <div>
              <div class="font-weight-medium">{{ item.branch || 'main' }}</div>
              <div class="caption grey--text">{{ item.commit || 'latest' }}</div>
            </div>
          </template>

          <!-- 创建时间列格式化 -->
          <template v-slot:item.created_at="{ item }">
            <div>{{ formatDate(item.created_at) }}</div>
            <div class="caption grey--text">
              {{ formatTimeAgo(item.created_at) }}
            </div>
          </template>

          <!-- 更新时间列格式化 -->
          <template v-slot:item.updated_at="{ item }">
            <div>{{ formatDate(item.updated_at) }}</div>
            <div class="caption grey--text">
              {{ formatTimeAgo(item.updated_at) }}
            </div>
          </template>

          <!-- 操作按钮列 -->
          <template v-slot:item.actions="{ item }">
            <v-slide-x-transition group>
              <v-btn
                v-tooltip="'查看详情'"
                class="action-btn"
                icon
                small
                @click.stop="viewExtension(item)"
              >
                <v-icon>mdi-eye</v-icon>
              </v-btn>
              <v-btn
                v-tooltip="'编辑扩展'"
                class="action-btn"
                icon
                small
                @click.stop="editExtension(item)"
              >
                <v-icon>mdi-pencil</v-icon>
              </v-btn>
              <v-btn
                v-if="item.status === 'pending'"
                v-tooltip="'批准扩展'"
                class="action-btn"
                color="success"
                icon
                small
                @click.stop="approveExtension(item)"
              >
                <v-icon>mdi-check</v-icon>
              </v-btn>
              <v-btn
                v-if="item.status === 'pending'"
                v-tooltip="'拒绝扩展'"
                class="action-btn"
                color="error"
                icon
                small
                @click.stop="rejectExtension(item)"
              >
                <v-icon>mdi-close</v-icon>
              </v-btn>
              <v-btn
                v-tooltip="'删除扩展'"
                class="action-btn"
                color="error"
                icon
                small
                @click.stop="confirmDelete(item)"
              >
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </v-slide-x-transition>
          </template>
        </v-data-table-server>
      </v-card>

      <!-- 扩展编辑对话框 -->
      <extension-editor
        v-model="editDialog"
        :extension="selectedExtension"
        @save="saveExtension"
      />

      <!-- 自动过审用户对话框 -->
      <v-dialog
        v-model="autoApproveDialog"
        max-width="640px"
        transition="dialog-bottom-transition"
      >
        <v-card>
          <v-card-item>
            <v-card-title class="headline">管理自动过审用户</v-card-title>
            <v-card-subtitle>
              输入用户名，支持换行或逗号分隔
            </v-card-subtitle>
            <template v-slot:append>
              <v-btn icon @click="autoApproveDialog = false">
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </template>
          </v-card-item>
          <v-divider></v-divider>
          <v-progress-linear
            v-if="autoApproveLoading"
            indeterminate
            color="primary"
          />
          <v-card-text class="pt-4">
            <v-textarea
              v-model="autoApproveInput"
              auto-grow
              clearable
              label="自动过审用户名单"
              outlined
              rows="4"
            ></v-textarea>
            <div class="mt-3">
              <div class="text-caption mb-2">预览</div>
              <div v-if="autoApprovePreview.length">
                <v-chip
                  v-for="name in autoApprovePreview"
                  :key="name"
                  class="mr-1 mb-1"
                  color="primary"
                  label
                  small
                >
                  {{ name }}
                </v-chip>
              </div>
              <div v-else class="caption grey--text">暂无用户名</div>
            </div>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn text @click="autoApproveDialog = false">取消</v-btn>
            <v-btn
              :loading="autoApproveSaving"
              color="primary"
              text
              @click="saveAutoApproveUsers"
            >
              保存
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <!-- 扩展详情对话框 -->
      <v-dialog
        v-model="viewDialog"
        max-width="800px"
        transition="dialog-bottom-transition"
      >
        <v-card>
          <v-card-item>
            <v-card-title class="headline">
              扩展详情
            </v-card-title>
            <v-card-subtitle>
              <v-icon>mdi-puzzle</v-icon>
              {{ selectedExtension?.project?.title || '扩展详情' }}
            </v-card-subtitle>
            <template v-slot:append>
              <v-btn icon @click="viewDialog = false">
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </template>
          </v-card-item>
          <v-divider></v-divider>

          <v-card-text class="pt-4" v-if="selectedExtension">
            <v-row>
              <v-col cols="12" sm="6">
                <v-card outlined>
                  <v-card-title class="subtitle-1">基本信息</v-card-title>
                  <v-card-text>
                    <div class="mb-2">
                      <strong>扩展ID:</strong> {{ selectedExtension.id }}
                    </div>
                    <div class="mb-2">
                      <strong>项目ID:</strong> {{ selectedExtension.projectid }}
                    </div>
                    <div class="mb-2">
                      <strong>分支:</strong> {{ selectedExtension.branch || 'main' }}
                    </div>
                    <div class="mb-2">
                      <strong>提交:</strong> {{ selectedExtension.commit || 'latest' }}
                    </div>
                    <div class="mb-2">
                      <strong>状态:</strong>
                      <v-chip :color="getStatusColor(selectedExtension.status)" small>
                        {{ getStatusText(selectedExtension.status) }}
                      </v-chip>
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" sm="6">
                <v-card outlined>
                  <v-card-title class="subtitle-1">项目信息</v-card-title>
                  <v-card-text>
                    <div class="mb-2">
                      <strong>项目名称:</strong> {{ selectedExtension.project?.title }}
                    </div>
                    <div class="mb-2">
                      <strong>项目标识:</strong> {{ selectedExtension.project?.name }}
                    </div>
                    <div class="mb-2">
                      <strong>描述:</strong> {{ selectedExtension.project?.description }}
                    </div>
                    <div class="mb-2">
                      <strong>作者:</strong> {{ selectedExtension.project?.author?.display_name }}
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12">
                <v-card outlined>
                  <v-card-title class="subtitle-1">扩展资源</v-card-title>
                  <v-card-text>
                    <div class="mb-2">
                      <strong>图片URL:</strong>
                      <a v-if="selectedExtension.image" :href="selectedExtension.image" target="_blank">
                        {{ selectedExtension.image }}
                      </a>
                      <span v-else class="grey--text">未设置</span>
                    </div>
                    <div class="mb-2">
                      <strong>文档URL:</strong>
                      <a v-if="selectedExtension.docs" :href="selectedExtension.docs" target="_blank">
                        {{ selectedExtension.docs }}
                      </a>
                      <span v-else class="grey--text">未设置</span>
                    </div>
                    <div class="mb-2">
                      <strong>示例项目:</strong>
                      <span v-if="selectedExtension.samples">
                        {{ selectedExtension.sample_project?.title || selectedExtension.samples }}
                      </span>
                      <span v-else class="grey--text">未设置</span>
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-dialog>

      <!-- 拒绝原因对话框 -->
      <v-dialog
        v-model="rejectDialog"
        max-width="500px"
        transition="dialog-bottom-transition"
      >
        <v-card>
          <v-card-title class="headline error--text">拒绝扩展</v-card-title>
          <v-card-text class="pt-4">
            <v-alert dense text type="warning">
              您即将拒绝扩展 <strong>{{ selectedExtension?.project?.title }}</strong>，请提供拒绝原因。
            </v-alert>
            <v-textarea
              v-model="rejectReason"
              :rules="[(v) => !!v || '拒绝原因不能为空']"
              class="mt-4"
              label="拒绝原因"
              outlined
              rows="3"
            ></v-textarea>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn text @click="rejectDialog = false">取消</v-btn>
            <v-btn
              :disabled="!rejectReason"
              :loading="rejecting"
              color="error"
              text
              @click="confirmReject"
            >
              确认拒绝
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <!-- 删除确认对话框 -->
      <v-dialog
        v-model="deleteDialog"
        max-width="400px"
        transition="dialog-bottom-transition"
      >
        <v-card>
          <v-card-title class="headline error--text">确认删除</v-card-title>
          <v-card-text class="pt-4">
            <v-alert dense text type="warning">
              此操作将永久删除扩展
              <strong>{{ selectedExtension?.project?.title }}</strong>
              ，此操作不可撤销。
            </v-alert>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn text @click="deleteDialog = false">取消</v-btn>
            <v-btn
              :loading="deleting"
              color="error"
              text
              @click="deleteExtension"
            >
              确认删除
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <!-- 全局提示 -->
      <v-snackbar
        v-model="snackbar.show"
        :color="snackbar.color"
        :timeout="snackbar.timeout"
        top
      >
        {{ snackbar.text }}
        <template v-slot:action="{ attrs }">
          <v-btn text v-bind="attrs" @click="snackbar.show = false">
            关闭
          </v-btn>
        </template>
      </v-snackbar>
    </div>
  </v-container>
</template>

<script>
import axios from "@/axios/axios";
import { debounce } from "lodash-es";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/zh-cn";
import ExtensionEditor from "@/components/admin/ExtensionEditor.vue";
import ProjectSelector from "@/components/shared/ProjectSelector.vue";
dayjs.extend(relativeTime);
dayjs.locale("zh-cn");

export default {
  name: 'ExtensionsPage',
  components: {
    ExtensionEditor,
    ProjectSelector
  },
  data() {
    return {
      extensionStats: [
        { title: "总扩展数", value: 100, type: "total", icon: "mdi-puzzle" },
        { title: "开发中", value: 0, type: "developing", icon: "mdi-code-braces" },
        { title: "待审核", value: 0, type: "pending", icon: "mdi-clock" },
        { title: "已批准", value: 0, type: "verified", icon: "mdi-check-circle" },
        { title: "已拒绝", value: 0, type: "rejected", icon: "mdi-close-circle" }
      ],
      extensions: [],
      total: 0,
      loading: false,
      refreshing: false,
      options: {
        page: 1,
        itemsPerPage: 10,
        sortBy: ["id"],
        sortDesc: [false],
        groupBy: [],
        groupDesc: [],
        multiSort: false,
      },
      headers: [
        { title: "ID", value: "id", width: "80px", sortable: false },
        { title: "扩展信息", value: "project", width: "250px", sortable: false },
        { title: "作者", value: "author", width: "150px", sortable: false },
        { title: "状态", value: "status", width: "120px", sortable: false },
        { title: "分支/提交", value: "branch", width: "120px", sortable: false },
        { title: "Scratch兼容性", value: "scratchCompatible", width: "120px", sortable: false },
        { title: "创建时间", value: "created_at", width: "180px", sortable: false },
        { title: "更新时间", value: "updated_at", width: "180px", sortable: false },
        {
          title: "操作",
          value: "actions",
          sortable: false,
          width: "200px",
          align: "center",
        },
      ],
      searchQuery: "",
      statusFilter: "",
      projectIdFilter: "",
      authorIdFilter: "",
      statusOptions: [
        { title: "开发中", value: "developing" },
        { title: "待审核", value: "pending" },
        { title: "已批准", value: "verified" },
        { title: "已拒绝", value: "rejected" },
      ],
      editDialog: false,
      viewDialog: false,
      rejectDialog: false,
      deleteDialog: false,
      autoApproveDialog: false,
      autoApproveLoading: false,
      autoApproveSaving: false,
      autoApproveUsers: [],
      autoApproveInput: "",
      selectedExtension: null,
      rejectReason: "",
      rejecting: false,
      deleting: false,
      snackbar: {
        show: false,
        text: "",
        color: "success",
        timeout: 3000,
      }
    }
  },
  computed: {
    autoApprovePreview() {
      return this.normalizeAutoApproveInput();
    }
  },
  methods: {
    normalizeAutoApproveInput() {
      return this.autoApproveInput
        .split(/[\n,]+/)
        .map((name) => name.trim())
        .filter(Boolean);
    },

    async openAutoApproveDialog() {
      this.autoApproveDialog = true;
      await this.loadAutoApproveUsers();
    },

    async loadAutoApproveUsers() {
      this.autoApproveLoading = true;
      try {
        const { data } = await axios.get("/admin/extensions/auto-approve-users");
        const usernames = Array.isArray(data?.data) ? data.data : [];
        this.autoApproveUsers = usernames;
        this.autoApproveInput = usernames.join("\n");
      } catch (error) {
        this.showError("加载自动过审用户失败");
        console.error("Error loading auto-approve users:", error);
      } finally {
        this.autoApproveLoading = false;
      }
    },

    async saveAutoApproveUsers() {
      this.autoApproveSaving = true;
      try {
        const usernames = this.normalizeAutoApproveInput();
        const { data } = await axios.put("/admin/extensions/auto-approve-users", {
          usernames
        });
        const nextUsernames = Array.isArray(data?.data) ? data.data : usernames;
        this.autoApproveUsers = nextUsernames;
        this.autoApproveInput = nextUsernames.join("\n");
        this.showSuccess(data?.message || "自动过审用户已更新");
        this.autoApproveDialog = false;
      } catch (error) {
        const message =
          error.response?.data?.message ||
          error.response?.data?.error ||
          "更新自动过审用户失败";
        this.showError(message);
        console.error("Error saving auto-approve users:", error);
      } finally {
        this.autoApproveSaving = false;
      }
    },
    async loadExtensions() {
      this.loading = true;
      try {
        const params = {
          page: this.options.page,
          itemsPerPage: this.options.itemsPerPage,
          sortBy: this.options.sortBy[0] || "id",
          sortDesc: this.options.sortDesc[0] || false,
        };

        if (this.searchQuery) params.search = this.searchQuery;
        if (this.statusFilter) params.status = this.statusFilter;
        if (this.projectIdFilter) params.projectid = this.projectIdFilter;
        if (this.authorIdFilter) params.authorid = this.authorIdFilter;

        const { data } = await axios.get("/admin/extensions", { params });

        this.extensions = data.items.map((extension) => ({
          ...extension,
          id: extension.id,
          projectid: extension.projectid,
          branch: extension.branch || "",
          commit: extension.commit || "latest",
          image: extension.image || "",
          samples: extension.samples,
          docs: extension.docs,
          status: extension.status || "developing",
          created_at: extension.created_at,
          updated_at: extension.updated_at,
        }));

        this.total = Number(data.total);
      } catch (error) {
        this.showError("加载扩展列表失败");
        console.error("Error loading extensions:", error);
      } finally {
        this.loading = false;
      }
    },

    async loadExtensionStats() {
      try {
        const response = await axios.get("/admin/extensions/stats/overview");
        this.extensionStats[0].value = response.data.data.total;
        this.extensionStats[1].value = response.data.data.developing;
        this.extensionStats[2].value = response.data.data.pending;
        this.extensionStats[3].value = response.data.data.verified;
        this.extensionStats[4].value = response.data.data.rejected;
      } catch (error) {
        console.error("Error loading extension stats:", error);
      }
    },

    async refreshData() {
      if (this.refreshing || this.loading) return;

      this.refreshing = true;
      try {
        await Promise.all([this.loadExtensions(), this.loadExtensionStats()]);
        this.showSuccess("数据已更新");
      } catch (error) {
        this.showError("刷新数据失败");
        console.error("Error refreshing data:", error);
      } finally {
        this.refreshing = false;
      }
    },

    createExtension() {
      this.selectedExtension = null;
      this.editDialog = true;
    },

    viewExtension(extension) {
      this.selectedExtension = extension;
      this.viewDialog = true;
    },

    editExtension(extension) {
      this.selectedExtension = extension;
      this.editDialog = true;
    },

    async saveExtension(extensionData) {
      try {
        if (extensionData.id) {
          // 更新扩展
          const { data } = await axios.put(
            `/admin/extensions/${extensionData.id}`,
            extensionData
          );

          const index = this.extensions.findIndex((e) => e.id === extensionData.id);
          if (index !== -1) {
            this.extensions[index] = { ...this.extensions[index], ...data };
          }
          this.showSuccess("扩展信息更新成功");
        } else {
          // 创建扩展
          const { data } = await axios.post("/admin/extensions", extensionData);
          this.extensions.unshift(data);
          this.showSuccess("扩展创建成功");
        }

        this.loadExtensionStats();
      } catch (error) {
        this.showError(error.response?.data?.error || "保存扩展信息失败");
        console.error("Error saving extension:", error);
        throw error;
      }
    },

    async approveExtension(extension) {
      try {
        const { data } = await axios.post(`/admin/extensions/${extension.id}/approve`);

        const index = this.extensions.findIndex((e) => e.id === extension.id);
        if (index !== -1) {
          this.extensions[index] = { ...this.extensions[index], ...data };
        }

        this.showSuccess("扩展已批准");
        this.loadExtensionStats();
      } catch (error) {
        this.showError("批准扩展失败");
        console.error("Error approving extension:", error);
      }
    },

    rejectExtension(extension) {
      this.selectedExtension = extension;
      this.rejectReason = "";
      this.rejectDialog = true;
    },

    async confirmReject() {
      this.rejecting = true;
      try {
        const { data } = await axios.post(`/admin/extensions/${this.selectedExtension.id}/reject`, {
          reason: this.rejectReason
        });

        const index = this.extensions.findIndex((e) => e.id === this.selectedExtension.id);
        if (index !== -1) {
          this.extensions[index] = { ...this.extensions[index], ...data };
        }

        this.showSuccess("扩展已拒绝");
        this.loadExtensionStats();
        this.rejectDialog = false;
      } catch (error) {
        this.showError("拒绝扩展失败");
        console.error("Error rejecting extension:", error);
      } finally {
        this.rejecting = false;
      }
    },

    confirmDelete(extension) {
      this.selectedExtension = extension;
      this.deleteDialog = true;
    },

    async deleteExtension() {
      this.deleting = true;
      try {
        await axios.delete(`/admin/extensions/${this.selectedExtension.id}`);
        this.showSuccess("扩展删除成功");
        this.loadExtensions();
        this.loadExtensionStats();
        this.deleteDialog = false;
      } catch (error) {
        this.showError("删除扩展失败");
        console.error("Error deleting extension:", error);
      } finally {
        this.deleting = false;
      }
    },

    getStatusText(status) {
      const option = this.statusOptions.find((opt) => opt.value === status);
      return option ? option.title : status;
    },

    formatDate(date) {
      return dayjs(date).format("YYYY-MM-DD HH:mm:ss");
    },

    formatTimeAgo(date) {
      return dayjs(date).fromNow();
    },

    getStatusColor(status) {
      return (
        {
          developing: "info",
          pending: "warning",
          verified: "success",
          rejected: "error",
        }[status] || "grey"
      );
    },

    getExtensionImage(image) {
      if (!image) return "/favicon.png";
      if (image.startsWith("http")) return image;
      return image;
    },

    showSuccess(text) {
      this.snackbar = {
        show: true,
        text,
        color: "success",
        timeout: 3000,
      };
    },

    showError(text) {
      this.snackbar = {
        show: true,
        text,
        color: "error",
        timeout: 5000,
      };
    },

    debouncedSearch: debounce(function () {
      this.loadExtensions();
    }, 300)
  },
  mounted() {
    this.loadExtensions();
    this.loadExtensionStats();
  }
}
</script>

<style lang="scss" scoped>
.extensions-admin {
  .stat-card {
    position: relative;
    overflow: hidden;
    transition: transform 0.2s;

    &:hover {
      transform: translateY(-2px);
    }

    .stat-icon {
      position: absolute;
      right: 16px;
      bottom: 16px;
      opacity: 0.2;
      font-size: 48px;
    }

    &.stat-total {
      background: linear-gradient(135deg, #1976d2, #64b5f6);
      color: white;
    }

    &.stat-developing {
      background: linear-gradient(135deg, #7b1fa2, #ba68c8);
      color: white;
    }

    &.stat-pending {
      background: linear-gradient(135deg, #f57c00, #ffb74d);
      color: white;
    }

    &.stat-verified {
      background: linear-gradient(135deg, #43a047, #81c784);
      color: white;
    }

    &.stat-rejected {
      background: linear-gradient(135deg, #d32f2f, #e57373);
      color: white;
    }
  }

  .status-chip {
    cursor: pointer;
    transition: transform 0.2s;

    &:hover {
      transform: scale(1.05);
    }
  }

  .action-btn {
    margin: 0 2px;
    opacity: 0.7;
    transition: opacity 0.2s, transform 0.2s;

    &:hover {
      opacity: 1;
      transform: scale(1.1);
    }
  }

  .v-data-table {
    .v-data-table__wrapper {
      transition: opacity 0.3s;
    }

    &.v-data-table--loading {
      .v-data-table__wrapper {
        opacity: 0.5;
      }
    }
  }

  .rotate {
    animation: rotate 1s linear infinite;
  }

  @keyframes rotate {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .v-dialog {
    .v-card {
      .v-card-title {
        position: relative;

        .v-btn {
          position: absolute;
          right: 8px;
          top: 8px;
        }
      }
    }
  }
}
</style>
