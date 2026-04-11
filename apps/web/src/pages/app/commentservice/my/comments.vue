<template>
  <v-container fluid class="pa-4 pa-md-6" style="max-width: 1100px">
    <v-btn
      variant="text"
      prepend-icon="mdi-arrow-left"
      to="/app/commentservice/space"
      class="mb-4 text-none"
    >
      返回空间列表
    </v-btn>

    <div class="text-h5 font-weight-bold mb-1" style="letter-spacing: -0.5px">
      我的评论
    </div>
    <div class="text-body-2 text-medium-emphasis mb-5">
      查看我在所有空间发表的评论
    </div>

    <!-- Toolbar -->
    <v-card variant="flat" border class="mb-4">
      <v-card-text class="pa-4 d-flex align-center flex-wrap ga-3">
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
        <tbody>
          <tr
            v-for="comment in comments"
            :key="comment.objectId"
            class="comment-row"
          >
            <td class="py-3" style="vertical-align: top">
              <div class="d-flex align-center flex-wrap ga-1 mb-1">
                <v-chip
                  v-if="comment.space"
                  size="small"
                  variant="tonal"
                  :to="`/app/commentservice/${comment.space.cuid}`"
                >
                  {{ comment.space.name }}
                </v-chip>
                <span class="text-caption text-medium-emphasis">
                  {{ formatDate(comment.insertedAt) }}
                  <span v-if="comment.url">
                    于
                    <a
                      v-if="buildUrl(comment)"
                      :href="buildUrl(comment)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-primary text-decoration-none"
                    >
                      <code class="text-caption">{{ comment.url }}</code>
                    </a>
                    <code v-else class="text-caption">{{ comment.url }}</code>
                  </span>
                </span>
              </div>
              <div class="text-body-2 mb-2 comment-content">
                {{ comment.orig || comment.comment }}
              </div>
              <v-chip
                :color="statusColor(comment.status)"
                size="x-small"
                variant="flat"
              >
                {{ statusLabel(comment.status) }}
              </v-chip>
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
  </v-container>
</template>

<script setup>
import { ref, watch, onMounted } from "vue";
import { useSeo } from "@/composables/useSeo";
import { getMyComments } from "@/services/commentService";

useSeo({
  title: "我的评论",
  description: "查看你在所有评论空间中发表的评论，包含评论状态和来源信息。",
});

const comments = ref([]);
const loading = ref(true);
const page = ref(1);
const totalPages = ref(1);
const keyword = ref("");
const activeKeyword = ref("");

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

function buildUrl(comment) {
  const domain = comment.space?.domain;
  if (!comment.url || !domain) return "";
  const base = domain.replace(/\/+$/, "");
  const p = comment.url.startsWith("/") ? comment.url : `/${comment.url}`;
  const origin = base.startsWith("http") ? base : `https://${base}`;
  return `${origin}${p}`;
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
    if (activeKeyword.value) params.keyword = activeKeyword.value;
    const res = await getMyComments(params);
    const d = res.data;
    comments.value = d.data || [];
    totalPages.value = d.totalPages || 1;
  } catch (e) {
    console.error("Failed to load my comments:", e);
    comments.value = [];
  } finally {
    loading.value = false;
  }
}

watch(page, loadComments);
onMounted(loadComments);
</script>

<style scoped>
.comment-content {
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
