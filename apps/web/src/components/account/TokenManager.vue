<template>
  <div>
    <v-card class="mb-4" border>
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">mdi-key-plus</v-icon>
        创建新令牌
      </v-card-title>
      <v-card-text>
        <v-form v-model="createFormValid" @submit.prevent="createToken">
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="createForm.name"
                :rules="nameRules"
                :counter="50"
                density="comfortable"
                label="令牌名称"
                placeholder="例如：我的API令牌"
                required
                variant="outlined"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="createForm.expires_in"
                :items="expirationOptions"
                density="comfortable"
                item-title="label"
                item-value="value"
                label="过期时间"
                variant="outlined"
              ></v-select>
            </v-col>

            <v-col cols="12">
              <div class="d-flex align-center mb-2">
                <v-icon class="mr-2" size="small">mdi-shield-key-outline</v-icon>
                <span class="text-subtitle-2">权限</span>
                <v-spacer></v-spacer>
                <v-switch
                  v-model="fullAccess"
                  label="完全访问"
                  color="error"
                  density="compact"
                  hide-details
                  inset
                  @update:model-value="handleFullAccessToggle"
                ></v-switch>
              </div>

              <v-alert
                v-if="fullAccess"
                type="warning"
                variant="tonal"
                density="compact"
                class="mb-3"
              >
                该令牌将拥有账户全部权限，等同于完整登录会话。只应授予你完全信任的工具。
              </v-alert>

              <template v-else>
                <v-alert
                  type="info"
                  variant="tonal"
                  density="compact"
                  class="mb-3"
                >
                  先选择最接近用途的模板；需要更精确控制时，再打开自定义权限。创建、修改、删除是互相独立的能力。
                </v-alert>

                <div v-if="scopesLoading" class="text-center pa-2">
                  <v-progress-circular indeterminate size="24"></v-progress-circular>
                </div>

                <template v-else>
                  <v-row dense>
                    <v-col
                      v-for="preset in scopePresets"
                      :key="preset.id"
                      cols="12"
                      md="6"
                    >
                      <v-card
                        class="scope-preset"
                        :class="{ 'scope-preset--selected': selectedPresetId === preset.id }"
                        variant="outlined"
                        @click="applyPreset(preset)"
                      >
                        <v-card-text class="pa-3">
                          <div class="d-flex align-center mb-1">
                            <div class="font-weight-medium">{{ preset.name }}</div>
                            <v-spacer></v-spacer>
                            <v-chip
                              :color="riskColor(preset.risk_level)"
                              size="x-small"
                              label
                            >
                              {{ riskLabel(preset.risk_level) }}
                            </v-chip>
                          </div>
                          <div class="text-body-2 text-medium-emphasis mb-2">
                            {{ preset.description }}
                          </div>
                          <div>
                            <v-chip
                              v-for="scopeName in preset.scopes.slice(0, 4)"
                              :key="scopeName"
                              size="x-small"
                              variant="tonal"
                              class="mr-1 mb-1"
                            >
                              {{ scopeDisplayName(scopeName) }}
                            </v-chip>
                            <span
                              v-if="preset.scopes.length > 4"
                              class="text-caption text-medium-emphasis"
                            >
                              +{{ preset.scopes.length - 4 }}
                            </span>
                          </div>
                        </v-card-text>
                      </v-card>
                    </v-col>
                  </v-row>

                  <div class="d-flex align-center mt-3">
                    <v-switch
                      v-model="advancedMode"
                      label="自定义精确权限"
                      color="primary"
                      density="compact"
                      hide-details
                      inset
                    ></v-switch>
                    <v-spacer></v-spacer>
                    <v-btn
                      v-if="selectedScopes.length"
                      size="small"
                      variant="text"
                      @click="resetScopeSelection"
                    >
                      清空
                    </v-btn>
                  </div>

                  <v-expand-transition>
                    <div v-if="advancedMode" class="mt-2">
                      <v-table density="compact" class="scope-table">
                        <tbody>
                          <tr v-for="group in resourceList" :key="group.resource">
                            <td class="scope-res-cell">
                              <div class="font-weight-medium">{{ group.label }}</div>
                              <div class="text-caption text-medium-emphasis">
                                {{ group.description }}
                              </div>
                            </td>
                            <td>
                              <div class="scope-checkbox-grid">
                                <v-checkbox
                                  v-for="item in group.items"
                                  :key="item.name"
                                  v-model="scopeSelections[item.name]"
                                  :label="item.action_label || item.title"
                                  :title="item.description"
                                  color="primary"
                                  density="compact"
                                  hide-details
                                  @update:model-value="markCustomSelection"
                                ></v-checkbox>
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </v-table>
                    </div>
                  </v-expand-transition>

                  <div class="mt-3">
                    <span class="text-caption text-medium-emphasis mr-1">
                      已选 {{ selectedScopes.length }} 项权限：
                    </span>
                    <v-chip
                      v-for="item in selectedScopeDetails"
                      :key="item.name"
                      :color="riskColor(item.risk_level)"
                      size="x-small"
                      variant="tonal"
                      class="mr-1 mb-1"
                      :title="item.name"
                    >
                      {{ item.title || item.name }}
                    </v-chip>
                    <span v-if="selectedScopes.length === 0" class="text-caption text-warning">
                      请至少选择一个模板或一项权限
                    </span>
                  </div>
                </template>
              </template>
            </v-col>

            <v-col cols="12">
              <v-btn
                :disabled="!createFormValid || creating || selectedScopes.length === 0"
                :loading="creating"
                color="primary"
                type="submit"
              >
                <v-icon class="mr-2">mdi-key-plus</v-icon>
                创建令牌
              </v-btn>
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
    </v-card>

    <v-card border>
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">mdi-key</v-icon>
        我的令牌
        <v-spacer></v-spacer>
        <v-btn
          :loading="loading"
          icon="mdi-refresh"
          variant="text"
          @click="loadTokens"
        ></v-btn>
      </v-card-title>
      <v-card-text>
        <div v-if="loading" class="text-center pa-4">
          <v-progress-circular indeterminate></v-progress-circular>
        </div>

        <div v-else-if="tokens.length === 0" class="text-center pa-4">
          <v-icon size="64" color="grey">mdi-key-off</v-icon>
          <p class="text-grey mt-2">暂无令牌</p>
        </div>

        <div v-else>
          <v-list>
            <v-list-item
              v-for="token in tokens"
              :key="token.id"
              class="mb-2"
            >
              <template v-slot:prepend>
                <v-icon
                  :color="token.revoked ? 'error' : 'success'"
                  :icon="token.revoked ? 'mdi-key-off' : 'mdi-key'"
                ></v-icon>
              </template>

              <v-list-item-title>
                {{ token.name }}
                <v-chip
                  v-if="token.revoked"
                  color="error"
                  size="small"
                  class="ml-2"
                >
                  已吊销
                </v-chip>
                <v-chip
                  v-else-if="isExpired(token)"
                  color="warning"
                  size="small"
                  class="ml-2"
                >
                  已过期
                </v-chip>
              </v-list-item-title>

              <v-list-item-subtitle>
                <div class="d-flex flex-column">
                  <div v-if="token.scopes && token.scopes.length" class="my-1">
                    <v-chip
                      v-for="s in token.scopes"
                      :key="s"
                      :title="s"
                      size="x-small"
                      class="mr-1 mb-1"
                      variant="tonal"
                      :color="riskColor(scopeDetail(s).risk_level)"
                    >
                      {{ scopeDisplayName(s) }}
                    </v-chip>
                  </div>
                  <span v-if="token.token_prefix" class="text-grey">
                    前缀：{{ token.token_prefix }}...
                  </span>
                  <span>创建时间：{{ formatDate(token.created_at) }}</span>
                  <span v-if="token.expires_at">
                    过期时间：{{ formatDate(token.expires_at) }}
                  </span>
                  <span v-else class="text-grey">永不过期</span>
                  <span v-if="token.last_used_at">
                    最后使用：{{ formatDate(token.last_used_at) }}
                    <span v-if="token.last_used_ip" class="text-grey">
                      ({{ token.last_used_ip }})
                    </span>
                  </span>
                </div>
              </v-list-item-subtitle>

              <template v-slot:append>
                <v-btn
                  v-if="!token.revoked"
                  icon="mdi-key-off"
                  variant="text"
                  color="error"
                  :title="'吊销令牌'"
                  @click="revokeToken(token.id)"
                ></v-btn>
              </template>
            </v-list-item>
          </v-list>
        </div>
      </v-card-text>
    </v-card>

    <v-dialog v-model="showNewTokenDialog" max-width="600">
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon class="mr-2" color="success">mdi-check-circle</v-icon>
          令牌创建成功
        </v-card-title>
        <v-card-text>
          <v-alert
            type="warning"
            variant="tonal"
            class="mb-4"
          >
            <strong>重要提示：</strong>令牌只会显示一次，请立即复制并妥善保存！
          </v-alert>

          <v-text-field
            :model-value="newToken"
            density="comfortable"
            label="新令牌"
            readonly
            variant="outlined"
          >
            <template v-slot:append>
              <v-btn
                icon="mdi-content-copy"
                variant="text"
                @click="copyToken"
              ></v-btn>
            </template>
          </v-text-field>

          <div class="mt-4">
            <h4>使用方式：</h4>
            <v-code class="mt-2">
              <div>Authorization Header:</div>
              <div>Authorization: Bearer {{ newToken }}</div>
              <div class="mt-2">或 Query Parameter:</div>
              <div>?token={{ newToken }}</div>
            </v-code>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            color="primary"
            @click="showNewTokenDialog = false"
          >
            确定
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="confirmDialog.show" max-width="400">
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon :color="confirmDialog.color" class="mr-2">mdi-alert</v-icon>
          <span class="text-h6">{{ confirmDialog.title }}</span>
        </v-card-title>
        <v-card-text>
          <p>{{ confirmDialog.message }}</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="handleConfirmDialogCancel">
            取消
          </v-btn>
          <v-btn
            :color="confirmDialog.color"
            :loading="confirmDialog.loading"
            @click="handleConfirmDialogConfirm"
          >
            {{ confirmDialog.confirmText }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import {
  createToken,
  getTokens,
  revokeToken,
  getScopeCatalog,
} from "@/services/tokenService";
import { useSudoManager } from "@/composables/useSudoManager";

const ACTION_ORDER = {
  read: 10,
  create: 20,
  update: 30,
  interact: 35,
  delete: 40,
  manage: 50,
};

export default {
  name: "TokenManager",
  data() {
    return {
      loading: false,
      creating: false,
      tokens: [],
      scopeCatalog: [],
      scopePresets: [],
      categories: {},
      actions: {},
      scopesLoading: false,
      createFormValid: false,
      createForm: {
        name: "",
        expires_in: 86400,
      },
      fullAccess: false,
      advancedMode: false,
      selectedPresetId: null,
      scopeSelections: {},
      resourceList: [],
      resourceLabels: {
        project: "项目",
        user: "账户资料",
        comment: "评论",
        post: "推文",
        notification: "通知",
        asset: "素材",
        list: "项目列表",
        follow: "关注",
        blog: "博客",
        cachekv: "键值存储",
        oauth_app: "OAuth 应用",
        token: "令牌",
        event: "事件",
        analytics: "分析",
        extension: "扩展",
        admin: "管理后台",
      },
      resourceDescriptions: {
        project: "项目本体、文件、分支和可见性设置",
        user: "个人资料、用户名和密码",
        comment: "评论发布、修改和删除",
        post: "推文发布、互动和删除",
        notification: "私有通知和已读状态",
        asset: "上传和读取素材文件",
        list: "项目列表和列表项",
        follow: "关注关系",
        blog: "博客草稿和文章",
        cachekv: "账户键值存储",
        oauth_app: "第三方 OAuth 应用",
        token: "个人 API 令牌",
        event: "账户相关事件记录",
        analytics: "统计分析数据",
        extension: "Scratch 扩展",
        admin: "管理员操作",
      },
      showNewTokenDialog: false,
      newToken: "",
      confirmDialog: {
        show: false,
        title: "",
        message: "",
        color: "primary",
        confirmText: "确认",
        callback: null,
        loading: false,
      },
      expirationOptions: [
        { label: "1小时", value: 3600 },
        { label: "24小时", value: 86400 },
        { label: "7天", value: 604800 },
        { label: "30天", value: 2592000 },
        { label: "90天", value: 7776000 },
        { label: "永不过期", value: -1 },
      ],
      nameRules: [
        (v) => !!v || "令牌名称不能为空",
        (v) => v.length <= 50 || "令牌名称不能超过50个字符",
        (v) => v.length >= 2 || "令牌名称至少2个字符",
      ],
    };
  },
  setup() {
    const sudoManager = useSudoManager();
    return { sudoManager };
  },
  computed: {
    selectedScopes() {
      if (this.fullAccess) return ["*"];
      return Object.entries(this.scopeSelections)
        .filter(([, selected]) => selected)
        .map(([name]) => name);
    },
    selectedScopeDetails() {
      return this.selectedScopes.map((name) => this.scopeDetail(name));
    },
  },
  async mounted() {
    await Promise.all([this.loadTokens(), this.loadScopeCatalog()]);
  },
  methods: {
    async loadScopeCatalog() {
      this.scopesLoading = true;
      try {
        const response = await getScopeCatalog();
        const payload = response.data || {};
        this.scopeCatalog = payload.data || [];
        this.scopePresets = payload.presets || [];
        this.categories = payload.categories || {};
        this.actions = payload.actions || {};
        this.buildResourceList();
      } catch (error) {
        this.$emit("error", error);
      } finally {
        this.scopesLoading = false;
      }
    },

    buildResourceList() {
      const map = {};
      const nextSelections = {};
      for (const item of this.scopeCatalog) {
        if (item.name === "*" || item.action === "write") continue;
        const [fallbackResource, fallbackAction] = item.name.split(":");
        const resource = item.resource || fallbackResource;
        const action = item.action || fallbackAction;
        if (!resource || !action || action === "*") continue;

        if (!map[resource]) {
          map[resource] = {
            resource,
            label: this.resourceLabels[resource] || resource,
            description: this.resourceDescriptions[resource] || "",
            category: item.category,
            order: this.categories[item.category]?.order || 100,
            items: [],
          };
        }
        map[resource].items.push(item);
        nextSelections[item.name] = Boolean(this.scopeSelections[item.name]);
      }

      this.resourceList = Object.values(map)
        .map((group) => ({
          ...group,
          items: group.items.sort(
            (a, b) => (ACTION_ORDER[a.action] || 100) - (ACTION_ORDER[b.action] || 100)
          ),
        }))
        .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "zh-CN"));
      this.scopeSelections = nextSelections;
    },

    applyPreset(preset) {
      const next = {};
      const presetScopes = new Set(preset.scopes || []);
      for (const item of this.scopeCatalog) {
        if (item.name !== "*" && item.action !== "write") {
          next[item.name] = presetScopes.has(item.name);
        }
      }
      this.fullAccess = false;
      this.scopeSelections = next;
      this.selectedPresetId = preset.id;
    },

    handleFullAccessToggle(value) {
      if (value) {
        this.selectedPresetId = null;
        this.advancedMode = false;
      }
    },

    markCustomSelection() {
      this.selectedPresetId = null;
    },

    resetScopeSelection() {
      this.fullAccess = false;
      this.selectedPresetId = null;
      const next = {};
      for (const item of this.scopeCatalog) {
        if (item.name !== "*" && item.action !== "write") {
          next[item.name] = false;
        }
      }
      this.scopeSelections = next;
    },

    scopeDetail(name) {
      if (name === "*") {
        return {
          name,
          title: "完全访问",
          risk_level: "high",
        };
      }
      return this.scopeCatalog.find((item) => item.name === name) || {
        name,
        title: name,
        risk_level: "medium",
      };
    },

    scopeDisplayName(name) {
      return this.scopeDetail(name).title || name;
    },

    riskColor(level) {
      switch (level) {
        case "high":
          return "error";
        case "medium":
          return "warning";
        case "low":
          return "success";
        default:
          return "primary";
      }
    },

    riskLabel(level) {
      switch (level) {
        case "high":
          return "高风险";
        case "medium":
          return "中风险";
        case "low":
          return "低风险";
        default:
          return "普通";
      }
    },

    async loadTokens() {
      this.loading = true;
      try {
        const response = await getTokens();
        this.tokens = response.data.data || [];
      } catch (error) {
        this.$emit("error", error);
      } finally {
        this.loading = false;
      }
    },

    async createToken() {
      if (this.selectedScopes.length === 0) return;
      this.creating = true;
      try {
        const sudoToken = await this.sudoManager.requireSudo({
          title: "创建令牌",
          subtitle: "创建个人访问令牌是一个敏感操作，需要验证您的身份。",
          persistent: true,
        });

        const response = await createToken(
          {
            name: this.createForm.name,
            expires_in: this.createForm.expires_in,
            scopes: this.selectedScopes,
          },
          sudoToken
        );
        this.newToken = response.data.data.token;
        this.showNewTokenDialog = true;

        this.createForm.name = "";
        this.createForm.expires_in = 86400;
        this.resetScopeSelection();

        await this.loadTokens();

        this.$emit("token-created", response);
      } catch (error) {
        if (error.type !== "cancel") {
          this.$emit("error", error);
        }
      } finally {
        this.creating = false;
      }
    },

    async revokeToken(id) {
      this.confirmDialog = {
        show: true,
        title: "吊销令牌",
        message: "确定要吊销这个令牌吗？吊销后令牌将立即失效且无法恢复。",
        color: "error",
        confirmText: "吊销",
        loading: false,
        callback: async () => {
          try {
            await revokeToken(id);
            await this.loadTokens();
            this.$emit("token-revoked", { id });
          } catch (error) {
            this.$emit("error", error);
          }
        },
      };
    },

    copyToken() {
      navigator.clipboard.writeText(this.newToken).then(() => {
        this.$toast.add({
          severity: "success",
          summary: "复制成功",
          detail: "令牌已复制到剪贴板",
          life: 3000,
        });
      });
    },

    formatDate(dateString) {
      if (!dateString) return "";
      return new Date(dateString).toLocaleString("zh-CN");
    },

    isExpired(token) {
      if (token.revoked) return false;
      if (!token.expires_at) return false;
      return new Date(token.expires_at) < new Date();
    },

    handleConfirmDialogCancel() {
      this.confirmDialog.show = false;
      this.confirmDialog.callback = null;
    },

    async handleConfirmDialogConfirm() {
      this.confirmDialog.loading = true;
      try {
        if (this.confirmDialog.callback) {
          await this.confirmDialog.callback();
        }
      } finally {
        this.confirmDialog.show = false;
        this.confirmDialog.callback = null;
        this.confirmDialog.loading = false;
      }
    },
  },
};
</script>

<style scoped>
.v-code {
  background-color: rgb(var(--v-theme-surface-variant));
  border-radius: 4px;
  padding: 12px;
  font-family: monospace;
  font-size: 14px;
  line-height: 1.4;
}

.scope-preset {
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.scope-preset--selected {
  border-color: rgb(var(--v-theme-primary));
  background-color: rgba(var(--v-theme-primary), 0.08);
}

.scope-table :deep(td) {
  padding-top: 8px;
  padding-bottom: 8px;
  vertical-align: middle;
}

.scope-res-cell {
  width: 28%;
  min-width: 140px;
}

.scope-checkbox-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
  gap: 4px 12px;
}
</style>
