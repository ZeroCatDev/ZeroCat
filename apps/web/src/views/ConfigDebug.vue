<template>
  <div class="config-debug">
    <h2>配置调试页面</h2>

    <div class="card">
      <div class="card-header">
        <h3>当前配置信息</h3>
        <span v-if="lastUpdateTime" class="last-update">
          最后更新: {{ formatTime(lastUpdateTime) }}
        </span>
      </div>

      <div class="config-content">
        <pre>{{ JSON.stringify(currentConfig, null, 2) }}</pre>
      </div>

      <div class="actions">
        <button :disabled="isRefreshing" class="refresh-btn" @click="handleRefresh">
          {{ isRefreshing ? '刷新中...' : '手动刷新' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import {ref, onMounted} from 'vue';
import config, {getConfig, refreshConfig} from '@/services/serverConfig';

export default {
  name: 'ConfigDebug',
  setup() {
    const currentConfig = ref(config);
    const lastUpdateTime = ref(null);
    const isRefreshing = ref(false);

    const updateConfigDisplay = () => {
      currentConfig.value = getConfig();
      lastUpdateTime.value = Date.now();
    };

    const handleRefresh = async () => {
      isRefreshing.value = true;
      try {
        await refreshConfig();
        updateConfigDisplay();
      } catch (error) {
        console.error('刷新配置失败:', error);
        alert('刷新配置失败，请查看控制台了解详情');
      } finally {
        isRefreshing.value = false;
      }
    };

    const formatTime = (timestamp) => {
      if (!timestamp) return '';
      const date = new Date(timestamp);
      return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    };

    onMounted(() => {
      updateConfigDisplay();
    });

    return {
      currentConfig,
      lastUpdateTime,
      isRefreshing,
      handleRefresh,
      formatTime,
    };
  },
};
</script>

<style scoped>
.config-debug {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.card-header h3 {
  margin: 0;
  color: #333;
}

.last-update {
  color: #666;
  font-size: 0.9em;
}

.config-content {
  background: #f5f5f5;
  border-radius: 4px;
  padding: 15px;
  margin-bottom: 20px;
}

.config-content pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.actions {
  display: flex;
  justify-content: flex-end;
}

.refresh-btn {
  background: #4CAF50;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
}

.refresh-btn:hover {
  background: #45a049;
}

.refresh-btn:disabled {
  background: #cccccc;
  cursor: not-allowed;
}
</style>
