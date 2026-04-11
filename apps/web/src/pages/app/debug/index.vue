<template>
  <v-container>
    <!-- 主标题卡片 -->
    <v-card class="mb-6" elevation="2">
      <v-card-item>

        <v-card-title class="text-h5">调试工具</v-card-title>
        <v-card-subtitle class="mt-2">
          调试
        </v-card-subtitle>
      </v-card-item>
    </v-card>

    <v-row>
      <!-- OAuth 应用卡片 -->
      <v-col v-for="item in items" :key="item.title" :to="item.link" cols="12" md="6">
        <v-card :to="item.link" class="h-100" elevation="1" hover>
          <v-card-item>
            <v-card-title>{{ item.title }}</v-card-title>
            <v-card-subtitle class="mt-2">
              {{ item.description }}
            </v-card-subtitle>

          </v-card-item>
        </v-card>
      </v-col>


    </v-row>


  </v-container>
</template>

<script setup>
const items = [
  {
    title: '接口调试',
    description: '/app/debug/api',
    link: '/app/debug/api'
  },
  {
    title: '缓存管理',
    description: '/app/debug/kv',
    link: '/app/debug/kv'
  },
  {
    title: '浏览器指纹',
    description: '/app/debug/fingerprint',
    link: '/app/debug/fingerprint'
  },
  {
    title: '用户令牌',
    description: '/app/debug/token',
    link: '/app/debug/token'
  },


]
</script>

<style scoped>
.v-card {
  transition: transform 0.2s;
}

.v-card:hover {
  transform: translateY(-2px);
}
</style>
