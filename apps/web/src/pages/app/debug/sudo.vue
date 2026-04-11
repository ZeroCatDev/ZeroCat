<template><sudo-example></sudo-example>
  <div class="sudo-debug"><SudoManager/>
    <v-container>
      <v-card class="mb-4">
        <v-card-title>Sudo Token 调试页面</v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="6">
              <v-card-subtitle>当前Token状态</v-card-subtitle>
              <v-list>
                <v-list-item>
                  <v-list-item-title>Token 有效性:</v-list-item-title>
                  <v-list-item-subtitle>
                    <v-chip :color="isTokenValid ? 'success' : 'error'">
                      {{ isTokenValid ? '有效' : '无效' }}
                    </v-chip>
                  </v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <v-list-item-title>剩余时间:</v-list-item-title>
                  <v-list-item-subtitle>{{ tokenExpiresIn }}秒</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <v-list-item-title>过期时间:</v-list-item-title>
                  <v-list-item-subtitle>{{ expiresAt ? new Date(expiresAt).toLocaleString() : '无' }}</v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-col>
            <v-col cols="12" md="6">
              <v-card-subtitle>当前Token</v-card-subtitle>
              <v-textarea
                v-model="sudoToken"
                readonly
                label="Sudo Token"
                rows="3"
                class="token-display"
              ></v-textarea>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <v-card class="mb-4">
        <v-card-title>认证测试</v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="6">
              <v-btn
                color="primary"
                class="mb-2 me-2"
                @click="testRequireSudo"
                :loading="isLoading"
              >
                测试认证
              </v-btn>

              <v-btn
                color="error"
                class="mb-2"
                @click="clearSudo"
                :disabled="!isTokenValid"
              >
                清除Token
              </v-btn>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <v-card>
        <v-card-title>API 测试</v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="6">
              <v-btn
                color="info"
                class="mb-2 me-2"
                @click="testApiRequest"
                :loading="isApiLoading"
              >
                测试需要Sudo的API请求
              </v-btn>
            </v-col>
          </v-row>
          <v-alert
            v-if="apiResult"
            :type="apiResult.success ? 'success' : 'error'"
            class="mt-4"
          >
            {{ apiResult.message }}
          </v-alert>
        </v-card-text>
      </v-card>
    </v-container>

    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="3000"
    >
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useSudoManager } from '@/composables/useSudoManager';
import axios from '@/axios/axios';
import SudoExample from '@/components/auth/SudoExample.vue';
const {
  requireSudo,
  isSudoValid,
  clearSudo,
  isLoading,
  tokenExpiresIn,
  sudoToken,
  expiresAt
} = useSudoManager();

const isTokenValid = computed(() => isSudoValid());
const isApiLoading = ref(false);
const apiResult = ref(null);

const snackbar = ref({
  show: false,
  text: '',
  color: 'success'
});

const showMessage = (text, success = true) => {
  snackbar.value = {
    show: true,
    text,
    color: success ? 'success' : 'error'
  };
};

const testRequireSudo = async () => {
  try {
    const token = await requireSudo({
      title: '测试强制认证',
      subtitle: '这是一个测试用的强制认证对话框',
      persistent: true
    });
    showMessage('强制认证成功！');
  } catch (error) {
    showMessage(error.message || '认证失败', false);
  }
};


const testApiRequest = async () => {
  isApiLoading.value = true;
  apiResult.value = null;

  try {
    const response = await axios({
      method: 'get',
      url: '/api/admin/test',
      requireSudo: true // 标记需要sudo认证
    });

    apiResult.value = {
      success: true,
      message: '请求成功！响应数据：' + JSON.stringify(response.data)
    };
  } catch (error) {
    apiResult.value = {
      success: false,
      message: '请求失败：' + (error.response?.data?.message || error.message)
    };
  } finally {
    isApiLoading.value = false;
  }
};
</script>

<style scoped>
.token-display {
  font-family: monospace;
  background-color: rgba(0, 0, 0, 0.05);
}
</style>
