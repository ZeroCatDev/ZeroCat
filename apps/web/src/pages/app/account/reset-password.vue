<template>
  <v-container class="d-flex align-center justify-center fill-height pa-4">
    <v-card border rounded="xl" max-width="448" width="100%" class="mx-auto pa-5 pa-sm-8">
      <div class="text-center mb-6">
        <v-avatar
          size="56"
          :color="done ? 'success' : 'primary'"
          variant="tonal"
          class="mb-3"
        >
          <v-icon size="32">{{ done ? "mdi-check-circle-outline" : "mdi-lock-reset" }}</v-icon>
        </v-avatar>
        <h2 class="text-h5 font-weight-medium">设置新密码</h2>
        <p class="text-body-2 text-medium-emphasis mt-1">
          {{ done ? "密码已更新" : "请输入您的新密码" }}
        </p>
      </div>

      <v-expand-transition>
        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          density="comfortable"
          class="mb-4"
          :text="error"
        />
      </v-expand-transition>

      <!-- 链接无效 -->
      <template v-if="!hasToken">
        <v-alert
          type="warning"
          variant="tonal"
          density="comfortable"
          class="mb-4"
          text="重置链接无效或已过期，请重新申请。"
        />
        <v-btn
          block
          size="large"
          rounded="lg"
          color="primary"
          variant="flat"
          class="text-none"
          to="/app/account/retrieve"
        >
          重新申请重置链接
        </v-btn>
      </template>

      <!-- 重置成功 -->
      <template v-else-if="done">
        <p class="text-body-2 text-medium-emphasis text-center mb-4">
          您的密码已成功重置，请使用新密码登录。
        </p>
        <v-btn
          block
          size="large"
          rounded="lg"
          color="primary"
          variant="flat"
          class="text-none"
          to="/app/account/login"
        >
          前往登录
        </v-btn>
        <p class="text-caption text-medium-emphasis text-center mt-3">
          {{ redirectCountdown }} 秒后自动跳转到登录页
        </p>
      </template>

      <!-- 输入新密码 -->
      <template v-else>
        <v-form @submit.prevent="submit">
          <v-text-field
            v-model="password"
            label="新密码"
            variant="outlined"
            autocomplete="new-password"
            autofocus
            :type="show1 ? 'text' : 'password'"
            :append-inner-icon="show1 ? 'mdi-eye' : 'mdi-eye-off'"
            prepend-inner-icon="mdi-lock-outline"
            :rules="passwordRules"
            @click:append-inner="show1 = !show1"
          />
          <v-text-field
            v-model="confirm"
            label="确认新密码"
            variant="outlined"
            autocomplete="new-password"
            :type="show2 ? 'text' : 'password'"
            :append-inner-icon="show2 ? 'mdi-eye' : 'mdi-eye-off'"
            prepend-inner-icon="mdi-lock-check-outline"
            :rules="confirmRules"
            @click:append-inner="show2 = !show2"
          />
          <v-btn
            type="submit"
            block
            size="large"
            rounded="lg"
            color="primary"
            variant="flat"
            class="text-none mt-1"
            :loading="loading"
          >
            重置密码
          </v-btn>
        </v-form>
      </template>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useHead } from "@unhead/vue";
import AuthService from "@/services/authService";

useHead({ title: "设置新密码" });

const route = useRoute();
const router = useRouter();

const token = ref(typeof route.query.token === "string" ? route.query.token : "");
const hasToken = computed(() => !!token.value);

const password = ref("");
const confirm = ref("");
const show1 = ref(false);
const show2 = ref(false);
const loading = ref(false);
const error = ref("");
const done = ref(false);
const redirectCountdown = ref(3);
let redirectTimer = null;

onBeforeUnmount(() => clearInterval(redirectTimer));

const passwordRules = [
  (v) => !!v || "请输入新密码",
  (v) => v.length >= 8 || "密码至少需要 8 个字符",
  (v) => (/[A-Za-z]/.test(v) && /[0-9]/.test(v)) || "密码必须包含字母和数字",
];
const confirmRules = computed(() => [
  (v) => !!v || "请再次输入新密码",
  (v) => v === password.value || "两次输入的密码不一致",
]);

const submit = async () => {
  error.value = "";
  if (password.value.length < 8 || !/[A-Za-z]/.test(password.value) || !/[0-9]/.test(password.value)) {
    error.value = "密码至少 8 位，且包含字母和数字";
    return;
  }
  if (password.value !== confirm.value) {
    error.value = "两次输入的密码不一致";
    return;
  }
  loading.value = true;
  try {
    const resp = await AuthService.resetPasswordWithToken(
      token.value,
      password.value
    );
    if (resp?.status === "success") {
      done.value = true;
      // 体验增强：成功后自动跳转登录
      redirectTimer = setInterval(() => {
        redirectCountdown.value -= 1;
        if (redirectCountdown.value <= 0) {
          clearInterval(redirectTimer);
          router.push("/app/account/login");
        }
      }, 1000);
    } else {
      error.value = resp?.message || "重置失败，链接可能已失效，请重新申请";
    }
  } catch (e) {
    error.value = e?.response?.data?.message || e?.message || "重置失败，请重试";
  } finally {
    loading.value = false;
  }
};
</script>
