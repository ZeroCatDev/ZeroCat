<template>
  <v-container>
    <div class="oauth-applications-admin">
      <v-row class="mb-4">
        <v-col
          v-for="card in summaryCards"
          :key="card.title"
          cols="12"
          md="3"
          sm="6"
        >
          <v-card :class="['summary-card', `summary-${card.type}`]" elevation="2">
            <v-card-text>
              <div class="text-overline mb-1">{{ card.title }}</div>
              <div class="text-h4">{{ card.value }}</div>
              <v-icon class="summary-icon">{{ card.icon }}</v-icon>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-card class="mb-4">
        <v-card-text>
          <v-row align="center">
            <v-col cols="12" md="4" sm="6">
              <v-text-field
                v-model="filters.search"
                clearable
                hide-details
                label="搜索应用"
                prepend-icon="mdi-magnify"
                @update:model-value="onSearchInput"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="2" sm="6">
              <v-select
                v-model="filters.status"
                :items="statusFilterOptions"
                clearable
                hide-details
                label="状态"
                prepend-icon="mdi-filter"
                @update:model-value="applyFilters"
              ></v-select>
            </v-col>
            <v-col cols="12" md="2" sm="6">
              <v-select
                v-model="filters.isVerified"
                :items="booleanFilterOptions"
                clearable
                hide-details
                label="已验证"
                prepend-icon="mdi-shield-check"
                @update:model-value="applyFilters"
              ></v-select>
            </v-col>
            <v-col cols="12" md="2" sm="6">
              <v-select
                v-model="filters.isPublic"
                :items="booleanFilterOptions"
                clearable
                hide-details
                label="公开状态"
                prepend-icon="mdi-earth"
                @update:model-value="applyFilters"
              ></v-select>
            </v-col>
            <v-col cols="12" md="2" sm="6">
              <v-text-field
                v-model="filters.ownerId"
                clearable
                hide-details
                label="Owner ID"
                min="1"
                prepend-icon="mdi-account"
                type="number"
                @keydown.enter="applyFilters"
                @update:model-value="onOwnerInput"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="3" sm="6">
              <v-select
                v-model="filters.sortBy"
                :items="sortFieldOptions"
                hide-details
                label="排序字段"
                prepend-icon="mdi-sort"
                @update:model-value="applyFilters"
              ></v-select>
            </v-col>
            <v-col cols="12" md="2" sm="6">
              <v-select
                v-model="filters.sortOrder"
                :items="sortOrderOptions"
                hide-details
                label="排序方向"
                prepend-icon="mdi-sort-ascending"
                @update:model-value="applyFilters"
              ></v-select>
            </v-col>
            <v-col class="d-flex justify-end ga-2" cols="12" md="7" sm="12">
              <v-btn :disabled="loading" variant="outlined" @click="resetFilters">
                重置筛选
              </v-btn>
              <v-btn
                :disabled="loading"
                :loading="refreshing"
                color="primary"
                @click="refreshData"
              >
                <v-icon :class="{ rotate: refreshing }" class="mr-1">mdi-refresh</v-icon>
                刷新
              </v-btn>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <v-card>
        <v-data-table-server
          v-model:items-per-page="tableOptions.itemsPerPage"
          v-model:page="tableOptions.page"
          :headers="headers"
          :items="applications"
          :items-length="totalItems"
          :loading="loading"
          :loading-text="'加载中...'"
          :no-data-text="'暂无应用数据'"
          :no-results-text="'未找到匹配应用'"
          @update:options="onTableOptionsUpdate"
        >
          <template v-slot:item.name="{ item }">
            <div>
              <div class="font-weight-medium">{{ item.name || "-" }}</div>
              <div class="text-caption text-medium-emphasis">
                {{ item.description || "暂无描述" }}
              </div>
            </div>
          </template>

          <template v-slot:item.status="{ item }">
            <v-chip :color="getStatusColor(item.status)" size="small" variant="tonal">
              {{ item.status || "-" }}
            </v-chip>
          </template>

          <template v-slot:item.is_verified="{ item }">
            <v-chip :color="item.is_verified ? 'success' : 'default'" size="small" variant="tonal">
              {{ item.is_verified ? "已验证" : "未验证" }}
            </v-chip>
          </template>

          <template v-slot:item.is_public="{ item }">
            <v-chip :color="item.is_public ? 'info' : 'default'" size="small" variant="tonal">
              {{ item.is_public ? "公开" : "私有" }}
            </v-chip>
          </template>

          <template v-slot:item.owner="{ item }">
            <div>
              <div class="font-weight-medium">{{ getOwnerDisplay(item.owner) }}</div>
              <div class="text-caption text-medium-emphasis">ID: {{ item.owner?.id ?? "-" }}</div>
            </div>
          </template>

          <template v-slot:item.usage="{ item }">
            <div class="text-body-2">
              授权 {{ item._count?.authorizations ?? 0 }} / 令牌 {{ item._count?.access_tokens ?? 0 }}
            </div>
          </template>

          <template v-slot:item.created_at="{ item }">
            <div>{{ formatDate(item.created_at) }}</div>
          </template>

          <template v-slot:item.actions="{ item }">
            <div class="d-flex ga-1">
              <v-btn
                class="action-btn"
                icon="mdi-pencil"
                size="small"
                variant="text"
                @click.stop="openDetail(item)"
              ></v-btn>
              <v-btn
                class="action-btn"
                color="error"
                icon="mdi-delete"
                size="small"
                variant="text"
                @click.stop="openDeleteDialog(item)"
              ></v-btn>
            </div>
          </template>
        </v-data-table-server>
      </v-card>

      <v-dialog v-model="detailDialog" max-width="960">
        <v-card>
          <v-card-title class="d-flex align-center">
            <span class="text-h6">OAuth 应用详情</span>
            <v-spacer></v-spacer>
            <v-chip
              v-if="selectedApplication"
              :color="getStatusColor(selectedApplication.status)"
              class="mr-2"
              size="small"
              variant="tonal"
            >
              {{ selectedApplication.status || "-" }}
            </v-chip>
            <v-chip
              v-if="selectedApplication"
              :color="selectedApplication.is_verified ? 'success' : 'default'"
              class="mr-2"
              size="small"
              variant="tonal"
            >
              {{ selectedApplication.is_verified ? "已验证" : "未验证" }}
            </v-chip>
            <v-chip
              v-if="selectedApplication"
              :color="selectedApplication.is_public ? 'info' : 'default'"
              size="small"
              variant="tonal"
            >
              {{ selectedApplication.is_public ? "公开" : "私有" }}
            </v-chip>
          </v-card-title>

          <v-divider></v-divider>

          <v-card-text v-if="detailLoading" class="py-8 text-center">
            <v-progress-circular indeterminate></v-progress-circular>
          </v-card-text>

          <v-card-text v-else-if="selectedApplication">
            <v-row>
              <v-col cols="12" md="8">
                <v-form ref="editFormRef" @submit.prevent="saveApplication">
                  <v-text-field
                    v-model="editForm.name"
                    :rules="[requiredRule]"
                    class="mb-2"
                    label="应用名称"
                    required
                  ></v-text-field>

                  <v-textarea
                    v-model="editForm.redirectUrisText"
                    :rules="[requiredRule]"
                    class="mb-2"
                    hint="每行一个回调地址"
                    label="Redirect URIs"
                    persistent-hint
                    rows="4"
                  ></v-textarea>

                  <v-text-field
                    v-model="editForm.clientType"
                    :rules="[requiredRule]"
                    class="mb-2"
                    label="Client Type"
                    required
                  ></v-text-field>

                  <v-textarea
                    v-model="editForm.scopesText"
                    class="mb-2"
                    hint="每行一个 scope，可留空"
                    label="Scopes"
                    persistent-hint
                    rows="3"
                  ></v-textarea>

                  <v-text-field
                    v-model="editForm.webhookUrl"
                    class="mb-2"
                    clearable
                    label="Webhook URL"
                  ></v-text-field>

                  <v-text-field
                    v-model="editForm.logoUrl"
                    class="mb-2"
                    clearable
                    label="Logo URL"
                  ></v-text-field>

                  <v-text-field
                    v-model="editForm.termsUrl"
                    class="mb-2"
                    clearable
                    label="Terms URL"
                  ></v-text-field>

                  <v-select
                    v-model="editForm.status"
                    :items="statusUpdateOptions"
                    class="mb-2"
                    label="状态"
                  ></v-select>

                  <v-switch
                    v-model="editForm.isPublic"
                    color="primary"
                    label="公开应用"
                  ></v-switch>
                </v-form>
              </v-col>

              <v-col cols="12" md="4">
                <v-card class="mb-3" variant="tonal">
                  <v-card-title class="text-subtitle-1">基础信息</v-card-title>
                  <v-card-text class="text-body-2">
                    <div class="mb-2"><strong>ID:</strong> {{ selectedApplication.id }}</div>
                    <div class="mb-2"><strong>Client ID:</strong> {{ selectedApplication.client_id || "-" }}</div>
                    <div class="mb-2">
                      <strong>创建时间:</strong> {{ formatDate(selectedApplication.created_at) }}
                    </div>
                    <div>
                      <strong>更新时间:</strong> {{ formatDate(selectedApplication.updated_at) }}
                    </div>
                  </v-card-text>
                </v-card>

                <v-card class="mb-3" variant="tonal">
                  <v-card-title class="text-subtitle-1">所有者</v-card-title>
                  <v-card-text class="text-body-2">
                    <div class="mb-2"><strong>显示:</strong> {{ getOwnerDisplay(selectedApplication.owner) }}</div>
                    <div class="mb-2"><strong>ID:</strong> {{ selectedApplication.owner?.id ?? "-" }}</div>
                    <div><strong>Email:</strong> {{ selectedApplication.owner?.email || "-" }}</div>
                  </v-card-text>
                </v-card>

                <v-card class="mb-3" variant="tonal">
                  <v-card-title class="text-subtitle-1">授权数据</v-card-title>
                  <v-card-text class="text-body-2">
                    <div class="mb-2">
                      <strong>Authorizations:</strong> {{ selectedApplication._count?.authorizations ?? 0 }}
                    </div>
                    <div>
                      <strong>Access Tokens:</strong> {{ selectedApplication._count?.access_tokens ?? 0 }}
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>

          <v-divider></v-divider>

          <v-card-actions class="pa-4">
            <v-btn
              :disabled="!selectedApplication || detailLoading"
              :loading="verifying"
              color="primary"
              variant="tonal"
              @click="setVerified(!selectedApplication?.is_verified)"
            >
              {{ selectedApplication?.is_verified ? "取消验证" : "设为已验证" }}
            </v-btn>
            <v-btn
              :disabled="!selectedApplication"
              :loading="saving"
              color="primary"
              @click="saveApplication"
            >
              保存更新
            </v-btn>
            <v-btn
              :disabled="!selectedApplication"
              color="error"
              variant="text"
              @click="openDeleteDialog(selectedApplication)"
            >
              下线应用
            </v-btn>
            <v-spacer></v-spacer>
            <v-btn variant="text" @click="detailDialog = false">关闭</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="deleteDialog" max-width="500">
        <v-card>
          <v-card-title class="text-h6">确认下线应用</v-card-title>
          <v-card-text>
            <p class="mb-3">
              下线后会将应用状态设置为 <code>deleted</code>，并撤销相关授权与令牌。
            </p>
            <p class="mb-3">
              应用：<strong>{{ deleteTarget?.name || "-" }}</strong>
            </p>
            <v-text-field
              v-model="deleteConfirmText"
              :hint="`请输入 ${deleteExpectedText} 以确认`"
              :label="`输入 ${deleteExpectedText}`"
              persistent-hint
            ></v-text-field>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn variant="text" @click="deleteDialog = false">取消</v-btn>
            <v-btn
              :disabled="!isDeleteConfirmMatched"
              :loading="deleting"
              color="error"
              @click="deleteApplication"
            >
              确认下线
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-snackbar
        v-model="snackbar.show"
        :color="snackbar.color"
        :timeout="snackbar.timeout"
        top
      >
        {{ snackbar.text }}
        <template v-slot:action="{ attrs }">
          <v-btn text v-bind="attrs" @click="snackbar.show = false">关闭</v-btn>
        </template>
      </v-snackbar>
    </div>
  </v-container>
</template>

<script>
import axios from "@/axios/axios";
import { debounce } from "lodash-es";

export default {
  name: "AdminOAuthApplicationsPage",
  data() {
    return {
      loading: false,
      refreshing: false,
      detailLoading: false,
      saving: false,
      verifying: false,
      deleting: false,
      applications: [],
      totalItems: 0,
      tableOptions: {
        page: 1,
        itemsPerPage: 20,
      },
      headers: [
        { title: "ID", value: "id", width: "80px", sortable: false },
        { title: "应用", value: "name", width: "220px", sortable: false },
        { title: "Client ID", value: "client_id", width: "180px", sortable: false },
        { title: "状态", value: "status", width: "120px", sortable: false },
        { title: "验证", value: "is_verified", width: "110px", sortable: false },
        { title: "公开", value: "is_public", width: "110px", sortable: false },
        { title: "所有者", value: "owner", width: "180px", sortable: false },
        { title: "授权/令牌", value: "usage", width: "140px", sortable: false },
        { title: "创建时间", value: "created_at", width: "180px", sortable: false },
        { title: "操作", value: "actions", width: "100px", sortable: false },
      ],
      filters: {
        search: "",
        status: "",
        ownerId: "",
        isVerified: "",
        isPublic: "",
        sortBy: "updated_at",
        sortOrder: "desc",
      },
      statusFilterOptions: [
        { title: "全部", value: "" },
        { title: "active", value: "active" },
        { title: "inactive", value: "inactive" },
        { title: "pending", value: "pending" },
        { title: "suspended", value: "suspended" },
        { title: "revoked", value: "revoked" },
        { title: "deleted", value: "deleted" },
      ],
      statusUpdateOptions: [
        { title: "active", value: "active" },
        { title: "inactive", value: "inactive" },
        { title: "pending", value: "pending" },
        { title: "suspended", value: "suspended" },
        { title: "revoked", value: "revoked" },
      ],
      booleanFilterOptions: [
        { title: "全部", value: "" },
        { title: "是", value: "true" },
        { title: "否", value: "false" },
      ],
      sortFieldOptions: [
        { title: "id", value: "id" },
        { title: "name", value: "name" },
        { title: "client_id", value: "client_id" },
        { title: "status", value: "status" },
        { title: "type", value: "type" },
        { title: "is_verified", value: "is_verified" },
        { title: "is_public", value: "is_public" },
        { title: "created_at", value: "created_at" },
        { title: "updated_at", value: "updated_at" },
        { title: "owner_id", value: "owner_id" },
      ],
      sortOrderOptions: [
        { title: "降序", value: "desc" },
        { title: "升序", value: "asc" },
      ],
      detailDialog: false,
      selectedApplication: null,
      detailIdentifier: "",
      editForm: {
        name: "",
        redirectUrisText: "",
        clientType: "",
        scopesText: "",
        webhookUrl: "",
        logoUrl: "",
        termsUrl: "",
        status: "active",
        isPublic: false,
      },
      deleteDialog: false,
      deleteTarget: null,
      deleteConfirmText: "",
      snackbar: {
        show: false,
        text: "",
        color: "success",
        timeout: 3200,
      },
      debouncedFilterSearch: null,
    };
  },
  computed: {
    summaryCards() {
      return [
        {
          title: "总应用数",
          value: this.totalItems,
          type: "total",
          icon: "mdi-apps",
        },
        {
          title: "当前页",
          value: this.applications.length,
          type: "page",
          icon: "mdi-table",
        },
        {
          title: "已验证",
          value: this.applications.filter((item) => item.is_verified).length,
          type: "verified",
          icon: "mdi-shield-check",
        },
        {
          title: "公开应用",
          value: this.applications.filter((item) => item.is_public).length,
          type: "public",
          icon: "mdi-earth",
        },
      ];
    },
    deleteExpectedText() {
      if (!this.deleteTarget) return "";
      return this.deleteTarget.client_id || String(this.deleteTarget.id);
    },
    isDeleteConfirmMatched() {
      return this.deleteConfirmText.trim() === this.deleteExpectedText;
    },
  },
  created() {
    this.debouncedFilterSearch = debounce(() => {
      this.tableOptions.page = 1;
      this.loadApplications();
    }, 350);
  },
  mounted() {
    this.loadApplications();
  },
  beforeUnmount() {
    if (this.debouncedFilterSearch?.cancel) {
      this.debouncedFilterSearch.cancel();
    }
  },
  methods: {
    requiredRule(value) {
      return !!String(value || "").trim() || "该字段不能为空";
    },

    onSearchInput() {
      this.debouncedFilterSearch();
    },

    onOwnerInput() {
      this.tableOptions.page = 1;
      this.debouncedFilterSearch();
    },

    applyFilters() {
      this.tableOptions.page = 1;
      this.loadApplications();
    },

    resetFilters() {
      this.filters = {
        search: "",
        status: "",
        ownerId: "",
        isVerified: "",
        isPublic: "",
        sortBy: "updated_at",
        sortOrder: "desc",
      };
      this.tableOptions.page = 1;
      this.tableOptions.itemsPerPage = 20;
      this.loadApplications();
    },

    async refreshData() {
      if (this.refreshing || this.loading) return;
      this.refreshing = true;
      try {
        await this.loadApplications();
        if (this.detailDialog && this.detailIdentifier) {
          await this.loadApplicationDetail(this.detailIdentifier, true);
        }
        this.showSuccess("数据已更新");
      } finally {
        this.refreshing = false;
      }
    },

    onTableOptionsUpdate(options) {
      const nextPage = Number(options?.page || 1);
      const nextLimit = Number(options?.itemsPerPage || 20);
      const pageChanged = nextPage !== this.tableOptions.page;
      const limitChanged = nextLimit !== this.tableOptions.itemsPerPage;

      if (pageChanged || limitChanged) {
        this.tableOptions.page = nextPage;
        this.tableOptions.itemsPerPage = nextLimit;
        this.loadApplications();
      }
    },

    parseBooleanFilter(value) {
      if (value === "" || value === null || value === undefined) return undefined;
      return value === "true";
    },

    parseOwnerId(value) {
      if (value === "" || value === null || value === undefined) return undefined;
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed <= 0) return null;
      return parsed;
    },

    buildListParams() {
      const params = {
        page: this.tableOptions.page,
        limit: this.tableOptions.itemsPerPage,
        sortBy: this.filters.sortBy || "updated_at",
        sortOrder: this.filters.sortOrder || "desc",
      };

      if (this.filters.search?.trim()) {
        params.search = this.filters.search.trim();
      }

      if (this.filters.status) {
        params.status = this.filters.status;
      }

      const ownerId = this.parseOwnerId(this.filters.ownerId);
      if (ownerId === null) {
        this.showError("owner_id 必须是正整数");
        return null;
      }
      if (ownerId !== undefined) {
        params.owner_id = ownerId;
      }

      const isVerified = this.parseBooleanFilter(this.filters.isVerified);
      if (isVerified !== undefined) {
        params.is_verified = isVerified;
      }

      const isPublic = this.parseBooleanFilter(this.filters.isPublic);
      if (isPublic !== undefined) {
        params.is_public = isPublic;
      }

      return params;
    },

    normalizeListItem(item) {
      return {
        ...item,
        owner: item?.owner || {},
        _count: item?._count || {},
        is_public: Boolean(item?.is_public),
        is_verified: Boolean(item?.is_verified),
      };
    },

    extractTotalItems(responseData, limitFallback) {
      const pagination = responseData?.pagination || {};
      const explicitTotal = Number(
        pagination.total ??
          pagination.totalItems ??
          pagination.totalCount ??
          responseData?.total
      );
      if (Number.isFinite(explicitTotal) && explicitTotal >= 0) {
        return explicitTotal;
      }

      const totalPages = Number(pagination.totalPages);
      const limit = Number(pagination.limit || limitFallback || 20);
      if (Number.isFinite(totalPages) && totalPages > 0 && Number.isFinite(limit) && limit > 0) {
        return totalPages * limit;
      }

      return Array.isArray(responseData?.items) ? responseData.items.length : 0;
    },

    async loadApplications() {
      const params = this.buildListParams();
      if (!params) return;

      this.loading = true;
      try {
        const { data } = await axios.get("/admin/oauth/applications", { params });
        const items = Array.isArray(data?.items) ? data.items : [];
        this.applications = items.map((item) => this.normalizeListItem(item));
        this.totalItems = this.extractTotalItems(data, params.limit);
      } catch (error) {
        this.showError(error.response?.data?.message || "加载应用列表失败");
        console.error("Error loading OAuth applications:", error);
      } finally {
        this.loading = false;
      }
    },

    normalizeArrayField(value) {
      if (Array.isArray(value)) {
        return value.map((item) => String(item).trim()).filter(Boolean);
      }

      if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return [];

        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            return parsed.map((item) => String(item).trim()).filter(Boolean);
          }
        } catch {
          // ignore parse error and fallback to split
        }

        return trimmed
          .split(/\r?\n|,/g)
          .map((item) => item.trim())
          .filter(Boolean);
      }

      return [];
    },

    normalizeDetailApplication(app) {
      return {
        ...app,
        owner: app?.owner || {},
        _count: app?._count || {},
        redirect_uris: this.normalizeArrayField(app?.redirect_uris),
        scopes: this.normalizeArrayField(app?.scopes),
        is_public: Boolean(app?.is_public),
        is_verified: Boolean(app?.is_verified),
      };
    },

    fillEditFormFromDetail(app) {
      this.editForm = {
        name: app?.name || "",
        redirectUrisText: this.normalizeArrayField(app?.redirect_uris).join("\n"),
        clientType: app?.client_type || app?.type || "",
        scopesText: this.normalizeArrayField(app?.scopes).join("\n"),
        webhookUrl: app?.webhook_url || "",
        logoUrl: app?.logo_url || "",
        termsUrl: app?.terms_url || "",
        status: app?.status || "active",
        isPublic: Boolean(app?.is_public),
      };
    },

    async openDetail(item) {
      const identifier = item?.client_id || item?.id;
      if (!identifier) return;
      this.detailDialog = true;
      this.detailIdentifier = String(identifier);
      await this.loadApplicationDetail(this.detailIdentifier);
    },

    async loadApplicationDetail(identifier = this.detailIdentifier, silent = false) {
      if (!identifier) return;

      if (!silent) {
        this.detailLoading = true;
      }

      try {
        const { data } = await axios.get(
          `/admin/oauth/applications/${encodeURIComponent(identifier)}`
        );
        const app = this.normalizeDetailApplication(data?.application || data || {});
        this.selectedApplication = app;
        this.detailIdentifier = String(app.client_id || app.id || identifier);
        this.fillEditFormFromDetail(app);
      } catch (error) {
        this.showError(error.response?.data?.message || "加载应用详情失败");
        console.error("Error loading OAuth application detail:", error);
      } finally {
        if (!silent) {
          this.detailLoading = false;
        }
      }
    },

    toNullableString(value) {
      const text = String(value || "").trim();
      return text ? text : null;
    },

    buildUpdatePayload() {
      const name = String(this.editForm.name || "").trim();
      if (!name) {
        this.showError("应用名称不能为空");
        return null;
      }

      const redirectUris = this.normalizeArrayField(this.editForm.redirectUrisText);
      if (redirectUris.length === 0) {
        this.showError("至少需要一个 redirect URI");
        return null;
      }

      const clientType = String(this.editForm.clientType || "").trim();
      if (!clientType) {
        this.showError("client_type 不能为空");
        return null;
      }

      const status = String(this.editForm.status || "").trim();
      if (!status) {
        this.showError("状态不能为空");
        return null;
      }
      if (status === "deleted") {
        this.showError("管理员更新不允许将状态直接设置为 deleted");
        return null;
      }

      return {
        name,
        redirect_uris: redirectUris,
        client_type: clientType,
        scopes: this.normalizeArrayField(this.editForm.scopesText),
        webhook_url: this.toNullableString(this.editForm.webhookUrl),
        logo_url: this.toNullableString(this.editForm.logoUrl),
        terms_url: this.toNullableString(this.editForm.termsUrl),
        status,
        is_public: Boolean(this.editForm.isPublic),
      };
    },

    async saveApplication() {
      if (!this.selectedApplication || !this.detailIdentifier) return;

      const formValidationResult = await this.$refs.editFormRef?.validate?.();
      if (formValidationResult?.valid === false) {
        this.showError("请先修正表单错误后再保存");
        return;
      }

      const payload = this.buildUpdatePayload();
      if (!payload) return;

      this.saving = true;
      try {
        await axios.put(
          `/admin/oauth/applications/${encodeURIComponent(this.detailIdentifier)}`,
          payload
        );
        this.showSuccess("应用更新成功");
        await Promise.all([
          this.loadApplicationDetail(this.detailIdentifier),
          this.loadApplications(),
        ]);
      } catch (error) {
        this.showError(error.response?.data?.message || "更新应用失败");
        console.error("Error updating OAuth application:", error);
      } finally {
        this.saving = false;
      }
    },

    async requestSetVerified(identifier, nextVerified) {
      const url = `/admin/oauth/applications/${encodeURIComponent(identifier)}/verified`;
      const payload = { is_verified: Boolean(nextVerified) };
      const methods = ["put", "patch", "post"];
      let lastError = null;

      for (const method of methods) {
        try {
          return await axios[method](url, payload);
        } catch (error) {
          const status = error?.response?.status;
          const message = String(
            error?.response?.data?.message || error?.response?.data?.error || ""
          ).toLowerCase();

          // 若后端明确返回应用不存在，直接抛错，不再尝试其它方法
          if (message.includes("application not found")) {
            throw error;
          }

          if (status === 404 || status === 405) {
            lastError = error;
            continue;
          }

          throw error;
        }
      }

      throw lastError || new Error("Failed to set verified status");
    },

    async setVerified(nextVerified) {
      if (!this.selectedApplication || !this.detailIdentifier) return;

      this.verifying = true;
      try {
        await this.requestSetVerified(this.detailIdentifier, nextVerified);
        this.showSuccess(nextVerified ? "应用已设为已验证" : "应用已取消验证");
        await Promise.all([
          this.loadApplicationDetail(this.detailIdentifier),
          this.loadApplications(),
        ]);
      } catch (error) {
        this.showError(error.response?.data?.message || "更新验证状态失败");
        console.error("Error updating OAuth application verified status:", error);
      } finally {
        this.verifying = false;
      }
    },

    openDeleteDialog(item) {
      const identifier = item?.client_id || item?.id;
      if (!identifier) return;

      this.deleteTarget = {
        id: item?.id,
        name: item?.name || "",
        client_id: item?.client_id || "",
        identifier: String(identifier),
      };
      this.deleteConfirmText = "";
      this.deleteDialog = true;
    },

    async deleteApplication() {
      if (!this.deleteTarget?.identifier) return;

      this.deleting = true;
      try {
        await axios.delete(
          `/admin/oauth/applications/${encodeURIComponent(this.deleteTarget.identifier)}`
        );
        this.showSuccess("应用已下线并撤销相关授权");
        this.deleteDialog = false;

        if (
          this.selectedApplication &&
          (String(this.selectedApplication.id) === String(this.deleteTarget.id) ||
            this.selectedApplication.client_id === this.deleteTarget.client_id)
        ) {
          this.detailDialog = false;
          this.selectedApplication = null;
        }

        await this.loadApplications();
      } catch (error) {
        this.showError(error.response?.data?.message || "下线应用失败");
        console.error("Error deleting OAuth application:", error);
      } finally {
        this.deleting = false;
      }
    },

    getStatusColor(status) {
      return (
        {
          active: "success",
          inactive: "default",
          pending: "warning",
          suspended: "orange",
          revoked: "deep-orange",
          deleted: "error",
        }[status] || "default"
      );
    },

    getOwnerDisplay(owner) {
      if (!owner) return "-";
      return owner.username || owner.nickname || owner.email || "-";
    },

    formatDate(value) {
      if (!value) return "-";
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return String(value);
      }
      return parsed.toLocaleString("zh-CN", {
        hour12: false,
      });
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
  },
};
</script>

<style scoped lang="scss">
.oauth-applications-admin {
  .summary-card {
    position: relative;
    overflow: hidden;

    .summary-icon {
      position: absolute;
      right: 16px;
      bottom: 16px;
      font-size: 44px;
      opacity: 0.2;
    }

    &.summary-total {
      background: linear-gradient(135deg, #1976d2, #42a5f5);
      color: #fff;
    }

    &.summary-page {
      background: linear-gradient(135deg, #546e7a, #90a4ae);
      color: #fff;
    }

    &.summary-verified {
      background: linear-gradient(135deg, #2e7d32, #66bb6a);
      color: #fff;
    }

    &.summary-public {
      background: linear-gradient(135deg, #00695c, #26a69a);
      color: #fff;
    }
  }

  .action-btn {
    opacity: 0.75;
    transition: opacity 0.2s ease, transform 0.2s ease;

    &:hover {
      opacity: 1;
      transform: scale(1.1);
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
}
</style>
