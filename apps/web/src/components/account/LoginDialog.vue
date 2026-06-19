<template>
  <v-dialog v-model="dialogVisible" width="420">
    <v-card rounded="xl" class="position-relative pa-2">
      <v-btn
        class="position-absolute"
        style="top: 8px; right: 8px; z-index: 1"
        icon="mdi-open-in-new"
        size="small"
        variant="text"
        to="/app/account/login"
        @click="dialogVisible = false"
      ></v-btn>

      <SignInFlow
        embedded
        @close="dialogVisible = false"
        @login-success="handleLoginSuccess"
      />
    </v-card>
  </v-dialog>
</template>

<script>
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import SignInFlow from "./SignInFlow.vue";

export default {
  name: "LoginDialog",
  components: { SignInFlow },
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

      authStore.navigateToAuthRedirect(router, "/");
    };

    return {
      dialogVisible,
      handleLoginSuccess,
    };
  },
};
</script>
