<template>
  <div class="oauth-scope-selector">
    <div class="d-flex align-center mb-2">
      <v-icon class="mr-2" size="20">mdi-shield-key-outline</v-icon>
      <div>
        <div class="text-subtitle-1 font-weight-bold">{{ title }}</div>
        <div class="text-body-2 text-medium-emphasis">{{ description }}</div>
      </div>
    </div>

    <v-alert
      class="mb-3"
      density="compact"
      type="info"
      variant="tonal"
    >
      第三方应用只能请求这里声明的权限。授权时用户还可以只授予其中的一部分。
    </v-alert>

    <div v-if="loading" class="text-center pa-4">
      <v-progress-circular indeterminate size="28" />
    </div>

    <template v-else>
      <v-row class="mb-3" dense>
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
                <v-spacer />
                <v-chip :color="riskColor(preset.risk_level)" label size="x-small">
                  {{ riskLabel(preset.risk_level) }}
                </v-chip>
              </div>
              <div class="text-body-2 text-medium-emphasis mb-2">
                {{ preset.description }}
              </div>
              <v-chip
                v-for="scopeName in preset.scopes.slice(0, 4)"
                :key="scopeName"
                class="mr-1 mb-1"
                size="x-small"
                variant="tonal"
              >
                {{ scopeDisplayName(scopeName) }}
              </v-chip>
              <span
                v-if="preset.scopes.length > 4"
                class="text-caption text-medium-emphasis"
              >
                +{{ preset.scopes.length - 4 }}
              </span>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-table class="scope-table" density="compact">
        <tbody>
          <tr v-for="group in resourceList" :key="group.resource">
            <td class="scope-resource">
              <div class="font-weight-medium">{{ group.label }}</div>
              <div class="text-caption text-medium-emphasis">
                {{ group.description }}
              </div>
            </td>
            <td>
              <div class="scope-grid">
                <v-checkbox
                  v-for="item in group.items"
                  :key="item.name"
                  v-model="scopeSelections[item.name]"
                  color="primary"
                  density="compact"
                  hide-details
                  :label="item.action_label || item.title"
                  :title="item.description"
                  @update:model-value="markCustomSelection"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </v-table>

      <div class="mt-3">
        <span class="text-caption text-medium-emphasis mr-1">
          已声明 {{ selectedScopes.length }} 项权限：
        </span>
        <v-chip
          v-for="item in selectedScopeDetails"
          :key="item.name"
          class="mr-1 mb-1"
          :color="riskColor(item.risk_level)"
          size="x-small"
          :title="item.name"
          variant="tonal"
        >
          {{ item.title || item.name }}
        </v-chip>
        <span v-if="selectedScopes.length === 0" class="text-caption text-warning">
          至少选择一项权限
        </span>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
  import { getScopeCatalog } from "@/services/tokenService";

  const ACTION_ORDER = {
    read: 10,
    create: 20,
    update: 30,
    interact: 35,
    delete: 40,
    manage: 50,
  };

  export default {
    name: "OAuthScopeSelector",
    props: {
      modelValue: {
        type: Array,
        default: () => ["user:read"],
      },
      title: {
        type: String,
        default: "应用权限",
      },
      description: {
        type: String,
        default: "选择该 OAuth 应用允许请求的权限范围。",
      },
    },
    emits: ["error"],
    data() {
      return {
        loading: false,
        scopeCatalog: [],
        scopePresets: [],
        categories: {},
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
          git_sync: "Git 同步",
        },
        resourceDescriptions: {
          project: "项目本体、文件、分支和可见性设置",
          user: "个人资料、用户名和邮箱",
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
          git_sync: "GitHub 绑定和同步任务",
        },
      };
    },
    computed: {
      selectedScopes() {
        return Object.entries(this.scopeSelections)
          .filter(([, selected]) => selected)
          .map(([name]) => name);
      },
      selectedScopeDetails() {
        return this.selectedScopes.map((name) => this.scopeDetail(name));
      },
    },
    watch: {
      modelValue: {
        handler(value) {
          this.applyModelValue(value);
        },
        deep: true,
      },
    },
    async mounted() {
      await this.loadScopeCatalog();
    },
    methods: {
      async loadScopeCatalog() {
        this.loading = true;
        try {
          const response = await getScopeCatalog();
          const payload = response.data || {};
          this.scopeCatalog = (payload.data || []).filter(
            (item) => item.name !== "*" && item.action !== "write"
          );
          this.scopePresets = (payload.presets || [])
            .map((preset) => ({
              ...preset,
              scopes: (preset.scopes || []).filter((scopeName) =>
                this.scopeCatalog.some((item) => item.name === scopeName)
              ),
            }))
            .filter((preset) => preset.scopes.length > 0);
          this.categories = payload.categories || {};
          this.buildResourceList();
          this.applyModelValue(this.modelValue);
        } catch (error) {
          this.$emit("error", error);
        } finally {
          this.loading = false;
        }
      },
      buildResourceList() {
        const map = {};
        for (const item of this.scopeCatalog) {
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
        }

        this.resourceList = Object.values(map)
          .map((group) => ({
            ...group,
            items: group.items.toSorted(
              (a, b) => (ACTION_ORDER[a.action] || 100) - (ACTION_ORDER[b.action] || 100)
            ),
          }))
          .toSorted((a, b) => a.order - b.order || a.label.localeCompare(b.label, "zh-CN"));
      },
      applyModelValue(value) {
        const selected = new Set(Array.isArray(value) && value.length > 0 ? value : ["user:read"]);
        const next = {};
        for (const item of this.scopeCatalog) {
          next[item.name] = selected.has(item.name);
        }
        this.scopeSelections = next;
      },
      applyPreset(preset) {
        const selected = new Set(preset.scopes || []);
        const next = {};
        for (const item of this.scopeCatalog) {
          next[item.name] = selected.has(item.name);
        }
        this.selectedPresetId = preset.id;
        this.scopeSelections = next;
      },
      markCustomSelection() {
        this.selectedPresetId = null;
      },
      getSelectedScopes() {
        return [...this.selectedScopes];
      },
      scopeDetail(name) {
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
        if (level === "high") return "error";
        if (level === "medium") return "warning";
        if (level === "low") return "success";
        return "primary";
      },
      riskLabel(level) {
        if (level === "high") return "高风险";
        if (level === "medium") return "中风险";
        if (level === "low") return "低风险";
        return "普通";
      },
    },
  };
</script>

<style scoped>
.scope-preset {
  cursor: pointer;
  transition: border-color 0.16s ease, background-color 0.16s ease, transform 0.16s ease;
}

.scope-preset:hover {
  border-color: rgba(var(--v-theme-primary), 0.45);
  transform: translateY(-1px);
}

.scope-preset--selected {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.06);
}

.scope-table {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  overflow: hidden;
}

.scope-table :deep(td) {
  vertical-align: top;
  padding: 12px;
}

.scope-resource {
  width: 190px;
}

.scope-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 2px 8px;
}

@media (max-width: 720px) {
  .scope-table,
  .scope-table :deep(tbody),
  .scope-table :deep(tr),
  .scope-table :deep(td) {
    display: block;
    width: 100%;
  }

  .scope-resource {
    width: 100%;
    padding-bottom: 0;
  }
}
</style>
