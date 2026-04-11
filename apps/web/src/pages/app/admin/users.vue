<template>
  <v-container>
    <div class="users-admin">
      <!-- 统计信息卡片 -->
      <v-row class="mb-4">
        <v-col
          v-for="stat in userStats"
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
            <v-col cols="12" sm="4">
              <v-text-field
                v-model="searchQuery"
                clearable
                hide-details
                label="搜索用户"
                prepend-icon="mdi-magnify"
                @input="debouncedSearch"
              ></v-text-field>
            </v-col>
            <v-col cols="12" sm="3">
              <v-select
                v-model="statusFilter"
                :items="statusOptions"
                clearable
                hide-details
                label="状态过滤"
                prepend-icon="mdi-filter"
                @change="loadUsers"
              ></v-select>
            </v-col>
            <v-col cols="12" sm="3">
              <v-select
                v-model="typeFilter"
                :items="typeOptions"
                clearable
                hide-details
                label="类型过滤"
                prepend-icon="mdi-account-filter"
                @change="loadUsers"
              ></v-select>
            </v-col>
            <v-col class="d-flex justify-end" cols="12" sm="2">
              <v-btn
                :disabled="loading"
                :loading="refreshing"
                color="primary"
                @click="refreshData"
              >
                <v-icon :class="{ rotate: refreshing }" left
                >mdi-refresh
                </v-icon
                >
                刷新
              </v-btn>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- 用户列表表格 -->
      <v-card>
        <v-data-table-server
          v-model:items-per-page="options.itemsPerPage"
          v-model:page="options.page"
          :headers="headers"
          :items="users"
          :items-length="total"
          :loading="loading"
          :loading-text="'加载中...'"
          :no-data-text="'暂无数据'"
          :no-results-text="'未找到匹配的数据'"
          @update:options="loadUsers"
        >
          <!-- 用户头像和名称列 -->
          <template v-slot:item.username="{ item }">
            <div class="d-flex align-center">
              <v-avatar class="mr-2" size="32">
                <v-img
                  :alt="item.username"
                  :src="getAvatarUrl(item.avatar)"
                ></v-img>
              </v-avatar>
              <div>
                <div class="font-weight-medium">{{ item.username }}</div>
                <div class="caption grey--text">{{ item.display_name }}</div>
              </div>
            </div>
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

          <!-- 类型列自定义渲染 -->
          <template v-slot:item.type="{ item }">
            {{ getTypeText(item.type) }}
          </template>

          <!-- 注册时间列格式化 -->
          <template v-slot:item.regTime="{ item }">
            <div>{{ formatDate(item.regTime) }}</div>
            <div class="caption grey--text">
              {{ formatTimeAgo(item.regTime) }}
            </div>
          </template>

          <!-- 操作按钮列 -->
          <template v-slot:item.actions="{ item }">
            <v-slide-x-transition group>
              <v-btn
                v-tooltip="'编辑用户'"
                class="action-btn"
                icon
                small
                @click.stop="editUser(item)"
              >
                <v-icon>mdi-pencil</v-icon>
              </v-btn>
              <v-btn
                v-if="item.type !== 'administrator'"
                v-tooltip="'删除用户'"
                class="action-btn"
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

      <!-- 用户编辑对话框 -->
      <user-editor v-model="editDialog" :user="selectedUser" @save="saveUser"/>

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
              此操作将永久删除用户
              <strong>{{ selectedUser?.username }}</strong>
              及其所有相关数据，此操作不可撤销。
            </v-alert>
            <v-text-field
              v-model="deleteConfirmation"
              :rules="[
                (v) => !v || v === selectedUser?.username || '用户名不匹配',
              ]"
              class="mt-4"
              dense
              label="请输入用户名以确认删除"
              outlined
            ></v-text-field>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn text @click="deleteDialog = false">取消</v-btn>
            <v-btn
              :disabled="deleteConfirmation !== selectedUser?.username"
              :loading="deleting"
              color="error"
              text
              @click="deleteUser"
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
import {debounce} from "lodash-es";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/zh-cn";
import UserEditor from "@/components/admin/UserEditor.vue";

dayjs.extend(relativeTime);
dayjs.locale("zh-cn");

export default {
  name: 'UsersPage',
  components: {
    UserEditor
  },
  data() {
    return {
      userStats: [
        {title: "总用户数", value: 0, type: "total", icon: "mdi-account-group"},
        {
          title: "活跃用户",
          value: 0,
          type: "active",
          icon: "mdi-account-check",
        }
      ],
      users: [],
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
        {title: "ID", value: "id", width: "80px", sortable: false},
        {title: "用户", value: "username", width: "250px", sortable: false},
        {title: "邮箱", value: "email", sortable: false},
        {title: "状态", value: "status", width: "120px", sortable: false},
        {title: "类型", value: "type", width: "120px", sortable: false},
        {title: "注册时间", value: "regTime", width: "180px", sortable: false},
        {
          title: "操作",
          value: "actions",
          sortable: false,
          width: "150px",
          align: "center",
        },
      ],
      searchQuery: "",
      statusFilter: "",
      typeFilter: "",
      statusOptions: [
        {title: "活跃", value: "active"},
        {title: "已暂停", value: "suspended"},
        {title: "已封禁", value: "banned"},
        {title: "待验证", value: "pending"},
      ],
      typeOptions: [
        {title: "访客", value: "guest"},
        {title: "普通用户", value: "user"},
        {title: "管理员", value: "administrator"},
      ],
      editDialog: false,
      deleteDialog: false,
      deleteConfirmation: "",
      selectedUser: null,
      deleting: false,
      snackbar: {
        show: false,
        text: "",
        color: "success",
        timeout: 3000,
      }
    }
  },
  methods: {
    async loadUsers() {
      this.loading = true;
      try {
        const params = {
          page: this.options.page,
          itemsPerPage: this.options.itemsPerPage,
          sort_by: this.options.sortBy[0] || "id",
          sort_order: this.options.sortDesc[0] ? "desc" : "asc",
        };

        if (this.searchQuery) params.search = this.searchQuery;
        if (this.statusFilter) params.status = this.statusFilter;
        if (this.typeFilter) params.type = this.typeFilter;

        const {data} = await axios.get("/admin/users", {params});

        this.users = data.items.map((user) => ({
          ...user,
          id: user.id,
          username: user.username,
          email: user.email || "",
          status: user.status || "pending",
          type: user.type || "user",
          regTime: user.regTime,
          avatar: user.avatar,
        }));

        this.total = Number(data.total);
      } catch (error) {
        this.showError("加载用户列表失败");
        console.error("Error loading users:", error);
      } finally {
        this.loading = false;
      }
    },

    async loadUserStats() {
      try {
        const {data} = await axios.get("/admin/users/stats/overview");
        this.userStats[0].value = data.totalUsers;
        this.userStats[1].value = data.usersByStatus.find((s) => s.status === "active")?._count || 0;
      } catch (error) {
        console.error("Error loading user stats:", error);
      }
    },

    async refreshData() {
      if (this.refreshing || this.loading) return;

      this.refreshing = true;
      try {
        await Promise.all([this.loadUsers(), this.loadUserStats()]);
        this.showSuccess("数据已更新");
      } catch (error) {
        this.showError("刷新数据失败");
        console.error("Error refreshing data:", error);
      } finally {
        this.refreshing = false;
      }
    },

    editUser(user) {
      this.selectedUser = user;
      this.editDialog = true;
    },

    async saveUser(userData) {
      try {
        const {data} = await axios.put(
          `/admin/users/${userData.id}`,
          userData
        );

        const index = this.users.findIndex((u) => u.id === userData.id);
        if (index !== -1) {
          this.users[index] = {...this.users[index], ...data};
        }

        this.showSuccess("用户信息更新成功");
      } catch (error) {
        this.showError(error.response?.data?.error || "保存用户信息失败");
        console.error("Error saving user:", error);
        throw error;
      }
    },

    confirmDelete(user) {
      this.selectedUser = user;
      this.deleteConfirmation = "";
      this.deleteDialog = true;
    },

    async deleteUser() {
      this.deleting = true;
      try {
        await axios.delete(`/admin/users/${this.selectedUser.id}`);
        this.showSuccess("用户删除成功");
        this.loadUsers();
        this.loadUserStats();
        this.deleteDialog = false;
      } catch (error) {
        this.showError("删除用户失败");
        console.error("Error deleting user:", error);
      } finally {
        this.deleting = false;
      }
    },

    getStatusText(status) {
      const option = this.statusOptions.find((opt) => opt.value === status);
      return option ? option.title : status;
    },

    getTypeText(type) {
      const option = this.typeOptions.find((opt) => opt.value === type);
      return option ? option.title : type;
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
          active: "success",
          suspended: "warning",
          banned: "error",
          pending: "info",
        }[status] || "grey"
      );
    },

    getAvatarUrl(avatar) {
      if (!avatar) return "/default-avatar.png";
      if (avatar.startsWith("http")) return avatar;
      return `/api/avatar/${avatar}`;
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
      this.loadUsers();
    }, 300)
  },
  mounted() {
    this.loadUsers();
    this.loadUserStats();
  }
}
</script>

<style lang="scss" scoped>
.users-admin {
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

    &.stat-active {
      background: linear-gradient(135deg, #43a047, #81c784);
      color: white;
    }

    &.stat-new {
      background: linear-gradient(135deg, #7b1fa2, #ba68c8);
      color: white;
    }

    &.stat-abnormal {
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

  // 新增样式
  .region-field {
    cursor: pointer;

    &:hover {
      background-color: rgba(0, 0, 0, 0.03);
    }
  }

  .contact-list {
    max-height: 300px;
    overflow-y: auto;
  }

  .custom-status {
    display: flex;
    align-items: center;
    gap: 8px;

    .emoji-picker {
      width: 80px;
    }

    .status-text {
      flex: 1;
    }
  }

  .featured-projects {
    border: 1px dashed rgba(0, 0, 0, 0.12);
    border-radius: 4px;
    padding: 8px;
    margin-top: 8px;
  }
}
</style>
