<template>
  <v-container fluid>
    <v-row class="mb-4">
      <v-col>
        <div class="d-flex align-center">
          <h1 class="text-h4">OAuth 应用</h1>
          <v-spacer></v-spacer>
          <v-btn
            :to="'/app/oauth/applications/new'"
            color="primary"
            prepend-icon="mdi-plus"
          >
            新建应用
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <!-- 应用列表 -->
    <v-row>
      <v-col>
        <v-card>
          <!-- 加载状态 -->
          <v-card-text v-if="loading" class="text-center py-8">
            <v-progress-circular indeterminate></v-progress-circular>
          </v-card-text>

          <!-- 空状态 -->
          <v-card-text
            v-else-if="applications.length === 0"
            class="text-center py-8"
          >
            <v-icon
              class="mb-4"
              color="grey"
              icon="mdi-apps"
              size="64"
            ></v-icon>
            <h3 class="text-h6 mb-2">还没有OAuth应用</h3>
            <p class="text-body-1 text-grey">
              创建一个新的OAuth应用来让其他用户通过OAuth授权访问你的应用。
            </p>
            <v-btn
              :to="'/app/oauth/applications/new'"
              class="mt-4"
              color="primary"
            >
              创建第一个应用
            </v-btn>
          </v-card-text>

          <!-- 应用列表 -->
          <template v-else>
            <v-list lines="two">
              <v-list-item
                v-for="app in applications"
                :key="app.client_id"
                :style="{ display: app.status == 'deleted' ? 'none' : '' }"
                :to="`/app/oauth/applications/${app.client_id}`"
                class="app-list-item"
              >
                <template v-slot:prepend>
                  <v-avatar
                    :image="app.logo_url || '/default-app-logo.png'"
                    class="mr-4"
                    size="48"
                  ></v-avatar>
                </template>

                <v-list-item-title class="text-h6 mb-1">
                  {{ app.name }}
                  <v-chip
                    v-if="app.is_verified"
                    class="ml-2"
                    color="success"
                    size="small"
                  >
                    已验证
                  </v-chip>
                </v-list-item-title>

                <v-list-item-subtitle>
                  <div class="d-flex align-center text-grey">
                    <v-icon
                      class="mr-1"
                      icon="mdi-identifier"
                      size="small"
                    ></v-icon>
                    <span class="mr-4">{{ app.client_id }}</span>
                    <v-icon
                      class="mr-1"
                      icon="mdi-clock-outline"
                      size="small"
                    ></v-icon>
                    <span
                    >创建于
                      {{ new Date(app.created_at).toLocaleDateString() }}</span
                    >
                  </div>
                  <div class="mt-1">{{ app.description || "暂无描述" }}</div>
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </template>
        </v-card>
      </v-col>
    </v-row>

    <!-- 错误提示 -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>

<script setup>
import {ref, onMounted} from "vue";
import axios from "@/axios/axios";

// 状态变量
const applications = ref([]);
const loading = ref(false);
const snackbar = ref({
  show: false,
  text: "",
  color: "error",
});

// 加载应用列表
const loadApplications = async () => {
  loading.value = true;
  try {
    const response = await axios.get("/oauth/applications");
    applications.value = response.data;
  } catch (error) {
    showError("加载应用列表失败");
    console.error("Failed to load applications:", error);
  }
  loading.value = false;
};

// 显示错误信息
const showError = (text) => {
  snackbar.value = {
    show: true,
    text,
    color: "error",
  };
};

// 页面加载时获取数据
onMounted(() => {
  loadApplications();
});
</script>

<style scoped>
.app-list-item {
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

.app-list-item:last-child {
  border-bottom: none;
}

.app-list-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.05);
}
</style>
