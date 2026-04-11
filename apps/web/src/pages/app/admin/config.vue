<template>
  <v-container fluid>
    <v-card>
      <v-card-title class="d-flex align-center">
        <span>系统配置</span>
        <v-spacer></v-spacer>
        <v-text-field
          v-model="searchQuery"
          class="mr-4"
          clearable
          density="compact"
          hide-details
          label="搜索配置项"
          placeholder="输入名称或键名搜索"
          prepend-icon="mdi-magnify"
          style="max-width: 300px"
          variant="outlined"
        ></v-text-field>
        <v-btn class="mr-2" prepend-icon="mdi-reload" variant="tonal" @click="reload"> 重载配置</v-btn>
        <v-btn
          :loading="loading"
          color="primary"
          prepend-icon="mdi-refresh"
          @click="loadConfigs"
        >
          刷新
        </v-btn>
      </v-card-title>

      <v-card-text>
        <config-item-group
          :configs="filteredConfigs"
          @save-error="handleSaveError"
        />
      </v-card-text>
    </v-card>

    <!-- 保存错误提示 -->
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
import ConfigItemGroup from '@/components/admin/ConfigItemGroup.vue'
import axios from '@/axios/axios'

export default {
  name: 'ConfigPage',
  components: {
    ConfigItemGroup
  },
  data() {
    return {
      loading: false,
      configs: [],
      searchQuery: '',
      snackbar: {
        show: false,
        text: '',
        color: 'success'
      }
    }
  },
  computed: {
    filteredConfigs() {
      if (!this.searchQuery) return this.configs

      const query = this.searchQuery.toLowerCase()
      return this.configs.filter(config =>
        config.key.toLowerCase().includes(query) ||
        (config.description && config.description.toLowerCase().includes(query))
      )
    }
  },
  methods: {
    async loadConfigs() {
      this.loading = true
      try {
        const unified = await axios.get('/admin/config/unified')
        if (unified.status === 200) {
          this.configs = unified.data.configs
        }
      } catch (error) {
        this.showError('加载配置失败')
      }
      this.loading = false
    },

    handleSaveError(key) {
      const config = this.configs.find(c => c.key === key)
      this.showError(`保存 ${config?.description || key} 失败`)
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
    },

    reload() {
      axios.get('/api/admin/config/reload').then(res => {
        if (res.status === 200) {
          this.showSuccess('重载配置成功')
        }
      })
    }
  },
  mounted() {
    this.loadConfigs()
  }
}
</script>


<style scoped>
.v-card {
  margin-bottom: 24px;
}
</style>
