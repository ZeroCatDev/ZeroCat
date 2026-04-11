<template>
  <div ref="editorContainer" class="editor-monaco-container" style="height: 100%; width: 100%"></div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import 'monaco-editor/esm/nls.messages.zh-cn.js';
import * as monaco from 'monaco-editor';

const emit = defineEmits(["update:modelValue", "change", "monaco-ready"]);
const model = defineModel({ default: '' });

const props = defineProps({
  language: {
    type: String,
    default: 'javascript'
  },
  options: {
    type: Object,
    default: () => ({})
  },
  height: {
    type: String,
    default: '100%'
  },
  readonly: {
    type: Boolean,
    default: false
  },
  projectType: {
    type: String,
    default: ""
  }
});

const editorContainer = ref(null);
const isDestroyed = ref(false);
let editor = null;
let resizeObserver = null;
let disposables = [];

const defaultOptions = {
  theme: 'vs-dark',
  fontSize: 14,
  tabSize: 2,
  minimap: {
    enabled: true,
    scale: 2,
    showSlider: "mouseover"
  },
  scrollBeyondLastLine: true,
  automaticLayout: true,
  wordWrap: 'on',
  lineNumbers: 'on',
  renderLineHighlight: "all",
  formatOnPaste: true,
  formatOnType: true,
  autoIndent: "full",
  suggestOnTriggerCharacters: true,
  acceptSuggestionOnEnter: "on",
  quickSuggestions: {
    other: true,
    comments: true,
    strings: true
  },
  snippetSuggestions: "top",
  renderControlCharacters: true,
  renderWhitespace: "selection",
  bracketPairColorization: {
    enabled: true,
    independentColorPoolPerBracketType: true
  },
  guides: {
    bracketPairs: true,
    indentation: true,
    highlightActiveIndentation: true,
    bracketPairsHorizontal: true
  },
  cursorBlinking: "smooth",
  cursorSmoothCaretAnimation: "on",
  smoothScrolling: true,
  mouseWheelZoom: true,
  padding: {
    top: 5,
    bottom: 5
  },
  folding: true,
  foldingHighlight: true,
  unfoldOnClickAfterEndOfLine: true,
  links: true,
  contextmenu: true,
  mouseWheelScrollSensitivity: 1,
  roundedSelection: true,
  scrollbar: {
    verticalScrollbarSize: 12,
    horizontalScrollbarSize: 12,
    useShadows: true,
    verticalHasArrows: false,
    horizontalHasArrows: false,
    arrowSize: 0
  }
};

// 清理所有资源
const disposeAll = () => {
  isDestroyed.value = true;

  // 清理所有注册的disposables
  disposables.forEach(d => d?.dispose());
  disposables = [];

  // 清理编辑器实例
  if (editor) {
    try {
      const model = editor.getModel();
      if (model) {
        model.dispose();
      }
      editor.dispose();
    } catch (e) {
      console.error('Error disposing editor:', e);
    }
    editor = null;
  }

  // 清理ResizeObserver
  if (resizeObserver) {
    try {
      resizeObserver.disconnect();
    } catch (e) {
      console.error('Error disconnecting resize observer:', e);
    }
    resizeObserver = null;
  }

  // 清理DOM
  if (editorContainer.value) {
    editorContainer.value.innerHTML = '';
  }
};

// 创建编辑器实例
const createEditor = () => {
  if (!editorContainer.value) return;

  // 如果有项目类型，尝试设置对应的语言
  let initialLanguage = props.language;
  if (props.projectType) {
    const projectLang = props.projectType.split('-')[0].toLowerCase();
    const availableLangs = monaco.languages.getLanguages();
    const matchedLang = availableLangs.find(lang => lang.id === projectLang);
    if (matchedLang) {
      initialLanguage = matchedLang.id;
    }
  }

  const options = {
    ...defaultOptions,
    ...props.options,
    value: model.value,
    language: initialLanguage,
    readOnly: props.readonly
  };

  try {
    // 创建编辑器
    editor = monaco.editor.create(editorContainer.value, options);

    // 监听内容变化
    const contentChangeDisposable = editor.onDidChangeModelContent(() => {
      const value = editor.getValue();
      if (value !== model.value) {
        emit("update:modelValue", value);
        emit("change", value);
      }
    });
    disposables.push(contentChangeDisposable);

    // 添加ResizeObserver以确保编辑器在容器大小变化时调整大小
    resizeObserver = new ResizeObserver(() => {
      if (editor) {
        editor.layout();
      }
    });
    resizeObserver.observe(editorContainer.value);

    // 确保编辑器初始布局正确
    setTimeout(() => {
      if (editor) {
        editor.layout();
      }
    }, 100);

    // 添加编辑器焦点变化监听
    const focusDisposable = editor.onDidFocusEditorText(() => {
      if (editor) {
        editor.layout();
      }
    });
    disposables.push(focusDisposable);

    // 添加编辑器配置变化监听
    const configurationDisposable = editor.onDidChangeConfiguration(() => {
      if (editor) {
        editor.layout();
      }
    });
    disposables.push(configurationDisposable);

    // 注册额外的主题
    monaco.editor.defineTheme("monokai", {
      base: "vs-dark",
      inherit: true,
      rules: [
        {token: "comment", foreground: "88846f", fontStyle: "italic"},
        {token: "keyword", foreground: "f92672"},
        {token: "string", foreground: "e6db74"},
        {token: "number", foreground: "ae81ff"},
      ],
      colors: {
        "editor.background": "#272822",
        "editor.foreground": "#f8f8f2",
        "editorLineNumber.foreground": "#90908a",
        "editor.selectionBackground": "#49483e",
        "editor.lineHighlightBackground": "#3e3d32",
      },
    });

    // 通知父组件 Monaco 已加载完成
    emit('monaco-ready', {
      monaco,
      editor,
      availableLanguages: monaco.languages.getLanguages()
    });
  } catch (error) {
    console.error('Failed to initialize Monaco editor:', error);
  }
};

// 监听属性变化
watch(() => model.value, (newValue) => {
  if (editor && !isDestroyed.value && newValue !== editor.getValue()) {
    editor.setValue(newValue || '');
  }
});

watch(() => props.language, (newLanguage) => {
  if (monaco && editor) {
    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelLanguage(model, newLanguage);
    }
  }
});

watch(() => props.options, (newOptions) => {
  if (editor && !isDestroyed.value) {
    editor.updateOptions(newOptions);
  }
}, { deep: true });

watch(() => props.readonly, (newValue) => {
  if (editor && !isDestroyed.value) {
    editor.updateOptions({ readOnly: newValue });
  }
});

watch(() => props.projectType, (newType) => {
  if (editor && monaco && newType) {
    const projectLang = newType.split('-')[0].toLowerCase();
    const availableLangs = monaco.languages.getLanguages();
    const matchedLang = availableLangs.find(lang => lang.id === projectLang);
    if (matchedLang) {
      const model = editor.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, matchedLang.id);
      }
    }
  }
});

// 组件挂载时创建编辑器
onMounted(() => {
  createEditor();

  // 添加窗口大小变化监听
  const handleResize = () => {
    if (editor) {
      editor.layout();
    }
  };
  window.addEventListener("resize", handleResize);
  disposables.push({
    dispose: () => window.removeEventListener("resize", handleResize)
  });
});

// 组件卸载前清理所有资源
onBeforeUnmount(() => {
  disposeAll();
});
</script>

<style scoped>
.editor-monaco-container {
  width: 100%;
  min-height: 100px;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}
</style>