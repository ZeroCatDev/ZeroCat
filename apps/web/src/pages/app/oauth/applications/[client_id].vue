<template>
  <v-container fluid>
    <v-row class="mb-4">
      <v-col>
        <div class="d-flex align-center">
          <v-btn
            :to="'/app/oauth/applications'"
            class="mr-4"
            icon="mdi-arrow-left"
            variant="text"
          >

          </v-btn>
          <h1 class="text-h4">编辑 {{ form.name||'OAuth 应用' }}</h1>
          <v-spacer></v-spacer>
          <!-- <v-btn
             variant="text"
             prepend-icon="mdi-help-circle"
             @click="helpDialog = true"
           >
             集成指南
           </v-btn>-->
        </div>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" md="8">
        <v-card>
          <v-form ref="formRef" @submit.prevent="saveApplication">
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

              <!-- 高级设置 -->
              <h2 class="text-h6 mb-4 mt-6">高级设置</h2>

              <v-text-field
                v-model="form.webhook_url"
                :rules="[
                  v => !v || /^https?:\/\/.+/.test(v) || '请输入有效的URL（以http://或https://开头）'
                ]"
                class="mb-4"
                hint="接收应用相关事件通知的URL"
                label="Webhook URL"
              ></v-text-field>


              <v-text-field
                v-model="form.terms_url"
                :rules="[
                  v => !v || /^https?:\/\/.+/.test(v) || '请输入有效的URL（以http://或https://开头）'
                ]"
                class="mb-4"
                hint="应用服务条款页面的URL"
                label="服务条款URL"
              ></v-text-field>

              <v-text-field
                v-model="form.privacy_url"
                :rules="[
                  v => !v || /^https?:\/\/.+/.test(v) || '请输入有效的URL（以http://或https://开头）'
                ]"
                class="mb-4"
                hint="应用隐私政策页面的URL"
                label="隐私政策URL"
              ></v-text-field>
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
                保存更改
              </v-btn>
            </v-card-actions>
          </v-form>
        </v-card>

        <!-- 应用徽标上传卡片 -->
        <v-card class="mb-4">
          <v-card-title class="text-h6 d-flex align-center">
            <v-icon class="mr-2" color="primary" icon="mdi-image"></v-icon>
            应用徽标
          </v-card-title>
          <v-card-text>
            <div class="d-flex flex-column">
              <div class="d-flex align-items-center mb-4">
                <v-sheet
                  class="rounded-lg overflow-hidden elevation-2 mr-4"
                  height="96"
                  width="96"
                >
                  <v-img
                    :src="logoPreview || s3BucketUrl + '/material/asset/' + application?.logo_url"
                    class="bg-grey-lighten-3"
                    cover
                    height="96"
                    width="96"
                  >
                    <template v-slot:placeholder>
                      <div class="d-flex align-center justify-center fill-height">
                        <v-icon color="grey-darken-1" icon="mdi-image" size="48"></v-icon>
                      </div>
                    </template>
                  </v-img>
                </v-sheet>
                <div class="flex-grow-1">
                  <p class="text-body-2 mb-2">上传应用徽标以增加品牌辨识度</p>
                  <ul class="text-caption text-medium-emphasis mb-2">
                    <li>建议尺寸：200 x 200 像素</li>
                    <li>支持格式：PNG、JPG、GIF</li>
                    <li>文件大小：最大 2MB</li>
                  </ul>
                </div>
              </div>
              <div class="d-flex flex-column">
                <v-file-input
                  v-model="logoFile"
                  :rules="[
                    v => (!v || !v.length || v[0].size < 2000000) || '徽标大小不能超过2MB'
                  ]"
                  accept="image/*"
                  class="mb-2"
                  density="comfortable"
                  label="选择图片"
                  placeholder="选择或拖放图片"
                  prepend-icon="mdi-image"
                  show-size
                  variant="outlined"
                  @change="onLogoFileChange"
                ></v-file-input>
                <div v-if="logoFile" class="d-flex align-items-center">
                  <v-btn
                    :loading="logoUploading"
                    class="mr-2"
                    color="primary"
                    prepend-icon="mdi-cloud-upload"
                    @click="uploadLogo"
                  >
                    上传徽标
                  </v-btn>
                  <v-btn
                    color="error"
                    variant="text"
                    @click="cancelLogoUpload"
                  >
                    取消
                  </v-btn>
                </div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- 客户端凭据 -->
      <v-col cols="12" md="4">
        <v-card>
          <v-card-title class="text-h6">
            客户端凭据
          </v-card-title>
          <v-card-text>
            <p class="text-body-2 mb-4">
              使用这些凭据来配置你的OAuth应用。请确保安全保管你的客户端密钥。
            </p>

            <v-text-field
              v-if="application"
              v-model="application.client_id"
              class="mb-4"
              label="客户端ID"
              readonly
              variant="outlined"
            >
              <template v-slot:append>
                <v-btn
                  icon="mdi-content-copy"
                  variant="text"
                  @click="copyToClipboard(application.client_id)"
                ></v-btn>
              </template>
            </v-text-field>

            <v-text-field
              v-if="application && showClientSecret"
              v-model="application.client_secret"
              class="mb-4"
              label="客户端密钥"
              readonly
              type="password"
              variant="outlined"
            >
              <template v-slot:append>
                <v-btn
                  icon="mdi-eye"
                  variant="text"
                  @click="toggleClientSecret"
                ></v-btn>
                <v-btn
                  icon="mdi-content-copy"
                  variant="text"
                  @click="copyToClipboard(application.client_secret)"
                ></v-btn>
              </template>
            </v-text-field>

            <v-btn
              v-else
              block
              variant="outlined"
              @click="toggleClientSecret"
            >
              显示客户端密钥
            </v-btn>
          </v-card-text>
        </v-card>
        <!-- OAuth集成指南 -->
        <v-card class="mb-4">
          <v-card-title class="text-h6 d-flex align-center">
            <v-icon class="mr-2" color="primary" icon="mdi-book-open-page-variant"></v-icon>
            OAuth 2.0 集成指南
          </v-card-title>

          <v-card-text>
            <!-- 基本信息 -->
            <div class="mb-6">
              <v-alert class="mb-4" type="info" variant="tonal">
                <h4 class="text-subtitle-1 font-weight-bold mb-2">基本信息</h4>
                <ul class="ml-4">
                  <li>协议标准：OAuth 2.0</li>
                  <li>支持流程：授权码模式（可选 PKCE 支持）</li>
                  <li>认证入口：https://api.zcservice.houlang.cloud/oauth/authorize</li>
                  <li>令牌交换：https://api.zcservice.houlang.cloud/oauth/token</li>
                  <li>用户信息：https://api.zcservice.houlang.cloud/oauth/userinfo</li>
                </ul>
              </v-alert>
            </div>

            <!-- Step 1 -->
            <div class="mb-6">
              <div class="d-flex align-center mb-2">
                <v-chip class="mr-2" color="primary">步骤 1</v-chip>
                <span class="text-h6">构建授权URL</span>
              </div>
              <v-card class="pa-4 mb-2" variant="outlined">
                <div class="d-flex justify-space-between align-center mb-2">
                  <code class="text-body-1">
                    https://api.zcservice.houlang.cloud/oauth/authorize?<br>
                    client_id={{ application?.client_id }}<br>
                    &redirect_uri={{ form?.redirect_uris?.[0] || "[您的回调URL]" }}<br>
                    &response_type=code<br>
                    &scope=user:basic user:email<br>
                    &state=[推荐：随机字符串防止CSRF攻击]<br>
                    &code_challenge=[可选：PKCE挑战码]<br>
                    &code_challenge_method=[可选：plain或S256]
                  </code>
                  <v-btn
                    color="primary"
                    icon="mdi-content-copy"
                    variant="text"
                    @click="copyToClipboard('https://api.zcservice.houlang.cloud/oauth/authorize?client_id=' + application?.client_id + '&redirect_uri=' + (form?.redirect_uris?.[0] || '[您的回调URL]') + '&response_type=code&scope=user:basic user:email&state=[推荐：随机字符串]')"
                  ></v-btn>
                </div>
                <div class="mt-3">
                  <p class="text-caption">
                    <strong>参数说明：</strong>
                  </p>
                  <ul class="text-caption">
                    <li><code>client_id</code>：必填，您的应用ID</li>
                    <li><code>redirect_uri</code>：必填，必须与预配置的回调地址匹配</li>
                    <li><code>response_type</code>：必填，固定为"code"</li>
                    <li><code>scope</code>：可选，权限范围（空格分隔）</li>
                    <li><code>state</code>：推荐，防止CSRF攻击的随机字符串</li>
                    <li><code>code_challenge</code>：可选，PKCE模式下的挑战码</li>
                    <li><code>code_challenge_method</code>：可选，PKCE方法（plain或S256）</li>
                  </ul>
                </div>
              </v-card>
            </div>

            <!-- Step 2 -->
            <div class="mb-6">
              <div class="d-flex align-center mb-2">
                <v-chip class="mr-2" color="primary">步骤 2</v-chip>
                <span class="text-h6">获取访问令牌</span>
              </div>
              <v-card class="pa-4 mb-2" variant="outlined">
                <div class="d-flex justify-space-between align-center mb-2">
                  <code class="text-body-1">
                    POST https://api.zcservice.houlang.cloud/oauth/token<br>
                    Content-Type: application/x-www-form-urlencoded<br><br>
                    grant_type=authorization_code<br>
                    code=[授权码]<br>
                    client_id={{ application?.client_id }}<br>
                    client_secret={{ showClientSecret ? application?.client_secret : '[您的客户端密钥]' }}<br>
                    redirect_uri={{ form?.redirect_uris?.[0] || "[您的回调URL]" }}<br>
                    code_verifier=[如果使用PKCE，则必填]
                  </code>
                  <div class="d-flex flex-column">
                    <v-btn
                      class="mb-2"
                      color="primary"
                      icon="mdi-content-copy"
                      variant="text"
                      @click="copyToClipboard(`POST https://api.zcservice.houlang.cloud/oauth/token\nContent-Type: application/x-www-form-urlencoded\n\ngrant_type=authorization_code\ncode=[授权码]\nclient_id=${application?.client_id}\nclient_secret=${application?.client_secret}\nredirect_uri=[您的回调URL]`)"
                    ></v-btn>
                    <v-btn
                      :icon="showClientSecret ? 'mdi-eye-off' : 'mdi-eye'"
                      color="primary"
                      variant="text"
                      @click="toggleClientSecret"
                    ></v-btn>
                  </div>
                </div>
                <div class="mt-3">
                  <p class="text-caption">
                    <strong>响应示例：</strong>
                  </p>
                  <pre class="text-caption bg-grey-lighten-4 pa-2 rounded">
{
  "access_token": "abc",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "xyz",
  "scope": "user:basic user:email"
}</pre>
                </div>
              </v-card>
            </div>

            <!-- Step 3 -->
            <div class="mb-6">
              <div class="d-flex align-center mb-2">
                <v-chip class="mr-2" color="primary">步骤 3</v-chip>
                <span class="text-h6">使用访问令牌</span>
              </div>
              <v-card class="pa-4 mb-2" variant="outlined">
                <div class="d-flex justify-space-between align-center mb-2">
                  <code class="text-body-1">
                    GET https://api.zcservice.houlang.cloud/oauth/userinfo<br>
                    Authorization: Bearer [访问令牌]
                  </code>
                  <v-btn
                    color="primary"
                    icon="mdi-content-copy"
                    variant="text"
                    @click="copyToClipboard(`GET https://api.zcservice.houlang.cloud/oauth/userinfo\nAuthorization: Bearer [访问令牌]`)"
                  ></v-btn>
                </div>
                <div class="mt-3">
                  <p class="text-caption">
                    <strong>响应示例：</strong>
                  </p>
                  <pre class="text-caption bg-grey-lighten-4 pa-2 rounded">
{
  "openid": "zerocat_1234567890",
  "username": "zerocat",
  "nickname": "ZeroCat",
  "avatar": "https://zerocat.dev/avatar.png",
  "email": true,
  "email_verified": true
}</pre>
                </div>
              </v-card>
            </div>

            <!-- 可用权限 -->
            <div class="mb-6">
              <h3 class="text-h6 mb-3">可用权限（Scopes）</h3>
              <v-table density="compact">
                <thead>
                <tr>
                  <th>权限名</th>
                  <th>说明</th>
                </tr>
                </thead>
                <tbody>
                <tr>
                  <td><code>user:basic</code></td>
                  <td>获取用户名与显示名</td>
                </tr>
                <tr>
                  <td><code>user:email</code></td>
                  <td>获取用户验证过的邮箱地址</td>
                </tr>
                </tbody>
              </v-table>
            </div>

            <!-- 刷新令牌 -->
            <div class="mb-6">
              <h3 class="text-h6 mb-3">刷新令牌（可选）</h3>
              <v-card class="pa-4" variant="outlined">
                <code class="text-body-1">
                  POST https://api.zcservice.houlang.cloud/oauth/token<br>
                  Content-Type: application/x-www-form-urlencoded<br><br>
                  grant_type=refresh_token<br>
                  client_id={{ application?.client_id }}<br>
                  client_secret={{ showClientSecret ? application?.client_secret : '[您的客户端密钥]' }}<br>
                  refresh_token=[刷新令牌]
                </code>
              </v-card>
            </div>

            <!-- 接口限速 -->
            <div class="mb-6">
              <h3 class="text-h6 mb-3">接口限速</h3>
              <ul class="text-body-2">
                <li>全局限制：每应用每小时 5000 次请求</li>
                <li>授权请求：每 IP 每分钟最多 10 次</li>
              </ul>
            </div>

            <!-- 安全提示 -->
            <v-alert
              class="mt-4"
              type="warning"
              variant="outlined"
            >
              <template v-slot:prepend>
                <v-icon icon="mdi-shield-lock"></v-icon>
              </template>
              <div class="text-body-1">
                <strong>安全建议：</strong>
                <ul class="mt-2">
                  <li>使用 HTTPS 作为回调地址</li>
                  <li>建议启用 PKCE，特别是移动端应用</li>
                  <li>客户端密钥请勿暴露于前端代码</li>
                  <li>始终校验 state 参数与 redirect_uri</li>
                  <li>妥善管理与吊销令牌，保护用户数据隐私</li>
                </ul>
              </div>
            </v-alert>

            <!-- 错误处理 -->
            <div class="mt-6">
              <h3 class="text-h6 mb-3">错误处理</h3>
              <p class="text-body-2 mb-2">常见错误响应格式：</p>
              <pre class="text-caption bg-grey-lighten-4 pa-2 rounded">
{
  "error": "invalid_request",
  "error_description": "参数缺失或格式错误"
}</pre>
              <p class="text-body-2 mt-3 mb-2">常见错误类型：</p>
              <ul class="text-body-2">
                <li><code>invalid_request</code>：参数不合法</li>
                <li><code>invalid_client</code>：客户端验证失败</li>
                <li><code>invalid_grant</code>：code 或 refresh_token 无效</li>
                <li><code>invalid_scope</code>：权限范围无效</li>
                <li><code>unauthorized_client</code>：客户端未被授权</li>
                <li><code>access_denied</code>：用户拒绝授权</li>
              </ul>
            </div>
          </v-card-text>
        </v-card>
        <!-- 删除应用 -->
        <v-card class="mt-4" color="error" variant="outlined">
          <v-card-title class="text-h6">
            删除应用
          </v-card-title>
          <v-card-text>
            <p class="text-body-2">
              删除应用后，所有使用此应用的用户将无法继续访问。此操作不可撤销。
            </p>
          </v-card-text>
          <v-card-actions>
            <v-btn
              color="error"
              variant="text"
              @click="confirmDelete"
            >
              删除此应用
            </v-btn>
          </v-card-actions>
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

    <!-- 删除确认对话框 -->
    <v-dialog v-model="deleteDialog" max-width="500">
      <v-card>
        <v-card-title class="text-h5">
          确认删除应用
        </v-card-title>
        <v-card-text>
          <p class="mb-4">
            你确定要删除应用 "{{ form.name }}" 吗？此操作不可撤销，所有使用此应用的用户将无法继续访问。
          </p>
          <v-text-field
            v-model="deleteConfirmation"
            :rules="[v => v === form.name || '请输入正确的应用名称']"
            label="输入应用名称以确认"
          ></v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            variant="text"
            @click="deleteDialog = false"
          >
            取消
          </v-btn>
          <v-btn
            :disabled="deleteConfirmation !== form.name"
            :loading="loading"
            color="error"
            @click="deleteApplication"
          >
            删除应用
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>


  </v-container>
</template>

<script>
import axios from '@/axios/axios'
import {ref, onMounted} from "vue";
import {get} from "@/services/serverConfig";
import { useSudoManager } from '@/composables/useSudoManager'

export default {
  data() {
    return {
      form: {
        name: '',
        description: '',
        homepage_url: '',
        redirect_uris: [''],
        webhook_url: '',
        logo_url: '',
        terms_url: '',
        privacy_url: ''
      },
      loading: false,
      application: null,
      showClientSecret: false,
      deleteDialog: false,
      deleteConfirmation: '',
      logoFile: null,
      logoPreview: null,
      compressedLogoFile: null,
      logoUploading: false,
      snackbar: {
        show: false,
        text: '',
        color: 'success'
      },
      s3BucketUrl: '',
      sudoManager: useSudoManager()
    }
  },

  methods: {
    // 加载应用数据
    async loadApplication() {
      this.loading = true
      try {
        const response = await axios.get(`/oauth/applications/${this.$route.params.client_id}`)
        this.application = response.data
        this.form = response.data
      } catch (error) {
        this.showError('加载应用信息失败')
        console.error('Failed to load application:', error)
      }
      this.loading = false
    },

    // 保存应用
    async saveApplication() {
      const {valid} = await this.$refs.formRef.validate()

      if (!valid) {
        this.showError('请检查表单填写是否正确')
        return
      }

      this.loading = true
      try {
        const data = this.form
        await axios.put(`/oauth/applications/${this.$route.params.client_id}`, data)
        this.showSuccess('应用更新成功')
        await this.loadApplication()
      } catch (error) {
        this.showError('更新应用失败')
        console.error('Failed to save application:', error)
      }
      this.loading = false
    },

    // 删除应用
    async deleteApplication() {
      this.loading = true
      try {
        // 请求sudo认证
        const sudoToken = await this.sudoManager.requireSudo({
          title: '删除 OAuth 应用',
          subtitle: `您正在删除OAuth应用"${this.form.name}"。此操作不可逆，请验证您的身份。`,
          persistent: true
        });

        await axios.delete(`/oauth/applications/${this.$route.params.client_id}`, {
          headers: {
            'X-Sudo-Token': sudoToken
          }
        })
        this.showSuccess('应用已删除')
        this.$router.push("/app/oauth/applications")
      } catch (error) {
        if (error.type !== 'cancelled') {
          this.showError('删除应用失败')
          console.error('Failed to delete application:', error)
        }
      }
      this.loading = false
      this.deleteDialog = false
    },

    // 添加回调URL
    addRedirectUri() {
      this.form.redirect_uris.push('')
    },

    // 删除回调URL
    removeRedirectUri(index) {
      this.form.redirect_uris.splice(index, 1)
    },

    // 复制到剪贴板
    async copyToClipboard(text) {
      try {
        await navigator.clipboard.writeText(text)
        this.showSuccess('已复制到剪贴板')
      } catch (error) {
        this.showError('复制失败')
      }
    },

    // 切换客户端密钥显示状态
    toggleClientSecret() {
      this.showClientSecret = !this.showClientSecret
    },

    // 确认删除
    confirmDelete() {
      this.deleteDialog = true
      this.deleteConfirmation = ''
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
    },

    // 处理应用徽标文件选择
    async onLogoFileChange(event) {
      const file = event.target.files ? event.target.files[0] : null;
      if (file instanceof File && file.type.startsWith("image/")) {
        const { default: Compressor } = await import("compressorjs");
        new Compressor(file, {
          quality: 0.8,
          maxWidth: 500,
          maxHeight: 500,
          success: (compressedFile) => {
            this.logoPreview = URL.createObjectURL(compressedFile);
            this.compressedLogoFile = compressedFile;
          },
          error: (err) => {
            console.error("图片压缩出错：", err.message);
            this.$emit('error', {
              message: "图片压缩出错：" + err.message
            });
          },
        });
      } else if (file) {
        this.$emit('error', {
          message: "请选择有效的图片文件"
        });
      }

    },

    // 取消徽标上传
    cancelLogoUpload() {
      if (this.logoPreview) {
        URL.revokeObjectURL(this.logoPreview)
      }
      this.logoFile = null
      this.logoPreview = null
      this.compressedLogoFile = null
    },

    // 上传徽标到服务器
    async uploadLogo() {
      if (!this.compressedLogoFile) return

      const formData = new FormData()
      formData.append('zcfile', this.compressedLogoFile) // 统一使用 zcfile 作为字段名

      try {
        this.logoUploading = true
        const response = await axios.post(
          `/oauth/applications/${this.$route.params.client_id}/logo`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          }
        )

        if (response.data.code === 'success') {
          this.showSuccess('徽标上传成功')
          this.cancelLogoUpload() // 清理预览状态
        } else {
          throw new Error('上传响应格式错误')
        }
      } catch (error) {
        console.error('上传徽标失败:', error)
        this.showError(error.response?.data?.message || error.response?.data?.error || '上传徽标失败，请稍后重试')
      } finally {
        this.logoUploading = false
      }
    }
  },

  async mounted() {
    this.s3BucketUrl = get('s3.staticurl');
    this.loadApplication();
  },

  beforeDestroy() {
    if (this.logoPreview) {
      URL.revokeObjectURL(this.logoPreview)
    }
  }
}
</script>

<style scoped>
.v-card {
  border: 1px solid rgba(0, 0, 0, 0.12);
}

code {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 2px 4px;
  border-radius: 4px;
  font-family: monospace;
}

pre {
  overflow-x: auto;
}
</style>
