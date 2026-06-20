<template>
  <div class="introspect-container">
    <v-card class="pa-4">
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">mdi-card-account-details-outline</v-icon>
        令牌归属查询
      </v-card-title>
      <v-card-subtitle>
        输入任意令牌，查询其归属与权限信息。仅当令牌属于你本人或你是管理员时，才会显示归属用户等敏感信息。
      </v-card-subtitle>

      <v-divider class="my-3"></v-divider>

      <v-textarea
        v-model="tokenInput"
        label="令牌 (zc_...)"
        placeholder="粘贴要查询的令牌"
        rows="3"
        variant="outlined"
        auto-grow
        clearable
      ></v-textarea>

      <div class="d-flex align-center">
        <v-btn
          :loading="loading"
          :disabled="!tokenInput || !tokenInput.trim()"
          color="primary"
          @click="introspect"
        >
          <v-icon class="mr-2">mdi-magnify</v-icon>
          查询
        </v-btn>
        <v-btn
          class="ml-2"
          variant="text"
          @click="useCurrentToken"
        >
          使用当前会话令牌
        </v-btn>
      </div>

      <v-alert
        v-if="error"
        type="error"
        variant="tonal"
        class="mt-4"
      >
        {{ error }}
      </v-alert>

      <!-- 未找到 -->
      <v-alert
        v-if="result && !result.found"
        type="warning"
        variant="tonal"
        class="mt-4"
      >
        未找到该令牌（不存在或从未签发）。
      </v-alert>

      <!-- 查询结果 -->
      <v-card v-if="result && result.found" class="mt-4" variant="outlined">
        <v-card-title class="text-subtitle-1 d-flex align-center">
          归属信息
          <v-spacer></v-spacer>
          <v-chip
            :color="statusColor"
            size="small"
            label
          >{{ statusText }}</v-chip>
        </v-card-title>
        <v-card-text>
          <v-table density="comfortable">
            <tbody>
              <tr>
                <td class="font-weight-bold" style="width: 160px;">令牌类型</td>
                <td>
                  <v-chip size="small" label :color="typeColor">{{ typeLabel }}</v-chip>
                </td>
              </tr>
              <tr v-if="result.token_prefix">
                <td class="font-weight-bold">前缀</td>
                <td><code>{{ result.token_prefix }}…</code></td>
              </tr>
              <tr>
                <td class="font-weight-bold">权限范围 (Scopes)</td>
                <td>
                  <template v-if="result.scopes && result.scopes.length">
                    <v-chip
                      v-for="s in result.scopes"
                      :key="s"
                      size="x-small"
                      variant="tonal"
                      color="primary"
                      class="mr-1 mb-1"
                    >{{ s }}</v-chip>
                  </template>
                  <span v-else class="text-grey">无</span>
                </td>
              </tr>
              <tr>
                <td class="font-weight-bold">过期时间</td>
                <td>{{ result.expires_at ? formatDate(result.expires_at) : '永不过期' }}</td>
              </tr>
              <tr>
                <td class="font-weight-bold">创建时间</td>
                <td>{{ formatDate(result.created_at) }}</td>
              </tr>
              <tr>
                <td class="font-weight-bold">最后使用</td>
                <td>{{ result.last_used_at ? formatDate(result.last_used_at) : '从未' }}</td>
              </tr>

              <!-- 敏感字段, 仅 owner/admin 可见 -->
              <template v-if="canSeeOwner">
                <tr>
                  <td class="font-weight-bold">令牌ID</td>
                  <td>{{ result.token_id }}</td>
                </tr>
                <tr v-if="result.name">
                  <td class="font-weight-bold">名称</td>
                  <td>{{ result.name }}</td>
                </tr>
                <tr>
                  <td class="font-weight-bold">归属用户</td>
                  <td>
                    <template v-if="result.user">
                      {{ result.user.display_name }}
                      <span class="text-grey">@{{ result.user.username }} (ID: {{ result.user.id }})</span>
                      <v-chip
                        v-if="result.user.status !== 'active'"
                        size="x-small"
                        color="error"
                        class="ml-2"
                      >{{ result.user.status }}</v-chip>
                    </template>
                    <span v-else class="text-grey">未知</span>
                  </td>
                </tr>
                <tr v-if="result.application">
                  <td class="font-weight-bold">OAuth 应用</td>
                  <td>
                    {{ result.application.name }}
                    <span class="text-grey">(client_id: {{ result.application.client_id }})</span>
                  </td>
                </tr>
                <tr>
                  <td class="font-weight-bold">最后使用 IP</td>
                  <td>{{ result.last_used_ip || '无' }}</td>
                </tr>
                <tr>
                  <td class="font-weight-bold">活动次数</td>
                  <td>{{ result.activity_count }}</td>
                </tr>
              </template>
            </tbody>
          </v-table>

          <v-alert
            v-if="!canSeeOwner"
            type="info"
            variant="tonal"
            density="compact"
            class="mt-3"
          >
            该令牌不属于你本人，归属用户等敏感信息已隐藏。
          </v-alert>
        </v-card-text>
      </v-card>
    </v-card>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { introspectToken } from "@/services/tokenService";
import { localuser } from "@/services/localAccount";

const tokenInput = ref("");
const loading = ref(false);
const error = ref("");
const result = ref(null);

const canSeeOwner = computed(() => result.value && !!result.value.user);

const statusText = computed(() => {
  if (!result.value) return "";
  if (result.value.revoked) return "已吊销";
  if (result.value.expired) return "已过期";
  return result.value.active ? "有效" : "无效";
});
const statusColor = computed(() => {
  if (!result.value) return "grey";
  if (result.value.active) return "success";
  if (result.value.revoked) return "error";
  if (result.value.expired) return "warning";
  return "grey";
});

const typeLabels = { session: "登录会话", personal: "个人API令牌", oauth: "OAuth授权" };
const typeLabel = computed(() => typeLabels[result.value?.type] || result.value?.type || "未知");
const typeColor = computed(() => {
  switch (result.value?.type) {
    case "session": return "blue";
    case "personal": return "teal";
    case "oauth": return "purple";
    default: return "grey";
  }
});

function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleString("zh-CN");
}

function useCurrentToken() {
  const t = localuser.getToken && localuser.getToken();
  if (t) {
    tokenInput.value = t;
  } else {
    error.value = "当前未登录或无法读取会话令牌";
  }
}

async function introspect() {
  loading.value = true;
  error.value = "";
  result.value = null;
  try {
    const response = await introspectToken(tokenInput.value.trim());
    result.value = response.data.data;
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || "查询失败";
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.introspect-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 16px;
}
code {
  background-color: rgb(var(--v-theme-surface-variant));
  padding: 2px 6px;
  border-radius: 4px;
}
</style>
