<template>
  <v-container>
    <v-card>
      <v-card-title>Bluesky 同步授权失败</v-card-title>
      <v-card-text>
        <v-alert type="error" variant="tonal" class="mb-4">
          {{ message }}
        </v-alert>
        <v-btn color="primary" to="/app/account/oauth">
          返回账号社交设置
        </v-btn>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const message = computed(() => route.query.message || '授权失败，请重试。');
</script>
