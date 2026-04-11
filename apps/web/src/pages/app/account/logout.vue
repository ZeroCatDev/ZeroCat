<template>
  <v-container>
    <v-card border class="mx-auto" rel="noopener" target="_blank">
      <template v-slot:title>
        <span>{{ titlemessage }}</span></template
      >
      <template v-slot:subtitle>
        <span>正在退出您的ZeroCat账户</span></template
      >
      <v-card-text class="bg-surface-light pt-4">{{ log }}</v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useNotificationStore } from "@/stores/notification";
import { useHead } from "@unhead/vue";

useHead({
  title: "退出",
});

const router = useRouter();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();
const titlemessage = ref("正在退出账户");
const log = ref("");

onMounted(async () => {
  log.value = "正在退出账户...";

  try {
    await authStore.logout(true);
  } catch {
    // 即使出错也继续清理
  }

  // 清除其他 store 中的用户数据
  notificationStore.resetUnreadCount();

  titlemessage.value = "已成功退出";
  log.value = "您已安全退出账户，正在返回首页...";

  setTimeout(() => {
    router.push("/");
  }, 1000);
});
</script>
