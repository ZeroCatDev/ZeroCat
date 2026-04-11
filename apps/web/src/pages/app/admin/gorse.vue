<template>
  <v-container fluid>
    <!-- 标题卡片 -->
    <v-card class="mb-6" elevation="2">
      <v-card-item>
        <template v-slot:prepend>
          <v-icon class="me-4" color="primary" icon="mdi-star-cog" size="large" />
        </template>
        <v-card-title class="text-h5">Gorse 推荐系统</v-card-title>
        <v-card-subtitle class="mt-2">管理个性化推荐引擎的状态与数据同步</v-card-subtitle>
        <template v-slot:append>
          <v-btn
            :loading="statusLoading"
            icon="mdi-refresh"
            variant="text"
            title="刷新状态"
            @click="loadStatus"
          />
        </template>
      </v-card-item>
    </v-card>

    <v-row>
      <!-- 服务状态 -->
      <v-col cols="12" md="4">
        <v-card variant="outlined" height="100%">
          <v-card-title class="d-flex align-center ga-2">
            <v-icon icon="mdi-server-network" />
            服务状态
          </v-card-title>
          <v-card-text>
            <v-skeleton-loader v-if="statusLoading" type="list-item-two-line" />
            <template v-else>
              <v-list>
                <v-list-item>
                  <template v-slot:prepend>
                    <v-icon
                      :color="status.enabled ? 'success' : 'error'"
                      :icon="status.enabled ? 'mdi-check-circle' : 'mdi-close-circle'"
                    />
                  </template>
                  <v-list-item-title>运行状态</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ status.enabled ? '运行中' : '未启用' }}
                  </v-list-item-subtitle>
                </v-list-item>

                <v-list-item v-if="status.endpoint">
                  <template v-slot:prepend>
                    <v-icon icon="mdi-link" />
                  </template>
                  <v-list-item-title>服务地址</v-list-item-title>
                  <v-list-item-subtitle class="text-truncate">
                    {{ status.endpoint }}
                  </v-list-item-subtitle>
                </v-list-item>

                <v-list-item v-if="status.message">
                  <template v-slot:prepend>
                    <v-icon icon="mdi-information-outline" />
                  </template>
                  <v-list-item-title>详情</v-list-item-title>
                  <v-list-item-subtitle>{{ status.message }}</v-list-item-subtitle>
                </v-list-item>
              </v-list>

              <v-alert
                v-if="statusError"
                type="error"
                variant="tonal"
                class="mt-2"
                :text="statusError"
              />
            </template>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- 数据同步 -->
      <v-col cols="12" md="8">
        <v-card variant="outlined">
          <v-card-title class="d-flex align-center ga-2">
            <v-icon icon="mdi-sync" />
            数据同步
          </v-card-title>
          <v-card-subtitle class="px-4 pb-2">
            将用户、帖子和行为反馈同步到 Gorse，以便生成个性化推荐。全量同步可能耗时数分钟。
          </v-card-subtitle>
          <v-card-text>
            <v-row>
              <!-- 全量同步 -->
              <v-col cols="12">
                <v-btn
                  color="primary"
                  prepend-icon="mdi-database-sync"
                  :loading="syncing.all"
                  :disabled="anySyncing"
                  block
                  size="large"
                  @click="runSync('all')"
                >
                  全量同步（用户 + 帖子 + 反馈）
                </v-btn>
              </v-col>

              <!-- 分项同步 -->
              <v-col cols="12" sm="4">
                <v-btn
                  color="secondary"
                  prepend-icon="mdi-account-sync"
                  :loading="syncing.users"
                  :disabled="anySyncing"
                  block
                  @click="runSync('users')"
                >
                  同步用户
                </v-btn>
              </v-col>
              <v-col cols="12" sm="4">
                <v-btn
                  color="secondary"
                  prepend-icon="mdi-file-sync"
                  :loading="syncing.posts"
                  :disabled="anySyncing"
                  block
                  @click="runSync('posts')"
                >
                  同步帖子
                </v-btn>
              </v-col>
              <v-col cols="12" sm="4">
                <v-btn
                  color="secondary"
                  prepend-icon="mdi-heart-pulse"
                  :loading="syncing.feedbacks"
                  :disabled="anySyncing"
                  block
                  @click="runSync('feedbacks')"
                >
                  同步反馈
                </v-btn>
              </v-col>

              <v-col cols="12" sm="4">
                <v-btn
                  color="secondary"
                  prepend-icon="mdi-heart-pulse"
                  :loading="syncing.projects"
                  :disabled="anySyncing"
                  block
                  @click="runSync('projects')"
                >
                  同步项目
                </v-btn>
              </v-col>
            </v-row>

            <!-- 同步进行中提示 -->
            <v-alert
              v-if="anySyncing"
              type="info"
              variant="tonal"
              class="mt-4"
              icon="mdi-timer-sand"
              text="同步进行中，请勿关闭页面，全量同步可能需要数分钟……"
            />

            <!-- 同步结果 -->
            <template v-if="syncResult">
              <v-divider class="my-4" />
              <p class="text-subtitle-1 font-weight-bold mb-2">
                <v-icon icon="mdi-check-circle" color="success" size="small" class="mr-1" />
                {{ syncResult.message ?? '同步完成' }}
              </p>
              <v-table density="compact">
                <thead>
                  <tr>
                    <th>类别</th>
                    <th>总数</th>
                    <th>已同步</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="syncResult.data?.users">
                    <td>用户</td>
                    <td>{{ syncResult.data.users.total }}</td>
                    <td>{{ syncResult.data.users.synced }}</td>
                  </tr>
                  <tr v-if="syncResult.data?.posts">
                    <td>帖子</td>
                    <td>{{ syncResult.data.posts.total }}</td>
                    <td>{{ syncResult.data.posts.synced }}</td>
                  </tr>
                  <template v-if="syncResult.data?.feedbacks">
                    <tr v-for="(count, type) in syncResult.data.feedbacks" :key="type">
                      <td>反馈 · {{ type }}</td>
                      <td colspan="2">{{ count }}</td>
                    </tr>
                  </template>
                                    <template v-if="syncResult.data?.projects">

                  <tr v-if="syncResult.data?.projects">
                    <td>项目</td>
                    <td>{{ syncResult.data.projects.total }}</td>
                    <td>{{ syncResult.data.projects.synced }}</td>
                  </tr>
                  </template>
                </tbody>
              </v-table>
            </template>

            <!-- 同步错误 -->
            <v-alert
              v-if="syncError"
              type="error"
              variant="tonal"
              class="mt-4"
              :text="syncError"
              closable
              @click:close="syncError = null"
            />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import GorseService from '@/services/gorseService';

// --- 状态 ---
const statusLoading = ref(false);
const statusError = ref(null);
const status = ref({ enabled: false, endpoint: '', message: '' });

const syncing = ref({ all: false, users: false, posts: false, feedbacks: false, projects: false });
const syncResult = ref(null);
const syncError = ref(null);

const anySyncing = computed(() => Object.values(syncing.value).some(Boolean));

// --- 方法 ---
const loadStatus = async () => {
  statusLoading.value = true;
  statusError.value = null;
  try {
    status.value = await GorseService.getStatus();
  } catch (e) {
    statusError.value = e.message;
  } finally {
    statusLoading.value = false;
  }
};

const syncMap = {
  all: GorseService.syncAll.bind(GorseService),
  users: GorseService.syncUsers.bind(GorseService),
  posts: GorseService.syncPosts.bind(GorseService),
  feedbacks: GorseService.syncFeedbacks.bind(GorseService),
  projects: GorseService.syncProjects.bind(GorseService),
};

const runSync = async (type) => {
  syncing.value[type] = true;
  syncResult.value = null;
  syncError.value = null;
  try {
    syncResult.value = await syncMap[type]();
  } catch (e) {
    syncError.value = e.message;
  } finally {
    syncing.value[type] = false;
  }
};

onMounted(loadStatus);
</script>
