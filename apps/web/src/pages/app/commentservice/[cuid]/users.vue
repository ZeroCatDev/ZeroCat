<template>
  <v-container fluid class="pa-4 pa-md-6" style="max-width: 840px">
    <v-btn
      variant="text"
      prepend-icon="mdi-arrow-left"
      :to="`/app/commentservice/${cuid}`"
      class="mb-4 text-none"
    >
      返回空间详情
    </v-btn>

    <div class="text-h5 font-weight-bold mb-1" style="letter-spacing: -0.5px">
      用户管理
    </div>
    <div class="text-body-2 text-medium-emphasis mb-5">
      管理用户角色和权限
    </div>

    <!-- Toolbar -->
    <v-card variant="flat" border class="mb-4">
      <v-card-text class="pa-4 d-flex align-center flex-wrap ga-3">
        <v-btn-toggle v-model="filter.type" mandatory density="compact" color="primary">
          <v-btn value="" class="text-none">全部</v-btn>
          <v-btn value="moderator" class="text-none">审核员</v-btn>
          <v-btn value="guest" class="text-none">普通用户</v-btn>
          <v-btn value="banned" class="text-none">封禁</v-btn>
        </v-btn-toggle>

        <v-spacer />

        <v-text-field
          v-model="keyword"
          placeholder="搜索用户..."
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
      <v-skeleton-loader v-for="i in 3" :key="i" type="list-item-two-line" class="mb-2" />
    </template>

    <!-- Empty -->
    <v-card v-else-if="users.length === 0" variant="flat" border class="text-center py-16 px-8">
      <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-account-off-outline</v-icon>
      <div class="text-body-1 text-medium-emphasis">暂无用户</div>
    </v-card>

    <!-- User List -->
    <template v-else>
      <v-card
        v-for="u in users"
        :key="u.id"
        variant="flat"
        border
        class="mb-2 user-card"
      >
        <v-card-text class="d-flex align-center pa-4">
          <v-avatar size="42" class="mr-3" color="grey-lighten-3">
            <v-img v-if="u.avatar" :src="s3BucketUrl + '/assets/' + u.avatar.slice(0, 2) + '/' + u.avatar.slice(2, 4) + '/' + u.avatar + '.webp'" />
          </v-avatar>
          <div class="flex-grow-1" style="min-width: 0">
            <div class="d-flex align-center flex-wrap ga-2">
              <span class="text-subtitle-2 font-weight-bold">
                {{ u.display_name || u.user?.display_name || '未知用户' }}
              </span>
              <v-chip
                :color="roleColor(u.type)"
                size="x-small"
                variant="flat"
              >
                {{ roleLabel(u.type) }}
              </v-chip>
              <v-chip v-if="u.label" size="x-small" variant="tonal">
                {{ u.label }}
              </v-chip>
            </div>
            <div class="text-caption text-medium-emphasis">
              <span v-if="u.email">{{ u.email }}</span>
              <span v-if="u.user?.username" class="ml-2">@{{ u.user.username }}</span>
            </div>
          </div>

          <!-- Actions -->
          <v-menu>
            <template v-slot:activator="{ props }">
              <v-btn icon="mdi-dots-vertical" variant="text" size="small" v-bind="props" />
            </template>
            <v-list density="compact">
              <v-list-subheader>设置角色</v-list-subheader>
              <v-list-item
                v-for="role in roleOptions"
                :key="role.value"
                :active="u.type === role.value"
                @click="changeRole(u, role.value)"
              >
                <template v-slot:prepend>
                  <v-icon :color="role.color" size="small">{{ role.icon }}</v-icon>
                </template>
                <v-list-item-title>{{ role.label }}</v-list-item-title>
              </v-list-item>
              <v-divider />
              <v-list-item @click="openLabelDialog(u)">
                <template v-slot:prepend>
                  <v-icon size="small">mdi-tag-outline</v-icon>
                </template>
                <v-list-item-title>设置标签</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </v-card-text>
      </v-card>

      <!-- Pagination -->
      <div class="d-flex justify-center mt-4" v-if="totalPages > 1">
        <v-pagination
          v-model="page"
          :length="totalPages"
          :total-visible="5"
          density="compact"
        />
      </div>
    </template>

    <!-- Label Dialog -->
    <v-dialog v-model="labelDialog" max-width="420">
      <v-card border>
        <v-card-text class="pa-6">
          <div class="text-h6 font-weight-bold mb-4">设置标签</div>
          <div class="text-caption font-weight-medium text-medium-emphasis mb-2">用户标签</div>
          <v-text-field
            v-model="labelValue"
            variant="solo-filled"
            flat
            density="comfortable"
            placeholder="例如：博主、特邀嘉宾"
            hint="留空可清除标签"
            persistent-hint
          />
        </v-card-text>
        <v-card-actions class="px-6 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="labelDialog = false" class="text-none">取消</v-btn>
          <v-btn color="primary" :loading="savingLabel" @click="saveLabel" class="text-none">
            保存
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useSeo } from "@/composables/useSeo";
import { getSpaceUsers, updateSpaceUser } from "@/services/commentService";
import { get } from "@/services/serverConfig";
useSeo({
  title: "用户管理",
  description: "管理评论空间的用户角色和权限，包括审核员、普通用户和封禁操作。",
});

const route = useRoute();
const cuid = route.params.cuid;

const users = ref([]);
const loading = ref(true);
const page = ref(1);
const totalPages = ref(1);
const filter = reactive({ type: "" });
const keyword = ref("");
const activeKeyword = ref("");

const labelDialog = ref(false);
const labelValue = ref("");
const labelTarget = ref(null);
const savingLabel = ref(false);
const s3BucketUrl = get("s3.staticurl");
const roleOptions = [
  { value: "moderator", label: "审核员", color: "warning", icon: "mdi-account-check" },
  { value: "guest", label: "普通用户", color: "info", icon: "mdi-account" },
  { value: "banned", label: "封禁", color: "grey", icon: "mdi-account-cancel" },
];

function roleColor(type) {
  return { administrator: "error", moderator: "warning", guest: "info", banned: "grey" }[type] || "grey";
}

function roleLabel(type) {
  return { administrator: "管理员", moderator: "审核员", guest: "用户", banned: "封禁" }[type] || type;
}

function doSearch() {
  activeKeyword.value = keyword.value?.trim() || "";
  page.value = 1;
  loadUsers();
}

function clearSearch() {
  keyword.value = "";
  activeKeyword.value = "";
  page.value = 1;
  loadUsers();
}

async function loadUsers() {
  loading.value = true;
  try {
    const params = { page: page.value, pageSize: 20 };
    if (filter.type) params.type = filter.type;
    if (activeKeyword.value) params.keyword = activeKeyword.value;
    const res = await getSpaceUsers(cuid, params);
    const d = res.data;
    users.value = d.users || [];
    totalPages.value = d.totalPages || 1;
  } catch (e) {
    console.error("Failed to load users:", e);
    users.value = [];
  } finally {
    loading.value = false;
  }
}

async function changeRole(user, type) {
  try {
    await updateSpaceUser(cuid, user.user_id, { type });
    user.type = type;
  } catch (e) {
    console.error("Failed to update role:", e);
  }
}

function openLabelDialog(user) {
  labelTarget.value = user;
  labelValue.value = user.label || "";
  labelDialog.value = true;
}

async function saveLabel() {
  if (!labelTarget.value) return;
  savingLabel.value = true;
  try {
    await updateSpaceUser(cuid, labelTarget.value.user_id, {
      label: labelValue.value || null,
    });
    labelTarget.value.label = labelValue.value || null;
    labelDialog.value = false;
  } catch (e) {
    console.error("Failed to update label:", e);
  } finally {
    savingLabel.value = false;
  }
}

watch(() => filter.type, () => {
  page.value = 1;
  loadUsers();
});
watch(page, loadUsers);
onMounted(loadUsers);
</script>

<style scoped>
.user-card {
  transition: border-color 0.15s ease;
}

.user-card:hover {
  border-color: rgba(var(--v-theme-on-surface), 0.2);
}
</style>
