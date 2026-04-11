<template>
  <v-container fluid class="pa-4 pa-md-6" style="max-width: 960px">
    <div class="text-h5 font-weight-bold mb-1" style="letter-spacing: -0.5px">
      翻译
    </div>
    <div class="text-body-2 text-medium-emphasis mb-6">
      输入文本，即时翻译为目标语言。
    </div>

    <!-- Language selectors -->
    <v-row dense class="mb-2" align="center">
      <v-col cols="5" sm="5">
        <v-select
          v-model="sourceLang"
          :items="sourceLangOptions"
          :loading="langsLoading"
          variant="outlined"
          density="compact"
          hide-details
          label="源语言"
        />
      </v-col>
      <v-col cols="2" sm="2" class="d-flex justify-center">
        <v-btn
          icon="mdi-swap-horizontal"
          variant="text"
          size="small"
          :disabled="sourceLang === 'auto'"
          @click="swapLangs"
        />
      </v-col>
      <v-col cols="5" sm="5">
        <v-select
          v-model="targetLang"
          :items="targetLangOptions"
          :loading="langsLoading"
          variant="outlined"
          density="compact"
          hide-details
          label="目标语言"
        />
      </v-col>
    </v-row>

    <!-- Translation panels -->
    <v-row dense>
      <!-- Source -->
      <v-col cols="12" md="6">
        <v-card variant="outlined" class="fill-height d-flex flex-column">
          <v-textarea
            v-model="sourceText"
            placeholder="输入要翻译的文本..."
            variant="plain"
            auto-grow
            rows="6"
            max-rows="14"
            hide-details
            class="px-4 pt-3 flex-grow-1"
            @keydown.ctrl.enter="translate"
          />
          <v-divider />
          <div class="d-flex align-center px-3 py-1">
            <span class="text-caption text-medium-emphasis">
              {{ sourceText.length }} 字符
            </span>
            <v-spacer />
            <v-btn
              icon="mdi-close"
              variant="text"
              size="x-small"
              :disabled="!sourceText"
              @click="sourceText = ''"
            />
          </div>
        </v-card>
      </v-col>

      <!-- Target -->
      <v-col cols="12" md="6">
        <v-card
          variant="outlined"
          class="fill-height d-flex flex-column"
          :loading="loading"
        >
          <v-textarea
            v-model="targetText"
            placeholder="翻译结果"
            variant="plain"
            auto-grow
            rows="6"
            max-rows="14"
            hide-details
            readonly
            class="px-4 pt-3 flex-grow-1"
          />
          <v-divider />
          <div class="d-flex align-center px-3 py-1">
            <span
              v-if="detectedLang"
              class="text-caption text-medium-emphasis"
            >
              检测到: {{ langName(detectedLang) }}
            </span>
            <v-spacer />
            <v-btn
              icon="mdi-content-copy"
              variant="text"
              size="x-small"
              :disabled="!targetText"
              @click="copyResult"
            />
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Translate button -->
    <div class="d-flex justify-end mt-3">
      <v-btn
        color="primary"
        variant="flat"
        :loading="loading"
        :disabled="!sourceText.trim()"
        prepend-icon="mdi-translate"
        @click="translate"
      >
        翻译
      </v-btn>
    </div>

    <!-- Error -->
    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      closable
      class="mt-4"
      @click:close="error = ''"
    >
      {{ error }}
    </v-alert>

    <v-snackbar v-model="copied" :timeout="1500" color="success">
      已复制到剪贴板
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useHead } from "@unhead/vue";

useHead({ title: "翻译" });

const API_BASE = "https://translate.houlang.cloud";

const LANG_NAMES = {
  en: "英语",
  "zh-Hans": "简体中文",
  "zh-Hant": "繁体中文",
  ja: "日语",
  ko: "韩语",
  fr: "法语",
  de: "德语",
  es: "西班牙语",
  pt: "葡萄牙语",
  ru: "俄语",
  ar: "阿拉伯语",
  it: "意大利语",
  nl: "荷兰语",
  pl: "波兰语",
  vi: "越南语",
  th: "泰语",
  id: "印尼语",
  ms: "马来语",
  tr: "土耳其语",
  uk: "乌克兰语",
  hi: "印地语",
  bn: "孟加拉语",
  ta: "泰米尔语",
  te: "泰卢固语",
  ml: "马拉雅拉姆语",
  kn: "卡纳达语",
  gu: "古吉拉特语",
  fa: "波斯语",
  he: "希伯来语",
  sv: "瑞典语",
  da: "丹麦语",
  fi: "芬兰语",
  nb: "挪威语(书面)",
  nn: "挪威语(新)",
  is: "冰岛语",
  el: "希腊语",
  bg: "保加利亚语",
  ro: "罗马尼亚语",
  hu: "匈牙利语",
  cs: "捷克语",
  sk: "斯洛伐克语",
  sl: "斯洛文尼亚语",
  hr: "克罗地亚语",
  sr: "塞尔维亚语",
  bs: "波斯尼亚语",
  sq: "阿尔巴尼亚语",
  et: "爱沙尼亚语",
  lv: "拉脱维亚语",
  lt: "立陶宛语",
  ca: "加泰罗尼亚语",
  az: "阿塞拜疆语",
  be: "白俄罗斯语",
};

function langName(code) {
  return LANG_NAMES[code] || code;
}

const languages = ref([]);
const langsLoading = ref(false);
const sourceLang = ref("auto");
const targetLang = ref("zh-Hans");
const sourceText = ref("");
const targetText = ref("");
const detectedLang = ref("");
const loading = ref(false);
const error = ref("");
const copied = ref(false);

const sourceLangOptions = computed(() => [
  { title: "自动检测", value: "auto" },
  ...languages.value.map((code) => ({ title: langName(code), value: code })),
]);

const targetLangOptions = computed(() =>
  languages.value.map((code) => ({ title: langName(code), value: code }))
);

async function fetchLanguages() {
  langsLoading.value = true;
  try {
    const res = await fetch(`${API_BASE}/languages`);
    if (!res.ok) throw new Error(`获取语言列表失败 (${res.status})`);
    const json = await res.json();
    languages.value = json.languages || [];
    // Set sensible defaults if available
    if (languages.value.includes("zh")) targetLang.value = "zh";
  } catch (e) {
    error.value = e.message || "无法加载语言列表";
  } finally {
    langsLoading.value = false;
  }
}

function swapLangs() {
  const tmpLang = sourceLang.value;
  const tmpText = sourceText.value;
  sourceLang.value = targetLang.value;
  targetLang.value = tmpLang;
  sourceText.value = targetText.value;
  targetText.value = tmpText;
  detectedLang.value = "";
}

async function translate() {
  const text = sourceText.value.trim();
  if (!text) return;

  loading.value = true;
  error.value = "";
  detectedLang.value = "";

  try {
    // Detect language if set to auto
    let fromLang = sourceLang.value;
    if (fromLang === "auto") {
      const detectRes = await fetch(`${API_BASE}/detect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!detectRes.ok) throw new Error(`语言检测失败 (${detectRes.status})`);
      const detectJson = await detectRes.json();
      fromLang = detectJson.language;
      detectedLang.value = fromLang;
    }

    // Translate
    const res = await fetch(`${API_BASE}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromLang,
        to: targetLang.value,
        text,
      }),
    });

    if (!res.ok) throw new Error(`翻译请求失败 (${res.status})`);
    const json = await res.json();

    if (json.result != null) {
      targetText.value = json.result;
    } else {
      throw new Error("未获取到翻译结果");
    }
  } catch (e) {
    error.value = e.message || "翻译失败，请稍后重试";
  } finally {
    loading.value = false;
  }
}

async function copyResult() {
  try {
    await navigator.clipboard.writeText(targetText.value);
    copied.value = true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = targetText.value;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    copied.value = true;
  }
}

onMounted(fetchLanguages);
</script>
