<template>
  <v-dialog v-model="dialogVisible" width="400">


    <v-card rounded="xl">
      <v-card-title></v-card-title>
      <v-card-text>
        <v-btn
          class="float-right"
          icon="mdi-open-in-new"
          size="small"
          to="/app/account/login"
          variant="text"
          @click="dialogVisible = false"
        ></v-btn>

        <h5 class="text-h5 font-weight-semibold mb-1">欢迎来到ZeroCat！ 👋🏻</h5>
        <p class="mb-0">登录你的账户</p>

        <LoginForm
          :showLinks="true"
          :showOAuth="true"
          @close="dialogVisible = false"
          @login-success="handleLoginSuccess"
          @login-error="handleLoginError"
        />
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script>
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import LoginForm from "./LoginForm.vue";

export default {
  name: "LoginDialog",
  components: { LoginForm },
  emits: ["login-success", "login-error"],

  setup(props, { emit }) {
    const authStore = useAuthStore();
    const router = useRouter();

    const dialogVisible = computed({
      get: () => authStore.loginDialogVisible,
      set: (val) => {
        if (val) {
          authStore.showLoginDialog();
        } else {
          authStore.hideLoginDialog();
        }
      },
    });

    const handleLoginSuccess = (response) => {
      authStore.hideLoginDialog();
      emit("login-success", response);

      // If there's a redirect URL, navigate to it
      const redirectUrl = authStore.consumeAuthRedirectUrl();
      if (redirectUrl=="/app/account/logout") {
        router.push("/");
      } else if (redirectUrl) {
        router.push(redirectUrl);
      } else {
        router.push("/");
      }

    };

    const handleLoginError = (error) => {
      emit("login-error", error);
    };

    return {
      dialogVisible,
      handleLoginSuccess,
      handleLoginError,
    };
  },
};
</script>
