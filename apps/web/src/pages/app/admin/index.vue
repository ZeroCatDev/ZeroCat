<template>
  <v-container>
    <!-- 主标题卡片 -->
    <v-card class="mb-6" elevation="2">
      <v-card-item>
        <template v-slot:prepend>
          <v-icon
            class="me-4"
            color="primary"
            icon="mdi-code-braces"
            size="large"
          ></v-icon>
        </template>
        <v-card-title class="text-h5">系统管理</v-card-title>
        <v-card-subtitle class="mt-2"> 系统管理</v-card-subtitle>
      </v-card-item>
    </v-card>
<v-card class="mb-6" elevation="2" @click="openAdminQueues">
      <v-card-item>
        <template v-slot:prepend>
          <v-icon
            class="me-4"
            color="primary"
            icon="mdi-code-braces"
            size="large"
          ></v-icon>
        </template>
        <v-card-title class="text-h5">Bullmq</v-card-title>
        <v-card-subtitle class="mt-2"> 面板</v-card-subtitle>
      </v-card-item>
    </v-card>
    <v-row>
      <!-- OAuth 应用卡片 -->
      <v-col v-for="item in config" :key="item.path" cols="6" md="6">
        <v-card :to="item.path" elevation="1" hover>
          <v-card-item>
            <v-card-title>{{ item.name }}</v-card-title>
            <v-card-subtitle>
              {{ item.path }}
            </v-card-subtitle>
            <template v-slot:append>
              <v-icon icon="mdi-chevron-right"></v-icon>
            </template>
          </v-card-item>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { get, fetchConfig } from "@/services/serverConfig";

export default {
  name: "AdminIndex",
  data() {
    return {
      config: [
        {name: "配置管理", path: "/app/admin/config"},
        {name: "Sitemap", path: "/app/admin/sitemap"},
        {name: "用户管理", path: "/app/admin/users"},
        {name: "项目管理", path: "/app/admin/project"},
        {name: "扩展管理", path: "/app/admin/extensions"},
        {name: "OAuth应用", path: "/app/admin/oauth/applications"},
        {name: "通知管理", path: "/app/admin/notifications"},
        {name: "评论服务", path: "/app/admin/commentservice"},
        {name: "联邦管理", path: "/app/admin/federation"},
        {name: "Gorse 推荐", path: "/app/admin/gorse"},
        {name: "Embedding 向量", path: "/app/admin/embedding"},
        {name: "40code 镜像同步", path: "/app/admin/mirror40code"},
      ],
    };
  },
  methods: {
    openAdminQueues() {
      const token = localStorage.getItem("token")
      const backendUrl = get("urls.backend");
      window.open(`${backendUrl}/admin/queues/auth?token=${token}`);
    }
}
}
</script>
