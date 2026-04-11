<template>
  <v-dialog
    :model-value="modelValue"
    max-width="800px"
    persistent
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-item>
        <v-card-title class="headline">
          {{ isEditing ? '编辑扩展' : '创建扩展' }}
        </v-card-title>
        <v-card-subtitle>
          <v-icon>mdi-puzzle</v-icon>
          {{ extensionData.project?.title || '扩展管理' }}
        </v-card-subtitle>
        <template v-slot:append>
          <v-btn icon @click="close">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </template>
      </v-card-item>
      <v-divider></v-divider>

      <v-card-text class="pt-4">
        <v-form ref="editForm" v-model="formValid">
          <v-tabs
            :model-value="tabIndex"
            @update:model-value="tabIndex = $event"
          >
            <v-tab :value="0">基本信息</v-tab>
            <v-tab :value="1">扩展配置</v-tab>

          </v-tabs>

          <v-card-text>
            <v-window
              :model-value="tabIndex"
              @update:model-value="tabIndex = $event"
            >
              <!-- 基本信息标签页 -->
              <v-window-item :value="0">
                <v-container>
                  <v-row>
                    <v-col cols="12" sm="6">
                      <v-text-field
                        v-model="extensionData.projectid"
                        :rules="[(v) => !!v || '项目ID不能为空', (v) => !isNaN(v) || '项目ID必须是数字']"
                        dense
                        label="项目ID"
                        outlined
                        type="number"
                      ></v-text-field>
                    </v-col>
                    <v-col cols="12" sm="6">
                      <v-select
                        v-model="extensionData.status"
                        :items="statusOptions"
                        dense
                        item-title="text"
                        item-value="value"
                        label="扩展状态"
                        outlined
                      ></v-select>
                    </v-col>
                    <v-col cols="12" sm="6">
                      <v-text-field
                        v-model="extensionData.branch"
                        dense
                        label="分支名称"
                        outlined
                        placeholder="main"
                      ></v-text-field>
                    </v-col>
                    <v-col cols="12" sm="6">
                      <v-text-field
                        v-model="extensionData.commit"
                        dense
                        label="提交哈希"
                        outlined
                        placeholder="latest"
                      ></v-text-field>
                    </v-col>
                  </v-row>
                </v-container>
              </v-window-item>

              <!-- 扩展配置标签页 -->
              <v-window-item :value="1">
                <v-container>
                  <v-row>
                    <v-col cols="12">
                      <v-alert
                        dense
                        text
                        type="info"
                        class="mb-4"
                      >
                        扩展配置信息，用于定义扩展的基本属性和行为。
                      </v-alert>
                    </v-col>
                    <v-col cols="12" sm="6">
                      <v-text-field
                        v-model="extensionData.samples"
                        dense
                        label="示例项目ID"
                        outlined
                        type="number"
                        hint="关联的示例项目ID，用于演示扩展功能"
                        persistent-hint
                      ></v-text-field>
                    </v-col>
                    <v-col cols="12" sm="6">
                      <v-text-field
                        v-model="extensionData.docs"
                        dense
                        label="文档URL"
                        outlined
                        hint="扩展文档的链接地址"
                        persistent-hint
                      ></v-text-field>
                    </v-col>
                    <v-col cols="12">
                      <v-text-field
                        v-model="extensionData.image"
                        dense
                        label="扩展图片URL"
                        outlined
                        hint="扩展的图标或预览图片链接"
                        persistent-hint
                      ></v-text-field>
                    </v-col>
                    <v-col cols="12">
                      <v-switch
                        v-model="extensionData.scratchCompatible"
                        label="兼容原版Scratch"
                        color="orange"
                        hide-details
                        hint="选择此扩展是否兼容原版Scratch平台"
                        persistent-hint
                      ></v-switch>
                    </v-col>
                  </v-row>
                </v-container>
              </v-window-item>


            </v-window>
          </v-card-text>
        </v-form>
      </v-card-text>

      <v-divider></v-divider>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn text @click="close">取消</v-btn>
        <v-btn
          :disabled="!formValid || saving"
          :loading="saving"
          color="primary"
          @click="save"
        >
          {{ isEditing ? '更新' : '创建' }}
        </v-btn>
      </v-card-actions>
    </v-card>

    <!-- 全局提示 -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="snackbar.timeout"
      top
    >
      {{ snackbar.text }}
      <template v-slot:action="{ attrs }">
        <v-btn text v-bind="attrs" @click="snackbar.show = false">
          关闭
        </v-btn>
      </template>
    </v-snackbar>
  </v-dialog>
</template>

<script>
export default {
  name: 'ExtensionEditor',
  props: {
    modelValue: {
      type: Boolean,
      default: false
    },
    extension: {
      type: Object,
      default: null
    }
  },
  emits: ['update:modelValue', 'save'],
  data() {
    return {
      tabIndex: 0,
      formValid: false,
      saving: false,
      extensionData: {
        id: null,
        projectid: null,
        branch: '',
        commit: 'latest',
        image: '',
        samples: null,
        docs: '',
        status: 'developing',
        project: null,
        scratchCompatible: false
      },
      statusOptions: [
        { text: '开发中', value: 'developing' },
        { text: '待审核', value: 'pending' },
        { text: '已批准', value: 'verified' },
        { text: '已拒绝', value: 'rejected' }
      ],
      snackbar: {
        show: false,
        text: '',
        color: 'success',
        timeout: 3000
      }
    }
  },
  computed: {
    isEditing() {
      return !!this.extension?.id;
    }
  },
  watch: {
    modelValue(newVal) {
      if (newVal) {
        this.initializeForm();
      }
    },
    extension: {
      handler() {
        if (this.modelValue) {
          this.initializeForm();
        }
      },
      deep: true
    }
  },
  methods: {
    initializeForm() {
      if (this.extension) {
        // 编辑模式
        this.extensionData = {
          id: this.extension.id,
          projectid: this.extension.projectid,
          branch: this.extension.branch || '',
          commit: this.extension.commit || 'latest',
          image: this.extension.image || '',
          samples: this.extension.samples,
          docs: this.extension.docs || '',
          status: this.extension.status || 'developing',
          project: this.extension.project,
          scratchCompatible: this.extension.scratchCompatible || false
        };
      } else {
        // 创建模式
        this.extensionData = {
          id: null,
          projectid: null,
          branch: '',
          commit: 'latest',
          image: '',
          samples: null,
          docs: '',
          status: 'developing',
          project: null,
          scratchCompatible: false
        };
      }

      // 重置表单验证
      this.$nextTick(() => {
        if (this.$refs.editForm) {
          this.$refs.editForm.resetValidation();
        }
      });
    },

    async save() {
      if (!this.formValid) {
        this.showError('请检查表单信息');
        return;
      }

      this.saving = true;
      try {
        // 准备保存的数据
        const saveData = {
          projectid: Number(this.extensionData.projectid),
          branch: this.extensionData.branch || '',
          commit: this.extensionData.commit || 'latest',
          image: this.extensionData.image || '',
          samples: this.extensionData.samples ? Number(this.extensionData.samples) : null,
          docs: this.extensionData.docs || '',
          status: this.extensionData.status,
          scratchCompatible: this.extensionData.scratchCompatible
        };

        // 如果是编辑模式，需要包含id
        if (this.isEditing && this.extensionData.id) {
          saveData.id = this.extensionData.id;
        }



        // 触发保存事件
        this.$emit('save', saveData);

        this.showSuccess(this.isEditing ? '扩展更新成功' : '扩展创建成功');
        this.close();
      } catch (error) {
        console.error('Error saving extension:', error);
        // 错误处理由父组件处理
      } finally {
        this.saving = false;
      }
    },

    close() {
      this.$emit('update:modelValue', false);
      this.tabIndex = 0;
    },

    showSuccess(text) {
      this.snackbar = {
        show: true,
        text,
        color: 'success',
        timeout: 3000
      };
    },

    showError(text) {
      this.snackbar = {
        show: true,
        text,
        color: 'error',
        timeout: 5000
      };
    }
  }
}
</script>

<style lang="scss" scoped>
.extension-editor {
  .v-tabs {
    .v-tab {
      min-width: 120px;
    }
  }

  .v-window {
    .v-window-item {
      padding: 16px 0;
    }
  }

  .v-form {
    .v-text-field,
    .v-select,
    .v-textarea {
      margin-bottom: 16px;
    }
  }

  .v-card-actions {
    padding: 16px 24px;
  }

  .v-alert {
    margin-bottom: 16px;
  }
}
</style>