<template>
  <div>
    <!-- 创建新令牌 -->
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
              <v-btn
                :disabled="!createFormValid || creating"
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

    <!-- 令牌列表 -->
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
                  :color="token.is_revoked ? 'error' : 'success'"
                  :icon="token.is_revoked ? 'mdi-key-off' : 'mdi-key'"
                ></v-icon>
              </template>

              <v-list-item-title>
                {{ token.name }}
                <v-chip
                  v-if="token.is_revoked"
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
                  <span>创建时间：{{ formatDate(token.created_at) }}</span>
                  <span v-if="token.expires_at">
                    过期时间：{{ formatDate(token.expires_at) }}
                  </span>
                  <span v-if="token.last_used_at">
                    最后使用：{{ formatDate(token.last_used_at) }}
                    <span v-if="token.last_used_ip" class="text-grey">
                      ({{ token.last_used_ip }})
                    </span>
                  </span>
                </div>
              </v-list-item-subtitle>

              <template v-slot:append>
                <v-menu>
                  <template v-slot:activator="{ props }">
                    <v-btn
                      icon="mdi-dots-vertical"
                      variant="text"
                      v-bind="props"
                    ></v-btn>
                  </template>
                  <v-list>
                    <v-list-item
                      v-if="!token.is_revoked"
                      @click="revokeToken(token.id)"
                    >
                      <template v-slot:prepend>
                        <v-icon>mdi-key-off</v-icon>
                      </template>
                      <v-list-item-title>吊销令牌</v-list-item-title>
                    </v-list-item>
                    <v-list-item
                      @click="deleteToken(token.id)"
                      color="error"
                    >
                      <template v-slot:prepend>
                        <v-icon>mdi-delete</v-icon>
                      </template>
                      <v-list-item-title>删除令牌</v-list-item-title>
                    </v-list-item>
                  </v-list>
                </v-menu>
              </template>
            </v-list-item>
          </v-list>
        </div>
      </v-card-text>
    </v-card>

    <!-- 新令牌对话框 -->
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

    <!-- 确认对话框 -->
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
  createAccountToken,
  getAccountTokens,
  deleteAccountToken,
  revokeAccountToken,
} from "@/services/accountTokenService";
import { useSudoManager } from '@/composables/useSudoManager';

export default {
  name: "TokenManager",
  data() {
    return {
      loading: false,
      creating: false,
      tokens: [],
      createFormValid: false,
      createForm: {
        name: "",
        expires_in: 86400, // 默认24小时
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
  async mounted() {
    await this.loadTokens();
  },
  methods: {
    async loadTokens() {
      this.loading = true;
      try {
        const response = await getAccountTokens();
        this.tokens = response.data.data || [];
      } catch (error) {
        this.$emit("error", error);
      } finally {
        this.loading = false;
      }
    },

    async createToken() {
      this.creating = true;
      try {
        const sudoToken = await this.sudoManager.requireSudo({
          title: '创建令牌',
          subtitle: '创建个人访问令牌是一个敏感操作，需要验证您的身份。',
          persistent: true
        });

        const response = await createAccountToken(this.createForm, sudoToken);
        this.newToken = response.data.data.token;
        this.showNewTokenDialog = true;

        // 重置表单
        this.createForm.name = "";
        this.createForm.expires_in = 86400;

        // 重新加载令牌列表
        await this.loadTokens();

        this.$emit("token-created", response);
      } catch (error) {
        if (error.type !== 'cancel') {
          this.$emit("error", error);
        }
      } finally {
        this.creating = false;
      }
    },

    async deleteToken(id) {
      this.confirmDialog = {
        show: true,
        title: "删除令牌",
        message: "确定要删除这个令牌吗？此操作不可撤销。",
        color: "error",
        confirmText: "删除",
        callback: async () => {
          try {
            await deleteAccountToken(id);
            await this.loadTokens();
            this.$emit("token-deleted", { id });
          } catch (error) {
            this.$emit("error", error);
          }
        }
      };
    },

    async revokeToken(id) {
      this.confirmDialog = {
        show: true,
        title: "吊销令牌",
        message: "确定要吊销这个令牌吗？吊销后令牌将无法使用。",
        color: "warning",
        confirmText: "吊销",
        callback: async () => {
          try {
            await revokeAccountToken(id);
            await this.loadTokens();
            this.$emit("token-revoked", { id });
          } catch (error) {
            this.$emit("error", error);
          }
        }
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
      if (token.is_revoked) return false;
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
</style>
