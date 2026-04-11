<template>
  <v-dialog v-model="dialog" max-width="800" persistent>
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">mdi-pencil</v-icon>
        编辑扩展
      </v-card-title>

      <v-card-text>
        <v-form ref="form" v-model="formValid">
          <!-- 基本信息 -->
          <v-card variant="tonal" border hover class="mb-4">
            <v-card-title class="text-subtitle-1">基本信息</v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="form.branch"
                    label="分支名称"
                    placeholder="选择分支"
                    prepend-inner-icon="mdi-source-branch"
                    variant="outlined"
                    density="compact"
                    :items="branches"
                    item-title="name"
                    item-value="name"
                    @update:model-value="onBranchChange"
                  >
                    <template v-slot:item="{ props, item }">
                      <v-list-item v-bind="props">
                        <template v-slot:prepend>
                          <v-icon size="small">mdi-source-branch</v-icon>
                        </template>
                        <v-list-item-title>{{ item.raw.name }}</v-list-item-title>
                        <v-list-item-subtitle v-if="item.raw.description">
                          {{ item.raw.description }}
                        </v-list-item-subtitle>
                      </v-list-item>
                    </template>
                  </v-select>
                </v-col>

                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="form.commit"
                    label="提交ID"
                    placeholder="留空或latest使用最新提交"
                    prepend-inner-icon="mdi-source-commit"
                    variant="outlined"
                    density="compact"
                    :readonly="useLatestCommit"
                  ></v-text-field>

                  <v-btn-group
                    v-model="useLatestCommit"
                    class="mt-2"
                    variant="outlined"
                    density="compact"
                    divided
                  >
                    <v-btn
                      :variant="useLatestCommit ? 'flat' : 'outlined'"
                      :color="useLatestCommit ? 'primary' : undefined"
                      size="small"
                      @click="useLatestCommit = true"
                    >
                      最新
                    </v-btn>
                    <v-btn
                      :variant="!useLatestCommit ? 'flat' : 'outlined'"
                      :color="!useLatestCommit ? 'primary' : undefined"
                      size="small"
                      @click="useLatestCommit = false"
                    >
                      指定
                    </v-btn>
                  </v-btn-group>

                  <!-- 提交选择列表 -->
                  <div v-if="!useLatestCommit && commits.length > 0" class="mt-3">
                    <v-list density="compact" max-height="200" class="overflow-y-auto">
                      <v-list-item
                        v-for="commit in commits"
                        :key="commit.id"
                        @click="selectCommit(commit)"
                        :active="form.commit === commit.id"
                        :class="{ 'v-list-item--active': form.commit === commit.id }"
                      >
                        <template v-slot:prepend>
                          <v-icon size="small">mdi-source-commit</v-icon>
                        </template>
                        <v-list-item-title class="text-caption">
                          {{ commit.id.substring(0, 8) }}
                        </v-list-item-title>
                        <v-list-item-subtitle class="text-caption">
                          {{ commit.commit_message || '无提交信息' }}
                        </v-list-item-subtitle>
                      </v-list-item>
                    </v-list>
                  </div>

                  <v-btn
                    v-if="!useLatestCommit"
                    variant="tonal"
                    size="small"
                    class="mt-2"
                    prepend-icon="mdi-refresh"
                    @click="fetchCommits"
                    :loading="loadingCommits"
                  >
                    刷新提交列表
                  </v-btn>
                </v-col>

                <v-col cols="12">
                  <v-text-field
                    v-model="form.docs"
                    label="文档路径"
                    placeholder="/docs/extension"
                    prepend-inner-icon="mdi-book-open-variant"
                    variant="outlined"
                    density="compact"
                  ></v-text-field>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- 图标设置 -->
          <v-card variant="tonal" border hover class="mb-4">
            <v-card-title class="text-subtitle-1">扩展图标</v-card-title>
            <v-card-text>
              <v-radio-group v-model="imageMode" inline>
                <v-radio label="跟随项目" value="project"></v-radio>
                <v-radio label="自定义图标" value="custom"></v-radio>
              </v-radio-group>

              <v-text-field
                v-if="imageMode === 'custom'"
                v-model="form.image"
                label="图标文件名"
                placeholder="icon.png"
                prepend-inner-icon="mdi-image"
                variant="outlined"
                density="compact"
                class="mt-2"
              ></v-text-field>

              <!-- 图标预览 -->
              <div class="d-flex align-center mt-4">
                <v-avatar size="48" class="mr-3">
                  <v-img
                    v-if="previewImage"
                    :src="previewImage"
                  ></v-img>
                  <v-icon v-else size="24">mdi-puzzle</v-icon>
                </v-avatar>
                <div>
                  <div class="text-body-2">预览</div>
                  <div class="text-caption text-grey">
                    {{ imageMode === 'project' ? '使用项目默认图标' : (form.image || '默认图标') }}
                  </div>
                </div>
              </div>
            </v-card-text>
          </v-card>

          <!-- 示例项目 -->
          <v-card variant="tonal" border hover class="mb-4">
            <v-card-title class="text-subtitle-1">示例项目</v-card-title>
            <v-card-text>
              <div class="d-flex align-center mb-3">
                <ProjectSelector
                  v-model="selectedSampleProjectId"
                  :multiple="false"
                  :author="'me'"
                >
                  <template v-slot:default>
                    <v-btn
                      class="ml-2"
                      variant="outlined"
                    >
                      选择
                    </v-btn>
                  </template>
                </ProjectSelector>
              </div>

              <!-- 已选择的示例项目 -->
              <div v-if="selectedSampleProject" class="selected-project">
                <v-card variant="outlined" class="mb-2">
                  <v-card-item>
                    <template v-slot:prepend>
                      <v-avatar>
                        <v-img
                          :src="localuser.getUserAvatar(selectedSampleProject.author?.avatar) || ''"
                        ></v-img>
                      </v-avatar>
                    </template>
                    <v-card-title class="text-subtitle-2">{{ selectedSampleProject.title }}</v-card-title>
                    <v-card-subtitle>by {{ selectedSampleProject.author?.display_name || selectedSampleProject.author?.username }}</v-card-subtitle>
                  </v-card-item>
                </v-card>
                <v-btn
                  size="small"
                  variant="text"
                  color="error"
                  prepend-icon="mdi-close"
                  @click="clearSampleProject"
                >
                  移除示例项目
                </v-btn>
              </div>

              <div v-else class="text-center py-4 text-grey">
                <v-icon size="48">mdi-file-document-outline</v-icon>
                <p class="mt-2">未选择示例项目</p>
              </div>
            </v-card-text>
          </v-card>

          <!-- Scratch兼容性设置 -->
          <v-card variant="tonal" border hover class="mb-4">
            <v-card-title class="text-subtitle-1">
              <v-icon class="mr-2" color="orange">mdi-puzzle</v-icon>
              Scratch兼容性
            </v-card-title>
            <v-card-text>
              <v-alert
                type="info"
                variant="tonal"
                density="compact"
                class="mb-4"
              >
                选择此扩展是否兼容原版Scratch平台。兼容原版Scratch的扩展可以在Scratch项目中使用。
              </v-alert>

              <v-switch
                v-model="form.scratchCompatible"
                label="兼容原版Scratch"
                color="orange"
                hide-details
                class="mb-2"
              ></v-switch>

              <div class="text-caption text-grey">
                {{ form.scratchCompatible ? '此扩展将可以在Scratch项目中使用' : '此扩展仅适用于其他平台' }}
              </div>
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
          @click="saveExtension"
        >
          保存
        </v-btn>
      </v-card-actions>
    </v-card>

  </v-dialog>
</template>

<script>
import request from "@/axios/axios";
import { localuser } from "@/services/localAccount";

import ProjectSelector from "../shared/ProjectSelector.vue";

export default {
  name: "ExtensionEditDialog",
  components: {
    ProjectSelector
  },
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
  emits: ['update:modelValue', 'updated'],
  data() {
    return {
      formValid: false,
      loading: false,
      loadingCommits: false,
      localuser,
      form: {
        branch: '',
        commit: '',
        image: '',
        samples: null,
        docs: '',
        scratchCompatible: false // 新增Scratch兼容性选项
      },

      useLatestCommit: true,
      imageMode: 'project',
      commits: [],
      branches: [], // 新增分支列表

      myProjects: [],
      selectedSampleProject: null,
      selectedSampleProjectId: null
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
    },

    previewImage() {
      if (this.imageMode === 'project') {
        return null; // 使用项目默认图标
      }

      if (this.form.image) {
        return localuser.getUserAvatar(this.form.image);
      }

      return null;
    }
  },
  watch: {
    async modelValue(newVal) {
      if (newVal && this.extension) {
        await this.initializeForm();
      }
    },

    useLatestCommit(newVal) {
      if (newVal) {
        this.form.commit = '';
      } else {
        this.fetchCommits();
      }
    },

    selectedSampleProjectId: {
      handler(newId) {
        if (newId) {
          this.loadSampleProject(newId);
        }
      },
      immediate: true
    }
  },
  async created() {
    await this.fetchMyProjects();
  },
  methods: {
    async initializeForm() {
      if (!this.extension) return;

      this.form = {
        branch: this.extension.branch || '',
        commit: this.extension.commit || '',
        image: this.extension.image || '',
        samples: this.extension.samples || null,
        docs: this.extension.docs || '',
        scratchCompatible: this.extension.scratchCompatible || false // 初始化Scratch兼容性
      };

      this.useLatestCommit = !this.extension.commit || this.extension.commit === 'latest';
      this.imageMode = this.extension.image ? 'custom' : 'project';

      // 加载示例项目信息
      if (this.extension.sample_project) {
        this.selectedSampleProject = this.extension.sample_project;
      }

      // 获取分支列表
      await this.fetchBranches();
    },

    async fetchMyProjects() {
      try {
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

    async fetchBranches() {
      if (!this.extension?.project?.id) return;

      try {
        const response = await request.get(
          `/project/branches?projectid=${this.extension.project.id}`
        );

        if (response.data.status === "success") {
          this.branches = response.data.data || [];
        } else {
          console.error("加载分支列表失败:", response.data.message);
          this.branches = [];
        }
      } catch (error) {
        console.error('Failed to fetch branches:', error);
        this.branches = [];
      }
    },

    async fetchCommits() {
      if (!this.extension?.project?.id) return;

      this.loadingCommits = true;
      try {
        const response = await request.get(
          `/project/commits?projectid=${this.extension.project.id}&branch=${this.form.branch || 'main'}`
        );

        if (response.data.status === "success") {
          this.commits = response.data.data || [];

          // 确保每个提交对象都有必要的属性，防止undefined错误
          this.commits = this.commits.map((commit) => {
            return {
              ...commit,
              id: commit.hash || commit.id || "unknown",
              commit_message: commit.message || commit.commit_message || "无提交信息",
              date: commit.date || new Date().toISOString(),
              author: commit.author || { username: "未知用户" },
            };
          });
        } else {
          console.error("加载提交历史失败:", response.data.message);
          this.commits = [];
        }
      } catch (error) {
        console.error('Failed to fetch commits:', error);
        this.commits = [];
      } finally {
        this.loadingCommits = false;
      }
    },

    selectCommit(commit) {
      this.form.commit = commit.id;
    },

    async onBranchChange() {
      // 分支选择变化时刷新提交列表
      if (!this.useLatestCommit) {
        await this.fetchCommits();
      }
    },

    async loadSampleProject(projectId) {
      try {
        const response = await request.post('/project/batch', { projectIds: [projectId] });
        const projects = response.data.data || [];
        if (projects.length > 0) {
          this.selectedSampleProject = projects[0];
          this.form.samples = projectId;
        }
      } catch (error) {
        console.error('Failed to load sample project:', error);
      }
    },

    selectSampleProject(project) {
      // 保持向后兼容的方法（已废弃）
      this.selectedSampleProject = project;
      this.form.samples = project.id;
      this.showProjectSelector = false;
    },

    clearSampleProject() {
      this.selectedSampleProject = null;
      this.selectedSampleProjectId = null;
      this.form.samples = null;
    },

    async saveExtension() {
      if (!this.extension) return;

      this.loading = true;
      try {
        const payload = {
          ...(this.form.branch && { branch: this.form.branch }),
          ...(this.form.docs && { docs: this.form.docs }),
          ...(this.form.scratchCompatible !== undefined && { scratchCompatible: this.form.scratchCompatible }) // 保存Scratch兼容性
        };

        // 处理提交ID
        if (this.useLatestCommit) {
          payload.commit = 'latest';
        } else if (this.form.commit) {
          payload.commit = this.form.commit;
        }

        // 处理图标
        if (this.imageMode === 'project') {
          // 不传image字段，后端会使用空值
        } else if (this.form.image) {
          payload.image = this.form.image;
        }

        // 处理示例项目
        if (this.form.samples) {
          payload.samples = this.form.samples;
        }

        const response = await request.put(`/extensions/manager/edit/${this.extension.id}`, payload);

        if (response.data.status === 'success') {
          this.$emit('updated');
          this.closeDialog();
          this.showMessage('扩展更新成功', 'success');
        } else {
          this.showMessage(response.data.message || '更新失败', 'error');
        }
      } catch (error) {
        console.error('Failed to update extension:', error);
        this.showMessage('更新扩展失败', 'error');
      } finally {
        this.loading = false;
      }
    },

    closeDialog() {
      this.dialog = false;
    },

    showMessage(message, color) {
      // 这里可以触发全局消息显示
      console.log(message);
    }
  }
};
</script>

<style scoped>
.selected-project {
  max-width: 100%;
}

.v-list-item--active {
  background-color: rgba(var(--v-theme-primary), 0.12);
}
</style>