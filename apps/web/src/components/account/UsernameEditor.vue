<template>
  <v-form v-model="valid" @submit.prevent="changeUsername">
    <v-row>
      <v-col cols="12" md="8">
        <v-text-field
          v-model="username"
          :counter="20"
          :rules="usernameRules"
          density="comfortable"
          label="用户名"
          required
          variant="outlined"
        ></v-text-field>
        <div class="text-caption text-medium-emphasis">2-20位，只能包含小写字母、数字和下划线，必须以字母开头</div>
      </v-col>
      <v-col cols="12">
        <v-btn
          :disabled="!valid"
          :loading="loading"
          class="px-6"
          color="primary"
          prepend-icon="mdi-check"
          size="large"
          @click="changeUsername"
        >
          保存用户名
        </v-btn>
      </v-col>
    </v-row>
  </v-form>
</template>

<script>
import {updateUsername} from "@/services/accountService";
import { useSudoManager } from '@/composables/useSudoManager';

export default {
  name: "UsernameEditor",
  props: {
    userData: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      loading: false,
      valid: false,
      username: this.userData.username || '',
      usernameRules: [
        v => !!v || "用户名是必填项",
        v => (v && v.length >= 2) || "用户名至少需要2个字符",
        v => (v && v.length <= 20) || "用户名不能超过20个字符",
        v => /^[a-z]/.test(v) || "用户名必须以字母开头",
        v => /^[a-z0-9]+(_[a-z0-9]+)*$/.test(v) || "用户名只能包含小写字母、数字，且不能有连续下划线",
      ]
    };
  },
  watch: {
    userData: {
      handler(newVal) {
        this.username = newVal.username || '';
      },
      immediate: true
    }
  },
  setup() {
    const sudoManager = useSudoManager();
    return { sudoManager };
  },
  methods: {
    async changeUsername() {
      if (!this.valid) return;

      this.loading = true;
      try {
        const sudoToken = await this.sudoManager.requireSudo({
          title: '修改用户名',
          subtitle: '修改用户名是一个敏感操作，需要验证您的身份。',
          persistent: true
        });

        const response = await updateUsername({
          username: this.username
        }, sudoToken);

        this.$emit('username-updated', response);
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
