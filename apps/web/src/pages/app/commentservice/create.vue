<template>
  <v-container fluid class="pa-4 pa-md-6" style="max-width: 640px">
    <v-btn
      variant="text"
      prepend-icon="mdi-arrow-left"
      to="/app/commentservice/space"
      class="mb-4 text-none"
    >
      返回空间列表
    </v-btn>

    <div class="text-h5 font-weight-bold mb-1" style="letter-spacing: -0.5px">
      创建评论空间
    </div>
    <div class="text-body-2 text-medium-emphasis mb-6">
      创建一个新的空间来接入评论服务
    </div>

    <v-card variant="flat" border class="pa-2">
      <v-card-text>
        <v-form ref="formRef" @submit.prevent="submit">
          <div class="text-caption font-weight-medium text-medium-emphasis mb-2">
            空间名称 <span class="text-error">*</span>
          </div>
          <v-text-field
            v-model="form.name"
            placeholder="例如：我的博客评论"
            :rules="[v => !!v || '空间名称不能为空']"
            variant="solo-filled"
            flat
            density="comfortable"
            class="mb-5"
          />

          <div class="text-caption font-weight-medium text-medium-emphasis mb-2">
            绑定域名（可选）
          </div>
          <v-text-field
            v-model="form.domain"
            placeholder="例如：blog.example.com"
            variant="solo-filled"
            flat
            density="comfortable"
            hint="限制评论嵌入的域名，留空表示不限制"
            persistent-hint
          />
        </v-form>
      </v-card-text>
      <v-card-actions class="px-4 pb-4 pt-2">
        <v-spacer />
        <v-btn variant="text" to="/app/commentservice/space" class="text-none">
          取消
        </v-btn>
        <v-btn
          color="primary"
          :loading="submitting"
          @click="submit"
          class="text-none px-6"
        >
          创建空间
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useSeo } from "@/composables/useSeo";
import { createSpace } from "@/services/commentService";

useSeo({
  title: "创建评论空间",
  description: "创建一个新的 Waline 评论空间，获取独立的评论后端地址，几分钟内接入你的网站。",
});

const router = useRouter();
const formRef = ref(null);
const submitting = ref(false);
const form = ref({
  name: "",
  domain: "",
});

async function submit() {
  const { valid } = await formRef.value.validate();
  if (!valid) return;

  submitting.value = true;
  try {
    const body = { name: form.value.name };
    if (form.value.domain) body.domain = form.value.domain;
    const res = await createSpace(body);
    if (res.data?.cuid) {
      router.push(`/app/commentservice/${res.data.cuid}`);
    }
  } catch (e) {
    console.error("Failed to create space:", e);
  } finally {
    submitting.value = false;
  }
}
</script>
