<template>
  <v-container fluid class="pa-4 pa-md-6" style="max-width: 1100px">
    <v-btn
      variant="text"
      prepend-icon="mdi-arrow-left"
      to="/app/admin"
      class="mb-4 text-none"
    >
      返回管理首页
    </v-btn>

    <div class="text-h5 font-weight-bold mb-1" style="letter-spacing: -0.5px">
      评论服务管理
    </div>
    <div class="text-body-2 text-medium-emphasis mb-6">
      管理全局敏感词、封禁策略、评论空间及违规日志
    </div>

    <v-card variant="flat" border>
      <v-tabs v-model="tab" density="compact" color="primary" show-arrows>
        <v-tab value="sensitive" class="text-none">敏感词管理</v-tab>
        <v-tab value="spaces" class="text-none">空间管理</v-tab>
        <v-tab value="violations" class="text-none">违规日志</v-tab>
      </v-tabs>

      <v-divider />

      <v-tabs-window v-model="tab">
        <!-- Tab 1: Sensitive Words -->
        <v-tabs-window-item value="sensitive">
          <v-card-text class="pa-5">
            <v-skeleton-loader v-if="sensitiveLoading" type="paragraph, text" />
            <template v-else>
              <!-- Sensitive Words -->
              <div class="d-flex align-center mb-4">
                <v-avatar size="32" color="warning" variant="tonal" class="mr-3">
                  <v-icon size="16" color="warning">mdi-shield-alert-outline</v-icon>
                </v-avatar>
                <div class="text-subtitle-1 font-weight-bold">全局敏感词</div>
              </div>

              <v-textarea
                v-model="sensitiveWords"
                label="敏感词列表"
                variant="solo-filled"
                flat
                density="comfortable"
                rows="8"
                placeholder="每行一个敏感词"
                hint="每行一个敏感词，匹配到的评论将被标记"
                persistent-hint
                class="mb-4"
              />

              <div class="d-flex justify-end mb-6">
                <v-btn
                  color="primary"
                  :loading="savingSensitiveWords"
                  @click="saveSensitiveWords"
                  class="text-none"
                >
                  保存敏感词
                </v-btn>
              </div>

              <v-divider class="mb-5" />

              <!-- Ban Duration -->
              <div class="d-flex align-center mb-4">
                <v-avatar size="32" color="error" variant="tonal" class="mr-3">
                  <v-icon size="16" color="error">mdi-timer-lock-outline</v-icon>
                </v-avatar>
                <div class="text-subtitle-1 font-weight-bold">封禁时长</div>
              </div>

              <v-text-field
                v-model.number="banDuration"
                label="触发敏感词后的封禁时长（秒）"
                variant="solo-filled"
                flat
                density="comfortable"
                type="number"
                min="0"
                hint="设为 0 表示不自动封禁"
                persistent-hint
                class="mb-2"
              />

              <div class="text-caption text-medium-emphasis mb-4">
                当前设置：{{ humanBanDuration }}
              </div>

              <div class="d-flex justify-end">
                <v-btn
                  color="primary"
                  :loading="savingBanDuration"
                  @click="saveBanDuration"
                  class="text-none"
                >
                  保存封禁时长
                </v-btn>
              </div>
            </template>
          </v-card-text>
        </v-tabs-window-item>

        <!-- Tab 2: Space Management -->
        <v-tabs-window-item value="spaces">
          <v-card-text class="pa-5">
            <!-- Toolbar -->
            <div class="d-flex align-center flex-wrap ga-3 mb-4">
              <v-btn-toggle v-model="spaceFilter" mandatory density="compact" color="primary">
                <v-btn value="" class="text-none">全部</v-btn>
                <v-btn value="active" class="text-none">启用</v-btn>
                <v-btn value="banned" class="text-none">封禁</v-btn>
              </v-btn-toggle>

              <v-spacer />

              <v-text-field
                v-model="spaceKeyword"
                placeholder="搜索空间..."
                variant="solo-filled"
                flat
                density="compact"
                hide-details
                clearable
                prepend-inner-icon="mdi-magnify"
                style="max-width: 260px"
                @keydown.enter="searchSpaces"
                @click:clear="clearSpaceSearch"
              />
            </div>

            <!-- Loading -->
            <v-skeleton-loader v-if="spacesLoading" type="table-tbody" />

            <!-- Empty -->
            <div
              v-else-if="spaces.length === 0"
              class="text-center py-16"
            >
              <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-comment-off-outline</v-icon>
              <div class="text-body-1 text-medium-emphasis">暂无空间</div>
            </div>

            <!-- Table -->
            <template v-else>
              <v-table density="comfortable">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>名称</th>
                    <th>CUID</th>
                    <th>域名</th>
                    <th>状态</th>
                    <th>所有者</th>
                    <th>创建时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="s in spaces" :key="s.id">
                    <td class="text-caption">{{ s.id }}</td>
                    <td>{{ s.name }}</td>
                    <td class="text-caption" style="font-family: monospace">{{ s.cuid }}</td>
                    <td class="text-caption">{{ s.domain || '-' }}</td>
                    <td>
                      <v-chip
                        :color="s.status === 'active' ? 'success' : 'error'"
                        size="small"
                        variant="flat"
                      >
                        {{ s.status === 'active' ? '启用' : '封禁' }}
                      </v-chip>
                    </td>
                    <td class="text-caption">{{ s.owner?.username || s.owner_id || '-' }}</td>
                    <td class="text-caption">{{ formatDate(s.created_at) }}</td>
                    <td>
                      <v-btn
                        icon="mdi-pencil-outline"
                        variant="text"
                        size="small"
                        @click="openSpaceDialog(s)"
                      />
                    </td>
                  </tr>
                </tbody>
              </v-table>

              <div class="d-flex justify-center mt-4" v-if="spaceTotalPages > 1">
                <v-pagination
                  v-model="spacePage"
                  :length="spaceTotalPages"
                  :total-visible="5"
                  density="compact"
                />
              </div>
            </template>
          </v-card-text>
        </v-tabs-window-item>

        <!-- Tab 3: Violations -->
        <v-tabs-window-item value="violations">
          <v-card-text class="pa-5">
            <v-skeleton-loader v-if="violationsLoading" type="table-tbody" />

            <div
              v-else-if="violations.length === 0"
              class="text-center py-16"
            >
              <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-check-circle-outline</v-icon>
              <div class="text-body-1 text-medium-emphasis">暂无违规记录</div>
            </div>

            <template v-else>
              <v-table density="comfortable">
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>IP</th>
                    <th>昵称</th>
                    <th>触发词</th>
                    <th>评论摘要</th>
                    <th>空间 ID</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="v in violations" :key="v.id">
                    <td class="text-caption">{{ formatDate(v.created_at) }}</td>
                    <td class="text-caption" style="font-family: monospace">{{ v.ip || '-' }}</td>
                    <td>{{ v.nick || '-' }}</td>
                    <td>
                      <v-chip size="small" color="warning" variant="tonal">
                        {{ v.keyword || '-' }}
                      </v-chip>
                    </td>
                    <td class="text-caption" style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
                      {{ v.comment || '-' }}
                    </td>
                    <td class="text-caption" style="font-family: monospace">{{ v.space_cuid || v.space_id || '-' }}</td>
                  </tr>
                </tbody>
              </v-table>

              <div class="d-flex justify-center mt-4" v-if="violationTotalPages > 1">
                <v-pagination
                  v-model="violationPage"
                  :length="violationTotalPages"
                  :total-visible="5"
                  density="compact"
                />
              </div>
            </template>
          </v-card-text>
        </v-tabs-window-item>
      </v-tabs-window>
    </v-card>

    <!-- Space Status Dialog -->
    <v-dialog v-model="spaceDialog" max-width="480">
      <v-card border>
        <v-card-text class="pa-6">
          <div class="d-flex align-center mb-4">
            <v-avatar size="40" color="primary" variant="tonal" class="mr-3">
              <v-icon color="primary">mdi-comment-text-outline</v-icon>
            </v-avatar>
            <div>
              <div class="text-h6 font-weight-bold">管理空间</div>
              <div class="text-caption text-medium-emphasis">{{ dialogSpace?.name }}</div>
            </div>
          </div>

          <div class="text-body-2 mb-3">
            CUID: <code>{{ dialogSpace?.cuid }}</code>
          </div>
          <div class="text-body-2 mb-4">
            当前状态:
            <v-chip
              :color="dialogSpace?.status === 'active' ? 'success' : 'error'"
              size="small"
              variant="flat"
            >
              {{ dialogSpace?.status === 'active' ? '启用' : '封禁' }}
            </v-chip>
          </div>

          <v-btn-toggle v-model="dialogNewStatus" mandatory density="compact" color="primary" class="mb-2">
            <v-btn value="active" class="text-none">启用</v-btn>
            <v-btn value="banned" class="text-none">封禁</v-btn>
          </v-btn-toggle>
        </v-card-text>
        <v-card-actions class="px-6 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="spaceDialog = false" class="text-none">取消</v-btn>
          <v-btn
            color="primary"
            :loading="savingSpaceStatus"
            @click="saveSpaceStatus"
            class="text-none"
          >
            保存
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :color="snackbarColor" :timeout="2000">
      {{ snackbarText }}
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useSeo } from "@/composables/useSeo";
import {
  getAdminSensitiveWords,
  updateAdminSensitiveWords,
  getAdminBanDuration,
  updateAdminBanDuration,
  getAdminSpaces,
  updateAdminSpaceStatus,
  getAdminViolations,
} from "@/services/commentService";

useSeo({
  title: "评论服务管理",
  description: "管理全局敏感词、封禁策略、评论空间状态及敏感词违规日志。",
});

const tab = ref("sensitive");

// ── Snackbar ──
const snackbar = ref(false);
const snackbarText = ref("");
const snackbarColor = ref("success");

function showMsg(text, color = "success") {
  snackbarText.value = text;
  snackbarColor.value = color;
  snackbar.value = true;
}

// ── Sensitive Words ──
const sensitiveLoading = ref(true);
const sensitiveWords = ref("");
const savingSensitiveWords = ref(false);
const banDuration = ref(0);
const savingBanDuration = ref(false);

const humanBanDuration = computed(() => {
  const s = banDuration.value;
  if (!s || s <= 0) return "不自动封禁";
  if (s < 60) return `${s} 秒`;
  if (s < 3600) return `${Math.floor(s / 60)} 分钟`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小时`;
  return `${Math.floor(s / 86400)} 天`;
});

async function loadSensitive() {
  sensitiveLoading.value = true;
  try {
    const [wordsRes, durationRes] = await Promise.all([
      getAdminSensitiveWords(),
      getAdminBanDuration(),
    ]);
    sensitiveWords.value = (wordsRes.data?.words || []).join("\n");
    banDuration.value = durationRes.data?.duration || 0;
  } catch (e) {
    showMsg("加载敏感词配置失败", "error");
  } finally {
    sensitiveLoading.value = false;
  }
}

async function saveSensitiveWords() {
  savingSensitiveWords.value = true;
  try {
    const words = sensitiveWords.value
      .split("\n")
      .map((w) => w.trim())
      .filter(Boolean);
    await updateAdminSensitiveWords({ words });
    showMsg("敏感词已保存");
  } catch (e) {
    showMsg("保存敏感词失败", "error");
  } finally {
    savingSensitiveWords.value = false;
  }
}

async function saveBanDuration() {
  savingBanDuration.value = true;
  try {
    await updateAdminBanDuration({ duration: banDuration.value });
    showMsg("封禁时长已保存");
  } catch (e) {
    showMsg("保存封禁时长失败", "error");
  } finally {
    savingBanDuration.value = false;
  }
}

// ── Spaces ──
const spacesLoading = ref(false);
const spaces = ref([]);
const spacePage = ref(1);
const spaceTotalPages = ref(1);
const spaceFilter = ref("");
const spaceKeyword = ref("");
const activeSpaceKeyword = ref("");

const spaceDialog = ref(false);
const dialogSpace = ref(null);
const dialogNewStatus = ref("active");
const savingSpaceStatus = ref(false);

function searchSpaces() {
  activeSpaceKeyword.value = spaceKeyword.value?.trim() || "";
  spacePage.value = 1;
  loadSpaces();
}

function clearSpaceSearch() {
  spaceKeyword.value = "";
  activeSpaceKeyword.value = "";
  spacePage.value = 1;
  loadSpaces();
}

async function loadSpaces() {
  spacesLoading.value = true;
  try {
    const params = { page: spacePage.value, pageSize: 20 };
    if (spaceFilter.value) params.status = spaceFilter.value;
    if (activeSpaceKeyword.value) params.keyword = activeSpaceKeyword.value;
    const res = await getAdminSpaces(params);
    const d = res.data;
    spaces.value = d.spaces || d.items || [];
    spaceTotalPages.value = d.totalPages || 1;
  } catch (e) {
    showMsg("加载空间列表失败", "error");
    spaces.value = [];
  } finally {
    spacesLoading.value = false;
  }
}

function openSpaceDialog(space) {
  dialogSpace.value = { ...space };
  dialogNewStatus.value = space.status || "active";
  spaceDialog.value = true;
}

async function saveSpaceStatus() {
  if (!dialogSpace.value) return;
  savingSpaceStatus.value = true;
  try {
    await updateAdminSpaceStatus(dialogSpace.value.id, {
      status: dialogNewStatus.value,
    });
    const target = spaces.value.find((s) => s.id === dialogSpace.value.id);
    if (target) target.status = dialogNewStatus.value;
    spaceDialog.value = false;
    showMsg("空间状态已更新");
  } catch (e) {
    showMsg("更新空间状态失败", "error");
  } finally {
    savingSpaceStatus.value = false;
  }
}

// ── Violations ──
const violationsLoading = ref(false);
const violations = ref([]);
const violationPage = ref(1);
const violationTotalPages = ref(1);

async function loadViolations() {
  violationsLoading.value = true;
  try {
    const params = { page: violationPage.value, pageSize: 20 };
    const res = await getAdminViolations(params);
    const d = res.data;
    violations.value = d.violations || d.items || [];
    violationTotalPages.value = d.totalPages || 1;
  } catch (e) {
    showMsg("加载违规日志失败", "error");
    violations.value = [];
  } finally {
    violationsLoading.value = false;
  }
}

// ── Helpers ──
function formatDate(str) {
  if (!str) return "-";
  const d = new Date(str);
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Watchers ──
watch(tab, (val) => {
  if (val === "spaces" && spaces.value.length === 0) loadSpaces();
  if (val === "violations" && violations.value.length === 0) loadViolations();
});

watch(
  () => spaceFilter.value,
  () => {
    spacePage.value = 1;
    loadSpaces();
  },
);
watch(spacePage, loadSpaces);
watch(violationPage, loadViolations);

onMounted(() => {
  loadSensitive();
});
</script>
