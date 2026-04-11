<template>
  <v-container fluid class="pa-4 pa-md-6" style="max-width: 1100px">
    <v-btn
      variant="text"
      prepend-icon="mdi-arrow-left"
      :to="`/app/commentservice/${cuid}`"
      class="mb-4 text-none"
    >
      返回空间详情
    </v-btn>

    <div class="text-h5 font-weight-bold mb-1" style="letter-spacing: -0.5px">
      管理评论
    </div>
    <div class="text-body-2 text-medium-emphasis mb-5">
      审核、管理空间中的所有评论
    </div>

    <!-- Toolbar -->
    <v-card variant="flat" border class="mb-4">
      <v-card-text class="pa-4 d-flex align-center flex-wrap ga-3">
        <v-btn-toggle v-model="filter.status" mandatory density="compact" color="primary">
          <v-btn value="" class="text-none">全部</v-btn>
          <v-btn value="approved" class="text-none">已通过</v-btn>
          <v-btn value="waiting" class="text-none">待审核</v-btn>
          <v-btn value="spam" class="text-none">垃圾</v-btn>
        </v-btn-toggle>

        <v-spacer />

        <v-text-field
          v-model="keyword"
          placeholder="搜索评论..."
          variant="solo-filled"
          flat
          density="compact"
          hide-details
          clearable
          prepend-inner-icon="mdi-magnify"
          style="max-width: 260px"
          @keydown.enter="doSearch"
          @click:clear="clearSearch"
        />
      </v-card-text>
    </v-card>

    <!-- Loading -->
    <template v-if="loading">
      <v-skeleton-loader v-for="i in 3" :key="i" type="table-row" class="mb-1" />
    </template>

    <!-- Empty -->
    <v-card v-else-if="comments.length === 0" variant="flat" border class="text-center py-16 px-8">
      <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-comment-off-outline</v-icon>
      <div class="text-body-1 text-medium-emphasis">暂无评论</div>
    </v-card>

    <!-- Comment Table -->
    <v-card v-else variant="flat" border rounded="lg">
      <v-table hover>
        <thead>
          <tr>
            <th style="width: 35%" class="font-weight-bold">作者</th>
            <th class="font-weight-bold">内容</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="comment in comments"
            :key="comment.objectId"
            class="comment-row"
          >
            <!-- Author Column -->
            <td class="py-3" style="vertical-align: top">
              <div class="d-flex align-start ga-3">
                <v-avatar size="40" class="flex-shrink-0 mt-1" color="grey-lighten-3">
                  <v-img v-if="comment.avatar" :src="comment.avatar" :alt="comment.nick" />
                  <v-icon v-else size="24" color="grey">mdi-account</v-icon>
                </v-avatar>
                <div style="min-width: 0">
                  <a
                    v-if="comment.link"
                    :href="comment.link.startsWith('http') ? comment.link : `https://${comment.link}`"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-subtitle-2 font-weight-bold text-primary text-decoration-none"
                  >
                    {{ comment.nick || '匿名' }}
                  </a>
                  <div v-else class="text-subtitle-2 font-weight-bold">
                    {{ comment.nick || '匿名' }}
                  </div>
                  <div v-if="comment.mail" class="text-caption text-medium-emphasis text-truncate">
                    {{ comment.mail }}
                  </div>
                  <div v-if="comment.ip" class="text-caption text-medium-emphasis">
                    {{ comment.ip }}
                  </div>
                  <div v-if="comment.addr" class="text-caption text-medium-emphasis">
                    {{ comment.addr }}
                  </div>
                </div>
              </div>
            </td>

            <!-- Content Column -->
            <td class="py-3" style="vertical-align: top">
              <div class="text-caption text-medium-emphasis mb-1">
                <span>{{ formatDate(comment.insertedAt) }}</span>
                <span v-if="comment.url">
                  于
                  <a
                    v-if="buildUrl(comment.url)"
                    :href="buildUrl(comment.url)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-primary text-decoration-none"
                  >
                    <code class="text-caption">{{ comment.url }}</code>
                  </a>
                  <code v-else class="text-caption">{{ comment.url }}</code>
                </span>
              </div>
              <div class="text-body-2 mb-2 comment-content">
                {{ comment.orig || comment.comment }}
              </div>
              <div class="text-caption text-medium-emphasis mb-1 d-flex flex-wrap ga-2" v-if="comment.browser || comment.os">
                <span v-if="comment.browser">
                  <v-icon size="x-small">mdi-web</v-icon> {{ comment.browser }}
                </span>
                <span v-if="comment.os">
                  <v-icon size="x-small">mdi-monitor</v-icon> {{ comment.os }}
                </span>
              </div>
              <!-- Status Chip (visible by default, hidden on hover) -->
              <v-chip
                :color="statusColor(comment.status)"
                size="x-small"
                variant="flat"
                class="comment-status-chip"
              >
                {{ statusLabel(comment.status) }}
              </v-chip>
              <!-- Hover Actions (hidden by default, visible on hover) -->
              <div class="comment-actions">
                <v-btn
                  v-if="comment.status !== 'approved'"
                  variant="tonal"
                  size="small"
                  color="success"
                  class="text-none"
                  @click="setStatus(comment, 'approved')"
                >
                  通过
                </v-btn>
                <v-btn
                  v-if="comment.status !== 'waiting'"
                  variant="tonal"
                  size="small"
                  color="warning"
                  class="text-none"
                  @click="setStatus(comment, 'waiting')"
                >
                  待审核
                </v-btn>
                <v-btn
                  v-if="comment.status !== 'spam'"
                  variant="tonal"
                  size="small"
                  color="orange-darken-3"
                  class="text-none"
                  @click="setStatus(comment, 'spam')"
                >
                  垃圾
                </v-btn>
                <v-btn
                  variant="tonal"
                  size="small"
                  color="error"
                  class="text-none"
                  @click="confirmDeleteComment(comment)"
                >
                  删除
                </v-btn>
              </div>
            </td>
          </tr>
        </tbody>
      </v-table>

      <!-- Pagination -->
      <v-divider v-if="totalPages > 1" />
      <div class="d-flex justify-center py-3" v-if="totalPages > 1">
        <v-pagination
          v-model="page"
          :length="totalPages"
          :total-visible="5"
          density="compact"
        />
      </div>
    </v-card>

    <!-- Delete Dialog -->
    <v-dialog v-model="deleteDialog" max-width="420">
      <v-card border>
        <v-card-text class="pa-6">
          <div class="d-flex align-center mb-4">
            <v-avatar size="40" color="error" variant="tonal" class="mr-3">
              <v-icon color="error">mdi-delete-outline</v-icon>
            </v-avatar>
            <div class="text-h6 font-weight-bold">确认删除</div>
          </div>
          <div class="text-body-2 text-medium-emphasis">
            确定要删除这条评论吗？该评论的所有回复也将被删除。
          </div>
        </v-card-text>
        <v-card-actions class="px-6 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="deleteDialog = false" class="text-none">取消</v-btn>
          <v-btn color="error" :loading="deleting" @click="doDelete" class="text-none">
            确认删除
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref, reactive, watch, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useSeo } from "@/composables/useSeo";
import {
  getSpace,
  getSpaceComments,
  updateComment,
  deleteComment,
} from "@/services/commentService";

const route = useRoute();
const cuid = route.params.cuid;

const spaceName = ref("");
const seoTitle = computed(() =>
  spaceName.value ? `${spaceName.value} - 评论管理` : "评论管理"
);
const seoDesc = computed(() =>
  spaceName.value
    ? `${spaceName.value} 的评论管理面板，审核、搜索和管理评论。`
    : "Waline 评论空间的评论管理面板"
);
useSeo({ title: seoTitle, description: seoDesc });

const spaceDomain = ref("");
const comments = ref([]);
const loading = ref(true);
const page = ref(1);
const totalPages = ref(1);
const filter = reactive({ status: "" });
const keyword = ref("");
const activeKeyword = ref("");
const deleteDialog = ref(false);
const deleting = ref(false);
const deleteTarget = ref(null);

function statusColor(s) {
  return { approved: "success", waiting: "warning", spam: "error" }[s] || "grey";
}

function statusLabel(s) {
  return { approved: "已通过", waiting: "待审核", spam: "垃圾" }[s] || s;
}

function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleString("zh-CN");
}

function buildUrl(path) {
  if (!path || !spaceDomain.value) return "";
  const base = spaceDomain.value.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  const domain = base.startsWith("http") ? base : `https://${base}`;
  return `${domain}${p}`;
}

function doSearch() {
  activeKeyword.value = keyword.value?.trim() || "";
  page.value = 1;
  loadComments();
}

function clearSearch() {
  keyword.value = "";
  activeKeyword.value = "";
  page.value = 1;
  loadComments();
}

async function loadComments() {
  loading.value = true;
  try {
    const params = { page: page.value, pageSize: 10 };
    if (filter.status) params.status = filter.status;
    if (activeKeyword.value) params.keyword = activeKeyword.value;
    const res = await getSpaceComments(cuid, params);
    const d = res.data;
    comments.value = d.data || [];
    totalPages.value = d.totalPages || 1;
  } catch (e) {
    console.error("Failed to load comments:", e);
    comments.value = [];
  } finally {
    loading.value = false;
  }
}

async function setStatus(comment, status) {
  try {
    await updateComment(cuid, comment.objectId, { status });
    comment.status = status;
  } catch (e) {
    console.error("Failed to update comment:", e);
  }
}

function confirmDeleteComment(comment) {
  deleteTarget.value = comment;
  deleteDialog.value = true;
}

async function doDelete() {
  if (!deleteTarget.value) return;
  deleting.value = true;
  try {
    await deleteComment(cuid, deleteTarget.value.objectId);
    comments.value = comments.value.filter(
      (c) => c.objectId !== deleteTarget.value.objectId
    );
    deleteDialog.value = false;
  } catch (e) {
    console.error("Failed to delete comment:", e);
  } finally {
    deleting.value = false;
  }
}

watch(() => filter.status, () => {
  page.value = 1;
  loadComments();
});

watch(page, loadComments);

onMounted(async () => {
  try {
    const spaceRes = await getSpace(cuid);
    spaceDomain.value = spaceRes.data?.domain || "";
    spaceName.value = spaceRes.data?.name || "";
  } catch (e) {
    console.error("Failed to load space:", e);
  }
  loadComments();
});
</script>

<style scoped>
.comment-row .comment-actions {
  opacity: 0;
  height: 0;
  overflow: hidden;
  transition: opacity 0.15s ease, height 0.15s ease;
}

.comment-row:hover .comment-actions {
  opacity: 1;
  height: auto;
  overflow: visible;
}

.comment-row .comment-status-chip {
  transition: opacity 0.15s ease;
}



.comment-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.comment-content {
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
