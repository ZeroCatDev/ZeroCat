<template>
  <v-container class="oauth-apps-page" fluid>
    <div class="page-header mb-4">
      <div class="page-header__text">
        <h1 class="text-h5 font-weight-medium mb-1">OAuth 应用</h1>
        <p class="text-body-2 text-medium-emphasis mb-0">
          管理你创建的第三方应用凭据与回调地址
        </p>
      </div>
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        :to="'/app/oauth/applications/new'"
      >
        新建应用
      </v-btn>
    </div>

    <v-card border flat>
      <v-card-text v-if="loading" class="text-center py-12">
        <v-progress-circular color="primary" indeterminate />
      </v-card-text>

      <v-card-text
        v-else-if="visibleApps.length === 0"
        class="text-center py-12"
      >
        <v-icon class="mb-3" color="medium-emphasis" icon="mdi-shield-key-outline" size="48" />
        <h2 class="text-h6 mb-1">还没有 OAuth 应用</h2>
        <p class="text-body-2 text-medium-emphasis mb-4">
          创建一个应用，让其他服务通过 OAuth 安全访问用户授权的数据。
        </p>
        <v-btn color="primary" :to="'/app/oauth/applications/new'">
          创建第一个应用
        </v-btn>
      </v-card-text>

      <v-list v-else lines="two" class="py-0">
        <v-list-item
          v-for="app in visibleApps"
          :key="app.client_id"
          :to="`/app/oauth/applications/${app.client_id}`"
          class="app-item"
        >
          <template #prepend>
            <v-avatar
              class="mr-3"
              :image="app.logo_url || undefined"
              rounded="lg"
              size="40"
            >
              <v-icon icon="mdi-application-brackets-outline" />
            </v-avatar>
          </template>

          <v-list-item-title class="d-flex align-center flex-wrap ga-1">
            <span class="font-weight-medium">{{ app.name }}</span>
            <v-chip
              v-if="app.is_verified"
              color="success"
              label
              size="x-small"
              variant="tonal"
            >
              已验证
            </v-chip>
            <v-chip
              v-if="app.auto_authorize"
              color="warning"
              label
              size="x-small"
              variant="tonal"
            >
              自动授权
            </v-chip>
          </v-list-item-title>

          <v-list-item-subtitle class="mt-1">
            <span class="app-meta">{{ app.client_id }}</span>
            <span class="app-meta-sep">·</span>
            <span class="app-meta">
              {{ formatDate(app.created_at) }}
            </span>
          </v-list-item-subtitle>

          <template #append>
            <v-icon icon="mdi-chevron-right" size="20" />
          </template>
        </v-list-item>
      </v-list>
    </v-card>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import axios from "@/axios/axios";

const applications = ref([]);
const loading = ref(false);
const snackbar = ref({
  show: false,
  text: "",
  color: "error",
});

const visibleApps = computed(() =>
  applications.value.filter((app) => app.status !== "deleted")
);

const formatDate = (value) => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("zh-CN");
  } catch {
    return String(value);
  }
};

const loadApplications = async () => {
  loading.value = true;
  try {
    const response = await axios.get("/oauth/applications");
    applications.value = Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    snackbar.value = {
      show: true,
      text: "加载应用列表失败",
      color: "error",
    };
    console.error("Failed to load applications:", error);
  }
  loading.value = false;
};

onMounted(() => {
  loadApplications();
});
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.page-header__text {
  min-width: 0;
  flex: 1 1 220px;
}

.app-item {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  min-height: 72px;
}

.app-item:last-child {
  border-bottom: none;
}

.app-meta {
  font-size: 0.78rem;
  word-break: break-all;
}

.app-meta-sep {
  margin: 0 6px;
  opacity: 0.45;
}

@media (max-width: 600px) {
  .oauth-apps-page {
    padding-inline: 12px;
  }

  .page-header .v-btn {
    width: 100%;
  }
}
</style>
