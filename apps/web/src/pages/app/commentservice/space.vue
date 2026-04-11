<template>
  <v-container fluid class="pa-4 pa-md-6" style="max-width: 1100px">
    <!-- Page Header -->
    <div class="d-flex align-center mb-6">
      <div>
        <div class="text-h5 font-weight-bold mb-1" style="letter-spacing: -0.5px">
          评论空间
        </div>
        <div class="text-body-2 text-medium-emphasis">
          管理你的评论服务空间
        </div>
      </div>
      <v-spacer />
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        to="/app/commentservice/create"
        class="text-none"
      >
        创建空间
      </v-btn>
    </div>

    <!-- Loading -->
    <v-row v-if="loading">
      <v-col v-for="i in 3" :key="i" cols="12" sm="6" md="4">
        <v-skeleton-loader type="card" />
      </v-col>
    </v-row>

    <!-- Empty -->
    <v-card
      v-else-if="spaces.length === 0"
      variant="flat"
      class="text-center py-16 px-8"
      border
    >
      <v-icon size="72" color="grey-lighten-1" class="mb-4">mdi-comment-off-outline</v-icon>
      <div class="text-h6 text-medium-emphasis mb-2">暂无评论空间</div>
      <div class="text-body-2 text-medium-emphasis mb-6">
        创建一个空间，开始接入评论服务
      </div>
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        to="/app/commentservice/create"
        class="text-none"
      >
        创建空间
      </v-btn>
    </v-card>

    <!-- Space List -->
    <v-row v-else>
      <v-col v-for="space in spaces" :key="space.cuid" cols="12" sm="6" md="4">
        <v-card
          :to="`/app/commentservice/${space.cuid}`"
          variant="flat"
          border
          hover
          class="space-card h-100"
        >
          <v-card-text class="pa-5">
            <div class="d-flex align-center mb-3">
              <v-avatar
                size="40"
                :color="space.status === 'active' ? 'primary' : 'grey-lighten-2'"
                variant="tonal"
                class="mr-3"
              >
                <v-icon size="20" :color="space.status === 'active' ? 'primary' : 'grey'">
                  mdi-comment-text-outline
                </v-icon>
              </v-avatar>
              <div class="flex-grow-1" style="min-width: 0">
                <div class="text-subtitle-1 font-weight-bold text-truncate">
                  {{ space.name }}
                </div>
              </div>
              <v-chip
                :color="space.status === 'active' ? 'success' : 'grey'"
                size="x-small"
                variant="flat"
                class="ml-2 flex-shrink-0"
              >
                {{ space.status === 'active' ? '启用' : '已停用' }}
              </v-chip>
            </div>

            <v-divider class="mb-3" />

            <div v-if="space.domain" class="text-body-2 text-medium-emphasis mb-2 d-flex align-center">
              <v-icon size="14" class="mr-2" color="grey">mdi-web</v-icon>
              <span class="text-truncate">{{ space.domain }}</span>
            </div>
            <div class="text-caption text-medium-emphasis d-flex align-center">
              <v-icon size="14" class="mr-2" color="grey">mdi-clock-outline</v-icon>
              创建于 {{ formatDate(space.created_at) }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- My Comments Link -->
    <v-card
      variant="flat"
      border
      class="mt-8 pa-5 d-flex align-center my-comments-card"
      to="/app/commentservice/my/comments"
      hover
    >
      <v-avatar size="44" color="primary" variant="tonal" class="mr-4">
        <v-icon color="primary">mdi-comment-account-outline</v-icon>
      </v-avatar>
      <div>
        <div class="text-subtitle-1 font-weight-medium">我的评论</div>
        <div class="text-caption text-medium-emphasis">查看我在所有空间发表的评论</div>
      </div>
      <v-spacer />
      <v-icon color="grey">mdi-chevron-right</v-icon>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useSeo } from "@/composables/useSeo";
import { getSpaces } from "@/services/commentService";

useSeo({
  title: "评论空间",
  description: "管理你的 Waline 评论服务空间，查看所有已创建的评论后端实例。",
});

const spaces = ref([]);
const loading = ref(true);

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("zh-CN");
}

onMounted(async () => {
  try {
    const res = await getSpaces();
    spaces.value = res.data || [];
  } catch (e) {
    console.error("Failed to load spaces:", e);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.space-card {
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.space-card:hover {
  border-color: rgb(var(--v-theme-primary)) !important;
  box-shadow: 0 4px 16px rgba(var(--v-theme-primary), 0.08);
}

.my-comments-card {
  transition: border-color 0.2s ease;
}

.my-comments-card:hover {
  border-color: rgb(var(--v-theme-primary)) !important;
}
</style>
