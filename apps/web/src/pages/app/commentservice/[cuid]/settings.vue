<template>
  <v-container fluid class="pa-4 pa-md-6" style="max-width: 840px">
    <v-btn
      variant="text"
      prepend-icon="mdi-arrow-left"
      :to="`/app/commentservice/${cuid}`"
      class="mb-4 text-none"
    >
      返回空间详情
    </v-btn>

    <div class="text-h5 font-weight-bold mb-1" style="letter-spacing: -0.5px">
      空间配置
    </div>
    <div class="text-body-2 text-medium-emphasis mb-6">
      管理基本信息、评论策略及安全设置
    </div>

    <v-skeleton-loader v-if="loading" type="card, card, card" />

    <template v-else>
      <!-- Basic Info -->
      <v-card variant="flat" border class="mb-5">
        <v-card-text class="pa-5">
          <div class="d-flex align-center mb-4">
            <v-avatar size="32" color="primary" variant="tonal" class="mr-3">
              <v-icon size="16" color="primary">mdi-information-outline</v-icon>
            </v-avatar>
            <div class="text-subtitle-1 font-weight-bold">基本信息</div>
          </div>

          <v-text-field
            v-model="info.name"
            label="空间名称"
            variant="solo-filled"
            flat
            density="comfortable"
            class="mb-4"
          />

          <v-text-field
            v-model="info.domain"
            label="绑定域名"
            variant="solo-filled"
            flat
            density="comfortable"
            placeholder="blog.example.com"
            hint="限制评论嵌入的域名，留空表示不限制"
            persistent-hint
            class="mb-4"
          />

          <v-select
            v-model="info.status"
            label="空间状态"
            variant="solo-filled"
            flat
            density="comfortable"
            :items="[
              { title: '启用', value: 'active' },
              { title: '停用', value: 'inactive' },
            ]"
          />
        </v-card-text>
        <v-divider />
        <v-card-actions class="px-5 py-3">
          <v-spacer />
          <v-btn color="primary" :loading="savingInfo" @click="saveInfo" class="text-none">
            保存
          </v-btn>
        </v-card-actions>
      </v-card>

      <!-- Config Tabs -->
      <v-card variant="flat" border class="mb-5">
        <v-tabs v-model="configTab" density="compact" color="primary" show-arrows>
          <v-tab value="basic" class="text-none">基础设置</v-tab>
          <v-tab value="display" class="text-none">显示设置</v-tab>
          <v-tab value="antispam" class="text-none">反垃圾</v-tab>
          <v-tab value="captcha" class="text-none">验证码</v-tab>
          <v-tab value="notification" class="text-none">通知渠道</v-tab>
          <v-tab value="markdown" class="text-none">Markdown</v-tab>
          <v-tab value="data" class="text-none">数据管理</v-tab>
        </v-tabs>

        <v-divider />

        <v-tabs-window v-model="configTab">
          <!-- ── 基础设置 ── -->
          <v-tabs-window-item value="basic">
            <v-card-text class="pa-5">
              <div class="d-flex align-center mb-4">
                <v-avatar size="32" color="info" variant="tonal" class="mr-3">
                  <v-icon size="16" color="info">mdi-comment-check-outline</v-icon>
                </v-avatar>
                <div class="text-subtitle-1 font-weight-bold">基础设置</div>
              </div>

              <v-switch
                v-model="configBool.audit"
                label="新评论需要审核"
                color="primary"
                density="compact"
                hint="开启后评论需经管理员审核才会显示，建议在评论框提示用户"
                persistent-hint
                class="mb-4"
              />

              <v-select
                v-model="config.login"
                label="登录要求"
                variant="solo-filled"
                flat
                density="comfortable"
                :items="[
                  { title: '允许匿名评论', value: '' },
                  { title: '强制登录', value: 'force' },
                ]"
                class="mb-4"
              />

              <v-text-field
                v-model="config.ipqps"
                label="IP 评论间隔（秒）"
                variant="solo-filled"
                flat
                density="comfortable"
                type="number"
                hint="同一 IP 两次评论的最短间隔，设为 0 不限制"
                persistent-hint
                class="mb-4"
              />

              <v-textarea
                v-model="config.forbiddenWords"
                label="敏感词"
                variant="solo-filled"
                flat
                density="comfortable"
                placeholder="用逗号分隔，例如：广告,spam,垃圾"
                rows="2"
                hint="匹配到敏感词的评论将被标记为垃圾"
                persistent-hint
                class="mb-4"
              />

              <v-text-field
                v-model="config.levels"
                label="用户等级阈值"
                variant="solo-filled"
                flat
                density="comfortable"
                placeholder="0,10,20,50,100,200"
                hint="留空关闭等级功能。填入逗号分隔的数字，根据评论数为用户分配等级标签"
                persistent-hint
                class="mb-2"
              />

              <v-expand-transition>
                <v-table v-if="config.levels.trim()" density="compact" class="text-caption rounded border mb-1">
                  <thead>
                    <tr>
                      <th class="text-left">等级</th>
                      <th class="text-left">评论数条件</th>
                      <th class="text-left">默认标签</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(item, i) in levelPreview" :key="i">
                      <td>{{ i }}</td>
                      <td>{{ item.condition }}</td>
                      <td>{{ item.label }}</td>
                    </tr>
                  </tbody>
                </v-table>
              </v-expand-transition>
            </v-card-text>
          </v-tabs-window-item>

          <!-- ── 显示设置 ── -->
          <v-tabs-window-item value="display">
            <v-card-text class="pa-5">
              <div class="d-flex align-center mb-4">
                <v-avatar size="32" color="success" variant="tonal" class="mr-3">
                  <v-icon size="16" color="success">mdi-poll</v-icon>
                </v-avatar>
                <div class="text-subtitle-1 font-weight-bold">显示设置</div>
              </div>

              <v-switch
                v-model="configBool.disableUserAgent"
                label="隐藏浏览器/操作系统信息"
                color="primary"
                hide-details
                density="compact"
                class="mb-3"
              />

              <v-switch
                v-model="configBool.disableRegion"
                label="隐藏 IP 地区信息"
                color="primary"
                hide-details
                density="compact"
                class="mb-4"
              />

              <v-text-field
                v-model="config.gravatarStr"
                label="Gravatar 头像地址模板"
                variant="solo-filled"
                flat
                density="comfortable"
                placeholder="https://seccdn.libravatar.org/avatar/{{mail|md5}}"
                hint="基于 nunjucks 语法，可用 {{mail|md5}} 替换为用户邮箱的 MD5 值"
                persistent-hint
                class="mb-4"
              />

              <v-text-field
                v-model="config.avatarProxy"
                label="头像代理地址"
                variant="solo-filled"
                flat
                density="comfortable"
                placeholder="https://proxy.example.com"
                hint="留空则不使用代理"
                persistent-hint
                class="mb-4"
              />

              <v-textarea
                v-model="config.secureDomains"
                label="安全域名白名单"
                variant="solo-filled"
                flat
                density="comfortable"
                placeholder="blog.example.com,api.example.com"
                rows="2"
                hint="逗号分隔，需同时填写网站域名和服务端域名（不含 http://），留空不限制"
                persistent-hint
              />
            </v-card-text>
          </v-tabs-window-item>

          <!-- ── 反垃圾 ── -->
          <v-tabs-window-item value="antispam">
            <v-card-text class="pa-5">
              <div class="d-flex align-center mb-4">
                <v-avatar size="32" color="warning" variant="tonal" class="mr-3">
                  <v-icon size="16" color="warning">mdi-shield-check-outline</v-icon>
                </v-avatar>
                <div class="text-subtitle-1 font-weight-bold">反垃圾</div>
              </div>

              <v-select
                v-model="config.spamChecker"
                label="反垃圾检查方式"
                variant="solo-filled"
                flat
                density="comfortable"
                :items="[
                  { title: '关闭', value: '' },
                  { title: 'Akismet', value: 'akismet' },
                ]"
                class="mb-4"
              />

              <v-text-field
                v-if="config.spamChecker === 'akismet'"
                v-model="config.akismetKey"
                label="Akismet API Key"
                variant="solo-filled"
                flat
                density="comfortable"
                :type="showSecret.akismetKey ? 'text' : 'password'"
                :append-inner-icon="showSecret.akismetKey ? 'mdi-eye-off' : 'mdi-eye'"
                @click:append-inner="showSecret.akismetKey = !showSecret.akismetKey"
                hint="留空时后端自动使用全局密钥池"
                persistent-hint
              />
            </v-card-text>
          </v-tabs-window-item>

          <!-- ── 验证码 ── -->
          <v-tabs-window-item value="captcha">
            <v-card-text class="pa-5">
              <div class="d-flex align-center mb-4">
                <v-avatar size="32" color="deep-purple" variant="tonal" class="mr-3">
                  <v-icon size="16" color="deep-purple">mdi-shield-key-outline</v-icon>
                </v-avatar>
                <div class="text-subtitle-1 font-weight-bold">验证码</div>
              </div>

              <v-select
                v-model="config.captchaType"
                label="验证码类型"
                variant="solo-filled"
                flat
                density="comfortable"
                :items="[
                  { title: '关闭', value: '' },
                  { title: 'Cloudflare Turnstile', value: 'turnstile' },
                  { title: 'Google reCAPTCHA v3', value: 'recaptchaV3' },
                ]"
                class="mb-4"
              />

              <template v-if="config.captchaType === 'turnstile'">
                <div class="text-caption text-medium-emphasis mb-3">
                  可在 Cloudflare Turnstile 控制台申请 Key 和 Secret
                </div>

                <v-text-field
                  v-model="config.turnstileKey"
                  label="Turnstile Site Key"
                  variant="solo-filled"
                  flat
                  density="comfortable"
                  hint="公开密钥，用于前端客户端"
                  persistent-hint
                  class="mb-4"
                />

                <v-text-field
                  v-model="config.turnstileSecret"
                  label="Turnstile Secret Key"
                  variant="solo-filled"
                  flat
                  density="comfortable"
                  :type="showSecret.turnstileSecret ? 'text' : 'password'"
                  :append-inner-icon="showSecret.turnstileSecret ? 'mdi-eye-off' : 'mdi-eye'"
                  @click:append-inner="showSecret.turnstileSecret = !showSecret.turnstileSecret"
                  hint="服务端密钥，请勿泄露"
                  persistent-hint
                />
              </template>

              <template v-if="config.captchaType === 'recaptchaV3'">
                <div class="text-caption text-medium-emphasis mb-3">
                  可在 Google reCAPTCHA 管理后台申请 Key 和 Secret
                </div>

                <v-text-field
                  v-model="config.recaptchaV3Key"
                  label="reCAPTCHA v3 Site Key"
                  variant="solo-filled"
                  flat
                  density="comfortable"
                  hint="公开密钥，须与客户端同时配置"
                  persistent-hint
                  class="mb-4"
                />

                <v-text-field
                  v-model="config.recaptchaV3Secret"
                  label="reCAPTCHA v3 Secret Key"
                  variant="solo-filled"
                  flat
                  density="comfortable"
                  :type="showSecret.recaptchaV3Secret ? 'text' : 'password'"
                  :append-inner-icon="showSecret.recaptchaV3Secret ? 'mdi-eye-off' : 'mdi-eye'"
                  @click:append-inner="showSecret.recaptchaV3Secret = !showSecret.recaptchaV3Secret"
                  hint="服务端密钥，请勿泄露"
                  persistent-hint
                />
              </template>
            </v-card-text>
          </v-tabs-window-item>

          <!-- ── 通知渠道 ── -->
          <v-tabs-window-item value="notification">
            <v-card-text class="pa-5">
              <div class="d-flex align-center mb-2">
                <v-avatar size="32" color="orange" variant="tonal" class="mr-3">
                  <v-icon size="16" color="orange">mdi-bell-outline</v-icon>
                </v-avatar>
                <div class="text-subtitle-1 font-weight-bold">通知渠道</div>
              </div>

              <v-text-field
                v-model="config.authorEmail"
                label="管理员通知邮箱"
                variant="solo-filled"
                flat
                density="comfortable"
                placeholder="admin@example.com"
                hint="接收新评论通知的邮箱，留空则使用空间所有者邮箱"
                persistent-hint
                class="mb-5"
              />

              <v-divider class="mb-5" />

              <v-expansion-panels variant="accordion" multiple>
                <!-- ─ 邮件（SMTP） ─ -->
                <v-expansion-panel>
                  <v-expansion-panel-title>
                    <div class="d-flex align-center flex-grow-1" style="gap: 12px">
                      <v-icon size="20" color="orange">mdi-email-outline</v-icon>
                      <span class="text-subtitle-2 font-weight-medium">邮件通知</span>
                      <v-chip v-if="channelEnabled.email" size="x-small" color="success" variant="tonal">已启用</v-chip>
                      <v-chip v-else size="x-small" variant="tonal">未启用</v-chip>
                    </div>
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <div class="d-flex align-center justify-space-between mb-2">
                      <div>
                        <div class="text-subtitle-2 font-weight-medium">管理员邮件通知</div>
                        <div class="text-caption text-medium-emphasis">有新评论时通过邮件通知管理员</div>
                      </div>
                      <v-switch
                        v-model="configBool.notifyEmailAdmin"
                        color="primary"
                        hide-details
                        density="compact"
                      />
                    </div>

                    <div class="d-flex align-center justify-space-between mb-4">
                      <div>
                        <div class="text-subtitle-2 font-weight-medium">回复邮件通知</div>
                        <div class="text-caption text-medium-emphasis">评论被回复时通过邮件通知原评论者</div>
                      </div>
                      <v-switch
                        v-model="configBool.notifyEmailReply"
                        color="primary"
                        hide-details
                        density="compact"
                      />
                    </div>

                    <v-divider class="mb-4" />

                    <v-alert
                      v-if="channelEnabled.email && !(config.smtpHost && config.smtpUser && config.smtpPass)"
                      type="success"
                      variant="tonal"
                      density="compact"
                      class="mb-4"
                    >
                      正在使用 ZeroCat 邮件服务。填写你的SMTP以使用自己的邮箱发信。
                    </v-alert>

                    <div :style="!channelEnabled.email ? 'opacity: 0.5; pointer-events: none' : ''">

                    <v-text-field
                      v-model="config.smtpService"
                      label="SMTP 服务名"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      placeholder="gmail"
                      hint="如 Gmail、QQ、163 等，填写后可省略服务器地址和端口"
                      persistent-hint
                      class="mb-4"
                    />

                    <v-row dense>
                      <v-col cols="12" sm="8">
                        <v-text-field
                          v-model="config.smtpHost"
                          label="SMTP 服务器地址"
                          variant="solo-filled"
                          flat
                          density="comfortable"
                          placeholder="smtp.gmail.com"
                          hint="填写了服务名时可留空"
                          persistent-hint
                        />
                      </v-col>
                      <v-col cols="12" sm="4">
                        <v-text-field
                          v-model="config.smtpPort"
                          label="端口"
                          variant="solo-filled"
                          flat
                          density="comfortable"
                          type="number"
                          placeholder="587"
                        />
                      </v-col>
                    </v-row>

                    <v-text-field
                      v-model="config.smtpUser"
                      label="SMTP 用户名"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      hint="通常为完整邮箱地址"
                      persistent-hint
                      class="mb-4"
                    />

                    <v-text-field
                      v-model="config.smtpPass"
                      label="SMTP 密码"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      :type="showSecret.smtpPass ? 'text' : 'password'"
                      :append-inner-icon="showSecret.smtpPass ? 'mdi-eye-off' : 'mdi-eye'"
                      @click:append-inner="showSecret.smtpPass = !showSecret.smtpPass"
                      hint="部分邮箱（如 QQ、163）需使用授权码而非登录密码"
                      persistent-hint
                      class="mb-4"
                    />

                    <v-switch
                      v-model="configBool.smtpSecure"
                      label="使用 SSL"
                      color="primary"
                      hide-details
                      density="compact"
                      class="mb-5"
                    />

                    <v-divider class="mb-4" />
                    <div class="text-subtitle-2 font-weight-medium mb-3">发件人信息</div>

                    <v-text-field
                      v-model="config.senderName"
                      label="发件人名称"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      placeholder="My Blog"
                      class="mb-4"
                    />

                    <v-text-field
                      v-model="config.senderEmail"
                      label="发件人邮箱"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      placeholder="noreply@example.com"
                      class="mb-5"
                    />

                    <v-divider class="mb-4" />
                    <div class="text-subtitle-2 font-weight-medium mb-3">邮件模板</div>

                    <v-text-field
                      v-model="config.mailSubject"
                      label="回复通知邮件主题"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      hint="支持 Nunjucks 模板变量，留空使用默认"
                      persistent-hint
                      class="mb-4"
                    />

                    <v-textarea
                      v-model="config.mailTemplate"
                      label="回复通知邮件正文"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      rows="3"
                      hint="HTML 格式，支持 Nunjucks 模板变量"
                      persistent-hint
                      class="mb-4"
                    />

                    <v-text-field
                      v-model="config.mailSubjectAdmin"
                      label="管理员通知邮件主题"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      hint="支持 Nunjucks 模板变量，留空使用默认"
                      persistent-hint
                      class="mb-4"
                    />

                    <v-textarea
                      v-model="config.mailTemplateAdmin"
                      label="管理员通知邮件正文"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      rows="3"
                      hint="HTML 格式，支持 Nunjucks 模板变量"
                      persistent-hint
                    />
                    </div>
                  </v-expansion-panel-text>
                </v-expansion-panel>

                <!-- ─ 微信（Server酱） ─ -->
                <v-expansion-panel>
                  <v-expansion-panel-title>
                    <div class="d-flex align-center flex-grow-1" style="gap: 12px">
                      <v-icon size="20" color="green">mdi-wechat</v-icon>
                      <span class="text-subtitle-2 font-weight-medium">微信（Server酱）</span>
                      <v-chip v-if="channelEnabled.wechat" size="x-small" color="success" variant="tonal">已启用</v-chip>
                      <v-chip v-else-if="configBool.notifyWechat" size="x-small" color="warning" variant="tonal">配置不完整</v-chip>
                      <v-chip v-else size="x-small" variant="tonal">未启用</v-chip>
                      <v-spacer />
                      <v-switch
                        v-model="configBool.notifyWechat"
                        color="primary"
                        hide-details
                        density="compact"
                        @click.stop
                      />
                    </div>
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <div class="text-caption text-medium-emphasis mb-4">
                      通过 Server酱（sct.ftqq.com）推送到微信。
                    </div>
                    <v-alert
                      v-if="configBool.notifyWechat && !channelEnabled.wechat"
                      type="warning"
                      variant="tonal"
                      density="compact"
                      class="mb-4"
                    >
                      请填写必填配置项以启用该渠道
                    </v-alert>
                    <div :style="!configBool.notifyWechat ? 'opacity: 0.5; pointer-events: none' : ''">

                    <v-text-field
                      v-model="config.scKey"
                      label="SendKey"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      :type="showSecret.scKey ? 'text' : 'password'"
                      :append-inner-icon="showSecret.scKey ? 'mdi-eye-off' : 'mdi-eye'"
                      @click:append-inner="showSecret.scKey = !showSecret.scKey"
                      hint="在 sct.ftqq.com 获取"
                      persistent-hint
                      class="mb-4"
                    />

                    <v-textarea
                      v-model="config.scTemplate"
                      label="消息模板"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      rows="5"
                      :placeholder="defaultTemplates.sc"
                      hint="Markdown 格式，支持 Nunjucks 模板变量，留空使用默认"
                      persistent-hint
                    />
                    </div>
                  </v-expansion-panel-text>
                </v-expansion-panel>

                <!-- ─ 企业微信 ─ -->
                <v-expansion-panel>
                  <v-expansion-panel-title>
                    <div class="d-flex align-center flex-grow-1" style="gap: 12px">
                      <v-icon size="20" color="blue">mdi-briefcase-outline</v-icon>
                      <span class="text-subtitle-2 font-weight-medium">企业微信</span>
                      <v-chip v-if="channelEnabled.qywx" size="x-small" color="success" variant="tonal">已启用</v-chip>
                      <v-chip v-else-if="configBool.notifyQywx" size="x-small" color="warning" variant="tonal">配置不完整</v-chip>
                      <v-chip v-else size="x-small" variant="tonal">未启用</v-chip>
                      <v-spacer />
                      <v-switch
                        v-model="configBool.notifyQywx"
                        color="primary"
                        hide-details
                        density="compact"
                        @click.stop
                      />
                    </div>
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <div class="text-caption text-medium-emphasis mb-4">
                      通过企业微信应用消息 API 推送。
                    </div>
                    <v-alert
                      v-if="configBool.notifyQywx && !channelEnabled.qywx"
                      type="warning"
                      variant="tonal"
                      density="compact"
                      class="mb-4"
                    >
                      请填写必填配置项以启用该渠道
                    </v-alert>
                    <div :style="!configBool.notifyQywx ? 'opacity: 0.5; pointer-events: none' : ''">

                    <v-text-field
                      v-model="config.qywxAm"
                      label="应用配置"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      placeholder="corpId,corpSecret,agentId,toUser"
                      hint="格式：corpId,corpSecret,agentId,toUser（逗号分隔），如 ww1234,secret,1000002,@all"
                      persistent-hint
                      class="mb-4"
                    />

                    <v-text-field
                      v-model="config.qywxProxy"
                      label="代理地址"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      placeholder="https://proxy.example.com"
                      class="mb-4"
                    />

                    <v-text-field
                      v-model="config.qywxProxyPort"
                      label="代理端口"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      type="number"
                      class="mb-4"
                    />

                    <v-textarea
                      v-model="config.wxTemplate"
                      label="消息模板"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      rows="3"
                      hint="支持 Nunjucks 模板变量，留空使用默认"
                      persistent-hint
                    />
                    </div>
                  </v-expansion-panel-text>
                </v-expansion-panel>

                <!-- ─ QQ（Qmsg酱） ─ -->
                <v-expansion-panel>
                  <v-expansion-panel-title>
                    <div class="d-flex align-center flex-grow-1" style="gap: 12px">
                      <v-icon size="20" color="light-blue">mdi-chat-outline</v-icon>
                      <span class="text-subtitle-2 font-weight-medium">QQ（Qmsg酱）</span>
                      <v-chip v-if="channelEnabled.qq" size="x-small" color="success" variant="tonal">已启用</v-chip>
                      <v-chip v-else-if="configBool.notifyQq" size="x-small" color="warning" variant="tonal">配置不完整</v-chip>
                      <v-chip v-else size="x-small" variant="tonal">未启用</v-chip>
                      <v-spacer />
                      <v-switch
                        v-model="configBool.notifyQq"
                        color="primary"
                        hide-details
                        density="compact"
                        @click.stop
                      />
                    </div>
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <div class="text-caption text-medium-emphasis mb-4">
                      通过 Qmsg酱（qmsg.zendee.cn）推送到 QQ。
                    </div>
                    <v-alert
                      v-if="configBool.notifyQq && !channelEnabled.qq"
                      type="warning"
                      variant="tonal"
                      density="compact"
                      class="mb-4"
                    >
                      请填写必填配置项以启用该渠道
                    </v-alert>
                    <div :style="!configBool.notifyQq ? 'opacity: 0.5; pointer-events: none' : ''">

                    <v-text-field
                      v-model="config.qmsgKey"
                      label="Qmsg KEY"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      :type="showSecret.qmsgKey ? 'text' : 'password'"
                      :append-inner-icon="showSecret.qmsgKey ? 'mdi-eye-off' : 'mdi-eye'"
                      @click:append-inner="showSecret.qmsgKey = !showSecret.qmsgKey"
                      hint="在 qmsg.zendee.cn 获取"
                      persistent-hint
                      class="mb-4"
                    />

                    <v-text-field
                      v-model="config.qqId"
                      label="接收消息的 QQ 号"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      class="mb-4"
                    />

                    <v-text-field
                      v-model="config.qmsgHost"
                      label="自定义服务地址"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      placeholder="https://qmsg.zendee.cn"
                      hint="留空使用默认地址"
                      persistent-hint
                      class="mb-4"
                    />

                    <v-textarea
                      v-model="config.qqTemplate"
                      label="消息模板"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      rows="6"
                      :placeholder="defaultTemplates.qq"
                      hint="纯文本格式，支持 Nunjucks 模板变量，留空使用默认"
                      persistent-hint
                    />
                    </div>
                  </v-expansion-panel-text>
                </v-expansion-panel>

                <!-- ─ Telegram ─ -->
                <v-expansion-panel>
                  <v-expansion-panel-title>
                    <div class="d-flex align-center flex-grow-1" style="gap: 12px">
                      <v-icon size="20" color="light-blue-darken-1">mdi-send</v-icon>
                      <span class="text-subtitle-2 font-weight-medium">Telegram</span>
                      <v-chip v-if="channelEnabled.telegram" size="x-small" color="success" variant="tonal">已启用</v-chip>
                      <v-chip v-else-if="configBool.notifyTelegram" size="x-small" color="warning" variant="tonal">配置不完整</v-chip>
                      <v-chip v-else size="x-small" variant="tonal">未启用</v-chip>
                      <v-spacer />
                      <v-switch
                        v-model="configBool.notifyTelegram"
                        color="primary"
                        hide-details
                        density="compact"
                        @click.stop
                      />
                    </div>
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <div class="text-caption text-medium-emphasis mb-4">
                      通过 Telegram Bot API 推送。
                    </div>
                    <v-alert
                      v-if="configBool.notifyTelegram && !channelEnabled.telegram"
                      type="warning"
                      variant="tonal"
                      density="compact"
                      class="mb-4"
                    >
                      请填写必填配置项以启用该渠道
                    </v-alert>
                    <div :style="!configBool.notifyTelegram ? 'opacity: 0.5; pointer-events: none' : ''">

                    <v-text-field
                      v-model="config.tgBotToken"
                      label="Bot Token"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      :type="showSecret.tgBotToken ? 'text' : 'password'"
                      :append-inner-icon="showSecret.tgBotToken ? 'mdi-eye-off' : 'mdi-eye'"
                      @click:append-inner="showSecret.tgBotToken = !showSecret.tgBotToken"
                      hint="通过 @BotFather 获取"
                      persistent-hint
                      class="mb-4"
                    />

                    <v-text-field
                      v-model="config.tgChatId"
                      label="Chat ID"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      placeholder="-100123456789"
                      hint="个人/群组/频道的 Chat ID"
                      persistent-hint
                      class="mb-4"
                    />

                    <v-textarea
                      v-model="config.tgTemplate"
                      label="消息模板"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      rows="8"
                      :placeholder="defaultTemplates.tg"
                      hint="支持 Markdown 格式化和 Nunjucks 模板变量，留空使用默认"
                      persistent-hint
                    />
                    </div>
                  </v-expansion-panel-text>
                </v-expansion-panel>

                <!-- ─ PushPlus ─ -->
                <v-expansion-panel>
                  <v-expansion-panel-title>
                    <div class="d-flex align-center flex-grow-1" style="gap: 12px">
                      <v-icon size="20" color="green-darken-1">mdi-bell-ring-outline</v-icon>
                      <span class="text-subtitle-2 font-weight-medium">PushPlus</span>
                      <v-chip v-if="channelEnabled.pushplus" size="x-small" color="success" variant="tonal">已启用</v-chip>
                      <v-chip v-else-if="configBool.notifyPushplus" size="x-small" color="warning" variant="tonal">配置不完整</v-chip>
                      <v-chip v-else size="x-small" variant="tonal">未启用</v-chip>
                      <v-spacer />
                      <v-switch
                        v-model="configBool.notifyPushplus"
                        color="primary"
                        hide-details
                        density="compact"
                        @click.stop
                      />
                    </div>
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <div class="text-caption text-medium-emphasis mb-4">
                      通过 PushPlus（pushplus.plus）推送到微信、邮件、企业微信等。
                    </div>
                    <v-alert
                      v-if="configBool.notifyPushplus && !channelEnabled.pushplus"
                      type="warning"
                      variant="tonal"
                      density="compact"
                      class="mb-4"
                    >
                      请填写必填配置项以启用该渠道
                    </v-alert>
                    <div :style="!configBool.notifyPushplus ? 'opacity: 0.5; pointer-events: none' : ''">

                    <v-text-field
                      v-model="config.pushPlusKey"
                      label="Token"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      :type="showSecret.pushPlusKey ? 'text' : 'password'"
                      :append-inner-icon="showSecret.pushPlusKey ? 'mdi-eye-off' : 'mdi-eye'"
                      @click:append-inner="showSecret.pushPlusKey = !showSecret.pushPlusKey"
                      hint="PushPlus Token"
                      persistent-hint
                      class="mb-4"
                    />

                    <v-text-field
                      v-model="config.pushPlusTopic"
                      label="群组编码"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      hint="用于一对多推送，留空则单人推送"
                      persistent-hint
                      class="mb-4"
                    />

                    <v-select
                      v-model="config.pushPlusChannel"
                      label="推送渠道"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      :items="[
                        { title: '微信（默认）', value: '' },
                        { title: 'Webhook', value: 'webhook' },
                        { title: '企业微信', value: 'cp' },
                        { title: '邮件', value: 'mail' },
                      ]"
                      class="mb-4"
                    />

                    <v-text-field
                      v-if="config.pushPlusChannel === 'webhook'"
                      v-model="config.pushPlusWebhook"
                      label="Webhook 地址"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      class="mb-4"
                    />

                    <v-text-field
                      v-model="config.pushPlusCallbackUrl"
                      label="回调地址"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      hint="留空则不使用回调"
                      persistent-hint
                      class="mb-4"
                    />

                    <v-textarea
                      v-model="config.pushPlusTemplate"
                      label="消息模板"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      rows="3"
                      hint="HTML 格式，支持 Nunjucks 模板变量，留空使用默认"
                      persistent-hint
                    />
                    </div>
                  </v-expansion-panel-text>
                </v-expansion-panel>

                <!-- ─ Discord ─ -->
                <v-expansion-panel>
                  <v-expansion-panel-title>
                    <div class="d-flex align-center flex-grow-1" style="gap: 12px">
                      <v-icon size="20" color="deep-purple-accent-1">mdi-discord</v-icon>
                      <span class="text-subtitle-2 font-weight-medium">Discord</span>
                      <v-chip v-if="channelEnabled.discord" size="x-small" color="success" variant="tonal">已启用</v-chip>
                      <v-chip v-else-if="configBool.notifyDiscord" size="x-small" color="warning" variant="tonal">配置不完整</v-chip>
                      <v-chip v-else size="x-small" variant="tonal">未启用</v-chip>
                      <v-spacer />
                      <v-switch
                        v-model="configBool.notifyDiscord"
                        color="primary"
                        hide-details
                        density="compact"
                        @click.stop
                      />
                    </div>
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <div class="text-caption text-medium-emphasis mb-4">
                      通过 Discord Webhook 推送。在频道设置 → 整合 → Webhook 中创建。
                    </div>
                    <v-alert
                      v-if="configBool.notifyDiscord && !channelEnabled.discord"
                      type="warning"
                      variant="tonal"
                      density="compact"
                      class="mb-4"
                    >
                      请填写必填配置项以启用该渠道
                    </v-alert>
                    <div :style="!configBool.notifyDiscord ? 'opacity: 0.5; pointer-events: none' : ''">

                    <v-text-field
                      v-model="config.discordWebhook"
                      label="Webhook URL"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      :type="showSecret.discordWebhook ? 'text' : 'password'"
                      :append-inner-icon="showSecret.discordWebhook ? 'mdi-eye-off' : 'mdi-eye'"
                      @click:append-inner="showSecret.discordWebhook = !showSecret.discordWebhook"
                      class="mb-4"
                    />

                    <v-textarea
                      v-model="config.discordTemplate"
                      label="消息模板"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      rows="3"
                      hint="纯文本格式，留空则使用 Embed 卡片格式"
                      persistent-hint
                    />
                    </div>
                  </v-expansion-panel-text>
                </v-expansion-panel>

                <!-- ─ 飞书 ─ -->
                <v-expansion-panel>
                  <v-expansion-panel-title>
                    <div class="d-flex align-center flex-grow-1" style="gap: 12px">
                      <v-icon size="20" color="blue-darken-1">mdi-feather</v-icon>
                      <span class="text-subtitle-2 font-weight-medium">飞书</span>
                      <v-chip v-if="channelEnabled.lark" size="x-small" color="success" variant="tonal">已启用</v-chip>
                      <v-chip v-else-if="configBool.notifyLark" size="x-small" color="warning" variant="tonal">配置不完整</v-chip>
                      <v-chip v-else size="x-small" variant="tonal">未启用</v-chip>
                      <v-spacer />
                      <v-switch
                        v-model="configBool.notifyLark"
                        color="primary"
                        hide-details
                        density="compact"
                        @click.stop
                      />
                    </div>
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <div class="text-caption text-medium-emphasis mb-4">
                      通过飞书自定义机器人 Webhook 推送。
                    </div>
                    <v-alert
                      v-if="configBool.notifyLark && !channelEnabled.lark"
                      type="warning"
                      variant="tonal"
                      density="compact"
                      class="mb-4"
                    >
                      请填写必填配置项以启用该渠道
                    </v-alert>
                    <div :style="!configBool.notifyLark ? 'opacity: 0.5; pointer-events: none' : ''">

                    <v-text-field
                      v-model="config.larkWebhook"
                      label="Webhook 地址"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      :type="showSecret.larkWebhook ? 'text' : 'password'"
                      :append-inner-icon="showSecret.larkWebhook ? 'mdi-eye-off' : 'mdi-eye'"
                      @click:append-inner="showSecret.larkWebhook = !showSecret.larkWebhook"
                      class="mb-4"
                    />

                    <v-text-field
                      v-model="config.larkSecret"
                      label="签名校验密钥"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      :type="showSecret.larkSecret ? 'text' : 'password'"
                      :append-inner-icon="showSecret.larkSecret ? 'mdi-eye-off' : 'mdi-eye'"
                      @click:append-inner="showSecret.larkSecret = !showSecret.larkSecret"
                      hint="在机器人安全设置中开启「签名校验」后填写"
                      persistent-hint
                      class="mb-4"
                    />

                    <v-textarea
                      v-model="config.larkTemplate"
                      label="消息模板"
                      variant="solo-filled"
                      flat
                      density="comfortable"
                      rows="3"
                      hint="纯文本格式，留空则使用交互式卡片格式"
                      persistent-hint
                    />
                    </div>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
            </v-card-text>
          </v-tabs-window-item>

          <!-- ── Markdown 渲染 ── -->
          <v-tabs-window-item value="markdown">
            <v-card-text class="pa-5">
              <div class="d-flex align-center mb-4">
                <v-avatar size="32" color="teal" variant="tonal" class="mr-3">
                  <v-icon size="16" color="teal">mdi-language-markdown-outline</v-icon>
                </v-avatar>
                <div class="text-subtitle-1 font-weight-bold">Markdown 渲染</div>
              </div>

              <v-switch
                v-model="configBool.markdownHighlight"
                label="代码高亮"
                color="primary"
                hide-details
                density="compact"
                class="mb-3"
              />

              <v-switch
                v-model="configBool.markdownEmoji"
                label="Emoji 支持"
                color="primary"
                hide-details
                density="compact"
                class="mb-3"
              />

              <v-switch
                v-model="configBool.markdownSub"
                label="下角标"
                color="primary"
                hide-details
                density="compact"
                class="mb-3"
              />

              <v-switch
                v-model="configBool.markdownSup"
                label="上角标"
                color="primary"
                hide-details
                density="compact"
                class="mb-4"
              />

              <v-select
                v-model="config.markdownTex"
                label="数学公式渲染"
                variant="solo-filled"
                flat
                density="comfortable"
                :items="[
                  { title: 'MathJax（默认）', value: 'mathjax' },
                  { title: 'KaTeX', value: 'katex' },
                  { title: '关闭', value: 'false' },
                ]"
                class="mb-4"
              />

              <v-text-field
                v-if="config.markdownTex === 'mathjax'"
                v-model="config.markdownMathjax"
                label="MathJax 选项"
                variant="solo-filled"
                flat
                density="comfortable"
                placeholder="{}"
                hint="JSON 格式的 MathJax 配置，留空使用默认"
                persistent-hint
                class="mb-4"
              />

              <v-text-field
                v-if="config.markdownTex === 'katex'"
                v-model="config.markdownKatex"
                label="KaTeX 选项"
                variant="solo-filled"
                flat
                density="comfortable"
                placeholder="{}"
                hint="JSON 格式的 KaTeX 配置，留空使用默认"
                persistent-hint
                class="mb-4"
              />

              <v-textarea
                v-model="config.markdownConfig"
                label="MarkdownIt 自定义配置"
                variant="solo-filled"
                flat
                density="comfortable"
                rows="3"
                placeholder="{}"
                hint="JSON 格式的 MarkdownIt 配置，一般无需修改"
                persistent-hint
              />
            </v-card-text>
          </v-tabs-window-item>

          <!-- ── 数据管理 ── -->
          <v-tabs-window-item value="data">
            <v-card-text class="pa-5">
              <DataManagement :cuid="cuid" @notify="onDataNotify" />
            </v-card-text>
          </v-tabs-window-item>
        </v-tabs-window>

        <v-divider />

        <v-alert
          v-if="configErrors.length && configTab !== 'data'"
          type="warning"
          variant="tonal"
          density="compact"
          closable
          class="mx-5 mt-4"
          @click:close="configErrors = []"
        >
          <div class="text-subtitle-2 font-weight-medium mb-1">部分字段校验失败</div>
          <ul class="text-body-2 pl-4">
            <li v-for="(err, i) in configErrors" :key="i">{{ err }}</li>
          </ul>
        </v-alert>

        <v-card-actions v-if="configTab !== 'data'" class="px-5 py-3">
          <v-spacer />
          <v-btn color="primary" :loading="savingConfig" @click="saveConfig" class="text-none">
            保存配置
          </v-btn>
        </v-card-actions>
      </v-card>

      <!-- Danger Zone -->
      <v-card variant="flat" border="error thin" class="mb-4">
        <v-card-text class="pa-5">
          <div class="d-flex align-center mb-4">
            <v-avatar size="32" color="error" variant="tonal" class="mr-3">
              <v-icon size="16" color="error">mdi-alert-outline</v-icon>
            </v-avatar>
            <div class="text-subtitle-1 font-weight-bold text-error">危险操作</div>
          </div>
          <div class="d-flex align-center">
            <div>
              <div class="text-body-2 font-weight-medium">删除空间</div>
              <div class="text-caption text-medium-emphasis">
                删除后所有评论、用户数据将被永久清除，无法恢复
              </div>
            </div>
            <v-spacer />
            <v-btn
              color="error"
              variant="tonal"
              size="small"
              class="text-none"
              @click="confirmDelete = true"
            >
              删除空间
            </v-btn>
          </div>
        </v-card-text>
      </v-card>

      <!-- Delete Dialog -->
      <v-dialog v-model="confirmDelete" max-width="420">
        <v-card border>
          <v-card-text class="pa-6">
            <div class="d-flex align-center mb-4">
              <v-avatar size="40" color="error" variant="tonal" class="mr-3">
                <v-icon color="error">mdi-delete-alert-outline</v-icon>
              </v-avatar>
              <div class="text-h6 font-weight-bold">确认删除</div>
            </div>
            <div class="text-body-2 text-medium-emphasis">
              确定要删除此空间吗？此操作不可撤销，所有评论和用户数据将被永久删除。
            </div>
          </v-card-text>
          <v-card-actions class="px-6 pb-5">
            <v-spacer />
            <v-btn variant="text" @click="confirmDelete = false" class="text-none">取消</v-btn>
            <v-btn color="error" :loading="deleting" @click="doDelete" class="text-none">
              确认删除
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </template>

    <v-snackbar v-model="snackbar" :color="snackbarColor" :timeout="2000">
      {{ snackbarText }}
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useSeo } from "@/composables/useSeo";
import DataManagement from "@/components/commentservice/DataManagement.vue";
import {
  getSpace,
  updateSpace,
  getSpaceConfig,
  updateSpaceConfig,
  deleteSpace,
} from "@/services/commentService";

const route = useRoute();
const router = useRouter();
const cuid = route.params.cuid;

const loading = ref(true);
const savingInfo = ref(false);

const info = ref({ name: "", domain: "", status: "active" });

const seoTitle = computed(() =>
  info.value.name ? `${info.value.name} - 空间配置` : "空间配置"
);
const seoDesc = computed(() =>
  info.value.name
    ? `${info.value.name} 的空间配置，管理基本信息、评论策略及安全设置。`
    : "Waline 评论空间配置页"
);
useSeo({ title: seoTitle, description: seoDesc });
const savingConfig = ref(false);
const snackbar = ref(false);
const snackbarText = ref("");
const snackbarColor = ref("success");
const confirmDelete = ref(false);
const deleting = ref(false);
const configTab = ref(route.query.tab || "basic");
const configErrors = ref([]);

const config = reactive({
  // 基础设置
  audit: "false",
  login: "",
  ipqps: "60",
  forbiddenWords: "",
  levels: "",
  // 显示设置
  disableUserAgent: "false",
  disableRegion: "false",
  gravatarStr: "",
  avatarProxy: "",
  secureDomains: "",
  // 反垃圾
  spamChecker: "",
  akismetKey: "",
  // 验证码
  captchaType: "",
  recaptchaV3Key: "",
  recaptchaV3Secret: "",
  turnstileKey: "",
  turnstileSecret: "",
  // 通知 — 通用
  authorEmail: "",
  // 通知 — 渠道开关
  notifyEmailAdmin: "false",
  notifyEmailReply: "false",
  notifyWechat: "false",
  notifyQywx: "false",
  notifyQq: "false",
  notifyTelegram: "false",
  notifyPushplus: "false",
  notifyDiscord: "false",
  notifyLark: "false",
  // 通知 — 邮件（SMTP）
  smtpHost: "",
  smtpPort: "",
  smtpUser: "",
  smtpPass: "",
  smtpSecure: "",
  smtpService: "",
  senderName: "",
  senderEmail: "",
  mailSubject: "",
  mailTemplate: "",
  mailSubjectAdmin: "",
  mailTemplateAdmin: "",
  // 通知 — Server酱
  scKey: "",
  scTemplate: "",
  // 通知 — 企业微信
  qywxAm: "",
  qywxProxy: "",
  qywxProxyPort: "",
  wxTemplate: "",
  // 通知 — QQ
  qmsgKey: "",
  qqId: "",
  qmsgHost: "",
  qqTemplate: "",
  // 通知 — Telegram
  tgBotToken: "",
  tgChatId: "",
  tgTemplate: "",
  // 通知 — PushPlus
  pushPlusKey: "",
  pushPlusTopic: "",
  pushPlusChannel: "",
  pushPlusTemplate: "",
  pushPlusWebhook: "",
  pushPlusCallbackUrl: "",
  // 通知 — Discord
  discordWebhook: "",
  discordTemplate: "",
  // 通知 — 飞书
  larkWebhook: "",
  larkSecret: "",
  larkTemplate: "",
  // Markdown
  markdownConfig: "",
  markdownHighlight: "true",
  markdownEmoji: "true",
  markdownSub: "true",
  markdownSup: "true",
  markdownTex: "mathjax",
  markdownMathjax: "",
  markdownKatex: "",
});

const showSecret = reactive({
  akismetKey: false,
  smtpPass: false,
  turnstileSecret: false,
  recaptchaV3Secret: false,
  scKey: false,
  qmsgKey: false,
  tgBotToken: false,
  pushPlusKey: false,
  discordWebhook: false,
  larkWebhook: false,
  larkSecret: false,
});

const channelEnabled = computed(() => ({
  email: config.notifyEmailAdmin === "true" || config.notifyEmailReply === "true",
  wechat: config.notifyWechat === "true" && !!config.scKey,
  qywx: config.notifyQywx === "true" && !!config.qywxAm,
  qq: config.notifyQq === "true" && !!(config.qmsgKey && config.qqId),
  telegram: config.notifyTelegram === "true" && !!(config.tgBotToken && config.tgChatId),
  pushplus: config.notifyPushplus === "true" && !!config.pushPlusKey,
  discord: config.notifyDiscord === "true" && !!config.discordWebhook,
  lark: config.notifyLark === "true" && !!config.larkWebhook,
}));

const defaultTemplates = {
  qq: `💬 {{site.name|safe}} 有新评论啦
{{self.nick}} 评论道:
{{self.comment}}
邮箱: {{self.mail}}
状态: {{self.status}}
仅供评论预览，查看完整內容:
{{site.postUrl}}`,
  tg: `💬 _[{{site.name}}]({{site.url}}) 有新评论啦_

_{{self.nick}}_ 回复说:

\`\`\`
{{self.comment-}}
\`\`\`

{{-self.commentLink}}
_邮箱_: \`{{self.mail}}\`
_审核_: {{self.status}}

仅供评论预览，点击 [查看完整內容]({{site.postUrl}})`,
  sc: `{{site.name|safe}} 有新评论啦
【评论者昵称】：{{self.nick}}
【评论者邮箱】：{{self.mail}}
【内容】：{{self.comment}}
【地址】：{{site.postUrl}}`,
};

const configBool = reactive({
  get audit() { return config.audit === "true"; },
  set audit(v) { config.audit = v ? "true" : "false"; },
  get disableUserAgent() { return config.disableUserAgent === "true"; },
  set disableUserAgent(v) { config.disableUserAgent = v ? "true" : "false"; },
  get disableRegion() { return config.disableRegion === "true"; },
  set disableRegion(v) { config.disableRegion = v ? "true" : "false"; },
  get notifyEmailAdmin() { return config.notifyEmailAdmin === "true"; },
  set notifyEmailAdmin(v) { config.notifyEmailAdmin = v ? "true" : "false"; },
  get notifyEmailReply() { return config.notifyEmailReply === "true"; },
  set notifyEmailReply(v) { config.notifyEmailReply = v ? "true" : "false"; },
  get notifyWechat() { return config.notifyWechat === "true"; },
  set notifyWechat(v) { config.notifyWechat = v ? "true" : "false"; },
  get notifyQywx() { return config.notifyQywx === "true"; },
  set notifyQywx(v) { config.notifyQywx = v ? "true" : "false"; },
  get notifyQq() { return config.notifyQq === "true"; },
  set notifyQq(v) { config.notifyQq = v ? "true" : "false"; },
  get notifyTelegram() { return config.notifyTelegram === "true"; },
  set notifyTelegram(v) { config.notifyTelegram = v ? "true" : "false"; },
  get notifyPushplus() { return config.notifyPushplus === "true"; },
  set notifyPushplus(v) { config.notifyPushplus = v ? "true" : "false"; },
  get notifyDiscord() { return config.notifyDiscord === "true"; },
  set notifyDiscord(v) { config.notifyDiscord = v ? "true" : "false"; },
  get notifyLark() { return config.notifyLark === "true"; },
  set notifyLark(v) { config.notifyLark = v ? "true" : "false"; },
  get smtpSecure() { return config.smtpSecure === "true"; },
  set smtpSecure(v) { config.smtpSecure = v ? "true" : "false"; },
  get markdownHighlight() { return config.markdownHighlight === "true"; },
  set markdownHighlight(v) { config.markdownHighlight = v ? "true" : "false"; },
  get markdownEmoji() { return config.markdownEmoji === "true"; },
  set markdownEmoji(v) { config.markdownEmoji = v ? "true" : "false"; },
  get markdownSub() { return config.markdownSub === "true"; },
  set markdownSub(v) { config.markdownSub = v ? "true" : "false"; },
  get markdownSup() { return config.markdownSup === "true"; },
  set markdownSup(v) { config.markdownSup = v ? "true" : "false"; },
});

const defaultLevelLabels = ["潜水", "冒泡", "吐槽", "活跃", "话痨", "传说"];

const levelPreview = computed(() => {
  const raw = config.levels.trim();
  if (!raw) return [];
  const nums = raw.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
  if (!nums.length) return [];
  return nums.map((n, i) => ({
    condition: i < nums.length - 1
      ? `${n} <= 评论数 < ${nums[i + 1]}`
      : `${n} <= 评论数`,
    label: defaultLevelLabels[i] || `Level ${i}`,
  }));
});

function showMsg(text, color = "success") {
  snackbarText.value = text;
  snackbarColor.value = color;
  snackbar.value = true;
}

function onDataNotify({ text, color }) {
  showMsg(text, color);
}

async function saveInfo() {
  savingInfo.value = true;
  try {
    const body = { name: info.value.name, status: info.value.status };
    if (info.value.domain) body.domain = info.value.domain;
    else body.domain = null;
    await updateSpace(cuid, body);
    showMsg("基本信息已保存");
  } catch (e) {
    showMsg("保存失败", "error");
  } finally {
    savingInfo.value = false;
  }
}

async function saveConfig() {
  savingConfig.value = true;
  try {
    const res = await updateSpaceConfig(cuid, { ...config });
    if (res.data) Object.assign(config, res.data);
    if (res.status === "partial") {
      configErrors.value = res.errors || [];
      showMsg("部分配置保存失败", "warning");
    } else {
      configErrors.value = [];
      showMsg("配置已保存");
    }
  } catch (e) {
    showMsg("保存失败", "error");
  } finally {
    savingConfig.value = false;
  }
}

async function doDelete() {
  deleting.value = true;
  try {
    await deleteSpace(cuid);
    router.replace("/app/commentservice/space");
  } catch (e) {
    showMsg("删除失败", "error");
  } finally {
    deleting.value = false;
  }
}

onMounted(async () => {
  try {
    const [spaceRes, configRes] = await Promise.all([
      getSpace(cuid),
      getSpaceConfig(cuid),
    ]);
    const s = spaceRes.data;
    info.value = { name: s.name, domain: s.domain || "", status: s.status };
    Object.assign(config, configRes.data);
  } catch (e) {
    console.error("Failed to load settings:", e);
  } finally {
    loading.value = false;
  }
});
</script>
