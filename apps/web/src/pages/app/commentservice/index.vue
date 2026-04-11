<template>
  <v-container fluid class="pa-4 pa-md-6" style="max-width: 1100px">
    <!-- Hero -->
    <div class="hero-section mb-10 mb-md-14">
      <div class="d-flex align-center mb-4">
        <v-avatar size="44" color="primary" variant="tonal" class="mr-3">
          <v-icon size="24" color="primary">mdi-server-outline</v-icon>
        </v-avatar>
      </div>

      <div
        class="hero-title font-weight-bold mb-3"
        style="letter-spacing: -1.2px; line-height: 1.15"
      >
        免费的 Waline<br class="d-none d-sm-block" />
        评论后端托管
      </div>

      <div
        class="text-body-1 text-medium-emphasis mb-8"
        style="max-width: 540px; line-height: 1.7"
      >
        无需自建服务器，无需数据库配置。免费托管完整的 Waline 后端，直接配合官方客户端使用。
      </div>

      <div class="d-flex flex-wrap ga-3">
        <v-btn
          color="primary"
          size="large"
          prepend-icon="mdi-plus"
          to="/app/commentservice/create"
          class="text-none px-6"
        >
          免费创建空间
        </v-btn>
        <v-btn
          variant="outlined"
          size="large"
          prepend-icon="mdi-arrow-right"
          to="/app/commentservice/space"
          class="text-none px-6"
        >
          管理我的空间
        </v-btn>
      </div>
    </div>

    <!-- Why hosted -->
    <div class="mb-10 mb-md-14">
      <div class="text-overline text-medium-emphasis font-weight-bold mb-2 tracking-wide">
        为什么选择托管
      </div>
      <div
        class="text-h5 font-weight-bold mb-3"
        style="letter-spacing: -0.5px"
      >
        告别繁琐的自部署流程
      </div>
      <div class="text-body-2 text-medium-emphasis mb-7" style="max-width: 600px; line-height: 1.65">
        自建 Waline 后端需要服务器、数据库、域名配置和持续维护。使用我们的托管服务，这些全部由平台承担，你只需关注内容本身。
      </div>

      <v-row>
        <v-col cols="12" sm="6">
          <v-card variant="flat" border class="h-100 compare-card">
            <v-card-text class="pa-5">
              <div class="d-flex align-center mb-4">
                <v-icon color="error" class="mr-2" size="20">mdi-close-circle-outline</v-icon>
                <div class="text-subtitle-2 font-weight-bold">自行部署</div>
              </div>
              <div class="d-flex flex-column ga-3">
                <div v-for="item in selfHostPains" :key="item" class="d-flex align-start">
                  <v-icon size="16" color="grey" class="mr-2 mt-1 flex-shrink-0">mdi-minus</v-icon>
                  <span class="text-body-2 text-medium-emphasis">{{ item }}</span>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6">
          <v-card variant="flat" border class="h-100 compare-card compare-card--highlight">
            <v-card-text class="pa-5">
              <div class="d-flex align-center mb-4">
                <v-icon color="success" class="mr-2" size="20">mdi-check-circle-outline</v-icon>
                <div class="text-subtitle-2 font-weight-bold">平台托管</div>
              </div>
              <div class="d-flex flex-column ga-3">
                <div v-for="item in hostedBenefits" :key="item" class="d-flex align-start">
                  <v-icon size="16" color="success" class="mr-2 mt-1 flex-shrink-0">mdi-check</v-icon>
                  <span class="text-body-2">{{ item }}</span>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </div>

    <!-- What you get -->
    <div class="mb-10 mb-md-14">
      <div class="text-overline text-medium-emphasis font-weight-bold mb-2 tracking-wide">
        托管服务包含
      </div>
      <div
        class="text-h5 font-weight-bold mb-7"
        style="letter-spacing: -0.5px"
      >
        开箱即用的完整后端
      </div>

      <v-row>
        <v-col
          v-for="(feat, i) in features"
          :key="i"
          cols="12"
          sm="6"
          md="4"
        >
          <v-card
            variant="flat"
            border
            class="feature-card h-100"
          >
            <v-card-text class="pa-5">
              <v-avatar
                size="44"
                :color="feat.color"
                variant="tonal"
                class="mb-4"
              >
                <v-icon :color="feat.color" size="22">{{ feat.icon }}</v-icon>
              </v-avatar>
              <div class="text-subtitle-1 font-weight-bold mb-2">
                {{ feat.title }}
              </div>
              <div class="text-body-2 text-medium-emphasis" style="line-height: 1.65">
                {{ feat.desc }}
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </div>

    <!-- How it works -->
    <div class="mb-10 mb-md-14">
      <div class="text-overline text-medium-emphasis font-weight-bold mb-2 tracking-wide">
        使用流程
      </div>
      <div
        class="text-h5 font-weight-bold mb-7"
        style="letter-spacing: -0.5px"
      >
        三步完成接入
      </div>

      <v-row>
        <v-col
          v-for="(step, i) in steps"
          :key="i"
          cols="12"
          md="4"
        >
          <div class="d-flex align-start">
            <div
              class="step-number text-h4 font-weight-black mr-4 flex-shrink-0"
              :style="{ color: `rgb(var(--v-theme-primary))`, opacity: 0.18 }"
            >
              {{ String(i + 1).padStart(2, '0') }}
            </div>
            <div>
              <div class="text-subtitle-1 font-weight-bold mb-1">
                {{ step.title }}
              </div>
              <div class="text-body-2 text-medium-emphasis" style="line-height: 1.65">
                {{ step.desc }}
              </div>
            </div>
          </div>
        </v-col>
      </v-row>
    </div>

    <!-- Compatibility -->
    <v-card variant="flat" border class="mb-10 mb-md-14 compat-card">
      <v-card-text class="pa-5 pa-md-7">
        <v-row align="center">
          <v-col cols="12" md="7">
            <div class="text-overline text-medium-emphasis font-weight-bold mb-2 tracking-wide">
              完全兼容
            </div>
            <div
              class="text-h6 font-weight-bold mb-3"
              style="letter-spacing: -0.3px"
            >
              与 Waline 官方客户端无缝对接
            </div>
            <div class="text-body-2 text-medium-emphasis mb-5" style="line-height: 1.65">
              托管后端提供标准的 Waline Server API，你可以直接使用 @waline/client 或任何兼容 Waline 协议的客户端。已有 Waline 站点迁移过来也很简单，只需替换 serverURL 即可。
            </div>
            <v-btn
              variant="text"
              color="primary"
              class="text-none px-0"
              append-icon="mdi-open-in-new"
              href="https://waline.js.org/"
              target="_blank"
              rel="noopener noreferrer"
            >
              查看 Waline 官方文档
            </v-btn>
          </v-col>
          <v-col cols="12" md="5">
            <div class="d-flex flex-wrap ga-2 justify-md-end">
              <v-chip
                v-for="tag in compatTags"
                :key="tag.label"
                variant="tonal"
                size="small"
                :prepend-icon="tag.icon"
                class="font-weight-medium"
              >
                {{ tag.label }}
              </v-chip>
            </div>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- No vendor lock-in -->
    <v-card variant="flat" border class="mb-10 mb-md-14 no-lockin-card">
      <v-card-text class="pa-5 pa-md-7">
        <div class="d-flex align-start">
          <v-avatar size="44" color="info" variant="tonal" class="mr-4 flex-shrink-0">
            <v-icon color="info" size="22">mdi-lock-open-variant-outline</v-icon>
          </v-avatar>
          <div>
            <div class="text-subtitle-1 font-weight-bold mb-2">
              没有供应商锁定
            </div>
            <div class="text-body-2 text-medium-emphasis" style="line-height: 1.65">
              你的数据完全属于你，可以随时导出评论数据。如果未来需要迁移到自建服务器，只需导出数据并导入到你自己的 Waline 实例中，无缝切换，不丢失任何评论。
            </div>
          </div>
        </div>
      </v-card-text>
    </v-card>

    <!-- Bottom CTA -->
    <v-card
      variant="flat"
      border
      class="cta-card pa-6 pa-md-8 text-center"
    >
      <div class="text-h6 font-weight-bold mb-2" style="letter-spacing: -0.3px">
        免费开始使用
      </div>
      <div class="text-body-2 text-medium-emphasis mb-5">
        创建你的评论空间，获取 serverURL，几分钟内接入你的网站
      </div>
      <div class="d-flex justify-center flex-wrap ga-3">
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          to="/app/commentservice/create"
          class="text-none px-6"
        >
          创建空间
        </v-btn>
        <v-btn
          variant="text"
          append-icon="mdi-open-in-new"
          href="https://waline.js.org/"
          target="_blank"
          rel="noopener noreferrer"
          class="text-none"
        >
          Waline 文档
        </v-btn>
      </div>
    </v-card>
  </v-container>
</template>

<script setup>
import { useSeo } from "@/composables/useSeo";

useSeo({
  title: "评论服务",
  description: "免费的 Waline 评论后端托管服务，无需自建服务器，无需数据库配置，开箱即用。",
});

const selfHostPains = [
  "需要购买和维护云服务器",
  "需要配置数据库（MySQL / PostgreSQL / MongoDB）",
  "需要处理 HTTPS 证书和域名解析",
  "需要手动更新 Waline 版本",
  "服务宕机需要自行排查恢复",
];

const hostedBenefits = [
  "无需服务器，创建空间即获得后端地址",
  "数据库由平台维护，自动备份",
  "内置 HTTPS，开箱即用",
  "平台统一升级，始终使用最新版本",
  "免费使用，零运维成本",
];

const features = [
  {
    icon: "mdi-server-outline",
    color: "primary",
    title: "托管后端",
    desc: "每个评论空间对应一个独立的 Waline 后端实例，提供标准 serverURL，直接用于客户端配置。",
  },
  {
    icon: "mdi-shield-check-outline",
    color: "success",
    title: "评论审核",
    desc: "内置评论审核面板，支持按状态筛选、关键词搜索，快速处理待审核和垃圾评论。",
  },
  {
    icon: "mdi-robot-outline",
    color: "warning",
    title: "反垃圾 & 验证码",
    desc: "集成 Akismet 反垃圾检测，支持 Cloudflare Turnstile 和 Google reCAPTCHA 人机验证。",
  },
  {
    icon: "mdi-bell-ring-outline",
    color: "error",
    title: "多渠道通知",
    desc: "新评论推送至邮件、微信、Telegram、Discord、飞书等，灵活配置通知策略。",
  },
  {
    icon: "mdi-account-group-outline",
    color: "info",
    title: "用户与权限",
    desc: "管理员、审核员、访客、封禁用户等角色体系，通过平台账号统一登录管理。",
  },
  {
    icon: "mdi-view-dashboard-outline",
    color: "secondary",
    title: "多空间隔离",
    desc: "为不同站点创建独立空间，每个空间拥有独立配置、域名绑定和用户数据。",
  },
];

const steps = [
  {
    title: "创建评论空间",
    desc: "填写空间名称，平台自动为你分配一个 Waline 后端实例和 serverURL。",
  },
  {
    title: "配置你的偏好",
    desc: "在管理面板中设置审核模式、通知渠道、反垃圾规则等，按需开启。",
  },
  {
    title: "嵌入你的网站",
    desc: "将 serverURL 填入 @waline/client 的配置中，评论区立即生效。",
  },
];

const compatTags = [
  { icon: "mdi-language-javascript", label: "@waline/client" },
  { icon: "mdi-vuejs", label: "Vue" },
  { icon: "mdi-react", label: "React" },
  { icon: "mdi-language-html5", label: "HTML" },
  { icon: "mdi-hexagon-outline", label: "Hexo" },
  { icon: "mdi-book-open-variant", label: "VuePress" },
  { icon: "mdi-file-document-outline", label: "Hugo" },
  { icon: "mdi-api", label: "Waline API" },
];
</script>

<style scoped>
.hero-title {
  font-size: clamp(1.75rem, 5vw, 2.75rem);
}

.tracking-wide {
  letter-spacing: 1.5px;
}

.feature-card {
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.feature-card:hover {
  border-color: rgb(var(--v-theme-primary)) !important;
  box-shadow: 0 4px 16px rgba(var(--v-theme-primary), 0.06);
}

.compare-card {
  transition: border-color 0.2s ease;
}

.compare-card--highlight {
  border-color: rgb(var(--v-theme-success)) !important;
}

.compat-card {
  transition: border-color 0.2s ease;
}

.compat-card:hover {
  border-color: rgba(var(--v-theme-on-surface), 0.2);
}

.no-lockin-card {
  transition: border-color 0.2s ease;
}

.no-lockin-card:hover {
  border-color: rgb(var(--v-theme-info)) !important;
}

.cta-card {
  transition: border-color 0.2s ease;
}

.cta-card:hover {
  border-color: rgb(var(--v-theme-primary)) !important;
}

.step-number {
  font-variant-numeric: tabular-nums;
  line-height: 1;
  margin-top: 2px;
  user-select: none;
}
</style>
