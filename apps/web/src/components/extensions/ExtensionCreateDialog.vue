<template>
  <v-dialog v-model="dialog" max-width="800" persistent>
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">mdi-plus</v-icon>
        创建扩展
      </v-card-title>

      <v-card-text>
        <v-form ref="form" v-model="formValid">
          <!-- 项目选择 -->
          <v-card variant="tonal" border hover class="mb-4">
            <v-card-title class="text-subtitle-1">选择项目</v-card-title>
            <v-card-text>
              <ProjectSelector
                v-model="selectedProjectIds"
                :multiple="true"
                :author="'me'"
              />
            </v-card-text>
          </v-card>

          <!-- 批量设置 -->
          <v-card variant="tonal" border class="mb-4">
            <v-card-title class="text-subtitle-1">批量设置</v-card-title>
            <v-card-text>
              <v-checkbox
                v-model="scratchCompatible"
                label="兼容 Scratch"
                hide-details
              ></v-checkbox>
            </v-card-text>
          </v-card>
        </v-form>
      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn @click="closeDialog">取消</v-btn>
        <v-btn
          color="primary"
          :loading="loading"
          :disabled="!selectedProjectIds || selectedProjectIds.length === 0"
          @click="createExtensions"
        >
          创建扩展 ({{ selectedProjectIds ? selectedProjectIds.length : 0 }})
        </v-btn>
      </v-card-actions>

      <!-- 进度对话框 -->
      <v-dialog v-model="createProgress.isVisible" persistent max-width="400">
        <v-card>
          <v-card-title class="text-center">
            正在创建扩展...
          </v-card-title>
          <v-card-text>
            <v-progress-linear
              :model-value="(createProgress.current / createProgress.total) * 100"
              color="primary"
              height="8"
              rounded
            ></v-progress-linear>
            <div class="text-center mt-3">
              <p class="text-body-2">
                {{ createProgress.current }} / {{ createProgress.total }}
              </p>
              <p class="text-caption text-grey">
                正在处理第 {{ createProgress.current }} 个项目...
              </p>
            </div>
          </v-card-text>
        </v-card>
      </v-dialog>
    </v-card>
  </v-dialog>
</template>

<script>
import request from "@/axios/axios";
import ProjectSelector from "../shared/ProjectSelector.vue";

export default {
  name: "ExtensionCreateDialog",
  components: {
    ProjectSelector
  },
  props: {
    modelValue: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:modelValue', 'created'],
  data() {
    return {
      formValid: false,
      loading: false,
      selectedProjectIds: [],
      scratchCompatible: false,
      createProgress: {
        current: 0,
        total: 0,
        isVisible: false
      }
    };
  },
  computed: {
    dialog: {
      get() {
        return this.modelValue;
      },
      set(value) {
        this.$emit('update:modelValue', value);
      }
    }
  },
  watch: {
    modelValue(newVal) {
      if (newVal) {
        this.resetForm();
      }
    }
  },
  methods: {
    async createExtensions() {
      if (!this.selectedProjectIds || this.selectedProjectIds.length === 0) return;

      this.loading = true;
      this.createProgress = {
        current: 0,
        total: this.selectedProjectIds.length,
        isVisible: true
      };

      try {
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < this.selectedProjectIds.length; i++) {
          const projectId = this.selectedProjectIds[i];
          this.createProgress.current = i + 1;

          try {
            const payload = {
              projectid: projectId,
              scratchCompatible: this.scratchCompatible
            };
            const response = await request.post('/extensions/manager/create', payload);

            if (response.data.status === 'success') {
              successCount++;
            } else {
              failCount++;
              console.error(`Failed to create extension for project ${projectId}:`, response.data);
            }
          } catch (error) {
            failCount++;
            console.error(`Failed to create extension for project ${projectId}:`, error);
          }
        }

        if (successCount > 0) {
          this.$emit('created');
          this.closeDialog();

          if (failCount > 0) {
            this.showMessage(`成功创建 ${successCount} 个扩展，${failCount} 个失败`, 'warning');
          } else {
            this.showMessage(`成功创建 ${successCount} 个扩展`, 'success');
          }
        } else {
          this.showMessage('所有扩展创建失败', 'error');
        }
      } catch (error) {
        console.error('Failed to create extensions:', error);
        this.showMessage('创建扩展失败', 'error');
      } finally {
        this.loading = false;
        this.createProgress.isVisible = false;
      }
    },

    resetForm() {
      this.selectedProjectIds = [];
      this.scratchCompatible = false;
    },

    closeDialog() {
      this.dialog = false;
    },

    showMessage(message, color) {
      console.log(message);
    }
  }
};
</script>

<style scoped>
</style>