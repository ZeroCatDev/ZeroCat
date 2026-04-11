<route lang="yaml">
meta:
  layout: simple
</route>

<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="5" md="4">
        <v-card variant="flat" border class="text-center pa-8">
          <!-- Loading State -->
          <div v-if="loading" class="py-4">
            <v-progress-circular
              indeterminate
              color="primary"
              size="56"
              width="4"
              class="mb-6"
            />
            <div class="text-h6 font-weight-bold mb-2">{{ title }}</div>
            <div class="text-body-2 text-medium-emphasis">{{ message }}</div>
          </div>

          <!-- Error State -->
          <div v-else-if="error" class="py-4">
            <v-avatar size="64" color="error" variant="tonal" class="mb-6">
              <v-icon size="32" color="error">mdi-alert-circle</v-icon>
            </v-avatar>
            <div class="text-h6 font-weight-bold mb-2">{{ title }}</div>
            <div class="text-body-2 text-medium-emphasis mb-6">{{ message }}</div>
            <v-btn color="primary" variant="tonal" @click="retry" class="text-none">
              重试
            </v-btn>
          </div>

          <!-- Success State -->
          <div v-else-if="success" class="py-4">
            <v-avatar size="64" color="success" variant="tonal" class="mb-6">
              <v-icon size="32" color="success">mdi-check-circle</v-icon>
            </v-avatar>
            <div class="text-h6 font-weight-bold mb-2">{{ title }}</div>
            <div class="text-body-2 text-medium-emphasis">{{ message }}</div>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useSeo } from "@/composables/useSeo";
import { localuser } from "@/services/localAccount";
import { walineLogin } from "@/services/commentService";

useSeo({
  title: "评论登录",
  description: "通过 ZeroCat 账号登录评论系统。",
});

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const error = ref(false);
const success = ref(false);
const title = ref("正在登录...");
const message = ref("请稍候，正在验证身份");

async function doLogin() {
  const spaceCuid = route.query.space;

  if (!spaceCuid) {
    error.value = true;
    loading.value = false;
    title.value = "参数错误";
    message.value = "缺少 space 参数";
    return;
  }

  // Check ZeroCat login
  if (!localuser.isLogin.value) {
    const currentUrl = window.location.pathname + window.location.search;
    router.replace({
      path: "/app/account/login",
      query: { redirect: currentUrl },
    });
    return;
  }

  try {
    const res = await walineLogin(spaceCuid);

    if (res.errno !== 0 && res.status !== "success") {
      throw new Error(res.errmsg || res.message || "登录失败");
    }

    const data = res.data;
    success.value = true;
    loading.value = false;
    title.value = "登录成功";
    message.value = `欢迎，${data.nick || "用户"}`;

    // postMessage back to Waline client popup
    if (window.opener) {
      window.opener.postMessage({ type: "profile", data }, "*");
      setTimeout(() => window.close(), 600);
    } else {
      message.value = "登录成功，但无法回传至评论组件。请关闭此窗口后刷新页面。";
    }
  } catch (e) {
    error.value = true;
    loading.value = false;
    title.value = "登录失败";
    message.value = e.response?.data?.message || e.message || "未知错误";
  }
}

function retry() {
  loading.value = true;
  error.value = false;
  success.value = false;
  title.value = "正在登录...";
  message.value = "请稍候，正在验证身份";
  doLogin();
}

onMounted(doLogin);
</script>
