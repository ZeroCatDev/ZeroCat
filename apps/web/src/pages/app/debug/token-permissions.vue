<template>
  <v-container fluid>
    <v-card class="mb-4">
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2" icon="mdi-shield-search"></v-icon>
        令牌权限调试
        <v-spacer></v-spacer>
        <v-btn
          :loading="contextLoading"
          color="primary"
          prepend-icon="mdi-refresh"
          variant="tonal"
          @click="loadContext"
        >
          刷新
        </v-btn>
      </v-card-title>
      <v-card-subtitle>
        查看当前请求 token 的有效权限，并测试指定 scope 的鉴权结果。
      </v-card-subtitle>
    </v-card>

    <v-row>
      <v-col cols="12" lg="5">
        <v-card class="mb-4">
          <v-card-title>当前令牌</v-card-title>
          <v-progress-linear v-if="contextLoading" indeterminate></v-progress-linear>
          <v-card-text v-if="context">
            <v-table density="comfortable">
              <tbody>
                <tr>
                  <td class="field-name">用户</td>
                  <td>
                    {{ context.user?.display_name || context.user?.username }}
                    <span class="text-medium-emphasis">@{{ context.user?.username }}</span>
                  </td>
                </tr>
                <tr>
                  <td class="field-name">Token ID</td>
                  <td>{{ context.token?.id || "无" }}</td>
                </tr>
                <tr>
                  <td class="field-name">类型</td>
                  <td>
                    <v-chip :color="tokenTypeColor(context.token?.type)" size="small" label>
                      {{ tokenTypeLabel(context.token?.type) }}
                    </v-chip>
                  </td>
                </tr>
                <tr>
                  <td class="field-name">权限来源</td>
                  <td>{{ scopeSourceLabel(context.token?.scope_source) }}</td>
                </tr>
                <tr>
                  <td class="field-name">过期时间</td>
                  <td>{{ context.token?.expires_at ? formatDate(context.token.expires_at) : "永不过期" }}</td>
                </tr>
              </tbody>
            </v-table>
          </v-card-text>
          <v-card-text v-else-if="!contextLoading" class="text-medium-emphasis">
            无法读取当前令牌上下文。
          </v-card-text>
        </v-card>

        <v-card>
          <v-card-title>Scope 测试</v-card-title>
          <v-card-text>
            <v-textarea
              v-model="scopeInput"
              auto-grow
              label="要测试的 scope"
              placeholder="project:read&#10;project:123:update&#10;admin:manage"
              rows="4"
              variant="outlined"
            ></v-textarea>
            <v-btn
              :disabled="!scopeInput.trim()"
              :loading="evaluating"
              color="primary"
              prepend-icon="mdi-play-circle"
              @click="evaluate"
            >
              评估
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" lg="7">
        <v-card class="mb-4">
          <v-card-title>有效权限</v-card-title>
          <v-card-text>
            <div class="text-caption text-medium-emphasis mb-2">当前 token 参与匹配的 scope</div>
            <div class="chip-box">
              <v-chip
                v-for="scope in effectiveScopes"
                :key="scope"
                class="mr-1 mb-1"
                color="primary"
                size="x-small"
                variant="tonal"
              >
                {{ scope }}
              </v-chip>
              <span v-if="effectiveScopes.length === 0" class="text-caption text-medium-emphasis">
                无
              </span>
            </div>

            <template v-if="storedScopes.length">
              <v-divider class="my-3"></v-divider>
              <div class="text-caption text-medium-emphasis mb-2">数据库记录的 scope</div>
              <v-chip
                v-for="scope in storedScopes"
                :key="scope"
                class="mr-1 mb-1"
                color="secondary"
                size="x-small"
                variant="tonal"
              >
                {{ scope }}
              </v-chip>
            </template>
          </v-card-text>
        </v-card>

        <v-card class="mb-4">
          <v-card-title>账号策略</v-card-title>
          <v-card-text>
            <div class="text-caption text-medium-emphasis mb-2">角色</div>
            <v-chip
              v-for="role in policy.roles"
              :key="role"
              class="mr-1 mb-1"
              size="small"
              variant="tonal"
            >
              {{ role }}
            </v-chip>
            <span v-if="!policy.roles?.length" class="text-caption text-medium-emphasis">无</span>

            <v-divider class="my-3"></v-divider>
            <div class="text-caption text-medium-emphasis mb-2">允许</div>
            <div class="chip-box">
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
              <v-divider class="my-3"></v-divider>
              <div class="text-caption text-medium-emphasis mb-2">拒绝</div>
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

        <v-card v-if="evaluation">
          <v-card-title class="d-flex align-center">
            评估结果
            <v-spacer></v-spacer>
            <v-chip :color="evaluation.allowed ? 'success' : 'error'" size="small" label>
              {{ evaluation.allowed ? "允许" : "拒绝" }}
            </v-chip>
          </v-card-title>
          <v-data-table
            :headers="resultHeaders"
            :items="evaluation.results || []"
            density="comfortable"
            item-value="scope"
          >
            <template v-slot:item.allowed="{ item }">
              <v-chip :color="item.allowed ? 'success' : 'error'" size="small" label>
                {{ item.allowed ? "允许" : "拒绝" }}
              </v-chip>
            </template>
            <template v-slot:item.token_allowed="{ item }">
              <v-icon :color="item.token_allowed ? 'success' : 'error'">
                {{ item.token_allowed ? "mdi-check" : "mdi-close" }}
              </v-icon>
            </template>
            <template v-slot:item.policy_allowed="{ item }">
              <v-icon :color="item.policy_allowed ? 'success' : 'error'">
                {{ item.policy_allowed ? "mdi-check" : "mdi-close" }}
              </v-icon>
            </template>
            <template v-slot:item.resource_allowed="{ item }">
              <v-icon :color="item.resource_allowed ? 'success' : 'error'">
                {{ item.resource_allowed ? "mdi-check" : "mdi-close" }}
              </v-icon>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="snackbar.timeout">
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import {
  evaluateTokenScopes,
  getCurrentTokenDebugContext,
} from "@/services/tokenService";

const context = ref(null);
const contextLoading = ref(false);
const evaluating = ref(false);
const scopeInput = ref("project:read\nuser:read");
const evaluation = ref(null);
const snackbar = ref({
  show: false,
  text: "",
  color: "success",
  timeout: 3000,
});

const resultHeaders = [
  { title: "Scope", value: "scope", sortable: false },
  { title: "结果", value: "allowed", sortable: false, width: "100px" },
  { title: "Token", value: "token_allowed", sortable: false, width: "90px", align: "center" },
  { title: "账号策略", value: "policy_allowed", sortable: false, width: "110px", align: "center" },
  { title: "资源边界", value: "resource_allowed", sortable: false, width: "110px", align: "center" },
];

const effectiveScopes = computed(() => context.value?.token?.effective_scopes || []);
const storedScopes = computed(() => context.value?.token?.stored_scopes || []);
const policy = computed(() => context.value?.policy || { roles: [], allow: [], deny: [] });

function showError(text) {
  snackbar.value = { show: true, text, color: "error", timeout: 5000 };
}

async function loadContext() {
  contextLoading.value = true;
  try {
    const response = await getCurrentTokenDebugContext();
    context.value = response.data.data;
  } catch (error) {
    showError(error.response?.data?.message || "加载令牌上下文失败");
  } finally {
    contextLoading.value = false;
  }
}

async function evaluate() {
  evaluating.value = true;
  evaluation.value = null;
  try {
    const response = await evaluateTokenScopes(scopeInput.value);
    evaluation.value = response.data.data;
  } catch (error) {
    showError(error.response?.data?.message || "评估 scope 失败");
  } finally {
    evaluating.value = false;
  }
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("zh-CN");
}

function tokenTypeLabel(type) {
  return {
    session: "网页登录会话",
    personal: "个人 API 令牌",
    oauth: "OAuth 授权令牌",
  }[type] || type || "未知";
}

function tokenTypeColor(type) {
  return {
    session: "blue",
    personal: "teal",
    oauth: "purple",
  }[type] || "grey";
}

function scopeSourceLabel(source) {
  return {
    current_user_policy: "当前用户角色策略",
    token_record: "令牌记录 scope",
  }[source] || source || "未知";
}

onMounted(loadContext);
</script>

<style scoped>
.field-name {
  width: 120px;
  font-weight: 600;
}

.chip-box {
  max-height: 220px;
  overflow: auto;
}
</style>
