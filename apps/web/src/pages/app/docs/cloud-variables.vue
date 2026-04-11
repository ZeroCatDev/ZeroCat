<template>
  <v-container>
    <v-card elevation="1" class="mb-4"
      ><v-card-item>
        <v-card-title class="text-h5">云变量</v-card-title>
        <v-card-subtitle class="mt-2">
          使用其他环境连接位于ZeroCat上的项目云变量。
        </v-card-subtitle>
      </v-card-item>
    </v-card>

    <v-card elevation="1" class="h-100">
      <v-card-title>连接配置</v-card-title>

      <v-card-text>
        在项目页面启用云变量匿名读取后，
        你需要在项目打包器（如TurboWarp Packager）中配置云变量地址为：
        <v-text-field
          :model-value="wsUrl"
          readonly
          variant="outlined"
          density="compact"
          class="mt-2"
          append-inner-icon="mdi-content-copy"
          @click:append-inner="copyToClipboard(wsUrl)"
        ></v-text-field
        >你可以在“Cloud Variables”中“Cloud host”一栏找到这个设置。<br />
        然后，将你的作品ID配置为：<br/><p style="color: red;">{{projectId==""?"通过在作品设置页面的链接打开此页面以获取具体的作品ID":""}}</p>
                <v-text-field
          v-model.trim="projectId"
          variant="outlined"
          density="compact"
           class="mt-2"
           append-inner-icon="mdi-content-copy"
          @click:append-inner="copyToClipboard(projectId)"
        />

        在TurboWarp Packager中，你需要点击“Advanced
        Options”（倒数第二个大类别）部分下的“You probably don't want to change
        these. (Click to open)”，并找到“Project ID”。
        你可能还会想将用户名改为一个更好看的名字，注意不要删除随机数部分，不然历史记录会不好分辨。
      </v-card-text>
    </v-card>

    <v-snackbar v-model="copySuccess" timeout="2000" location="top">
      复制成功！
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { computed, ref, watchEffect } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const projectId = ref("");
const username = ref("ExampleUsername");
const apiBaseInput = ref(
  import.meta.env.VITE_APP_BASE_API || window.location.origin,
);
const copySuccess = ref(false);
watchEffect(() => {
  const pid = route.query.projectid || route.query.projectId || route.query.id;
  if (pid) projectId.value = String(pid);
});

const wsUrl = computed(() => {
  const base = apiBaseInput.value || window.location.origin;
  const url = new URL("/scratch/cloud/ws", base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
});
const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text).then(() => {
    copySuccess.value = true;
    setTimeout(() => (copySuccess.value = false), 2000);
  });
};
</script>

<style
</style>
