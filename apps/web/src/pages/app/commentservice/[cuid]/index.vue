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

    <!-- Loading -->
    <v-skeleton-loader v-if="loading" type="card, card" />

    <template v-else-if="space">
      <!-- Header -->
      <div class="d-flex align-center mb-6 flex-wrap ga-3">
        <v-avatar size="48" color="primary" variant="tonal" class="mr-1">
          <v-icon size="24" color="primary">mdi-comment-text-outline</v-icon>
        </v-avatar>
        <div>
          <div class="text-h5 font-weight-bold" style="letter-spacing: -0.5px">
            {{ space.name }}
          </div>
          <div class="text-body-2 text-medium-emphasis">
            <code class="text-caption" style="opacity: 0.7">{{ space.cuid }}</code>
          </div>
        </div>
        <v-spacer />
        <v-chip
          v-if="isOwner"
          :color="space.status === 'active' ? 'success' : 'grey'"
          size="small"
          variant="flat"
        >
          <v-icon start size="12">
            {{ space.status === 'active' ? 'mdi-circle' : 'mdi-circle-outline' }}
          </v-icon>
          {{ space.status === 'active' ? '启用' : '已停用' }}
        </v-chip>
      </div>

      <!-- Stats (owner only) -->
      <v-row v-if="isOwner" class="mb-6">
        <v-col v-for="stat in statCards" :key="stat.label" cols="6" sm="3">
          <v-card variant="flat" border class="stat-card">
            <v-card-text class="pa-4 text-center">
              <div class="text-h4 font-weight-bold mb-1" :class="`text-${stat.color}`">
                {{ stat.value }}
              </div>
              <div class="text-caption text-medium-emphasis font-weight-medium">
                {{ stat.label }}
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Quick Nav (owner only) -->
      <div v-if="isOwner" class="mb-6">
        <div class="text-subtitle-2 font-weight-medium text-medium-emphasis mb-3">快捷操作</div>
        <v-row>
          <v-col v-for="nav in navItems" :key="nav.to" cols="12" sm="6" md="3">
            <v-card
              :to="nav.to"
              variant="flat"
              border
              hover
              class="nav-card pa-4 d-flex align-center h-100"
            >
              <v-avatar size="40" :color="nav.color" variant="tonal" class="mr-3 flex-shrink-0">
                <v-icon :color="nav.color" size="20">{{ nav.icon }}</v-icon>
              </v-avatar>
              <div class="flex-grow-1" style="min-width: 0">
                <div class="text-subtitle-2 font-weight-medium">{{ nav.title }}</div>
                <div class="text-caption text-medium-emphasis">{{ nav.desc }}</div>
              </div>
              <v-icon size="16" color="grey" class="ml-2 flex-shrink-0">mdi-chevron-right</v-icon>
            </v-card>
          </v-col>
        </v-row>
      </div>

      <!-- Space Info -->
      <v-card variant="flat" border class="mb-5">
        <v-card-text class="pa-5">
          <div class="text-subtitle-1 font-weight-bold mb-4">空间信息</div>
          <v-table density="compact">
            <tbody>
              <tr>
                <td class="text-medium-emphasis font-weight-medium" style="width: 130px">空间 ID</td>
                <td><code>{{ space.cuid }}</code></td>
              </tr>
              <tr v-if="space.domain">
                <td class="text-medium-emphasis font-weight-medium">绑定域名</td>
                <td>{{ space.domain }}</td>
              </tr>
              <tr v-if="space.owner">
                <td class="text-medium-emphasis font-weight-medium">所有者</td>
                <td>
                  <div class="d-flex align-center ga-2">
                    <v-avatar size="24">
                      <v-img v-if="space.owner.avatar" :src="s3BucketUrl +'/assets/' + space.owner.avatar.slice(0, 2) + '/' + space.owner.avatar.slice(2, 4) + '/' + space.owner.avatar + '.webp'" />
                      <v-icon v-else size="24">mdi-account-circle</v-icon>
                    </v-avatar>
                    <router-link
                      :to="`/${space.owner.username}`"
                      class="text-primary text-decoration-none"
                    >
                      {{ space.owner.display_name || space.owner.username }}
                    </router-link>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="text-medium-emphasis font-weight-medium">创建时间</td>
                <td>{{ formatDate(space.created_at) }}</td>
              </tr>
              <tr v-if="space.updated_at">
                <td class="text-medium-emphasis font-weight-medium">更新时间</td>
                <td>{{ formatDate(space.updated_at) }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-card>

      <!-- Moderators -->
      <v-card v-if="space.moderators && space.moderators.length" variant="flat" border>
        <v-card-text class="pa-5">
          <div class="text-subtitle-1 font-weight-bold mb-4">管理</div>
          <v-list density="compact" class="pa-0" bg-color="transparent">
            <v-list-item
              v-for="mod in space.moderators"
              :key="mod.id"
              :to="`/${mod.username}`"
              class="px-0 rounded-lg"
            >
              <template #prepend>
                <v-avatar size="36" class="mr-3">
                  <v-img v-if="mod.avatar" :src="s3BucketUrl +'/assets/' + mod.avatar.slice(0, 2) + '/' + mod.avatar.slice(2, 4) + '/' + mod.avatar + '.webp'" />
                  <v-icon v-else size="36">mdi-account-circle</v-icon>
                </v-avatar>
              </template>
              <v-list-item-title class="text-body-2 font-weight-medium">
                {{ mod.display_name || mod.username }}
              </v-list-item-title>
              <v-list-item-subtitle class="text-caption">
                @{{ mod.username }}
              </v-list-item-subtitle>
              <template #append>
                <v-chip
                  :color="mod.role === 'administrator' ? 'primary' : 'warning'"
                  size="x-small"
                  variant="flat"
                >
                  {{ mod.role === 'administrator' ? '管理员' : '审核员' }}
                </v-chip>
              </template>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>

    </template>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useSeo } from "@/composables/useSeo";
import { getSpace, getSpaceStats } from "@/services/commentService";
import { get } from "@/services/serverConfig";
const route = useRoute();
const cuid = route.params.cuid;

const space = ref(null);
const stats = ref({ commentCount: 0, userCount: 0, waitingCount: 0, spamCount: 0 });
const loading = ref(true);

const seoTitle = computed(() =>
  space.value ? `${space.value.name} - 空间详情` : "空间详情"
);
const seoDesc = computed(() =>
  space.value
    ? `${space.value.name} 的 Waline 评论空间详情，包含评论统计、用户管理和空间配置。`
    : "Waline 评论空间详情页"
);
useSeo({ title: seoTitle, description: seoDesc });

const isOwner = computed(() => !!space.value?.status);
const s3BucketUrl = get("s3.staticurl");

const statCards = computed(() => [
  { label: "评论总数", value: stats.value.commentCount, color: "primary" },
  { label: "用户数", value: stats.value.userCount, color: "success" },
  { label: "待审核", value: stats.value.waitingCount, color: "warning" },
  { label: "垃圾评论", value: stats.value.spamCount, color: "error" },
]);

const navItems = computed(() => [
  {
    to: `/app/commentservice/${cuid}/comments`,
    icon: "mdi-comment-text-multiple-outline",
    color: "primary",
    title: "评论管理",
    desc: "审核和管理评论",
  },
  {
    to: `/app/commentservice/${cuid}/users`,
    icon: "mdi-account-group-outline",
    color: "success",
    title: "用户管理",
    desc: "管理用户角色和权限",
  },
  {
    to: `/app/commentservice/${cuid}/settings`,
    icon: "mdi-cog-outline",
    color: "warning",
    title: "空间配置",
    desc: "审核、频率限制等设置",
  },
  {
    to: `/app/commentservice/${cuid}/guide`,
    icon: "mdi-code-tags",
    color: "info",
    title: "接入指南",
    desc: "获取嵌入代码",
  },
]);

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("zh-CN");
}

onMounted(async () => {
  try {
    const spaceRes = await getSpace(cuid);
    space.value = spaceRes.data;

    if (isOwner.value) {
      try {
        const statsRes = await getSpaceStats(cuid);
        stats.value = statsRes.data || stats.value;
      } catch (e) {
        console.error("Failed to load stats:", e);
      }
    }
  } catch (e) {
    console.error("Failed to load space:", e);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.stat-card {
  transition: border-color 0.2s ease;
}

.stat-card:hover {
  border-color: rgba(var(--v-theme-on-surface), 0.2);
}

.nav-card {
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.nav-card:hover {
  border-color: rgb(var(--v-theme-primary)) !important;
  box-shadow: 0 2px 12px rgba(var(--v-theme-primary), 0.06);
}
</style>
