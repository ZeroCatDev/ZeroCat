<template>
  <v-container>
    <v-card>
      <v-card-title>Twitter 同步授权成功</v-card-title>
      <v-card-text>
        <v-alert type="success" variant="tonal" class="mb-4">
          已完成 Twitter 同步授权，现在可以开启自动同步。
        </v-alert>
        <v-btn color="primary" to="/app/account/oauth">
          返回账号社交设置
        </v-btn>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
</script>
