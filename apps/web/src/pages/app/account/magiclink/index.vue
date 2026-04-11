<template>
  <div>
    <AuthCard subtitle="魔术链接登录">
      <v-form @submit.prevent="sendMagicLink">
        <v-row>
          <v-col cols="12">
            <v-text-field
              v-model="email"
              :rules="emailRules"
              label="邮箱"
              type="text"
              variant="outlined"
            ></v-text-field>
          </v-col>

          <v-col cols="12">
            <Recaptcha ref="recaptcha" recaptchaId="recaptcha-div"/>
          </v-col>

          <v-col cols="12">
            <v-btn
              :disabled="linkSent"
              :loading="loading"
              :text="linkSent ? '已发送，请检查邮箱' : '发送登录链接'"
              append-icon="mdi-arrow-right"
              class="text-none"
              color="primary"
              rounded="xl"
              size="large"
              variant="flat"
              @click="sendMagicLink"
            ></v-btn>
          </v-col>

          <v-col cols="12">
            <div class="d-flex flex-wrap justify-start gap-2">
              <v-btn
                append-icon="mdi-arrow-right"
                class="text-none"
                color="white"
                rounded="xl"
                size="large"
                text="密码登录"
                to="/app/account/login"
                variant="text"
              ></v-btn>
              <v-btn
                append-icon="mdi-arrow-right"
                class="text-none"
                color="white"
                rounded="xl"
                size="large"
                text="注册"
                to="/app/account/register"
                variant="text"
              ></v-btn>
              <v-btn
                append-icon="mdi-arrow-right"
                class="text-none"
                color="white"
                rounded="xl"
                size="large"
                text="找回密码"
                to="/app/account/retrieve"
                variant="text"
              ></v-btn>
            </div>
          </v-col>
        </v-row>
      </v-form>
    </AuthCard>
    <LoadingDialog :show="loading" text="处理中"/>
  </div>
</template>

<script>
import {ref} from "vue";
import {useRouter} from "vue-router";
import {useHead} from "@unhead/vue";
import {localuser} from "@/services/localAccount";
import AuthService from "@/services/authService";
import LoadingDialog from "@/components/LoadingDialog.vue";
import Recaptcha from "@/components/Recaptcha.vue";
import AuthCard from "@/components/AuthCard.vue";

export default {
  components: {LoadingDialog, Recaptcha, AuthCard},

  setup() {
    const router = useRouter();
    const recaptcha = ref(null);

    // State variables
    const email = ref("");
    const loading = ref(false);
    const linkSent = ref(false);

    // Validation rules
    const emailRules = [
      (v) => !!v || "必须填写邮箱",
      (v) => /.+@.+\..+/.test(v) || "不符合格式",
    ];

    // Check if user is already logged in
    if (localuser.isLogin.value === true) {
      router.push("/");
    }

    // Set page title
    useHead({
      title: "魔术链接登录",
    });

    const sendMagicLink = async () => {
      if (!email.value || !/.+@.+\..+/.test(email.value)) {
        showErrorToast("请输入正确的邮箱地址");
        return;
      }

      if (linkSent.value) return;

      loading.value = true;
      try {
        const captcha = recaptcha.value?.getResponse();
        if (!captcha) {
          showErrorToast("请完成人机验证");
          loading.value = false;
          return;
        }

        const response = await AuthService.generateMagicLink(
          email.value,
          window.location.origin + '/app/account/magiclink/validate',
          captcha
        );

        if (response.status === "success") {
          showSuccessToast("登录链接已发送到您的邮箱");
          linkSent.value = true;
        } else {
          showErrorToast(response.message || "发送失败");
        }
      } catch (error) {
        showErrorToast(error.response?.data?.message || error.message);
      } finally {
        loading.value = false;
      }
    };

    const showSuccessToast = (message) => {
      // Using PrimeVue toast
      this?.$toast?.add({
        severity: "success",
        summary: "成功",
        detail: message,
        life: 3000,
      });
    };

    const showErrorToast = (message) => {
      // Using PrimeVue toast
      this?.$toast?.add({
        severity: "error",
        summary: "错误",
        detail: message,
        life: 3000,
      });
    };

    return {
      email,
      loading,
      linkSent,
      recaptcha,
      emailRules,
      sendMagicLink,
    };
  },
};
</script>
