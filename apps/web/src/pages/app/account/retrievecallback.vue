<template>
  <div class="auth-wrapper d-flex align-center justify-center pa-4">
    <v-card border class="auth-card pa-4 pt-7" max-width="448" rounded="lg">
      <v-row>
        <v-col cols="12">
          <v-cardtext>
            <h5 class="text-h5 font-weight-semibold mb-1">
              欢迎来到ZeroCat！ 👋🏻
            </h5>
            <p class="mb-0">重设密码</p>
          </v-cardtext>
        </v-col>
      </v-row
      >

      <v-cardtext>
        <v-form>
          <v-row>
            <!-- email -->
            <v-col cols="12">
              <v-text-field
                v-model="password"
                :append-icon="show1 ? 'mdi-eye' : 'mdi-eye-off'"
                :rules="passwordRules"
                :type="show1 ? 'text' : 'password'"
                label="密码"
                variant="outlined"
                @click:append="show1 = !show1"
              >
              </v-text-field>
              <v-text-field
                v-model="password2"
                :append-icon="show2 ? 'mdi-eye' : 'mdi-eye-off'"
                :rules="password2Rules"
                :type="show2 ? 'text' : 'password'"
                label="确认密码"
                variant="outlined"
                @click:append="show2 = !show2"
              >
              </v-text-field>
            </v-col>
            <v-col cols="9">
              <Recaptcha ref="recaptcha" recaptchaId="recaptcha-div"/>
            </v-col>
            <!-- password -->
            <v-col cols="12">
              <!-- remember me checkbox
              <div class="d-flex align-center justify-space-between flex-wrap ">
                <VCheckbox disabled label="Remember me" />


              </div>-->

              <v-btn
                append-icon="mdi-arrow-right"
                class="text-none"
                color="primary"
                rounded="xl"
                size="large"
                text="重设密码"
                variant="flat"
                @click="login"
              ></v-btn>
              <!-- login button -->
            </v-col>
            <v-col cols="12">
              <v-btn
                append-icon="mdi-arrow-right"
                class="text-none"
                color="white"
                rounded="xl"
                size="large"
                text="登录"
                to="/app/account/login"
                variant="text"
              ></v-btn>
              <!-- login button -->
            </v-col>
            <!-- create account -->
          </v-row>
        </v-form>
      </v-cardtext>
    </v-card>
  </div>
  <LoadingDialog :show="loading" text="正在重设密码"/>
</template>

<script>
import {localuser} from "@/services/localAccount";
import LoadingDialog from "@/components/LoadingDialog.vue";
import Recaptcha from "@/components/Recaptcha.vue";
import {useHead} from "@unhead/vue";
import {resetPassword} from "@/services/accountService";
import {useAuthStore} from "@/stores/auth";

export default {
  components: {LoadingDialog, Recaptcha},
  data() {
    return {
      BASE_API: import.meta.env.VITE_APP_BASE_API,
      password: "",
      password2: "",
      show1: false,
      show2: false,

      tryinguser: {},
      loading: false,
      emailRules: [
        (value) => {
          if (value) return true;

          return "必须填写邮箱";
        },
        (value) => {
          if (/.+@.+\..+/.test(value)) return true;

          return "不符合格式";
        },
      ],
      passwordRules: [
        (value) => {
          if (value) return true;

          return "必须填写密码";
        },
      ],
      password2Rules: [
        (value) => {
          if (value) return true;

          return "必须填写密码";
        },
        (value) => {
          if (value != this.password) return "必须与前者相同";
        },
      ],
    };
  },

  created() {
    const authStore = useAuthStore();
    const redirectFromQuery =
      typeof this.$route.query.redirect === "string" ? this.$route.query.redirect : null;
    if (redirectFromQuery) {
      authStore.setAuthRedirectUrl(redirectFromQuery);
    }

    if (localuser.isLogin.value == true) {
      authStore.navigateToAuthRedirect(this.$router, "/");
    }
  },

  setup() {
    useHead({
      title: "重设密码",
    });
  },
  methods: {
    async login() {
      const authStore = useAuthStore();
      this.loading = true;
      try {
        const response = await resetPassword({
          jwttoken: this.$route.query.token,
          captcha: this.$refs.recaptcha.getResponse(),
          pw: this.password,
        });
        this.tryinguser = response.data;
        if (this.tryinguser.status === "success") {
          const redirectSuffix = authStore.authRedirectUrl
            ? `?redirect=${encodeURIComponent(authStore.authRedirectUrl)}`
            : "";
          this.$router.push(`/app/account/login${redirectSuffix}`);
        } else {
          this.$toast.add({
            severity: "info",
            summary: "info",
            detail: this.tryinguser.message,
            life: 3000,
          });
        }
      } catch (error) {
        this.$toast.add({
          severity: "error",
          summary: "错误",
          detail: error.message,
          life: 3000,
        });
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>
