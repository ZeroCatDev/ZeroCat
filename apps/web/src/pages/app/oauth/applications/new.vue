<template>
  <v-container fluid>
    <v-row class="mb-4">
      <v-col>
        <div class="d-flex align-center">
          <v-btn
            :to="'/app/oauth/applications'"
            class="mr-4"
            prepend-icon="mdi-arrow-left"
            variant="text"
          >
            返回应用列表
          </v-btn>
          <h1 class="text-h4">创建 OAuth 应用</h1>
        </div>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" md="8">
        <v-card>
          <v-form ref="form" @submit.prevent="saveApplication">
            <v-card-text>
              <!-- 基本信息 -->
              <h2 class="text-h6 mb-4">基本信息</h2>

              <v-text-field
                v-model="form.name"
                :rules="[v => !!v || '应用名称是必填的']"
                class="mb-4"
                label="应用名称"
                required
              ></v-text-field>

              <v-textarea
                v-model="form.description"
                class="mb-4"
                hint="简要描述你的应用，帮助用户了解应用的用途"
                label="应用描述"
                rows="3"
              ></v-textarea>

              <v-text-field
                v-model="form.homepage_url"
                :rules="[
                  v => !v || /^https?:\/\/.+/.test(v) || '请输入有效的URL（以http://或https://开头）'
                ]"
                class="mb-4"
                hint="你的应用的完整URL"
                label="应用主页"
              ></v-text-field>

              <!-- 回调设置 -->
              <h2 class="text-h6 mb-4 mt-6">回调设置</h2>

              <div v-for="(uri, index) in form.redirect_uris" :key="index" class="d-flex mb-2">
                <v-text-field
                  v-model="form.redirect_uris[index]"
                  :rules="[
                    v => !!v || '回调URL是必填的',
                    v => /^https?:\/\/.+/.test(v) || '请输入有效的URL（以http://或https://开头）'
                  ]"
                  class="mr-2"
                  label="授权回调URL"
                  required
                ></v-text-field>
                <v-btn
                  :disabled="form.redirect_uris.length === 1"
                  color="error"
                  icon="mdi-delete"
                  variant="text"
                  @click="removeRedirectUri(index)"
                ></v-btn>
              </div>

              <v-btn
                class="mt-2"
                prepend-icon="mdi-plus"
                variant="text"
                @click="addRedirectUri"
              >
                添加回调URL
              </v-btn>

            </v-card-text>

            <v-divider></v-divider>

            <v-card-actions class="pa-4">
              <v-spacer></v-spacer>
              <v-btn
                :to="'/app/oauth/applications'"
                class="mr-2"
                variant="outlined"
              >
                取消
              </v-btn>
              <v-btn
                :loading="loading"
                color="primary"
                type="submit"
              >
                创建应用
              </v-btn>
            </v-card-actions>
          </v-form>
        </v-card>
      </v-col>

      <v-col cols="12" md="4">
        <v-card>
          <v-card-title class="text-h6">
            创建说明
          </v-card-title>
          <v-card-text>
            <p class="text-body-2 mb-4">
              OAuth应用允许其他应用通过OAuth2.0协议访问你的API。创建应用后，你将获得客户端ID和密钥。
            </p>

            <v-alert
              class="mb-4"
              type="info"
              variant="tonal"
            >
              <h4 class="text-subtitle-1 font-weight-bold mb-2">重要提示</h4>
              <ul class="ml-4">
                <li>客户端密钥只会显示一次，请妥善保管</li>
                <li>回调URL必须使用HTTPS（本地开发除外）</li>
                <li>谨慎选择应用权限范围</li>
              </ul>
            </v-alert>

            <p class="text-body-2">
              需要帮助？查看我们的
              <a class="text-decoration-none" href="#" target="_blank">OAuth应用开发指南</a>。
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 提示消息 -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="3000"
    >
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>

<script>
import {useRouter} from 'vue-router'
import axios from '@/axios/axios'
import { useSudoManager } from '@/composables/useSudoManager'

export default {
  name: 'NewOAuthApplication',

  data() {
    return {
      form: {
        name: '',
        description: '',
        homepage_url: '',
        redirect_uris: [''],
        scopes: ['profile']
      },
      loading: false,
      snackbar: {
        show: false,
        text: '',
        color: 'success'
      },
      sudoManager: useSudoManager()
    }
  },

  methods: {
    // 保存应用
    async saveApplication() {
      this.loading = true
      try {
        // 请求sudo认证
        const sudoToken = await this.sudoManager.requireSudo({
          title: '创建 OAuth 应用',
          subtitle: `您正在创建名为"${this.form.name}"的OAuth应用。此操作需要验证您的身份。`,
          persistent: true
        });

        // 创建应用
        const response = await axios.post('/oauth/applications', {
          name: this.form.name,
          description: this.form.description,
          homepage_url: this.form.homepage_url,
          redirect_uris: this.form.redirect_uris.filter(uri => uri.trim()),
          type: 'oauth',
          scopes: this.form.scopes
        }, {
          headers: {
            'X-Sudo-Token': sudoToken
          }
        })

        this.showSuccess('应用创建成功')
        this.$router.push('/app/oauth/applications/' + response.data.client_id)
      } catch (error) {
        if (error.type !== 'cancelled') {
          this.showError('创建应用失败')
          console.error('Failed to create application:', error)
        }
      }
      this.loading = false
    },

    // 添加回调URL
    addRedirectUri() {
      if (!this.form.redirect_uris) {
        this.form.redirect_uris = []
      }
      this.form.redirect_uris.push('')
    },

    // 删除回调URL
    removeRedirectUri(index) {
      if (this.form.redirect_uris && this.form.redirect_uris.length > 1) {
        this.form.redirect_uris.splice(index, 1)
      }
    },

    // 显示成功消息
    showSuccess(text) {
      this.snackbar = {
        show: true,
        text,
        color: 'success'
      }
    },

    // 显示错误消息
    showError(text) {
      this.snackbar = {
        show: true,
        text,
        color: 'error'
      }
    }
  }
}
</script>

<style scoped>
.v-card {
  border: 1px solid rgba(0, 0, 0, 0.12);
}
</style>
