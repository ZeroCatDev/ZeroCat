<template>
  <div class="diff-monaco-container" :style="{ height: height }">
    <div class="diff-header" v-if="showHeader">
      <div class="left-header">
        <slot name="left-header">
          <div class="header-content">
            <v-icon size="small" class="mr-2">{{ leftIcon }}</v-icon>
            <span class="text-subtitle-2">{{ leftTitle }}</span>
          </div>
        </slot>
      </div>
      <div class="right-header">
        <slot name="right-header">
          <div class="header-content">
            <v-icon size="small" class="mr-2">{{ rightIcon }}</v-icon>
            <span class="text-subtitle-2">{{ rightTitle }}</span>
          </div>
        </slot>
      </div>
    </div>
    <div ref="diffContainer" class="diff-editor"></div>
  </div>
</template>

<script>
import * as monaco from 'monaco-editor';

export default {
  name: 'DiffMonacoComponent',
  props: {
    originalValue: {
      type: String,
      required: true
    },
    modifiedValue: {
      type: String,
      required: true
    },
    language: {
      type: String,
      default: 'javascript'
    },
    height: {
      type: String,
      default: '500px'
    },
    showHeader: {
      type: Boolean,
      default: true
    },
    leftTitle: {
      type: String,
      default: '原始版本'
    },
    rightTitle: {
      type: String,
      default: '修改版本'
    },
    leftIcon: {
      type: String,
      default: 'mdi-source-commit'
    },
    rightIcon: {
      type: String,
      default: 'mdi-source-commit-next'
    },
    options: {
      type: Object,
      default: () => ({})
    },
    readonly: {
      type: Boolean,
      default: false
    }
  },
  emits: ['modified-change', 'original-change', 'diff-ready'],
  data() {
    return {
      diffEditor: null,
      originalModel: null,
      modifiedModel: null,
      isDestroyed: false,
      defaultOptions: {
        theme: 'vs-dark',
        automaticLayout: true,
        readOnly: false,
        renderSideBySide: true,
        originalEditable: false,
        enableSplitViewResizing: true,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        fontSize: 14,
        lineNumbers: 'on',
        wordWrap: 'on',
        folding: true,
        lineDecorationsWidth: 10,
        lineNumbersMinChars: 3,
        contextmenu: true,
        find: {
          autoFindInSelection: 'always'
        }
      }
    };
  },
  mounted() {
    this.initDiffEditor();
  },
  beforeUnmount() {
    this.destroyDiffEditor();
  },
  watch: {
    originalValue(newValue) {
      if (this.originalModel && !this.isDestroyed) {
        try {
          this.originalModel.setValue(newValue || '');
        } catch (error) {
          console.error('Error updating original value:', error);
        }
      }
    },
    modifiedValue(newValue) {
      if (this.modifiedModel && !this.isDestroyed) {
        try {
          this.modifiedModel.setValue(newValue || '');
        } catch (error) {
          console.error('Error updating modified value:', error);
        }
      }
    },
    language(newValue) {
      if (this.originalModel && this.modifiedModel && !this.isDestroyed) {
        try {
          monaco.editor.setModelLanguage(this.originalModel, newValue);
          monaco.editor.setModelLanguage(this.modifiedModel, newValue);
        } catch (error) {
          console.error('Error updating language:', error);
        }
      }
    },
    readonly(newValue) {
      if (this.diffEditor && !this.isDestroyed) {
        try {
          this.diffEditor.updateOptions({ readOnly: newValue });
        } catch (error) {
          console.error('Error updating readonly:', error);
        }
      }
    },
    options: {
      deep: true,
      handler(newOptions) {
        if (this.diffEditor && !this.isDestroyed) {
          try {
            this.diffEditor.updateOptions(newOptions);
          } catch (error) {
            console.error('Error updating options:', error);
          }
        }
      }
    }
  },
  methods: {
    initDiffEditor() {
      if (this.isDestroyed) return;

      const container = this.$refs.diffContainer;
      if (!container) return;

      const editorOptions = {
        ...this.defaultOptions,
        ...this.options,
        readOnly: this.readonly
      };

      try {
        this.diffEditor = monaco.editor.createDiffEditor(container, editorOptions);

        this.originalModel = monaco.editor.createModel(this.originalValue || '', this.language);
        this.modifiedModel = monaco.editor.createModel(this.modifiedValue || '', this.language);

        this.diffEditor.setModel({
          original: this.originalModel,
          modified: this.modifiedModel
        });

        this.modifiedModel.onDidChangeContent(() => {
          if (!this.isDestroyed) {
            try {
              const value = this.modifiedModel.getValue();
              this.$emit('modified-change', value);
            } catch (error) {
              console.error('Error emitting modified change:', error);
            }
          }
        });

        if (editorOptions.originalEditable) {
          this.originalModel.onDidChangeContent(() => {
            if (!this.isDestroyed) {
              try {
                const value = this.originalModel.getValue();
                this.$emit('original-change', value);
              } catch (error) {
                console.error('Error emitting original change:', error);
              }
            }
          });
        }

        this.$nextTick(() => {
          if (!this.isDestroyed) {
            this.$emit('diff-ready', {
              monaco,
              diffEditor: this.diffEditor,
              originalModel: this.originalModel,
              modifiedModel: this.modifiedModel
            });
          }
        });
      } catch (error) {
        console.error('Failed to initialize diff editor:', error);
      }
    },

    destroyDiffEditor() {
      this.isDestroyed = true;

      try {
        if (this.originalModel) {
          this.originalModel.dispose();
          this.originalModel = null;
        }

        if (this.modifiedModel) {
          this.modifiedModel.dispose();
          this.modifiedModel = null;
        }

        if (this.diffEditor) {
          this.diffEditor.dispose();
          this.diffEditor = null;
        }
      } catch (error) {
        console.error('Error disposing diff editor:', error);
      }
    },

    updateDiff(originalValue, modifiedValue) {
      if (!this.isDestroyed && this.originalModel && this.modifiedModel) {
        try {
          this.originalModel.setValue(originalValue || '');
          this.modifiedModel.setValue(modifiedValue || '');
        } catch (error) {
          console.error('Error updating diff:', error);
        }
      }
    },

    getModifiedValue() {
      if (!this.modifiedModel || this.isDestroyed) return '';
      try {
        return this.modifiedModel.getValue();
      } catch (error) {
        console.error('Error getting modified value:', error);
        return '';
      }
    },

    getOriginalValue() {
      if (!this.originalModel || this.isDestroyed) return '';
      try {
        return this.originalModel.getValue();
      } catch (error) {
        console.error('Error getting original value:', error);
        return '';
      }
    },

    layout() {
      if (this.diffEditor && !this.isDestroyed) {
        try {
          this.diffEditor.layout();
        } catch (error) {
          console.error('Error laying out diff editor:', error);
        }
      }
    },

    focus() {
      if (this.diffEditor && !this.isDestroyed) {
        try {
          this.diffEditor.focus();
        } catch (error) {
          console.error('Error focusing diff editor:', error);
        }
      }
    }
  }
};
</script>

<style scoped>
.diff-monaco-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), 0.12);
  position: relative;
}

.diff-header {
  display: flex;
  background-color: rgba(var(--v-theme-surface), 0.9);
  border-bottom: 1px solid rgba(var(--v-border-color), 0.12);
}

.left-header,
.right-header {
  flex: 1;
  padding: 8px 16px;
}

.right-header {
  border-left: 1px solid rgba(var(--v-border-color), 0.12);
}

.header-content {
  display: flex;
  align-items: center;
}

.diff-editor {
  flex: 1;
  min-height: 0;
}
</style>