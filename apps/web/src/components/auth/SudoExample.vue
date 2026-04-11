<!--
  Sudo管理系统使用示例

  这个文件展示了如何在Vue组件中使用sudo认证系统
  包括基本用法、高级用法和最佳实践
-->

<template>
  <div class="sudo-example">
    <v-container>
      <h2>Sudo管理系统使用示例</h2>

      <!-- 基本用法示例 -->
      <v-card class="mb-4">
        <v-card-title>基本用法</v-card-title>
        <v-card-text>
          <v-btn
            @click="basicSudoExample"
            color="primary"
            :loading="loading.basic"
            class="mr-2"
          >
            需要Sudo认证的操作
          </v-btn>

          <v-btn
            @click="checkSudoStatus"
            color="info"
            class="mr-2"
          >
            检查Sudo状态
          </v-btn>

          <v-btn
            @click="clearSudoExample"
            color="warning"
          >
            清除Sudo Token
          </v-btn>
        </v-card-text>
      </v-card>

      <!-- HTTP请求示例 -->
      <v-card class="mb-4">
        <v-card-title>HTTP请求集成</v-card-title>
        <v-card-text>
          <v-btn
            @click="sudoApiRequest"
            color="primary"
            :loading="loading.api"
            class="mr-2"
          >
            发送需要Sudo的API请求
          </v-btn>

          <v-btn
            @click="autoSudoRequest"
            color="secondary"
            :loading="loading.auto"
          >
            自动处理Sudo的API请求
          </v-btn>
        </v-card-text>
      </v-card>

      <!-- 状态显示 -->
      <v-card class="mb-4">
        <v-card-title>当前Sudo状态</v-card-title>
        <v-card-text>
          <v-chip
            :color="sudoManager.isTokenValid ? 'success' : 'error'"
            variant="tonal"
            class="mr-2"
          >
            <v-icon :icon="sudoManager.isTokenValid ? 'mdi-shield-check' : 'mdi-shield-off'" class="mr-1" />
            {{ sudoManager.isTokenValid ? '已认证' : '未认证' }}
          </v-chip>

          <v-chip
            v-if="sudoManager.isTokenValid"
            color="info"
            variant="tonal"
          >
            剩余: {{ sudoManager.tokenExpiresIn }}
          </v-chip>

          <v-progress-linear
            v-if="sudoManager.isLoading==true"
            indeterminate
            color="primary"
            class="mt-2"
          />
        </v-card-text>
      </v-card>

      <!-- 结果显示 -->
      <v-card v-if="result">
        <v-card-title>操作结果</v-card-title>
        <v-card-text>
          <pre>{{ result }}</pre>
        </v-card-text>
      </v-card>
    </v-container>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useSudoManager } from '@/composables/useSudoManager';
import axios from '@/axios/axios';

// 使用sudo管理器
const sudoManager = useSudoManager();

// 状态
const loading = reactive({
  basic: false,
  optional: false,
  api: false,
  auto: false
});

const result = ref(null);

// 基本sudo认证示例
const basicSudoExample = async () => {
  loading.basic = true;
  result.value = null;

  try {
    // 请求sudo认证
    const sudoToken = await sudoManager.requireSudo({
      title: '删除重要数据',
      subtitle: '此操作不可逆，请验证您的身份',
      persistent: true  // 用户必须认证，不能取消
    });

    result.value = {
      success: true,
      message: '获取到sudo token',
      token: sudoToken.substring(0, 20) + '...',  // 只显示部分token
      action: '模拟执行了需要sudo权限的操作'
    };

    // 这里可以执行需要sudo权限的操作
    console.log('执行需要sudo权限的操作，token:', sudoToken);

  } catch (error) {
    result.value = {
      success: false,
      message: error.message,
      type: error.type
    };
  } finally {
    loading.basic = false;
  }
};

// 检查sudo状态
const checkSudoStatus = () => {
  result.value = {
    isValid: sudoManager.isSudoValid(),
    token: sudoManager.getSudoToken(),
    expiresIn: sudoManager.tokenExpiresIn,
    expiresAt: sudoManager.expiresAt,
    formattedTime: sudoManager.formatTime(sudoManager.tokenExpiresIn)
  };
};

// 清除sudo token
const clearSudoExample = () => {
  sudoManager.clearSudo();
  result.value = {
    success: true,
    message: 'Sudo token已清除'
  };
};

// 发送需要sudo的API请求
const sudoApiRequest = async () => {
  loading.api = true;
  result.value = null;

  try {
    // 首先确保有sudo token
    const sudoToken = await sudoManager.requireSudo({
      title: 'API操作认证',
      subtitle: '此API调用需要管理员权限'
    });

    // 手动添加sudo token到请求
    const config = sudoManager.addSudoToRequest({
      method: 'delete',
      url: '/admin/users/123',
      data: { reason: '违规操作' }
    });

    // 发送请求（这里模拟）
    console.log('发送带有sudo token的请求:', config);

    result.value = {
      success: true,
      message: '模拟API请求成功',
      requestConfig: config
    };

  } catch (error) {
    result.value = {
      success: false,
      message: error.message
    };
  } finally {
    loading.api = false;
  }
};

// 自动处理sudo的API请求
const autoSudoRequest = async () => {
  loading.auto = true;
  result.value = null;

  try {
    // 使用自动sudo处理的请求
    // 如果服务器返回需要sudo的错误，会自动弹出认证对话框
    const response = await axios({
      method: 'post',
      url: '/admin/settings',
      data: { setting: 'important_config', value: 'new_value' },
      requireSudo: true  // 标记这个请求需要sudo
    });

    result.value = {
      success: true,
      message: '自动处理sudo的API请求成功',
      data: response.data
    };

  } catch (error) {
    result.value = {
      success: false,
      message: error.message,
      details: error.response?.data
    };
  } finally {
    loading.auto = false;
  }
};

// 在组件挂载时设置axios拦截器（如果还未设置）
import { onMounted } from 'vue';

onMounted(() => {
  // 为axios实例添加sudo拦截器
  sudoManager.createSudoInterceptor(axios);
});
</script>
