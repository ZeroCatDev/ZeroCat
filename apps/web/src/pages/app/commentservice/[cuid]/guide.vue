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
      接入服务
    </div>
    <div class="text-body-2 text-medium-emphasis mb-6">
      将其接入你的网站中。
    </div>


    <!-- Step 2 -->
    <v-card variant="flat" border class="mb-4">
      <v-card-text class="pa-5">
        <div class="d-flex align-center mb-3">
          <div class="text-subtitle-1 font-weight-bold">Waline 服务端地址</div>
        </div>
        <div class="text-body-2 text-medium-emphasis mb-3">
          在serverURL填入这个地址：
        </div>
        <div class="position-relative">
  <v-text-field
                v-model="serverURL"
                readonly
                variant="flat"
                style="font-family: 'Consolas', 'Monaco', monospace;"
              />
          <v-btn
            icon="mdi-content-copy"
            size="x-small"
            variant="tonal"
            class="position-absolute"
            style="top: 12px; right: 12px"
            @click="copyCode"
          />
        </div>
      </v-card-text>
    </v-card>



    <!-- Step 4 -->
    <v-card variant="flat" border>
      <v-card-text class="pa-5">
        <div class="d-flex align-center mb-3">
          <div class="text-subtitle-1 font-weight-bold">更多文档</div>
        </div>
        <div class="text-body-2">
          完整配置请参考
          <a href="https://waline.js.org/" target="_blank" rel="noopener noreferrer" class="text-primary font-weight-medium">
            Waline 官方文档
          </a>。
        </div>
      </v-card-text>
    </v-card>

    <v-snackbar v-model="copied" :timeout="1500" color="success">
      已复制到剪贴板
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref, computed } from "vue";
import { useRoute } from "vue-router";
import { useSeo } from "@/composables/useSeo";
import { get } from "@/services/serverConfig";

useSeo({
  title: "接入指南",
  description: "获取 Waline 评论服务的 serverURL，将评论系统嵌入你的网站。",
});

const route = useRoute();
const cuid = route.params.cuid;
const copied = ref(false);

const serverURL = computed(() => {
  const origin = get("urls.backend");
  return `${origin}/comment/${cuid}`;
});


async function copyCode() {
  try {
    await navigator.clipboard.writeText(serverURL.value);
    copied.value = true;
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = serverURL.value;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    copied.value = true;
  }
}
</script>
