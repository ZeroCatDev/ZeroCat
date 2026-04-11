<template>
  <v-container fluid class="pa-4 pa-md-6" style="max-width: 1100px">
    <div class="text-h5 font-weight-bold mb-1">ScratchBlocks 转换</div>
    <div class="text-body-2 text-medium-emphasis mb-6">
      上传 Scratch/TurboWarp 的 project.json，将每个角色的积木树转换为 scratchblocks（snapblocks）代码。
    </div>

    <v-card border class="mb-4">
      <v-card-text>
        <v-row dense>
          <v-col cols="12" md="6">
            <v-file-input
              v-model="projectFile"
              label="选择 project.json 或 .sb3"
              accept="application/json,.json,.sb3,application/zip"
              prepend-icon="mdi-file-upload"
              border
              hide-details
            />
          </v-col>
          <v-col cols="12" md="3">
            <v-select
              v-model="selectedLanguage"
              :items="languageOptions"
              item-title="label"
              item-value="value"
              label="积木语言"
              border
              hide-details
            />
          </v-col>
          <v-col cols="12" md="3" class="d-flex align-center">
            <v-btn
              block
              color="primary"
              prepend-icon="mdi-code-json"
              :loading="loading"
              :disabled="!projectFile"
              @click="convert"
            >
              开始转换
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <v-alert v-if="error" type="error" variant="tonal" closable class="mb-4" @click:close="error = ''">
      {{ error }}
    </v-alert>

    <v-card v-if="convertedTargets.length" border class="mb-4">
      <v-card-text class="py-3">
        <div class="text-subtitle-2 mb-2">角色切换</div>
        <v-chip-group
        column
          v-model="activeTargetIndex"
          selected-class="active-target-chip"
          class="target-chip-group"

        >
          <v-chip
            v-for="(target, index) in convertedTargets"
            :key="`${target.name}-${index}`"
            :value="index"
            border
            class="ma-1"
          >
            <v-icon start :icon="target.isStage ? 'mdi-monitor' : 'mdi-account'" />
            {{ target.name }}
          </v-chip>
        </v-chip-group>
      </v-card-text>
    </v-card>

    <div v-if="activeTarget" ref="renderRootRef">
      <v-card border class="fill-height d-flex flex-column">
        <v-card-item>
          <template #prepend>
            <v-icon :icon="activeTarget.isStage ? 'mdi-monitor' : 'mdi-account'" />
          </template>
          <v-card-title>{{ activeTarget.name }}</v-card-title>
          <v-card-subtitle>{{ activeTarget.scripts.length }} 棵积木树</v-card-subtitle>
        </v-card-item>

        <v-card-text class="pt-1">
          <v-sheet
            v-for="(script, index) in activeTarget.scripts"
            :key="`${activeTarget.name}-${index}`"
            border
            rounded
            class="script-sheet pa-3 mb-3"
            @click="copyText(script)"
          >
            <div class="text-caption text-medium-emphasis mb-2">#{{ index + 1 }}（点击复制）</div>
            <pre class="blocks">{{ script }}</pre>
          </v-sheet>
        </v-card-text>
      </v-card>
    </div>

    <v-snackbar v-model="copied" :timeout="1500" color="success">已复制到剪贴板</v-snackbar>
  </v-container>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useHead } from '@unhead/vue';
import JSZip from 'jszip';
import scratchblocksAllLocales from '@/constants/scratchblocks-locales/all.js';
import scratchblocksZhCn from '@/constants/scratchblocks-locales/zh-cn.json';

useHead({ title: 'ScratchBlocks 转换' });

const projectFile = ref(null);
const loading = ref(false);
const error = ref('');
const copied = ref(false);
const convertedTargets = ref([]);
const renderRootRef = ref(null);
const activeTargetIndex = ref(0);
const selectedLanguage = ref('zh-cn');
const sourceProject = ref(null);

let scratchblocksModule = null;
const loadedLanguageCodes = new Set();

const totalScripts = computed(() => {
  return convertedTargets.value.reduce((sum, target) => sum + target.scripts.length, 0);
});

const activeTarget = computed(() => {
  if (!convertedTargets.value.length) {
    return null;
  }
  const index = Math.min(Math.max(Number(activeTargetIndex.value) || 0, 0), convertedTargets.value.length - 1);
  return convertedTargets.value[index] || null;
});

const normalizedLocaleMap = Object.fromEntries(
  Object.entries(scratchblocksAllLocales).map(([code, locale]) => [code.replaceAll('_', '-'), locale]),
);

const LANGUAGE_NAME_OVERRIDES = {
  'zh-cn': '简体中文',
  'zh-tw': '繁體中文',
  'pt-br': '葡萄牙语（巴西）',
  'es-419': '西班牙语（拉美）',
  'ja-Hira': '日语（平假名）',
};

const languageNameFormatter =
  typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['zh-Hans', 'zh'], { type: 'language' })
    : null;

function getLanguageLabel(code) {
  if (LANGUAGE_NAME_OVERRIDES[code]) {
    return `${LANGUAGE_NAME_OVERRIDES[code]} (${code})`;
  }
  const canonicalCode = code.toLowerCase();
  if (LANGUAGE_NAME_OVERRIDES[canonicalCode]) {
    return `${LANGUAGE_NAME_OVERRIDES[canonicalCode]} (${code})`;
  }
  try {
    const normalized = code.includes('-') ? code : code.toLowerCase();
    const display = languageNameFormatter?.of(normalized);
    if (display) {
      return `${display} (${code})`;
    }
  } catch {
  }
  return code;
}

const languageOptions = computed(() => {
  const codes = Object.keys(normalizedLocaleMap).sort((a, b) => a.localeCompare(b));
  const sorted = codes.includes('zh-cn')
    ? ['zh-cn', ...codes.filter((code) => code !== 'zh-cn')]
    : codes;
  return sorted.map((code) => ({ label: getLanguageLabel(code), value: code }));
});

const currentLocale = computed(() => {
  return normalizedLocaleMap[selectedLanguage.value] || scratchblocksZhCn;
});

const IGNORED_INPUT_KEYS = new Set(['SUBSTACK', 'SUBSTACK2']);
const C_SHAPED_OPCODES = new Set([
  'control_repeat',
  'control_forever',
  'control_if',
  'control_if_else',
  'control_repeat_until',
  'control_while',
  'control_for_each',
]);

function escapeBracketText(text) {
  return String(text ?? '').replace(/\]/g, '\\]');
}

function normalizeOpcode(opcode) {
  const upper = String(opcode || '').toUpperCase();
  if (upper.startsWith('OPERATOR_')) {
    return upper.replace('OPERATOR_', 'OPERATORS_');
  }
  return upper;
}

function getTemplate(opcode) {
  const key = normalizeOpcode(opcode);
  return currentLocale.value?.commands?.[key] || scratchblocksZhCn?.commands?.[key] || '';
}

function fieldToArg(fieldKey, fieldValue) {
  if (!Array.isArray(fieldValue)) {
    return `[${escapeBracketText(fieldValue)}]`;
  }
  const name = String(fieldValue[0] ?? '');
  if (fieldKey === 'VARIABLE' || fieldKey === 'LIST') {
    return `[${escapeBracketText(name)} v]`;
  }
  return `[${escapeBracketText(name)}]`;
}

function literalToArg(literal) {
  if (!Array.isArray(literal)) {
    return `[${escapeBracketText(literal)}]`;
  }
  const value = literal[1];
  const text = String(value ?? '');
  if (text !== '' && !Number.isNaN(Number(text))) {
    return `(${text})`;
  }
  return `[${escapeBracketText(text)}]`;
}

function inputToArg(input, context) {
  if (!Array.isArray(input)) {
    return '[]';
  }

  const blockId = typeof input[1] === 'string' ? input[1] : null;
  const literal = Array.isArray(input[1]) ? input[1] : Array.isArray(input[2]) ? input[2] : null;

  if (blockId) {
    return renderInlineBlock(blockId, context);
  }

  if (literal) {
    return literalToArg(literal);
  }

  return '[]';
}

function buildArgs(block, context) {
  const args = [];

  const fields = block.fields || {};
  for (const [fieldKey, fieldValue] of Object.entries(fields)) {
    args.push(fieldToArg(fieldKey, fieldValue));
  }

  const inputs = block.inputs || {};
  for (const [inputKey, inputValue] of Object.entries(inputs)) {
    if (IGNORED_INPUT_KEYS.has(inputKey)) {
      continue;
    }
    args.push(inputToArg(inputValue, context));
  }

  return args;
}

function fillTemplate(template, args) {
  if (!template) {
    return '';
  }
  return template.replace(/%(\d+)/g, (_, numberText) => {
    const index = Number(numberText) - 1;
    return args[index] ?? '[]';
  });
}

function fallbackText(block, context) {
  const args = buildArgs(block, context);
  const argsText = args.length ? ` ${args.join(' ')}` : '';
  return `${block.opcode}${argsText}`;
}

function blockToText(block, context) {
  const template = getTemplate(block.opcode);
  const args = buildArgs(block, context);
  return template ? fillTemplate(template, args) : fallbackText(block, context);
}

function renderInlineBlock(blockId, context) {
  const block = context.blocks[blockId];
  if (!block) {
    return '[]';
  }
  const text = blockToText(block, context);
  if (text.startsWith('<') && text.endsWith('>')) {
    return text;
  }
  return `(${text})`;
}

function renderScriptFromBlock(blockId, context, indentLevel = 0) {
  const lines = [];
  let currentId = blockId;

  while (currentId) {
    const block = context.blocks[currentId];
    if (!block) {
      break;
    }

    const indent = '  '.repeat(indentLevel);
    const header = blockToText(block, context);

    if (C_SHAPED_OPCODES.has(block.opcode)) {
      lines.push(`${indent}${header}`);

      const substackId = block.inputs?.SUBSTACK?.[1];
      if (typeof substackId === 'string') {
        lines.push(...renderScriptFromBlock(substackId, context, indentLevel + 1));
      }

      if (block.opcode === 'control_if_else') {
        lines.push(`${indent}else`);
        const substack2Id = block.inputs?.SUBSTACK2?.[1];
        if (typeof substack2Id === 'string') {
          lines.push(...renderScriptFromBlock(substack2Id, context, indentLevel + 1));
        }
      }

      lines.push(`${indent}end`);
    } else {
      lines.push(`${indent}${header}`);
    }

    currentId = block.next;
  }

  return lines;
}

function convertTarget(target) {
  const blocks = target.blocks || {};
  const topLevelBlocks = Object.entries(blocks)
    .filter(([, block]) => block?.topLevel)
    .sort(([, a], [, b]) => {
      const ay = Number.isFinite(a?.y) ? a.y : Number.MAX_SAFE_INTEGER;
      const by = Number.isFinite(b?.y) ? b.y : Number.MAX_SAFE_INTEGER;
      if (ay !== by) return ay - by;
      const ax = Number.isFinite(a?.x) ? a.x : Number.MAX_SAFE_INTEGER;
      const bx = Number.isFinite(b?.x) ? b.x : Number.MAX_SAFE_INTEGER;
      return ax - bx;
    });

  const context = { blocks };
  const scripts = topLevelBlocks
    .map(([id]) => renderScriptFromBlock(id, context, 0).join('\n').trim())
    .filter(Boolean);

  return {
    name: target.name || (target.isStage ? 'Stage' : 'Sprite'),
    isStage: Boolean(target.isStage),
    scripts,
  };
}

function parseProject(text) {
  const json = JSON.parse(text);
  if (!Array.isArray(json?.targets)) {
    throw new Error('无效的项目文件：缺少 targets 数组');
  }
  return json;
}

function getSingleFile(fileInput) {
  if (!fileInput) {
    return null;
  }
  if (Array.isArray(fileInput)) {
    return fileInput[0] || null;
  }
  return fileInput;
}

async function readProjectTextFromSb3(file) {
  const zip = await JSZip.loadAsync(file);
  const directEntry = zip.file('project.json');
  const nestedEntry = directEntry || Object.values(zip.files).find((entry) => !entry.dir && entry.name.endsWith('/project.json'));
  if (!nestedEntry) {
    throw new Error('无效的 sb3 文件：未找到 project.json');
  }
  return nestedEntry.async('text');
}

async function resolveProjectText() {
  const file = getSingleFile(projectFile.value);
  if (!file) {
    throw new Error('请先选择 project.json 或 sb3 文件');
  }

  const fileName = String(file.name || '').toLowerCase();
  if (fileName.endsWith('.sb3')) {
    return readProjectTextFromSb3(file);
  }

  return file.text();
}

async function convert() {
  error.value = '';
  convertedTargets.value = [];

  if (!projectFile.value) {
    error.value = '请先选择 project.json 或 sb3 文件';
    return;
  }

  loading.value = true;
  try {
    const text = await resolveProjectText();
    const project = parseProject(text);
    sourceProject.value = project;
    convertedTargets.value = project.targets.map(convertTarget);
    activeTargetIndex.value = 0;
    await nextTick();
    await renderScratchBlocks();
  } catch (err) {
    error.value = err?.message || '转换失败，请检查 JSON 格式是否正确';
  } finally {
    loading.value = false;
  }
}

function getLocalePayload(code) {
  return normalizedLocaleMap[code] || null;
}

async function ensureScratchblocksLanguages(sb, codes) {
  const languagePayload = {};
  let hasNewLanguage = false;

  for (const code of codes) {
    if (!code || loadedLanguageCodes.has(code)) {
      continue;
    }
    const payload = getLocalePayload(code);
    if (payload) {
      languagePayload[code] = payload;
      loadedLanguageCodes.add(code);
      hasNewLanguage = true;
    }
  }

  if (hasNewLanguage) {
    sb.loadLanguages(languagePayload);
  }
}

async function renderScratchBlocks() {
  const root = renderRootRef.value?.$el || renderRootRef.value;
  if (!root || typeof root.querySelectorAll !== 'function') {
    return;
  }
  const preBlocks = root.querySelectorAll('pre.blocks');
  if (!preBlocks.length) {
    return;
  }

  if (!scratchblocksModule) {
    const sb = await import('scratchblocks').then((m) => m.default);
    await ensureScratchblocksLanguages(sb, ['zh-cn', selectedLanguage.value]);
    scratchblocksModule = sb;
  } else {
    await ensureScratchblocksLanguages(scratchblocksModule, [selectedLanguage.value]);
  }

  const sb = scratchblocksModule;
  const options = {
    style: 'scratch3',
    inline: false,
    languages: ['en', selectedLanguage.value],
    scale: 1,
  };

  preBlocks.forEach((el) => {
    if (el.querySelector('.scratchblocks')) {
      return;
    }
    const code = sb.read(el, options);
    const doc = sb.parse(code, options);
    const svg = sb.render(doc, options);
    sb.replace(el, svg, doc, options);
  });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
  } catch {
    error.value = '复制失败，请手动复制文本';
  }
}

watch(activeTargetIndex, async () => {
  await nextTick();
  await renderScratchBlocks();
});

watch(selectedLanguage, async () => {
  if (!sourceProject.value) {
    return;
  }
  convertedTargets.value = sourceProject.value.targets.map(convertTarget);
  await nextTick();
  await renderScratchBlocks();
});
</script>

<style scoped>
.active-target-chip {
  border-color: rgb(var(--v-theme-primary));
}



.script-sheet {
  cursor: pointer;
}

.script-sheet :deep(svg) {
  max-width: 100%;
  height: auto;
}
</style>
