<template>
  <!-- Actions -->
  <v-card variant="flat" border class="mb-5">
    <v-card-text class="pa-5">
      <div class="d-flex align-center mb-4">
        <v-avatar size="32" color="deep-purple" variant="tonal" class="mr-3">
          <v-icon size="16" color="deep-purple">mdi-database-sync-outline</v-icon>
        </v-avatar>
        <div class="text-subtitle-1 font-weight-bold">操作</div>
      </div>
      <div class="d-flex ga-3 flex-wrap">
        <v-btn
          color="primary"
          prepend-icon="mdi-export"
          :loading="exporting"
          class="text-none"
          @click="doExport"
        >
          导出数据
        </v-btn>
        <v-btn
          color="secondary"
          prepend-icon="mdi-import"
          variant="tonal"
          class="text-none"
          @click="importDialog = true"
        >
          导入数据
        </v-btn>
      </div>
    </v-card-text>
  </v-card>

  <!-- Task List -->
  <v-card variant="flat" border class="mb-5">
    <v-card-text class="pa-5">
      <div class="d-flex align-center mb-4">
        <v-avatar size="32" color="info" variant="tonal" class="mr-3">
          <v-icon size="16" color="info">mdi-format-list-checks</v-icon>
        </v-avatar>
        <div class="text-subtitle-1 font-weight-bold">任务列表</div>
        <v-spacer />
        <v-btn
          icon="mdi-refresh"
          size="small"
          variant="text"
          :loading="loadingTasks"
          @click="fetchTasks"
        />
      </div>

      <v-skeleton-loader v-if="loadingTasks && !tasks.length" type="table-row@3" />

      <div v-else-if="!tasks.length" class="text-center text-medium-emphasis py-6">
        暂无任务
      </div>

      <v-table v-else density="compact">
        <thead>
          <tr>
            <th>类型</th>
            <th>状态</th>
            <th>进度</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="task in tasks" :key="task.id">
            <td>
              <v-chip
                :color="task.type === 'export' ? 'primary' : 'secondary'"
                size="small"
                variant="tonal"
              >
                {{ task.type === 'export' ? '导出' : '导入' }}
              </v-chip>
            </td>
            <td>
              <v-chip
                :color="statusColor(task.status)"
                size="small"
                variant="flat"
              >
                {{ statusLabel(task.status) }}
              </v-chip>
            </td>
            <td style="min-width: 120px">
              <v-progress-linear
                v-if="task.status === 'processing'"
                :model-value="task.progress || 0"
                color="primary"
                height="6"
                rounded
              />
              <span v-else class="text-caption text-medium-emphasis">--</span>
            </td>
            <td class="text-caption">
              {{ formatDate(task.created_at) }}
            </td>
            <td>
              <v-btn
                v-if="task.status === 'completed' && task.type === 'export'"
                icon="mdi-download"
                size="small"
                variant="text"
                color="primary"
                :loading="downloadingId === task.id"
                @click="doDownload(task.id)"
              />
              <v-btn
                v-if="task.status === 'failed'"
                icon="mdi-alert-circle-outline"
                size="small"
                variant="text"
                color="error"
                @click="showError(task)"
              />
              <v-btn
                v-if="task.status === 'completed' && task.result"
                icon="mdi-information-outline"
                size="small"
                variant="text"
                color="info"
                @click="showResult(task)"
              />
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card-text>
  </v-card>

  <!-- Import Dialog -->
  <v-dialog v-model="importDialog" max-width="520">
    <v-card border>
      <v-card-text class="pa-6">
        <div class="d-flex align-center mb-4">
          <v-avatar size="40" color="secondary" variant="tonal" class="mr-3">
            <v-icon color="secondary">mdi-import</v-icon>
          </v-avatar>
          <div class="text-h6 font-weight-bold">导入数据</div>
        </div>

        <v-file-input
          v-model="importFile"
          label="选择 JSON 文件"
          variant="solo-filled"
          flat
          density="comfortable"
          accept=".json"
          prepend-icon=""
          prepend-inner-icon="mdi-code-json"
          class="mb-3"
          @update:model-value="onFileChange"
        />

        <v-alert
          v-if="importError"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-3"
        >
          {{ importError }}
        </v-alert>

        <template v-if="importPreview">
          <v-alert type="info" variant="tonal" density="compact" class="mb-3">
            <div class="text-body-2">
              共 {{ importPreview.count }} 条记录
            </div>
          </v-alert>
        </template>
      </v-card-text>
      <v-card-actions class="px-6 pb-5">
        <v-spacer />
        <v-btn variant="text" class="text-none" @click="closeImportDialog">取消</v-btn>
        <v-btn
          color="primary"
          class="text-none"
          :disabled="!importPreview"
          :loading="importing"
          @click="doImport"
        >
          确认导入
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Error Detail Dialog -->
  <v-dialog v-model="errorDialog" max-width="480">
    <v-card border>
      <v-card-text class="pa-6">
        <div class="d-flex align-center mb-4">
          <v-avatar size="40" color="error" variant="tonal" class="mr-3">
            <v-icon color="error">mdi-alert-circle-outline</v-icon>
          </v-avatar>
          <div class="text-h6 font-weight-bold">错误详情</div>
        </div>
        <div class="text-body-2" style="white-space: pre-wrap; word-break: break-word">{{ errorDetail }}</div>
      </v-card-text>
      <v-card-actions class="px-6 pb-5">
        <v-spacer />
        <v-btn variant="text" class="text-none" @click="errorDialog = false">关闭</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Result Detail Dialog -->
  <v-dialog v-model="resultDialog" max-width="480">
    <v-card border>
      <v-card-text class="pa-6">
        <div class="d-flex align-center mb-4">
          <v-avatar size="40" color="success" variant="tonal" class="mr-3">
            <v-icon color="success">mdi-check-circle-outline</v-icon>
          </v-avatar>
          <div class="text-h6 font-weight-bold">结果详情</div>
        </div>
        <v-table v-if="resultDetail" density="compact">
          <tbody>
            <tr v-for="(value, key) in resultDetail" :key="key">
              <td class="text-medium-emphasis font-weight-medium" style="width: 120px">{{ key }}</td>
              <td>{{ value }}</td>
            </tr>
          </tbody>
        </v-table>
      </v-card-text>
      <v-card-actions class="px-6 pb-5">
        <v-spacer />
        <v-btn variant="text" class="text-none" @click="resultDialog = false">关闭</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import {
  exportSpaceData,
  importSpaceData,
  getDataTasks,
  getDataTask,
  downloadDataTask,
} from "@/services/commentService";

const props = defineProps({
  cuid: { type: String, required: true },
});

const emit = defineEmits(["notify"]);

function showMsg(text, color = "success") {
  emit("notify", { text, color });
}

// Tasks
const tasks = ref([]);
const loadingTasks = ref(false);
const exporting = ref(false);
const downloadingId = ref(null);

// Polling timers
const pollingTimers = new Map();

function clearAllTimers() {
  for (const timer of pollingTimers.values()) {
    clearInterval(timer);
  }
  pollingTimers.clear();
}

onBeforeUnmount(() => {
  clearAllTimers();
});

async function fetchTasks() {
  loadingTasks.value = true;
  try {
    const res = await getDataTasks(props.cuid);
    tasks.value = res.data || [];
  } catch (e) {
    console.error("Failed to load tasks:", e);
  } finally {
    loadingTasks.value = false;
  }
}

function startPolling(taskId) {
  if (pollingTimers.has(taskId)) return;
  const timer = setInterval(async () => {
    try {
      const res = await getDataTask(props.cuid, taskId);
      const updated = res.data;
      const idx = tasks.value.findIndex((t) => t.id === taskId);
      if (idx !== -1) {
        tasks.value[idx] = updated;
      }
      if (updated.status === "completed" || updated.status === "failed") {
        clearInterval(pollingTimers.get(taskId));
        pollingTimers.delete(taskId);
        showMsg(
          updated.status === "completed" ? "任务已完成" : "任务失败",
          updated.status === "completed" ? "success" : "error",
        );
      }
    } catch (e) {
      clearInterval(pollingTimers.get(taskId));
      pollingTimers.delete(taskId);
    }
  }, 2000);
  pollingTimers.set(taskId, timer);
}

// Export
async function doExport() {
  exporting.value = true;
  try {
    const res = await exportSpaceData(props.cuid);
    const task = res.data;
    tasks.value.unshift(task);
    showMsg("导出任务已创建");
    startPolling(task.id);
  } catch (e) {
    showMsg("创建导出任务失败", "error");
  } finally {
    exporting.value = false;
  }
}

// Download
async function doDownload(taskId) {
  downloadingId.value = taskId;
  try {
    const response = await downloadDataTask(props.cuid, taskId);
    const disposition = response.headers?.["content-disposition"] || "";
    let filename = `export-${props.cuid}.json`;
    const match = disposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i);
    if (match) {
      filename = decodeURIComponent(match[1].replace(/"/g, ""));
    }
    const url = URL.createObjectURL(response.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    showMsg("下载失败", "error");
  } finally {
    downloadingId.value = null;
  }
}

// Import
const importDialog = ref(false);
const importFile = ref(null);
const importError = ref("");
const importPreview = ref(null);
const importParsedData = ref(null);
const importing = ref(false);

function closeImportDialog() {
  importDialog.value = false;
  importFile.value = null;
  importError.value = "";
  importPreview.value = null;
  importParsedData.value = null;
}

function onFileChange(files) {
  importError.value = "";
  importPreview.value = null;
  importParsedData.value = null;

  const file = Array.isArray(files) ? files[0] : files;
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    if (!text || !text.trim()) {
      importError.value = "文件内容为空";
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      importError.value = "JSON 解析错误：文件格式不正确";
      return;
    }
    importParsedData.value = parsed;
    importPreview.value = { count: Array.isArray(parsed) ? parsed.length : 1 };
  };
  reader.onerror = () => {
    importError.value = "文件读取失败";
  };
  reader.readAsText(file);
}

async function doImport() {
  if (!importParsedData.value) return;
  importing.value = true;
  try {
    const res = await importSpaceData(props.cuid, importParsedData.value);
    const task = res.data;
    tasks.value.unshift(task);
    showMsg("导入任务已创建");
    startPolling(task.id);
    closeImportDialog();
  } catch (e) {
    showMsg("创建导入任务失败", "error");
  } finally {
    importing.value = false;
  }
}

// Error/Result dialogs
const errorDialog = ref(false);
const errorDetail = ref("");
const resultDialog = ref(false);
const resultDetail = ref(null);

function showError(task) {
  errorDetail.value = task.error || "未知错误";
  errorDialog.value = true;
}

function showResult(task) {
  resultDetail.value = task.result;
  resultDialog.value = true;
}

// Helpers
function statusColor(status) {
  const map = {
    pending: "grey",
    processing: "primary",
    completed: "success",
    failed: "error",
  };
  return map[status] || "grey";
}

function statusLabel(status) {
  const map = {
    pending: "等待中",
    processing: "处理中",
    completed: "已完成",
    failed: "失败",
  };
  return map[status] || status;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("zh-CN");
}

onMounted(() => {
  fetchTasks();
});
</script>
