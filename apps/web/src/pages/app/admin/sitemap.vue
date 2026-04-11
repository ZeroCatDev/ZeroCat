<template>
  <v-container fluid>
    <v-card>
      <v-card-title class="d-flex align-center">
        <span>站点地图管理</span>
        <v-spacer></v-spacer>
        <v-btn
          :loading="loading"
          color="primary"
          prepend-icon="mdi-refresh"
          @click="loadStatus"
        >
          刷新
        </v-btn>
      </v-card-title>

      <v-card-text>
        <v-row>
          <v-col cols="12" md="6">
            <!-- 设置卡片 -->
            <v-card variant="outlined">
              <v-card-title>基本设置</v-card-title>
              <v-card-text>
                <v-switch
                  v-model="settings.enabled"
                  :disabled="loading"
                  label="启用站点地图"
                  @change="saveSettings"
                ></v-switch>
                <v-switch
                  v-model="settings.autoUpdate"
                  :disabled="loading || !settings.enabled"
                  label="启用自动更新"
                  @change="saveSettings"
                ></v-switch>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" md="6">
            <!-- 状态卡片 -->
            <v-card variant="outlined">
              <v-card-title>当前状态</v-card-title>
              <v-card-text>
                <v-list>
                  <v-list-item>
                    <template v-slot:prepend>
                      <v-icon :color="status.isGenerating ? 'warning' : 'success'">
                        {{ status.isGenerating ? 'mdi-cog-sync' : 'mdi-check-circle' }}
                      </v-icon>
                    </template>
                    <v-list-item-title>生成状态</v-list-item-title>
                    <v-list-item-subtitle>
                      {{ status.isGenerating ? '正在生成中' : '空闲' }}
                    </v-list-item-subtitle>
                  </v-list-item>

                  <v-list-item>
                    <template v-slot:prepend>
                      <v-icon>mdi-clock-outline</v-icon>
                    </template>
                    <v-list-item-title>最后全量更新</v-list-item-title>
                    <v-list-item-subtitle>
                      {{ status.lastFullUpdate || '从未更新' }}
                    </v-list-item-subtitle>
                  </v-list-item>

                  <v-list-item>
                    <template v-slot:prepend>
                      <v-icon>mdi-clock-outline</v-icon>
                    </template>
                    <v-list-item-title>最后增量更新</v-list-item-title>
                    <v-list-item-subtitle>
                      {{ status.lastIncrementalUpdate || '从未更新' }}
                    </v-list-item-subtitle>
                  </v-list-item>

                  <v-list-item>
                    <template v-slot:prepend>
                      <v-icon>mdi-file-document-outline</v-icon>
                    </template>
                    <v-list-item-title>当前文件哈希</v-list-item-title>
                    <v-list-item-subtitle class="text-truncate">
                      {{ status.currentFileHash || '无' }}
                    </v-list-item-subtitle>
                  </v-list-item>
                </v-list>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- 操作按钮 -->
        <v-row class="mt-4">
          <v-col>
            <v-card variant="outlined">
              <v-card-title>手动生成</v-card-title>
              <v-card-text>
                <v-btn
                  :disabled="!settings.enabled || status.isGenerating"
                  :loading="generating"
                  class="mr-2"
                  color="primary"
                  prepend-icon="mdi-refresh"
                  @click="generateSitemap('full')"
                >
                  全量生成
                </v-btn>
                <v-btn
                  :disabled="!settings.enabled || status.isGenerating"
                  :loading="generating"
                  prepend-icon="mdi-refresh"
                  @click="generateSitemap('incremental')"
                >
                  增量更新
                </v-btn>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- 提示消息 -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="3000"
    >
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>

<script>
import axios from '@/axios/axios'

export default {
  name: 'SitemapPage',
  data() {
    return {
      loading: false,
      generating: false,
      settings: {
        enabled: false,
        autoUpdate: false
      },
      status: {
        enabled: false,
        autoUpdate: false,
        updateCron: '',
        currentFileHash: '',
        lastFullUpdate: '',
        lastIncrementalUpdate: '',
        isGenerating: false,
        isTaskScheduled: false
      },
      snackbar: {
        show: false,
        text: '',
        color: 'success'
      }
    }
  },
  methods: {
    async loadStatus() {
      this.loading = true
      try {
        const response = await axios.get('/admin/sitemap/status')
        if (response.status === 200 && response.data.status === 'success') {
          const data = response.data.data
          this.status = data
          this.settings.enabled = data.enabled
          this.settings.autoUpdate = data.autoUpdate
        }
      } catch (error) {
        this.showError('加载状态失败')
      }
      this.loading = false
    },

    async saveSettings() {
      this.loading = true
      try {
        const response = await axios.post('/admin/sitemap/settings', {
          enabled: this.settings.enabled,
          autoUpdate: this.settings.autoUpdate
        })
        if (response.status === 200 && response.data.status === 'success') {
          this.showSuccess('设置已更新')
          this.loadStatus()
        }
      } catch (error) {
        this.showError('保存设置失败')
        // 回滚设置
        this.loadStatus()
      }
      this.loading = false
    },

    async generateSitemap(type) {
      this.generating = true
      try {
        const response = await axios.post('/admin/sitemap/generate', {type})
        if (response.status === 200 && response.data.status === 'success') {
          this.showSuccess('站点地图生成成功')
          this.loadStatus()
        }
      } catch (error) {
        this.showError('生成站点地图失败')
      }
      this.generating = false
    },

    showSuccess(text) {
      this.snackbar = {
        show: true,
        text,
        color: 'success'
      }
    },

    showError(text) {
      this.snackbar = {
        show: true,
        text,
        color: 'error'
      }
    }
  },
  mounted() {
    this.loadStatus()
  }
}
</script>


<style scoped>
.v-card {
  margin-bottom: 16px;
}
</style>
