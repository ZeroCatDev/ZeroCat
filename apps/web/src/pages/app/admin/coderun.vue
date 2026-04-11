<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title class="d-flex align-center">
            CodeRun 设备管理
            <v-spacer></v-spacer>
            <v-btn
              :loading="loading"
              color="primary"
              @click="refreshDevices"
            >
              <v-icon left>mdi-refresh</v-icon>
              刷新
            </v-btn>
            <v-btn
              :loading="loading"
              class="ml-2"
              color="error"
              @click="confirmDeleteInactive"
            >
              <v-icon left>mdi-delete-sweep</v-icon>
              删除所有不活跃设备
            </v-btn>
          </v-card-title>

          <!-- 设备列表表格 -->
          <v-data-table
            :headers="headers"
            :items="devices"
            :items-per-page="10"
            :loading="loading"
            class="elevation-1"
          >
            <!-- 状态列 -->
            <template v-slot:item.status="{ item }">
              <v-chip
                :color="getStatusColor(item.status)"
                small
              >
                {{ item.status }}
              </v-chip>
            </template>

            <!-- 最后报告时间列 -->
            <template v-slot:item.last_report="{ item }">
              {{ formatDateTime(item.last_report) }}
            </template>

            <!-- 操作列 -->
            <template v-slot:item.actions="{ item }">
              <v-btn
                icon
                small
                @click="openDeviceDetails(item)"
              >
                <v-icon>mdi-eye</v-icon>
              </v-btn>
              <v-btn
                icon
                small
                @click="openDeviceConfig(item)"
              >
                <v-icon>mdi-cog</v-icon>
              </v-btn>
              <v-btn
                color="error"
                icon
                small
                @click="confirmDelete(item)"
              >
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- 设备详情对话框 -->
    <v-dialog
      v-model="detailsDialog"
      max-width="800px"
    >
      <v-card v-if="selectedDevice">
        <v-card-title>
          设备详情: {{ selectedDevice.device_name }}
          <v-spacer></v-spacer>
          <v-btn
            icon
            @click="detailsDialog = false"
          >
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-card-text>
          <v-tabs v-model="activeTab">
            <v-tab value="basic-info">基本信息</v-tab>
            <v-tab value="docker-info">Docker 信息</v-tab>
            <v-tab value="system-info">系统信息</v-tab>
            <v-tab value="runtime-info">运行时信息</v-tab>
          </v-tabs>
          <v-tabs-window v-model="activeTab">
            <!-- 基本信息 -->
            <v-tabs-window-item value="basic-info">
              <v-list>
                <v-list-item>
                  <v-list-item-content>
                    <v-list-item-title>设备 ID</v-list-item-title>
                    <v-list-item-subtitle>{{ selectedDevice.id }}</v-list-item-subtitle>
                  </v-list-item-content>
                </v-list-item>
                <v-list-item>
                  <v-list-item-content>
                    <v-list-item-title>设备名称</v-list-item-title>
                    <v-list-item-subtitle>{{ selectedDevice.device_name }}</v-list-item-subtitle>
                  </v-list-item-content>
                </v-list-item>
                <v-list-item>
                  <v-list-item-content>
                    <v-list-item-title>状态</v-list-item-title>
                    <v-list-item-subtitle>
                      <v-chip :color="getStatusColor(selectedDevice.status)" small>
                        {{ selectedDevice.status }}
                      </v-chip>
                    </v-list-item-subtitle>
                  </v-list-item-content>
                </v-list-item>
                <v-list-item>
                  <v-list-item-content>
                    <v-list-item-title>创建时间</v-list-item-title>
                    <v-list-item-subtitle>{{ formatDateTime(selectedDevice.created_at) }}</v-list-item-subtitle>
                  </v-list-item-content>
                </v-list-item>
                <v-list-item>
                  <v-list-item-content>
                    <v-list-item-title>最后更新</v-list-item-title>
                    <v-list-item-subtitle>{{ formatDateTime(selectedDevice.updated_at) }}</v-list-item-subtitle>
                  </v-list-item-content>
                </v-list-item>
                <v-list-item>
                  <v-list-item-content>
                    <v-list-item-title>最后报告</v-list-item-title>
                    <v-list-item-subtitle>{{ formatDateTime(selectedDevice.last_report) }}</v-list-item-subtitle>
                  </v-list-item-content>
                </v-list-item>
              </v-list>
            </v-tabs-window-item>
            <!-- Docker 信息 -->
            <v-tabs-window-item value="docker-info">
              <v-card-text>
                <pre>{{ JSON.stringify(selectedDevice.docker_info, null, 2) }}</pre>
              </v-card-text>
            </v-tabs-window-item>
            <!-- 系统信息 -->
            <v-tabs-window-item value="system-info">
              <v-card-text>
                <pre>{{ JSON.stringify(selectedDevice.system_info, null, 2) }}</pre>
              </v-card-text>
            </v-tabs-window-item>
            <!-- 运行时信息 -->
            <v-tabs-window-item value="runtime-info">
              <v-card-text>
                <pre>{{ JSON.stringify(selectedDevice.coderun_info, null, 2) }}</pre>
              </v-card-text>
            </v-tabs-window-item>
          </v-tabs-window>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- 设备配置对话框 -->
    <v-dialog
      v-model="configDialog"
      max-width="600px"
    >
      <v-card v-if="selectedDevice">
        <v-card-title>
          设备配置: {{ selectedDevice.device_name }}
          <v-spacer></v-spacer>
          <v-btn
            icon
            @click="configDialog = false"
          >
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-card-text>
          <v-form ref="configForm">
            <v-text-field
              v-model="editConfig.device_name"
              label="设备名称"
              required
            ></v-text-field>
            <v-text-field
              v-model="editConfig.request_url"
              label="请求 URL"
              required
            ></v-text-field>
            <v-select
              v-model="editConfig.status"
              :items="statusOptions"
              label="状态"
              required
            ></v-select>
            <v-textarea
              v-model="editConfig.device_config"
              :rules="[validateJson]"
              label="设备配置 (JSON)"
              rows="10"
            ></v-textarea>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            :loading="saving"
            color="primary"
            @click="saveDeviceConfig"
          >
            保存
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 删除确认对话框 -->
    <v-dialog
      v-model="deleteDialog"
      max-width="400px"
    >
      <v-card>
        <v-card-title>确认删除</v-card-title>
        <v-card-text>
          确定要删除设备 "{{ selectedDevice?.device_name }}" 吗？此操作无法撤销。
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            text
            @click="deleteDialog = false"
          >
            取消
          </v-btn>
          <v-btn
            :loading="deleting"
            color="error"
            @click="deleteDevice"
          >
            删除
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 删除所有不活跃设备确认对话框 -->
    <v-dialog
      v-model="deleteInactiveDialog"
      max-width="400px"
    >
      <v-card>
        <v-card-title>确认批量删除</v-card-title>
        <v-card-text>
          确定要删除所有不活跃的设备吗？此操作无法撤销。
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            text
            @click="deleteInactiveDialog = false"
          >
            取消
          </v-btn>
          <v-btn
            :loading="deletingInactive"
            color="error"
            @click="deleteAllInactive"
          >
            删除
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script>
import {ref, onMounted} from 'vue'
import axios from '@/axios/axios'

export default {
  name: 'CodeRunAdmin',
  setup() {
    // 数据
    const devices = ref([])
    const loading = ref(false)
    const selectedDevice = ref(null)
    const detailsDialog = ref(false)
    const configDialog = ref(false)
    const deleteDialog = ref(false)
    const deleteInactiveDialog = ref(false) // New dialog for deleting all inactive
    const activeTab = ref(0)
    const saving = ref(false)
    const deleting = ref(false)
    const deletingInactive = ref(false) // New loading state for deleting all inactive
    const editConfig = ref({
      device_name: '',
      request_url: '',
      status: '',
      device_config: ''
    })

    // 表格列定义
    const headers = [
      {title: '设备名称', value: 'device_name'},
      {title: '设备ID', value: 'id'},
      {title: '请求地址', value: 'request_url'},
      {title: '状态', value: 'status'},
      {title: '最后报告', value: 'last_report'},
      {title: '操作', value: 'actions', sortable: false}
    ]

    // 状态选项
    const statusOptions = ['active', 'inactive', 'error']

    // 方法
    const refreshDevices = async () => {
      loading.value = true
      try {
        const response = await axios.get('/admin/coderun/devices')
        if (response.data.success) {
          devices.value = response.data.devices
        }
      } catch (error) {
        console.error('Failed to fetch devices:', error)
      } finally {
        loading.value = false
      }
    }

    const openDeviceDetails = (device) => {
      selectedDevice.value = device
      detailsDialog.value = true
    }

    const openDeviceConfig = (device) => {
      selectedDevice.value = device
      editConfig.value = {
        device_name: device.device_name || '',
        request_url: device.request_url || '',
        status: device.status || 'active',
        device_config: JSON.stringify(device.device_config || {}, null, 2)
      }
      configDialog.value = true
    }

    const confirmDelete = (device) => {
      selectedDevice.value = device
      deleteDialog.value = true
    }

    const confirmDeleteInactive = () => {
      deleteInactiveDialog.value = true
    }

    const saveDeviceConfig = async () => {
      saving.value = true
      try {
        const config = {
          ...editConfig.value,
          device_config: JSON.parse(editConfig.value.device_config)
        }
        const response = await axios.put(`/admin/coderun/devices/${selectedDevice.value.id}`, config)
        if (response.data.success) {
          await refreshDevices()
          configDialog.value = false
        }
      } catch (error) {
        console.error('Failed to save device config:', error)
      } finally {
        saving.value = false
      }
    }

    const deleteDevice = async () => {
      deleting.value = true
      try {
        const response = await axios.delete(`/admin/coderun/devices/${selectedDevice.value.id}`)
        if (response.data.success) {
          await refreshDevices()
          deleteDialog.value = false
        }
      } catch (error) {
        console.error('Failed to delete device:', error)
      } finally {
        deleting.value = false
      }
    }

    const deleteAllInactive = async () => {
      deletingInactive.value = true
      try {
        const response = await axios.delete('/admin/coderun/devices/inactive/all')
        if (response.data.success) {
          await refreshDevices()
          deleteInactiveDialog.value = false
        }
      } catch (error) {
        console.error('Failed to delete all inactive devices:', error)
      } finally {
        deletingInactive.value = false
      }
    }

    const getStatusColor = (status) => {
      switch (status) {
        case 'active':
          return 'success'
        case 'error':
          return 'error'
        default:
          return 'warning'
      }
    }

    const formatDateTime = (datetime) => {
      if (!datetime) return '未知'
      return new Date(datetime).toLocaleString()
    }

    const validateJson = (value) => {
      try {
        if (!value) return true
        JSON.parse(value)
        return true
      } catch (e) {
        return '请输入有效的 JSON 格式'
      }
    }

    // 生命周期
    onMounted(() => {
      refreshDevices()
    })

    return {
      // 数据
      devices,
      loading,
      headers,
      selectedDevice,
      detailsDialog,
      configDialog,
      deleteDialog,
      deleteInactiveDialog, // New data property
      activeTab,
      editConfig,
      statusOptions,
      saving,
      deleting,
      deletingInactive, // New data property

      // 方法
      refreshDevices,
      openDeviceDetails,
      openDeviceConfig,
      confirmDelete,
      confirmDeleteInactive, // New method
      saveDeviceConfig,
      deleteDevice,
      deleteAllInactive, // New method
      getStatusColor,
      formatDateTime,
      validateJson
    }
  }
}
</script>

<style scoped>
pre {
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
