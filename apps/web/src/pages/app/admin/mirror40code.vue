<template>
  <v-container fluid>
    <v-row justify="center">
      <v-col cols="12" lg="10" xl="9">
        <v-card class="mb-4" border>
          <v-card-item>
            <template #prepend>
              <v-icon icon="mdi-source-branch-sync" color="primary" />
            </template>
            <v-card-title>40code 镜像同步</v-card-title>
            <v-card-subtitle>管理员接口：状态查询与手动触发同步</v-card-subtitle>
            <template #append>
              <v-btn
                color="primary"
                variant="tonal"
                prepend-icon="mdi-refresh"
                :loading="statusLoading"
                @click="loadStatus"
              >
                刷新状态
              </v-btn>
            </template>
          </v-card-item>
        </v-card>

        <v-alert
          v-if="feedback"
          :type="feedback.type"
          variant="tonal"
          closable
          class="mb-4"
          :text="feedback.message"
          @click:close="feedback = null"
        />

        <v-row>
          <v-col cols="12" md="4">
            <v-card border height="100%">
              <v-card-title class="text-subtitle-1">远端 API</v-card-title>
              <v-card-text>
                <div class="d-flex align-center ga-2 mb-2">
                  <v-icon :icon="remoteOk ? 'mdi-check-circle' : 'mdi-close-circle'" :color="remoteOk ? 'success' : 'error'" />
                  <span>{{ remoteOk ? '可用' : '不可用' }}</span>
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  返回码：{{ remoteCodeText }}
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" md="4">
            <v-card border height="100%">
              <v-card-title class="text-subtitle-1">队列可用性</v-card-title>
              <v-card-text>
                <div class="d-flex align-center ga-2 mb-2">
                  <v-icon
                    :icon="queueAvailable ? 'mdi-check-circle' : 'mdi-alert-circle'"
                    :color="queueAvailable ? 'success' : 'warning'"
                  />
                  <span>{{ queueAvailable ? '可用' : '不可用' }}</span>
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  初始化：{{ queueInitialized ? '已完成' : '未完成' }}
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" md="4">
            <v-card border height="100%">
              <v-card-title class="text-subtitle-1">任务总览</v-card-title>
              <v-card-text>
                <div class="text-body-2">等待中：{{ queueCounts.waiting ?? 0 }}</div>
                <div class="text-body-2">进行中：{{ queueCounts.active ?? 0 }}</div>
                <div class="text-body-2">已完成：{{ queueCounts.completed ?? 0 }}</div>
                <div class="text-body-2">失败：{{ queueCounts.failed ?? 0 }}</div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <v-card class="mt-4" border>
          <v-card-title>触发同步</v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="4">
                <v-btn
                  color="primary"
                  block
                  prepend-icon="mdi-database-sync"
                  :loading="fullSyncLoading"
                  :disabled="actionDisabled"
                  @click="handleFullSync"
                >
                  全量同步
                </v-btn>
              </v-col>

              <v-col cols="12" md="4">
                <v-text-field
                  v-model="userIdInput"
                  label="远端用户 ID"
                  variant="outlined"
                  density="comfortable"
                  type="number"
                  min="1"
                  hide-details="auto"
                />
                <v-btn
                  class="mt-2"
                  color="secondary"
                  block
                  prepend-icon="mdi-account-sync"
                  :loading="userSyncLoading"
                  :disabled="actionDisabled"
                  @click="handleUserSync"
                >
                  同步用户
                </v-btn>
              </v-col>

              <v-col cols="12" md="4">
                <v-text-field
                  v-model="projectIdInput"
                  label="远端项目 ID"
                  variant="outlined"
                  density="comfortable"
                  type="number"
                  min="1"
                  hide-details="auto"
                />
                <v-text-field
                  v-model="projectRemoteUserIdInput"
                  class="mt-2"
                  label="远端用户 ID（可选）"
                  variant="outlined"
                  density="comfortable"
                  type="number"
                  min="1"
                  hide-details="auto"
                />
                <v-btn
                  class="mt-2"
                  color="info"
                  block
                  prepend-icon="mdi-file-sync"
                  :loading="projectSyncLoading"
                  :disabled="actionDisabled"
                  @click="handleProjectSync"
                >
                  同步项目
                </v-btn>
              </v-col>
            </v-row>

            <v-alert
              v-if="!queueAvailable || !queueInitialized"
              type="warning"
              variant="tonal"
              class="mt-4"
              text="队列未就绪，触发任务可能失败（503）。请检查后端队列配置与运行状态。"
            />
          </v-card-text>
        </v-card>

        <v-card class="mt-4" border>
          <v-card-title>最近任务（最多 20 条）</v-card-title>
          <v-card-text>
            <v-table density="compact">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>类型</th>
                  <th>进度</th>
                  <th>尝试次数</th>
                  <th>失败原因</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="job in recentJobs" :key="job.id">
                  <td>{{ job.id }}</td>
                  <td>{{ job.name }}</td>
                  <td>{{ job.progress ?? 0 }}%</td>
                  <td>{{ job.attemptsMade ?? 0 }}</td>
                  <td class="text-error">{{ job.failedReason || '-' }}</td>
                </tr>
                <tr v-if="!recentJobs.length">
                  <td colspan="5" class="text-center text-medium-emphasis">暂无任务</td>
                </tr>
              </tbody>
            </v-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useHead } from '@unhead/vue';
import Mirror40codeService from '@/services/mirror40codeService';

useHead({ title: '40code 镜像同步' });

const statusLoading = ref(false);
const fullSyncLoading = ref(false);
const userSyncLoading = ref(false);
const projectSyncLoading = ref(false);

const feedback = ref(null);
const statusData = ref(null);

const userIdInput = ref('');
const projectIdInput = ref('');
const projectRemoteUserIdInput = ref('');

let pollTimer = null;

const queue = computed(() => statusData.value?.queue || {});
const queueCounts = computed(() => queue.value?.counts || {});
const recentJobs = computed(() => queue.value?.recentJobs || []);
const remote = computed(() => statusData.value?.remote || {});

const remoteOk = computed(() => Boolean(remote.value?.ok));
const remoteCodeText = computed(() => remote.value?.code ?? '-');

const queueAvailable = computed(() => Boolean(queue.value?.available));
const queueInitialized = computed(() => Boolean(queue.value?.initialized));

const actionDisabled = computed(() => {
  return fullSyncLoading.value || userSyncLoading.value || projectSyncLoading.value;
});

const positiveInt = (value) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    return null;
  }
  return n;
};

const setFeedback = (type, message) => {
  feedback.value = { type, message };
};

const loadStatus = async () => {
  statusLoading.value = true;
  try {
    const res = await Mirror40codeService.getStatus();
    statusData.value = res?.data || null;
  } catch (error) {
    setFeedback('error', error.message || '获取镜像状态失败');
  } finally {
    statusLoading.value = false;
  }
};

const startShortPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  let times = 0;
  pollTimer = setInterval(async () => {
    times += 1;
    await loadStatus();
    if (times >= 6) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }, 5000);
};

const handleFullSync = async () => {
  fullSyncLoading.value = true;
  try {
    const res = await Mirror40codeService.triggerFullSync();
    setFeedback('success', res?.message || '全量镜像任务已入队');
    await loadStatus();
    startShortPolling();
  } catch (error) {
    setFeedback('error', error.message || '触发全量同步失败');
  } finally {
    fullSyncLoading.value = false;
  }
};

const handleUserSync = async () => {
  const userId = positiveInt(userIdInput.value);
  if (!userId) {
    setFeedback('error', '请输入有效的远端用户 ID（正整数）');
    return;
  }

  userSyncLoading.value = true;
  try {
    const res = await Mirror40codeService.triggerUserSync(userId);
    setFeedback('success', res?.message || '用户同步任务已入队');
    await loadStatus();
    startShortPolling();
  } catch (error) {
    setFeedback('error', error.message || '触发用户同步失败');
  } finally {
    userSyncLoading.value = false;
  }
};

const handleProjectSync = async () => {
  const projectId = positiveInt(projectIdInput.value);
  if (!projectId) {
    setFeedback('error', '请输入有效的远端项目 ID（正整数）');
    return;
  }

  const remoteUserId = projectRemoteUserIdInput.value === '' ? null : positiveInt(projectRemoteUserIdInput.value);
  if (projectRemoteUserIdInput.value !== '' && !remoteUserId) {
    setFeedback('error', '远端用户 ID（可选）必须为正整数');
    return;
  }

  projectSyncLoading.value = true;
  try {
    const res = await Mirror40codeService.triggerProjectSync(projectId, remoteUserId);
    setFeedback('success', res?.message || '项目同步任务已入队');
    await loadStatus();
    startShortPolling();
  } catch (error) {
    setFeedback('error', error.message || '触发项目同步失败');
  } finally {
    projectSyncLoading.value = false;
  }
};

onMounted(() => {
  loadStatus();
});

onBeforeUnmount(() => {
  if (pollTimer) {
    clearInterval(pollTimer);
  }
});
</script>
