<template>
  <v-container fluid>
    <!-- 统计卡片 -->
    <v-row>
      <v-col cols="12" md="3" sm="6">
        <v-card>
          <v-card-text class="text-center">
            <div class="text-h4 mb-2">{{ stats.totalProjects || 0 }}</div>
            <div class="text-body-2">总项目数</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3" sm="6">
        <v-card>
          <v-card-text class="text-center">
            <div class="text-h4 mb-2">
              {{ getStateCount("public") }}
            </div>
            <div class="text-body-2">公开项目</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3" sm="6">
        <v-card>
          <v-card-text class="text-center">
            <div class="text-h4 mb-2">
              {{ getStateCount("private") }}
            </div>
            <div class="text-body-2">私有项目</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3" sm="6">
        <v-card>
          <v-card-text class="text-center">
            <div class="text-h4 mb-2">
              {{ getTypeCount("scratch") }}
            </div>
            <div class="text-body-2">Scratch项目</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 过滤器和搜索 -->
    <v-row class="mt-4">
      <v-col cols="12" md="3" sm="4">
        <v-text-field
          v-model="searchQuery"
          clearable
          label="搜索项目"
          prepend-icon="mdi-magnify"
          @update:model-value="debouncedSearch"
        ></v-text-field>
      </v-col>
      <v-col cols="12" md="3" sm="4">
        <v-select
          v-model="filters.state"
          :items="stateOptions"
          clearable
          label="项目状态"
          @update:model-value="loadItems"
        ></v-select>
      </v-col>
      <v-col cols="12" md="3" sm="4">
        <v-select
          v-model="filters.type"
          :items="typeOptions"
          clearable
          label="项目类型"
          @update:model-value="loadItems"
        ></v-select>
      </v-col>
      <v-col cols="12" md="3" sm="4">
        <v-text-field
          v-model="filters.authorid"
          clearable
          label="作者ID"
          type="number"
          @update:model-value="loadItems"
        ></v-text-field>
      </v-col>
    </v-row>

    <!-- 数据表格 -->
    <v-data-table-server
      v-model:items-per-page="itemsPerPage"
      :headers="headers"
      :items="items"
      :items-length="totalItems"
      :loading="loading"
      :search="searchQuery"
      class="elevation-1 mt-4"
      @update:options="loadItems"
    >
      <!-- 表格工具栏 -->
      <template v-slot:top>
        <v-toolbar flat>
          <v-toolbar-title>项目管理</v-toolbar-title>
          <v-divider class="mx-4" inset vertical></v-divider>
          <v-spacer></v-spacer>
          <v-btn
            color="primary"
            prepend-icon="mdi-refresh"
            @click="refreshData"
          >
            刷新
          </v-btn>
        </v-toolbar>
      </template>

      <!-- 自定义列 -->
      <template v-slot:item.state="{ item }">
        <v-chip
          :color="getStateColor(item.state)"
          :text="getStateText(item.state)"
          size="small"
        ></v-chip>
      </template>

      <template v-slot:item.type="{ item }">
        <v-chip
          :color="getTypeColor(item.type)"
          :text="getTypeText(item.type)"
          size="small"
        ></v-chip>
      </template>

      <template v-slot:item.actions="{ item }">
        <v-btn
          class="mr-2"
          icon="mdi-eye"
          size="small"
          variant="text"
          @click="viewProject(item)"
        ></v-btn>
        <v-btn
          class="mr-2"
          icon="mdi-pencil"
          size="small"
          variant="text"
          @click="editProject(item)"
        ></v-btn>
        <v-btn
          color="error"
          icon="mdi-delete"
          size="small"
          variant="text"
          @click="confirmDelete(item)"
        ></v-btn>
      </template>
    </v-data-table-server>

    <!-- 查看项目对话框 -->
    <v-dialog v-model="viewDialog" max-width="800px">
      <v-card>
        <v-card-title>
          <span class="text-h5">项目详情</span>
        </v-card-title>
        <v-card-text>
          <pre class="project-json">{{
            JSON.stringify(selectedItem, null, 2)
          }}</pre>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" variant="text" @click="viewDialog = false">
            关闭
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 编辑项目对话框 -->
    <v-dialog v-model="editDialog" max-width="800px">
      <v-card>
        <v-card-title>
          <span class="text-h5">编辑项目 #{{ editedItem.id }}</span>
        </v-card-title>
        <v-card-text>
          <v-container>
            <v-row>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="editedItem.name"
                  hint="项目的唯一标识符"
                  label="项目名称"
                  persistent-hint
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="editedItem.title"
                  label="标题"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="editedItem.authorid"
                  hint="新作者的用户ID"
                  label="作者ID"
                  persistent-hint
                  type="number"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-select
                  v-model="editedItem.state"
                  :items="stateOptions"
                  label="状态"
                ></v-select>
              </v-col>
              <v-col cols="12" sm="6">
                <v-select
                  v-model="editedItem.type"
                  :items="typeOptions"
                  label="项目类型"
                ></v-select>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="editedItem.license"
                  hint="例如：MIT, GPL, Apache-2.0"
                  label="许可证"
                  persistent-hint
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-textarea
                  v-model="editedItem.description"
                  label="描述"
                  rows="3"
                ></v-textarea>
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="editedItem.tags"
                  label="标签 (用逗号分隔)"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="editedItem.default_branch"
                  hint="例如：main, master"
                  label="默认分支"
                  persistent-hint
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="editedItem.time"
                  hint="项目创建时间"
                  label="创建时间"
                  persistent-hint
                  type="datetime-local"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="editedItem.view_count"
                  label="浏览数"
                  type="number"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="editedItem.like_count"
                  label="点赞数"
                  type="number"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="editedItem.star_count"
                  label="星标数"
                  type="number"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-switch
                  v-model="editedItem.history"
                  color="primary"
                  hide-details
                  label="启用历史记录"
                ></v-switch>
              </v-col>
              <v-col cols="12" sm="6">
                <v-switch
                  v-model="editedItem.devenv"
                  color="primary"
                  hide-details
                  label="启用开发环境"
                ></v-switch>
              </v-col>
            </v-row>
          </v-container>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" variant="text" @click="editDialog = false">
            取消
          </v-btn>
          <v-btn color="error" variant="text" @click="saveProject">
            保存
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 删除确认对话框 -->
    <v-dialog v-model="deleteDialog" max-width="500px">
      <v-card>
        <v-card-title class="text-h5">确认删除</v-card-title>
        <v-card-text> 确定要删除这个项目吗？此操作不可撤销。</v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" variant="text" @click="deleteDialog = false">
            取消
          </v-btn>
          <v-btn color="error" variant="text" @click="deleteProject">
            确认
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 提示消息 -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color">
      {{ snackbar.text }}
      <template v-slot:actions>
        <v-btn variant="text" @click="snackbar.show = false">关闭</v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script>
import axios from '@/axios/axios'
import {debounce} from 'lodash-es'

export default {
  name: 'ProjectPage',
  data() {
    return {
      // 表格配置
      headers: [
        {title: "ID", key: "id", sortable: true},
        {title: "项目名", key: "name", sortable: true},
        {title: "标题", key: "title", sortable: true},
        {title: "状态", key: "state", sortable: true},
        {title: "类型", key: "type", sortable: true},
        {title: "浏览数", key: "view_count", sortable: true},
        {title: "星标数", key: "star_count", sortable: true},
        {title: "作者", key: "author.username", sortable: false},
        {title: "操作", key: "actions", sortable: false},
      ],
      // 状态选项
      stateOptions: [
        {title: "公开", value: "public"},
        {title: "私有", value: "private"},
        {title: "草稿", value: "draft"},
        {title: "已删除", value: "deleted"},
      ],
      // 类型选项
      typeOptions: [
        {title: "文本", value: "text"},
        {title: "Scratch", value: "scratch"},
        {title: "Python", value: "python"},
      ],
      // 数据状态
      items: [],
      loading: false,
      totalItems: 0,
      itemsPerPage: 10,
      searchQuery: '',
      filters: {
        state: null,
        type: null,
        authorid: null,
      },
      stats: {
        totalProjects: 0,
        projectsByState: [],
        projectsByType: [],
        mostViewed: [],
        mostStarred: [],
      },
      // 对话框状态
      viewDialog: false,
      editDialog: false,
      deleteDialog: false,
      selectedItem: null,
      editedItem: {},
      // 提示消息
      snackbar: {
        show: false,
        text: '',
        color: 'success',
      }
    }
  },
  methods: {
    getStateCount(state) {
      const stateStats = this.stats.projectsByState?.find(
        (s) => s.state === state
      );
      return stateStats?._count || 0;
    },

    getTypeCount(type) {
      const typeStats = this.stats.projectsByType?.find((t) => t.type === type);
      return typeStats?._count || 0;
    },

    getStateColor(state) {
      const colors = {
        public: "success",
        private: "warning",
        draft: "info",
        deleted: "error",
      };
      return colors[state] || "default";
    },

    getStateText(state) {
      const texts = {
        public: "公开",
        private: "私有",
        draft: "草稿",
        deleted: "已删除",
      };
      return texts[state] || state;
    },

    getTypeColor(type) {
      const colors = {
        text: "primary",
        scratch: "success",
        python: "info",
      };
      return colors[type] || "default";
    },

    getTypeText(type) {
      const texts = {
        text: "文本",
        scratch: "Scratch",
        python: "Python",
      };
      return texts[type] || type;
    },

    async loadItems(options) {
      try {
        this.loading = true;
        const {
          page = 1,
          itemsPerPage: limit = 10,
          sortBy = [],
          sortDesc = [],
        } = options || {};

        // 处理排序
        let sortField = "id";
        let sortOrder = "asc";

        // 检查是否有排序字段
        if (sortBy.length > 0) {
          // 从排序对象中获取字段名
          sortField = sortBy[0].key || "id";
          sortOrder = sortBy[0].order;
        }

        const params = {
          page,
          limit,
          sortBy: sortField,
          sortOrder,
          search: this.searchQuery,
          ...this.filters,
        };

        console.log("Sorting details:", {
          sortBy,
          sortDesc,
          sortField,
          sortOrder,
          sortIndex: sortBy.findIndex((item) => item.key === sortField),
        }); // 详细的调试信息
        console.log("Request params:", params);

        const response = await axios.get("/admin/projects", {params});
        this.items = response.data.data;
        this.totalItems = response.data.pagination.total;
      } catch (error) {
        console.error("Error loading items:", error);
        this.showError("加载项目列表失败");
      } finally {
        this.loading = false;
      }
    },

    async loadStats() {
      try {
        const response = await axios.get("/admin/projects/stats/overview");
        this.stats = response.data;
      } catch (error) {
        this.showError("加载统计数据失败");
      }
    },

    async viewProject(item) {
      try {
        const response = await axios.get(`/admin/projects/${item.id}`);
        this.selectedItem = response.data;
        this.viewDialog = true;
      } catch (error) {
        this.showError("加载项目详情失败");
      }
    },

    editProject(item) {
      // 转换时间为本地datetime-local格式
      const localTime = item.time
        ? new Date(item.time).toISOString().slice(0, 16)
        : null;
      this.editedItem = {
        ...item,
        time: localTime,
      };
      this.editDialog = true;
    },

    async saveProject() {
      try {
        // 数据类型转换
        const updateData = {
          ...this.editedItem,
          authorid: parseInt(this.editedItem.authorid),
          view_count: parseInt(this.editedItem.view_count),
          like_count: parseInt(this.editedItem.like_count),
          star_count: parseInt(this.editedItem.star_count),
          history: Boolean(this.editedItem.history),
          devenv: Boolean(this.editedItem.devenv),
        };

        // 时间格式转换：确保使用UTC时间
        if (this.editedItem.time) {
          const localDate = new Date(this.editedItem.time);
          updateData.time = localDate.toISOString();
        }

        await axios.put(`/admin/projects/${this.editedItem.id}`, updateData);
        this.editDialog = false;
        this.showSuccess("项目更新成功");
        this.loadItems();
        this.loadStats();
      } catch (error) {
        if (error.response?.data?.error) {
          this.showError(error.response.data.error);
        } else {
          this.showError("更新项目失败");
        }
      }
    },

    confirmDelete(item) {
      this.selectedItem = item;
      this.deleteDialog = true;
    },

    async deleteProject() {
      try {
        await axios.delete(`/admin/projects/${this.selectedItem.id}`);
        this.deleteDialog = false;
        this.showSuccess("项目删除成功");
        this.loadItems();
        this.loadStats();
      } catch (error) {
        this.showError("删除项目失败");
      }
    },

    refreshData() {
      this.loadItems();
      this.loadStats();
    },

    debouncedSearch: debounce(function () {
      this.loadItems();
    }, 300),

    showSuccess(text) {
      this.snackbar = {
        show: true,
        text,
        color: 'success',
      };
    },

    showError(text) {
      this.snackbar = {
        show: true,
        text,
        color: 'error',
      };
    },

    formatDateTime(dateString) {
      if (!dateString) return "未设置";
      try {
        return new Date(dateString).toLocaleString();
      } catch (error) {
        return "无效日期";
      }
    }
  },
  mounted() {
    this.loadItems();
    this.loadStats();
  }
}
</script>

<style scoped>
.project-json {
  padding: 1rem;
  border-radius: 4px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: monospace;
  font-size: 0.9rem;
  line-height: 1.5;
  max-height: 70vh;
  overflow-y: auto;
}

.v-data-table {
  border-radius: 8px;
}

.text-gradient {
  background: linear-gradient(
    45deg,
    var(--v-primary-base),
    var(--v-secondary-base)
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
</style>
