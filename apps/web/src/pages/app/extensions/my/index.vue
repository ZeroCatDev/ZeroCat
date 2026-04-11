<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-card variant="flat">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2">mdi-puzzle</v-icon>
            扩展管理
            <v-spacer></v-spacer>
            <v-btn
              color="success"
              prepend-icon="mdi-plus"
              @click="showCreateDialog = true"
            >
              创建扩展
            </v-btn>
          </v-card-title>
          <v-card-text>
            <v-row v-if="loading">
              <v-col v-for="i in 6" :key="i" cols="12" md="6" lg="4">
                <v-skeleton-loader type="card"></v-skeleton-loader>
              </v-col>
            </v-row>
            <v-row v-else-if="extensions.length === 0">
              <v-col cols="12" class="text-center py-8">
                <v-icon size="64" color="grey-lighten-1">mdi-puzzle-outline</v-icon>
                <p class="text-h6 mt-4 text-grey-darken-1">扩展管理</p>
                <p class="text-body-2 text-grey">扩展管理</p>
              </v-col>
            </v-row>
            <v-row v-else>
              <v-col
                v-for="extension in extensions"
                :key="extension.id"
                cols="12"
                md="6"
                lg="4"
              >
                <v-card  border hover :to="`/${extension.project?.author?.username}/${extension.project?.name}`">
                  <v-card-item>
                    <v-card-title>{{ extension.project?.title || '扩展' }}</v-card-title>
                    <v-card-subtitle>{{ extension.project?.description || '扩展' }}</v-card-subtitle>
                    <template v-slot:append>
                      <v-chip
                        :color="getStatusColor(extension.status)"
                        size="small"
                        variant="flat"
                      >
                        {{ getStatusText(extension.status) }}
                      </v-chip>
                    </template>
                  </v-card-item>
                  <v-card-text>
                    <div class="d-flex align-center mb-2">
                      <v-icon class="mr-1" size="small">mdi-source-branch</v-icon>
                      <span class="text-caption">{{ extension.branch || 'main' }}</span>
                    </div>
                    <div class="d-flex align-center mb-2">
                      <v-icon class="mr-1" size="small">mdi-source-commit</v-icon>
                      <span class="text-caption">{{ extension.commit?.substring(0, 8) || 'latest' }}</span>
                    </div>
                    <div v-if="extension.sample_project" class="d-flex align-center mb-2">
                      <v-icon class="mr-1" size="small">mdi-file-document</v-icon>
                      <span class="text-caption">示例项目: {{ extension.sample_project.title }}</span>
                    </div>
                    <div class="d-flex align-center mb-2">
                      <v-icon class="mr-1" size="small">mdi-puzzle</v-icon>
                      <span class="text-caption">
                        {{ extension.scratchCompatible ? '兼容原版Scratch' : '不兼容原版Scratch' }}
                      </span>
                    </div>
                  </v-card-text>

                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 创建扩展对话框 -->
    <ExtensionCreateDialog
      v-model="showCreateDialog"
      @created="fetchExtensions"
    />

    <!-- 高级设置卡片 -->
    <v-row class="mt-6">
      <v-col cols="12">
        <v-card variant="flat" border>
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2">mdi-cog</v-icon>
            高级设置
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <v-card variant="tonal" border>
                  <v-card-title class="text-h6">
                    <v-icon class="mr-2" color="primary">mdi-cloud-upload</v-icon>
                    批量推送
                  </v-card-title>
                  <v-card-text>
                    <p class="text-body-2 text-grey-darken-1 mb-4">
                      批量同步扩展时使用
                    </p>
                    <v-btn
                      color="primary"
                      :loading="pushAllLoading"
                      :disabled="extensions.length === 0"
                      prepend-icon="mdi-cloud-upload"
                      @click="pushAllExtensions"
                      block
                    >
                      全部推送 ({{ extensions.length }})
                    </v-btn>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" md="6">
                <v-card variant="tonal" border>
                  <v-card-title class="text-h6">
                    <v-icon class="mr-2" color="success">mdi-update</v-icon>
                    批量更新
                  </v-card-title>
                  <v-card-text>
                    <p class="text-body-2 text-grey-darken-1 mb-4">
                      这是谁提的需求？
                    </p>
                    <v-btn
                      color="success"
                      :loading="updateAllLoading"
                      :disabled="extensions.length === 0"
                      prepend-icon="mdi-update"
                      @click="updateAllExtensions"
                      block
                    >
                      一键更新 ({{ extensions.length }})
                    </v-btn>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 消息提示 -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color">
      {{ snackbar.message }}
    </v-snackbar>
  </v-container>
</template>

<script>
import { useHead } from "@unhead/vue";
import request from "@/axios/axios";
import { localuser } from "@/services/localAccount";
import { get } from "@/services/serverConfig";
import ExtensionCreateDialog from "@/components/extensions/ExtensionCreateDialog.vue";

export default {
  name: "ExtensionsManagement",
  components: {
    ExtensionCreateDialog
  },
  setup() {
    useHead({
      title: "扩展管理 - ZeroCat",
    });
  },
  data() {
    return {
      loading: false,
      extensions: [],
      myProjects: [],
      s3BucketUrl: '',

      showCreateDialog: false,

      showEditDialog: false,
      editFormValid: false,
      editLoading: false,
      editTarget: null,
      editForm: {
        branch: '',
        commit: '',
        image: '',
        samples: null,
        docs: ''
      },

      showDeleteDialog: false,
      deleteLoading: false,
      deleteTarget: null,

      // 批量操作状态
      pushAllLoading: false,
      updateAllLoading: false,

      snackbar: {
        show: false,
        message: '',
        color: 'success'
      }
    };
  },
  async mounted() {
    this.s3BucketUrl = get('s3.staticurl');
    await Promise.all([
      this.fetchExtensions(),
      this.fetchMyProjects()
    ]);
  },
  methods: {
    async fetchExtensions() {
      this.loading = true;
      try {
        const response = await request.get('/extensions/manager/my');
        if (response.data.status === 'success') {
          this.extensions = response.data.data;
        }
      } catch (error) {
        console.error('Failed to fetch extensions:', error);
        this.showMessage('扩展管理失败', 'error');
      } finally {
        this.loading = false;
      }
    },

    async fetchMyProjects() {
      try {
        console.log(localuser.user);
        const response = await request.get('/searchapi', {
          params: {
            search_userid: localuser.user.value.id,
            search_state: 'public',
            limit: 100
          }
        });
        if (response.data && response.data.projects) {
          this.myProjects = response.data.projects;
        }
      } catch (error) {
        console.error('Failed to fetch my projects:', error);
      }
    },


    getStatusColor(status) {
      const colorMap = {
        'developing': 'primary',
        'pending': 'warning',
        'verified': 'success',
        'rejected': 'error'
      };
      return colorMap[status] || 'grey';
    },

    getStatusText(status) {
      const textMap = {
        'developing': '开发中',
            'pending': '待审核',
        'verified': '上架',
        'rejected': '已拒绝'
      };
      return textMap[status] || '未知';
    },

    showMessage(message, color = 'success') {
      this.snackbar = {
        show: true,
        message,
        color
      };
    },

    // 批量推送所有扩展
    async pushAllExtensions() {
      if (this.extensions.length === 0) {
        this.showMessage('没有可推送的扩展', 'warning');
        return;
      }

      this.pushAllLoading = true;
      try {
        const promises = this.extensions.map(extension =>
          request.post(`/extensions/manager/submit/${extension.id}`)
        );

        const results = await Promise.allSettled(promises);
        const successCount = results.filter(result =>
          result.status === 'fulfilled' && result.value?.data?.status === 'success'
        ).length;

        const failedCount = this.extensions.length - successCount;

        if (failedCount === 0) {
          this.showMessage(`成功推送 ${successCount} 个扩展`, 'success');
        } else {
          this.showMessage(`推送完成: ${successCount} 个成功, ${failedCount} 个失败`, 'warning');
        }

        // 刷新扩展列表
        await this.fetchExtensions();
      } catch (error) {
        console.error('Failed to push all extensions:', error);
        this.showMessage('批量推送失败', 'error');
      } finally {
        this.pushAllLoading = false;
      }
    },

    // 批量更新所有扩展
    async updateAllExtensions() {
      if (this.extensions.length === 0) {
        this.showMessage('没有可更新的扩展', 'warning');
        return;
      }

      this.updateAllLoading = true;
      try {
        const promises = this.extensions.map(extension =>
          request.post(`/extensions/manager/update/${extension.id}`)
        );

        const results = await Promise.allSettled(promises);
        const successCount = results.filter(result =>
          result.status === 'fulfilled' && result.value?.data?.status === 'success'
        ).length;

        const failedCount = this.extensions.length - successCount;

        if (failedCount === 0) {
          this.showMessage(`成功更新 ${successCount} 个扩展`, 'success');
        } else {
          this.showMessage(`更新完成: ${successCount} 个成功, ${failedCount} 个失败`, 'warning');
        }

        // 刷新扩展列表
        await this.fetchExtensions();
      } catch (error) {
        console.error('Failed to update all extensions:', error);
        this.showMessage('批量更新失败', 'error');
      } finally {
        this.updateAllLoading = false;
      }
    }
  }
};
</script>

<style scoped>

</style>
