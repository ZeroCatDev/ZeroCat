<template>
  <div ref="editorContainer" class="monaco-editor-container"></div>
</template>

<script>
import * as monaco from 'monaco-editor';
import { toRaw } from 'vue';

export default {
  name: 'MonacoEditorComponent',
  props: {
    value: {
      type: String,
      default: ''
    },
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
    projectType: {
      type: String,
      default: ''
    }
  },
  emits: ['update:value', 'change', 'monaco-ready'],
  data() {
    return {
      editor: null,
      defaultOptions: {
        theme: 'vs-dark',
        fontSize: 14,
        tabSize: 2,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: 'on',
        lineNumbers: 'on',
        glyphMargin: true,
        folding: true,
        lineDecorationsWidth: 10,
        lineNumbersMinChars: 3
      }
    };
  },
  watch: {
    value(newValue) {
      if (this.editor && newValue !== this.getValue()) {
        this.setValue(newValue);
      }
    },
    language(newValue) {
      if (this.editor) {
        const model = toRaw(this.editor.getModel());
        if (model) {
          monaco.editor.setModelLanguage(model, newValue);
        }
      }
    },
    options: {
      deep: true,
      handler(newOptions) {
        if (this.editor) {
          toRaw(this.editor).updateOptions(newOptions);
        }
      }
    }
  },
  mounted() {
    this.initMonaco();
  },
  beforeUnmount() {
    this.disposeEditor();
  },
  methods: {
    initMonaco() {
      const container = this.$refs.editorContainer;
      container.style.height = this.height;

      // 合并配置选项
      const editorOptions = {
        ...this.defaultOptions,
        ...this.options,
        value: this.value,
        language: this.language
      };

      // 创建编辑器
      this.editor = monaco.editor.create(container, editorOptions);

      // 监听内容变化
      this.editor.onDidChangeModelContent(() => {
        const value = this.getValue();
        this.$emit('update:value', value);
        this.$emit('change', value);
      });

      // 通知编辑器已准备就绪
      this.$nextTick(() => {
        this.$emit('monaco-ready', {
          monaco,
          editor: toRaw(this.editor),
          availableLanguages: monaco.languages.getLanguages()
        });
      });
    },
    disposeEditor() {
      if (this.editor) {
        const rawEditor = toRaw(this.editor);
        const model = rawEditor.getModel();
        if (model) {
          model.dispose();
        }
        rawEditor.dispose();
        this.editor = null;
      }
    },
    getValue() {
      if (!this.editor) return '';
      const rawEditor = toRaw(this.editor);
      return rawEditor.getValue();
    },
    setValue(value) {
      if (!this.editor) return;
      const rawEditor = toRaw(this.editor);
      const currentValue = rawEditor.getValue();
      if (value !== currentValue) {
        rawEditor.setValue(value);
      }
    },
    focus() {
      if (this.editor) {
        toRaw(this.editor).focus();
      }
    }
  }
};
</script>

<style scoped>
.monaco-editor-container {
  width: 100%;
  min-height: 100px;
  border-radius: 4px;
  overflow: hidden;
}
</style>
