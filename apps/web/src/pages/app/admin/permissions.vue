<template>
  <v-container fluid>
    <v-card class="mb-4" elevation="2">
      <v-card-item>
        <template v-slot:prepend>
          <v-icon class="me-4" color="primary" icon="mdi-shield-account" size="large"></v-icon>
        </template>
        <v-card-title class="text-h5">用户权限管理</v-card-title>
        <v-card-subtitle class="mt-2">
          通过角色控制用户账号权限；网页登录会话会实时使用这些权限。
        </v-card-subtitle>
        <template v-slot:append>
          <v-btn
            :loading="loadingRoles || loadingUsers"
            color="primary"
            prepend-icon="mdi-refresh"
            variant="tonal"
            @click="refreshAll"
          >
            刷新
          </v-btn>
        </template>
      </v-card-item>
    </v-card>

    <v-row>
      <v-col cols="12" lg="5">
        <v-card>
          <v-card-title class="d-flex align-center">
            用户
            <v-spacer></v-spacer>
            <v-text-field
              v-model="searchQuery"
              clearable
              density="compact"
              hide-details
              label="搜索用户"
              prepend-inner-icon="mdi-magnify"
              style="max-width: 260px"
              variant="outlined"
              @input="debouncedLoadUsers"
            ></v-text-field>
          </v-card-title>
          <v-data-table-server
            v-model:items-per-page="options.itemsPerPage"
            v-model:page="options.page"
            :headers="userHeaders"
            :items="users"
            :items-length="total"
            :loading="loadingUsers"
            item-value="id"
            density="comfortable"
            @update:options="loadUsers"
          >
            <template v-slot:item.username="{ item }">
              <div class="d-flex align-center">
                <v-avatar class="mr-2" size="32">
                  <v-img :alt="item.username" :src="getAvatarUrl(item.avatar)"></v-img>
                </v-avatar>
                <div>
                  <div class="font-weight-medium">{{ item.username }}</div>
                  <div class="text-caption text-medium-emphasis">{{ item.display_name }}</div>
                </div>
              </div>
            </template>

            <template v-slot:item.status="{ item }">
              <v-chip :color="statusColor(item.status)" size="small" label>
                {{ item.status || "unknown" }}
              </v-chip>
            </template>

            <template v-slot:item.actions="{ item }">
              <v-btn
                :color="selectedUser?.id === item.id ? 'primary' : undefined"
                size="small"
                variant="tonal"
                @click="selectUser(item)"
              >
                管理
              </v-btn>
            </template>
          </v-data-table-server>
        </v-card>
      </v-col>

      <v-col cols="12" lg="7">
        <v-card v-if="!selectedUser" class="empty-panel" variant="outlined">
          <v-card-text class="text-center py-10">
            <v-icon color="grey" icon="mdi-account-arrow-left-outline" size="56"></v-icon>
            <div class="text-subtitle-1 mt-3">选择一个用户后管理权限</div>
          </v-card-text>
        </v-card>

        <template v-else>
          <v-card class="mb-4">
            <v-card-title class="d-flex align-center">
              <v-avatar class="mr-3" size="40">
                <v-img :alt="selectedUser.username" :src="getAvatarUrl(selectedUser.avatar)"></v-img>
              </v-avatar>
              <div>
                <div>{{ selectedUser.display_name || selectedUser.username }}</div>
                <div class="text-caption text-medium-emphasis">
                  @{{ selectedUser.username }} · ID {{ selectedUser.id }}
                </div>
              </div>
              <v-spacer></v-spacer>
              <v-btn
                :disabled="!dirty || saving"
                :loading="saving"
                color="primary"
                prepend-icon="mdi-content-save"
                @click="savePermissions"
              >
                保存权限
              </v-btn>
            </v-card-title>
            <v-card-text>
              <v-alert
                v-if="dirty"
                class="mb-3"
                density="compact"
                type="warning"
                variant="tonal"
              >
                权限有未保存修改。
              </v-alert>
              <div class="d-flex flex-wrap ga-2">
                <v-chip size="small" label>状态：{{ selectedUser.status }}</v-chip>
                <v-chip size="small" label>类型：{{ selectedUser.type || "user" }}</v-chip>
                <v-chip size="small" color="primary" label>
                  已选角色 {{ selectedRoleKeys.length }}
                </v-chip>
                <v-chip size="small" color="secondary" label>
                  有效权限 {{ policy.allow?.length || 0 }}
                </v-chip>
              </div>
            </v-card-text>
          </v-card>

          <v-row>
            <v-col cols="12" md="6">
              <v-card class="h-100">
                <v-card-title class="d-flex align-center">
                  角色
                  <v-spacer></v-spacer>
                  <v-btn size="small" variant="text" @click="selectBaseRoles">
                    基础角色
                  </v-btn>
                  <v-btn size="small" variant="text" @click="clearRoles">
                    清空
                  </v-btn>
                </v-card-title>
                <v-progress-linear v-if="loadingPermissions" indeterminate></v-progress-linear>
                <v-list density="compact">
                  <v-list-item v-for="role in roles" :key="role.key">
                    <template v-slot:prepend>
                      <v-checkbox
                        v-model="selectedRoleKeys"
                        :value="role.key"
                        color="primary"
                        density="compact"
                        hide-details
                      ></v-checkbox>
                    </template>
                    <v-list-item-title>
                      {{ role.name }}
                      <v-chip v-if="role.key === 'admin'" class="ml-2" color="error" size="x-small" label>
                        admin
                      </v-chip>
                    </v-list-item-title>
                    <v-list-item-subtitle>
                      {{ role.description || role.key }}
                    </v-list-item-subtitle>
                    <template v-slot:append>
                      <v-chip size="x-small" variant="tonal">
                        {{ role.permissions.length }}
                      </v-chip>
                    </template>
                  </v-list-item>
                </v-list>
              </v-card>
            </v-col>

            <v-col cols="12" md="6">
              <v-card class="h-100">
                <v-card-title>当前有效策略</v-card-title>
                <v-card-text>
                  <div class="text-caption text-medium-emphasis mb-2">角色</div>
                  <div class="mb-4">
                    <v-chip
                      v-for="roleKey in policy.roles"
                      :key="roleKey"
                      class="mr-1 mb-1"
                      size="small"
                      variant="tonal"
                    >
                      {{ roleLabel(roleKey) }}
                    </v-chip>
                    <span v-if="!policy.roles?.length" class="text-caption text-medium-emphasis">无</span>
                  </div>

                  <div class="text-caption text-medium-emphasis mb-2">允许权限</div>
                  <div class="permission-chip-list">
                    <v-chip
                      v-for="scope in policy.allow"
                      :key="scope"
                      class="mr-1 mb-1"
                      color="primary"
                      size="x-small"
                      variant="tonal"
                    >
                      {{ scope }}
                    </v-chip>
                    <span v-if="!policy.allow?.length" class="text-caption text-medium-emphasis">无</span>
                  </div>

                  <template v-if="policy.deny?.length">
                    <div class="text-caption text-medium-emphasis mt-4 mb-2">拒绝权限</div>
                    <v-chip
                      v-for="scope in policy.deny"
                      :key="scope"
                      class="mr-1 mb-1"
                      color="error"
                      size="x-small"
                      variant="tonal"
                    >
                      {{ scope }}
                    </v-chip>
                  </template>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <v-card class="mt-4">
            <v-card-title>角色权限明细</v-card-title>
            <v-expansion-panels variant="accordion">
              <v-expansion-panel v-for="role in selectedRoles" :key="role.key">
                <v-expansion-panel-title>
                  {{ role.name }}
                  <span class="text-caption text-medium-emphasis ml-2">{{ role.key }}</span>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-chip
                    v-for="permission in role.permissions"
                    :key="`${role.key}:${permission.effect}:${permission.scope}`"
                    :color="permission.effect === 'deny' ? 'error' : 'primary'"
                    class="mr-1 mb-1"
                    size="small"
                    variant="tonal"
                  >
                    {{ permission.effect }} · {{ permission.scope }}
                  </v-chip>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-card>
        </template>
      </v-col>
    </v-row>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="snackbar.timeout">
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>

<script>
import axios from "@/axios/axios";
import { debounce } from "lodash-es";

export default {
  name: "AdminPermissionsPage",
  data() {
    return {
      roles: [],
      users: [],
      total: 0,
      selectedUser: null,
      selectedRoleKeys: [],
      savedRoleKeys: [],
      policy: { roles: [], allow: [], deny: [] },
      searchQuery: "",
      loadingRoles: false,
      loadingUsers: false,
      loadingPermissions: false,
      saving: false,
      options: {
        page: 1,
        itemsPerPage: 10,
        sortBy: ["id"],
        sortDesc: [false],
      },
      userHeaders: [
        { title: "ID", value: "id", width: "80px", sortable: false },
        { title: "用户", value: "username", sortable: false },
        { title: "状态", value: "status", width: "110px", sortable: false },
        { title: "操作", value: "actions", width: "100px", sortable: false, align: "center" },
      ],
      snackbar: {
        show: false,
        text: "",
        color: "success",
        timeout: 3000,
      },
    };
  },
  computed: {
    selectedRoles() {
      const selected = new Set(this.selectedRoleKeys);
      return this.roles.filter((role) => selected.has(role.key));
    },
    dirty() {
      return this.normalizeRoleKeys(this.selectedRoleKeys).join("|") !==
        this.normalizeRoleKeys(this.savedRoleKeys).join("|");
    },
  },
  methods: {
    normalizeRoleKeys(keys) {
      return [...new Set((keys || []).map((key) => String(key)).filter(Boolean))].sort();
    },
    async refreshAll() {
      await Promise.all([this.loadRoles(), this.loadUsers()]);
      if (this.selectedUser) {
        await this.loadUserPermissions(this.selectedUser.id);
      }
    },
    async loadRoles() {
      this.loadingRoles = true;
      try {
        const { data } = await axios.get("/admin/users/permissions/roles");
        this.roles = data.data?.roles || [];
      } catch (error) {
        this.showError("加载角色清单失败");
        console.error("Error loading roles:", error);
      } finally {
        this.loadingRoles = false;
      }
    },
    async loadUsers() {
      this.loadingUsers = true;
      try {
        const params = {
          page: this.options.page,
          itemsPerPage: this.options.itemsPerPage,
          search: this.searchQuery || undefined,
        };
        const { data } = await axios.get("/admin/users", { params });
        this.users = data.items || [];
        this.total = Number(data.total || 0);
      } catch (error) {
        this.showError("加载用户列表失败");
        console.error("Error loading users:", error);
      } finally {
        this.loadingUsers = false;
      }
    },
    async selectUser(user) {
      this.selectedUser = user;
      await this.loadUserPermissions(user.id);
    },
    async loadUserPermissions(userId) {
      this.loadingPermissions = true;
      try {
        const { data } = await axios.get(`/admin/users/${userId}/permissions`);
        const payload = data.data || {};
        this.selectedUser = payload.user || this.selectedUser;
        const roleKeys = (payload.assignments || [])
          .filter((assignment) => assignment.active)
          .map((assignment) => assignment.role_key);
        this.selectedRoleKeys = this.normalizeRoleKeys(roleKeys);
        this.savedRoleKeys = this.normalizeRoleKeys(roleKeys);
        this.policy = payload.policy || { roles: [], allow: [], deny: [] };
      } catch (error) {
        this.showError("加载用户权限失败");
        console.error("Error loading user permissions:", error);
      } finally {
        this.loadingPermissions = false;
      }
    },
    async savePermissions() {
      if (!this.selectedUser) return;
      this.saving = true;
      try {
        const roleKeys = this.normalizeRoleKeys(this.selectedRoleKeys);
        const { data } = await axios.put(`/admin/users/${this.selectedUser.id}/permissions`, {
          role_keys: roleKeys,
        });
        const payload = data.data || {};
        this.policy = payload.policy || this.policy;
        this.savedRoleKeys = this.normalizeRoleKeys(
          (payload.assignments || [])
            .filter((assignment) => assignment.active)
            .map((assignment) => assignment.role_key)
        );
        this.selectedRoleKeys = [...this.savedRoleKeys];
        this.showSuccess(data.message || "用户权限已更新");
      } catch (error) {
        this.showError(error.response?.data?.message || "保存用户权限失败");
        console.error("Error saving user permissions:", error);
      } finally {
        this.saving = false;
      }
    },
    selectBaseRoles() {
      this.selectedRoleKeys = this.roles
        .filter((role) => role.key !== "admin")
        .map((role) => role.key);
    },
    clearRoles() {
      this.selectedRoleKeys = [];
    },
    roleLabel(roleKey) {
      return this.roles.find((role) => role.key === roleKey)?.name || roleKey;
    },
    statusColor(status) {
      return {
        active: "success",
        suspended: "warning",
        banned: "error",
        pending: "info",
      }[status] || "grey";
    },
    getAvatarUrl(avatar) {
      if (!avatar) return "/default-avatar.png";
      if (avatar.startsWith("http")) return avatar;
      return `/api/avatar/${avatar}`;
    },
    showSuccess(text) {
      this.snackbar = { show: true, text, color: "success", timeout: 3000 };
    },
    showError(text) {
      this.snackbar = { show: true, text, color: "error", timeout: 5000 };
    },
    debouncedLoadUsers: debounce(function () {
      this.options.page = 1;
      this.loadUsers();
    }, 300),
  },
  mounted() {
    this.refreshAll();
  },
};
</script>

<style scoped>
.empty-panel {
  min-height: 280px;
}

.permission-chip-list {
  max-height: 220px;
  overflow: auto;
}
</style>
