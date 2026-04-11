<template>
  <v-form v-model="valid" @submit.prevent="changePassword">
    <v-row>
      <v-col cols="12" md="8">
        <v-text-field
          v-model="oldPassword"
          :rules="[v => !!v || '请输入当前密码']"
          density="comfortable"
          label="当前密码"
          required
          type="password"
          variant="outlined"
        ></v-text-field>
      </v-col>
      <v-col cols="12" md="8">
        <v-text-field
          v-model="newPassword"
          :rules="passwordRules"
          density="comfortable"
          label="新密码"
          required
          type="password"
          variant="outlined"
        ></v-text-field>
        <div class="text-caption text-medium-emphasis">
          密码必须由数字、大小写字母和特殊字符组成，且长度至少为8位
        </div>
      </v-col>
      <v-col cols="12" md="8">
        <v-text-field
          v-model="confirmPassword"
          :rules="[
            v => !!v || '请确认新密码',
            v => v === newPassword || '两次输入的密码不一致'
          ]"
          density="comfortable"
          label="确认新密码"
          required
          type="password"
          variant="outlined"
        ></v-text-field>
      </v-col>
      <v-col cols="12">
        <v-btn
          :disabled="!valid"
          :loading="loading"
          class="px-6"
          color="primary"
          prepend-icon="mdi-lock-reset"
          size="large"
          @click="changePassword"
        >
          更新密码
        </v-btn>
      </v-col>
    </v-row>
  </v-form>
</template>

<script>
import {updatePassword} from "@/services/accountService";
import { useSudoManager } from '@/composables/useSudoManager';

export default {
  name: "PasswordEditor",
  data() {
    return {
      loading: false,
      valid: false,
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
      passwordRules: [
        v => !!v || "请输入新密码",
        v => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[$@$!%*?&\.])[A-Za-z\d$@$!%*?&\.]{8,}/.test(v)
          || "密码必须由数字、大小写字母和特殊字符组成，且长度至少为8位"
      ]
    };
  },
  setup() {
    const sudoManager = useSudoManager();
    return { sudoManager };
  },
  methods: {
    async changePassword() {
      if (!this.valid) return;

      this.loading = true;
      try {
        const sudoToken = await this.sudoManager.requireSudo({
          title: '修改密码',
          subtitle: '这是一个重要操作，需要验证您的身份。',
          persistent: true
        });

        const response = await updatePassword({
          oldpw: this.oldPassword,
          newpw: this.newPassword
        }, sudoToken);

        this.$emit('password-updated', response);

        // Reset the form after successful update
        this.oldPassword = "";
        this.newPassword = "";
        this.confirmPassword = "";
      } catch (error) {
        if (error.type !== 'cancel') {
          this.$emit('error', error);
        }
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>
