<template>
  <v-card class="cloud-vars-card">
    <v-card-title class="d-flex justify-space-between align-center">
      <span>{{ editable ? '云变量管理' : '云变量' }}</span>
      <v-chip :color="connected ? 'success' : 'warning'" size="small" variant="tonal">
        {{ connected ? '已连接' : '未连接' }}
      </v-chip>
    </v-card-title>

    <v-card-subtitle class="pt-1">
      项目 ID: {{ projectId || '-' }}
    </v-card-subtitle>

    <v-card-text>
      <div class="d-flex ga-2 mb-3">
        <v-btn
          :disabled="!projectId || connecting"
          :loading="connecting"
          color="primary"
          size="small"
          variant="tonal"
          @click="connect"
        >
          {{ connected ? '重新连接' : '连接' }}
        </v-btn>
        <v-btn
          :disabled="!connected"
          size="small"
          variant="text"
          @click="disconnect"
        >
          断开
        </v-btn>
      </div>

      <v-alert
        v-if="lastError"
        class="mb-3"
        density="compact"
        type="warning"
        variant="tonal"
      >
        {{ lastError }}
      </v-alert>

      <v-table density="compact">
        <thead>
          <tr>
            <th class="text-left">变量名</th>
            <th class="text-left">值</th>
            <th class="text-left">更新时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in variableList" :key="item.name">
            <td>{{ item.name }}</td>
            <td class="value-cell">{{ item.value }}</td>
            <td>{{ item.updatedAtText }}</td>
          </tr>
          <tr v-if="!variableList.length">
            <td colspan="3" class="text-medium-emphasis">暂无云变量</td>
          </tr>
        </tbody>
      </v-table>

      <div v-if="editable" class="mt-4">
        <v-divider class="mb-4" />

        <div class="text-subtitle-2 mb-2">设置/创建变量</div>
        <v-row dense>
          <v-col cols="12" md="5">
            <v-text-field
              v-model.trim="editForm.name"
              hide-details
              label="变量名（☁ name）"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" md="5">
            <v-text-field
              v-model="editForm.value"
              hide-details
              label="变量值"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" md="2">
            <v-btn
              block
              color="primary"
              :disabled="!connected"
              @click="handleSet"
            >
              保存
            </v-btn>
          </v-col>
        </v-row>

        <div class="text-subtitle-2 mt-4 mb-2">重命名变量</div>
        <v-row dense>
          <v-col cols="12" md="5">
            <v-text-field
              v-model.trim="renameForm.name"
              hide-details
              label="原变量名"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" md="5">
            <v-text-field
              v-model.trim="renameForm.newName"
              hide-details
              label="新变量名"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" md="2">
            <v-btn
              block
              color="primary"
              :disabled="!connected"
              @click="handleRename"
            >
              重命名
            </v-btn>
          </v-col>
        </v-row>

        <div class="text-subtitle-2 mt-4 mb-2">删除变量</div>
        <v-row dense>
          <v-col cols="12" md="10">
            <v-text-field
              v-model.trim="deleteName"
              hide-details
              label="变量名"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" md="2">
            <v-btn
              block
              color="error"
              :disabled="!connected"
              @click="handleDelete"
            >
              删除
            </v-btn>
          </v-col>
        </v-row>
      </div>
    </v-card-text>
  </v-card>
</template>

<script>
import { localuser } from '@/services/localAccount';

const CLOUD_NAME_RE = /^(☁ |:cloud: ).+/;

export default {
  name: 'CloudVariablesCard',
  emits: ['cloud-updated'],
  props: {
    projectId: {
      type: [String, Number],
      required: true
    },
    editable: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      ws: null,
      connecting: false,
      connected: false,
      lastError: '',
      variables: {},
      editForm: {
        name: '',
        value: ''
      },
      renameForm: {
        name: '',
        newName: ''
      },
      deleteName: '',
      messageBuffer: ''
    };
  },
  computed: {
    variableList() {
      return Object.values(this.variables).sort((a, b) => a.name.localeCompare(b.name));
    },
    currentUsername() {
      return localuser.user.value?.username || 'guest';
    }
  },
  mounted() {
    this.connect();
  },
  beforeUnmount() {
    this.disconnect();
  },
  watch: {
    projectId() {
      this.variables = {};
      this.connect();
    }
  },
  methods: {
    buildWsUrl() {
      const token = localuser.getToken();
      const apiBase = import.meta.env.VITE_APP_BASE_API || window.location.origin;
      const url = new URL('/scratch/cloud/ws', apiBase);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      if (token) {
        url.searchParams.set('token', token);
      }
      return url.toString();
    },
    connect() {
      if (!this.projectId) return;
      this.disconnect();
      this.connecting = true;
      this.lastError = '';

      try {
        const ws = new WebSocket(this.buildWsUrl());
        this.ws = ws;

        ws.onopen = () => {
          this.connecting = false;
          this.connected = true;
          this.send({
            method: 'handshake',
            project_id: String(this.projectId),
            user: this.currentUsername
          });
        };

        ws.onmessage = (event) => {
          this.handleRawMessage(event.data);
        };

        ws.onclose = (event) => {
          this.connecting = false;
          this.connected = false;
          if (event.code && event.code !== 1000) {
            this.lastError = `连接已关闭（code ${event.code}）`;
          }
        };

        ws.onerror = () => {
          this.lastError = '云变量连接失败';
        };
      } catch (error) {
        this.connecting = false;
        this.connected = false;
        this.lastError = error?.message || '连接失败';
      }
    },
    disconnect() {
      if (this.ws) {
        this.ws.close(1000, 'client_close');
        this.ws = null;
      }
      this.connecting = false;
      this.connected = false;
      this.messageBuffer = '';
    },
    handleRawMessage(raw) {
      const chunk = String(raw || '');
      this.messageBuffer += chunk;
      const lines = this.messageBuffer.split('\n');
      this.messageBuffer = lines.pop() || '';
      lines.forEach((line) => this.handleLine(line));
    },
    handleLine(line) {
      const text = String(line || '').trim();
      if (!text) return;

      let payload = null;
      try {
        payload = JSON.parse(text);
      } catch {
        return;
      }

      if (payload.method === 'set' && typeof payload.name === 'string') {
        this.variables[payload.name] = {
          name: payload.name,
          value: payload.value == null ? '' : String(payload.value),
          updatedAtText: new Date().toLocaleTimeString()
        };
      }

      if (payload.method === 'delete' && typeof payload.name === 'string') {
        delete this.variables[payload.name];
      }
    },
    send(payload) {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      this.ws.send(`${JSON.stringify(payload)}\n`);
    },
    normalizeCloudName(name) {
      const n = String(name || '').trim();
      if (!n) return '';
      if (CLOUD_NAME_RE.test(n)) return n;
      return `☁ ${n}`;
    },
    handleSet() {
      const name = this.normalizeCloudName(this.editForm.name);
      const value = String(this.editForm.value ?? '');
      if (!name) return;
      this.send({
        method: 'set',
        name,
        value
      });
      this.editForm.name = name;
      this.variables[name] = {
        name,
        value,
        updatedAtText: new Date().toLocaleTimeString()
      };
      this.notifyCloudUpdate('set');
    },
    handleRename() {
      const name = this.normalizeCloudName(this.renameForm.name);
      const newName = this.normalizeCloudName(this.renameForm.newName);
      if (!name || !newName) return;
      this.send({
        method: 'rename',
        name,
        new_name: newName
      });
      if (this.variables[name]) {
        const value = this.variables[name].value;
        delete this.variables[name];
        this.variables[newName] = {
          name: newName,
          value,
          updatedAtText: new Date().toLocaleTimeString()
        };
      }
      this.renameForm.name = '';
      this.renameForm.newName = '';
      this.notifyCloudUpdate('rename');
    },
    handleDelete() {
      const name = this.normalizeCloudName(this.deleteName);
      if (!name) return;
      this.send({
        method: 'delete',
        name
      });
      delete this.variables[name];
      this.deleteName = '';
      this.notifyCloudUpdate('delete');
    },
    notifyCloudUpdate(method) {
      const detail = {
        projectId: this.projectId,
        method
      };
      this.$emit('cloud-updated', detail);
      window.dispatchEvent(new CustomEvent('cloudVariableUpdated', { detail }));
    }
  }
};
</script>

<style scoped>
.cloud-vars-card {
  width: 100%;
}

.value-cell {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
