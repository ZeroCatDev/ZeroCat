<template>
  <v-card>
    <v-card-title class="d-flex align-center">
      <v-icon class="mr-2">mdi-share-variant</v-icon>
      社交平台集成（Twitter + Bluesky）
    </v-card-title>

    <v-card-text>
      <div v-if="loading" class="d-flex align-center justify-center py-6">
        <v-progress-circular color="primary" indeterminate />
      </div>

      <template v-else>
        <v-alert
          v-if="message"
          :type="messageType"
          class="mb-4"
          variant="tonal"
        >
          {{ message }}
        </v-alert>

        <v-row>
          <v-col cols="12" md="6">
            <v-card border rounded="lg" class="h-100">
              <v-card-item>
                <v-card-title class="text-subtitle-1"
                  >𝕏（Twitter）设置 未完工！猫要死了，twitter什么人才接口。</v-card-title
                >
                <v-card-subtitle
                  >先配置 OAuth App，再进行授权。</v-card-subtitle
                >
              </v-card-item>
              <v-card-text>
                <v-alert
                  type="info"
                  variant="tonal"
                  density="comfortable"
                  class="mb-3"
                >
                  配置指引：填写 Client ID / Client Secret，保存后点击“Twitter
                  同步授权”。
                </v-alert>

                <div class="d-flex flex-wrap ga-2 mb-4">
                  <v-chip
                    :color="
                      overview.twitter.hasSyncAppConfig ? 'success' : 'warning'
                    "
                    size="small"
                  >
                    OAuth App
                    {{
                      overview.twitter.hasSyncAppConfig ? "已配置" : "未配置"
                    }}
                  </v-chip>
                  <v-chip
                    :color="
                      overview.twitter.hasSyncToken ? 'success' : 'warning'
                    "
                    size="small"
                  >
                    同步授权
                    {{ overview.twitter.hasSyncToken ? "已完成" : "未完成" }}
                  </v-chip>
                  <v-chip
                    :color="overview.sync.twitter ? 'success' : 'warning'"
                    size="small"
                  >
                    自动同步 {{ overview.sync.twitter ? "已开启" : "未开启" }}
                  </v-chip>
                </div>

                <v-expansion-panels variant="accordion" class="mb-3">
                  <v-expansion-panel>
                    <v-expansion-panel-title
                      >详细配置（OAuth App 参数）</v-expansion-panel-title
                    >
                    <v-expansion-panel-text>
                      <v-row>
                        <v-col cols="12" md="6">
                          <v-text-field
                            v-model="twitterApp.clientId"
                            density="comfortable"
                            label="Client ID"
                          />
                        </v-col>
                        <v-col cols="12" md="6">
                          <v-text-field
                            v-model="twitterApp.clientSecret"
                            density="comfortable"
                            label="Client Secret"
                            placeholder="保存后会脱敏显示"
                          />
                        </v-col>
                        <v-col cols="12">
                          <v-text-field
                            v-model="twitterApp.redirectUri"
                            density="comfortable"
                            label="Redirect URI（可选）"
                          />
                        </v-col>
                        <v-col cols="12"
                          ><v-btn
                            color="primary"
                            :loading="savingTwitterApp"
                            @click="saveTwitterApp"
                          >
                            保存 Twitter OAuth App
                          </v-btn>
                          <v-btn
                            color="error"
                            border
                            :loading="deletingTwitterApp"
                            @click="deleteTwitterApp"
                          >
                            删除 App 配置
                          </v-btn></v-col
                        >
                      </v-row>
                    </v-expansion-panel-text>
                  </v-expansion-panel>
                </v-expansion-panels>

                <v-switch
                  v-model="syncSettings.twitter"
                  color="primary"
                  :disabled="savingSettings"
                  hide-details
                  inset
                  label="Twitter 自动同步"
                  @update:modelValue="saveSyncSettings"
                />

                <div class="mt-3 d-flex flex-wrap ga-2">
                  <v-btn
                    color="primary"
                    border
                    @click="authorizeTwitterSync"
                  >
                    账号授权
                  </v-btn>
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" md="6">
            <v-card border rounded="lg" class="h-100">
              <v-card-item>
                <v-card-title class="text-subtitle-1"
                  >Bluesky 设置</v-card-title
                >
                <v-card-subtitle>可以配置PDS，但一般不需要改。</v-card-subtitle>
              </v-card-item>
              <v-card-text>
                <div class="d-flex flex-wrap ga-2 mb-4">
                  <v-chip
                    :color="
                      Boolean(overview.bluesky.pds) ? 'success' : 'warning'
                    "
                    size="small"
                  >
                    PDS {{ overview.bluesky.pds ? "已配置" : "未配置" }}
                  </v-chip>
                  <v-chip
                    :color="
                      overview.bluesky.hasSyncToken ? 'success' : 'warning'
                    "
                    size="small"
                  >
                    同步授权
                    {{ overview.bluesky.hasSyncToken ? "已完成" : "未完成" }}
                  </v-chip>
                  <v-chip
                    :color="overview.sync.bluesky ? 'success' : 'warning'"
                    size="small"
                  >
                    自动同步 {{ overview.sync.bluesky ? "已开启" : "未开启" }}
                  </v-chip>
                </div>

                <v-expansion-panels variant="accordion" class="mb-3">
                  <v-expansion-panel>
                    <v-expansion-panel-title
                      >详细配置（PDS 参数）</v-expansion-panel-title
                    >
                    <v-expansion-panel-text>
                      <v-text-field
                        v-model="blueskyPds"
                        clearable
                        density="comfortable"
                        label="PDS 地址"
                        placeholder="https://bsky.social"
                      /> <v-btn
                    color="primary"
                    :loading="savingBlueskyPds"
                    @click="saveBlueskyPds"
                  >
                    保存 Bluesky PDS
                  </v-btn>
                    </v-expansion-panel-text>
                  </v-expansion-panel>
                </v-expansion-panels>

                <v-switch
                  v-model="syncSettings.bluesky"
                  color="primary"
                  :disabled="savingSettings"
                  hide-details
                  inset
                  label="Bluesky 自动同步"
                  @update:modelValue="saveSyncSettings"
                />

                <div class="mt-3 d-flex flex-wrap ga-2">

                  <v-btn
                    color="primary"
                    border
                    @click="authorizeBlueskySync"
                  >
                    账号授权
                  </v-btn>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

      </template>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { localuser } from "@/services/localAccount";
import SocialService from "@/services/socialService";

const loading = ref(false);
const savingSettings = ref(false);
const savingTwitterApp = ref(false);
const deletingTwitterApp = ref(false);
const savingBlueskyPds = ref(false);

const message = ref("");
const messageType = ref("info");

const overview = ref({
  bindings: { twitter: false, bluesky: false },
  sync: { twitter: false, bluesky: false },
  twitter: {
    hasSyncAppConfig: false,
    hasSyncToken: false,
    appConfig: {
      clientId: "",
      clientSecret: "",
      redirectUri: "",
      scope: "",
    },
  },
  bluesky: {
    pds: "",
    hasSyncToken: false,
  },
});

const syncSettings = ref({ twitter: false, bluesky: false });
const twitterApp = ref({
  clientId: "",
  clientSecret: "",
  redirectUri: "",
});
const blueskyPds = ref("");

const parseBoundValue = (value) => {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "boolean") {
    return value;
  }
  return Boolean(value);
};

const getErrorMessage = (error, fallback) => {
  const statusCode = error?.response?.status;
  const serverMessage = error?.response?.data?.message || error?.message;

  if (statusCode === 401) return "请先登录";
  if (statusCode === 400) return serverMessage || "参数错误，请检查输入内容";
  if (statusCode >= 500) return "服务异常，请稍后重试";
  return serverMessage || fallback;
};

const setMessage = (type, text) => {
  messageType.value = type;
  message.value = text;
};

const applyOverview = (data = {}) => {
  const nextOverview = {
    bindings: {
      twitter: parseBoundValue(data?.bindings?.twitter),
      bluesky: parseBoundValue(data?.bindings?.bluesky),
    },
    sync: {
      twitter: Boolean(data?.sync?.twitter),
      bluesky: Boolean(data?.sync?.bluesky),
    },
    twitter: {
      hasSyncAppConfig: Boolean(data?.twitter?.hasSyncAppConfig),
      hasSyncToken: Boolean(data?.twitter?.hasSyncToken),
      appConfig: {
        clientId: data?.twitter?.appConfig?.clientId || "",
        clientSecret: data?.twitter?.appConfig?.clientSecret || "",
        redirectUri: data?.twitter?.appConfig?.redirectUri || "",
      },
    },
    bluesky: {
      pds: data?.bluesky?.pds || "",
      hasSyncToken: Boolean(data?.bluesky?.hasSyncToken),
    },
  };

  overview.value = nextOverview;
  syncSettings.value = { ...nextOverview.sync };
  twitterApp.value = { ...nextOverview.twitter.appConfig };
  blueskyPds.value = nextOverview.bluesky.pds;
};

const loadOverview = async () => {
  loading.value = true;
  try {
    const result = await SocialService.getOverview();
    if (result.status === "success") {
      applyOverview(result.data || {});
    } else {
      setMessage("error", result.message || "加载社交集成状态失败");
    }
  } catch (error) {
    setMessage("error", getErrorMessage(error, "加载社交集成状态失败"));
  } finally {
    loading.value = false;
  }
};

const saveSyncSettings = async () => {
  savingSettings.value = true;
  try {
    const result = await SocialService.updateSyncSettings(syncSettings.value);
    if (result.status === "success") {
      setMessage("success", "同步开关已保存");
      await loadOverview();
      return;
    }
    setMessage("error", result.message || "保存同步开关失败");
  } catch (error) {
    setMessage("error", getErrorMessage(error, "保存同步开关失败"));
  } finally {
    savingSettings.value = false;
  }
};

const saveTwitterApp = async () => {
  savingTwitterApp.value = true;
  try {
    const payload = {
      clientId: twitterApp.value.clientId?.trim(),
      clientSecret: twitterApp.value.clientSecret?.trim(),
      redirectUri: twitterApp.value.redirectUri?.trim() || undefined,
    };

    const result = await SocialService.saveTwitterSyncApp(payload);
    if (result.status === "success") {
      setMessage("success", "Twitter 同步 App 配置已保存");
      await loadOverview();
      return;
    }
    setMessage("error", result.message || "保存 Twitter 同步 App 配置失败");
  } catch (error) {
    setMessage(
      "error",
      getErrorMessage(error, "保存 Twitter 同步 App 配置失败"),
    );
  } finally {
    savingTwitterApp.value = false;
  }
};

const deleteTwitterApp = async () => {
  deletingTwitterApp.value = true;
  try {
    const result = await SocialService.deleteTwitterSyncApp();
    if (result.status === "success") {
      setMessage("success", "Twitter 同步 App 配置已删除");
      await loadOverview();
      return;
    }
    setMessage("error", result.message || "删除 Twitter 同步 App 配置失败");
  } catch (error) {
    setMessage(
      "error",
      getErrorMessage(error, "删除 Twitter 同步 App 配置失败"),
    );
  } finally {
    deletingTwitterApp.value = false;
  }
};

const authorizeTwitterSync = () => {
  window.location.href = SocialService.getTwitterSyncOAuthStartUrl(
    localuser.getToken(),
  );
};

const authorizeBlueskySync = () => {
  const pds = blueskyPds.value?.trim();
  window.location.href = SocialService.getBlueskySyncOAuthStartUrl(
    localuser.getToken(),
    pds,
  );
};

const saveBlueskyPds = async () => {
  savingBlueskyPds.value = true;
  try {
    const pds = blueskyPds.value?.trim();
    const result = await SocialService.setBlueskyPds(pds);
    if (result.status === "success") {
      setMessage("success", "Bluesky PDS 已保存");
      await loadOverview();
      return;
    }
    setMessage("error", result.message || "保存 Bluesky PDS 失败");
  } catch (error) {
    setMessage("error", getErrorMessage(error, "保存 Bluesky PDS 失败"));
  } finally {
    savingBlueskyPds.value = false;
  }
};

onMounted(() => {
  loadOverview();
});
</script>
