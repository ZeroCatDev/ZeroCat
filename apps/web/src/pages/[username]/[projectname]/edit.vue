<template>
  <div class="project-editor">
    <!-- 左侧活动栏 -->
    <v-navigation-drawer permanent rail>
      <v-list>
        <v-list-item
          v-for="(item, i) in navigationItems"
          :key="i"
          :value="item.value"
          :active="activeTab === item.value"
          @click="activeTab = item.value"
        >
          <template v-slot:prepend>
            <v-icon>{{ item.icon }}</v-icon>
          </template>

          <v-list-item-title>{{ item.title }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <!-- 左侧边栏 -->
    <v-navigation-drawer permanent>
      <v-list>
        <v-list-item :title="sidebarTitle" :prepend-icon="sidebarIcon" />
      </v-list>

      <v-divider></v-divider>

      <!-- 文件浏览器 -->
      <template v-if="activeTab === 'files'">
        <v-list>
          <v-list-item>
            <v-text-field
              density="compact"
              hide-details
              placeholder="搜索文件..."
              prepend-inner-icon="mdi-magnify"
              variant="solo-filled"
            ></v-text-field>
          </v-list-item>
          <v-list-item
            v-if="project"
            prepend-icon="mdi-file-code"
            :title="project.name || 'main'"
            @click="openMainEditor"
          >
            <template v-slot:append>
              <v-chip size="small" variant="text">{{
                editorOptions.language
              }}</v-chip>
            </template>
          </v-list-item>
        </v-list>
      </template>

      <!-- Git 面板 -->
      <template v-if="activeTab === 'git'">
        <v-list>
          <v-list-item>
            <v-select
              v-model="currentBranch"
              :items="branches.map((b) => b.name)"
              density="compact"
              hide-details
              label="当前分支"
              prepend-inner-icon="mdi-source-branch"
              variant="solo-filled"
              @update:model-value="switchBranch"
            ></v-select>
          </v-list-item>

          <v-list-item
            v-if="hasUnsavedChanges"
            prepend-icon="mdi-source-commit"
            title="更改"
            subtitle="有未保存的更改"
          >
            <template v-slot:append>
              <v-btn color="primary" size="small" @click="showCommitDialog">
                提交
              </v-btn>
            </template>
          </v-list-item>

          <v-divider></v-divider>

          <v-list-subheader>提交历史</v-list-subheader>
          <v-list-item
            v-for="commit in commits"
            :key="commit.id"
            :subtitle="formatCommitInfo(commit)"
            :title="commit.commit_message || '无提交信息'"
            lines="two"
          >
            <template v-slot:append>
              <v-menu location="end">
                <template v-slot:activator="{ props }">
                  <v-btn
                    icon="mdi-dots-vertical"
                    size="small"
                    variant="text"
                    v-bind="props"
                  ></v-btn>
                </template>
                <v-list>
                  <v-list-item @click="viewCommit(commit)">
                    <v-list-item-title>查看</v-list-item-title>
                  </v-list-item>
                  <v-list-item @click="openCommitDetails(commit)">
                    <v-list-item-title>查看详情</v-list-item-title>
                  </v-list-item>
                  <v-list-item @click="restoreCommit(commit)">
                    <v-list-item-title>恢复</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </template>
          </v-list-item>
        </v-list>
      </template>
    </v-navigation-drawer>
    <!-- 主编辑器容器 -->
    <div class="editor-main-container">
      <!-- 标签页栏 -->
      <div v-if="editorTabs.length > 0" class="editor-tabs-bar">
        <v-tabs
          v-model="activeEditorTab"
          density="compact"
          show-arrows
          class="editor-tabs"
        >
          <v-tab
            v-for="tab in editorTabs"
            :key="tab.id"
            :value="tab.id"
            class="editor-tab"
            :class="{ 'editor-tab--modified': tab.modified }"
          >
            <div class="d-flex align-center">
              <v-icon :icon="tab.icon" size="16" class="mr-2"></v-icon>
              <span class="tab-title">{{ tab.title }}</span>
              <v-btn
                v-if="tab.closeable !== false"
                icon
                size="x-small"
                variant="text"
                class="ml-2 close-btn"
                @click.stop="closeTab(tab.id)"
              >
                <v-icon size="12">mdi-close</v-icon>
              </v-btn>
            </div>
          </v-tab>
        </v-tabs>
      </div>

      <!-- 标签页内容区域 -->
      <div v-if="activeEditorTab" class="tab-content-container">
        <!-- 主编辑器标签页 -->
        <div v-if="getActiveTab()?.type === 'editor'" class="editor-content">
          <EditorMonacoComponent
            ref="mainEditor"
            v-model="activeTabContent"
            :language="editorOptions.language"
            :options="editorOptions"
            :project-type="project?.type"
            @change="handleEditorChange"
            @update:modelValue="handleEditorChange"
            @monaco-ready="handleMonacoReady"
          />
        </div>

        <!-- 查看模式标签页 -->
        <div v-else-if="getActiveTab()?.type === 'view'" class="view-content">
          <!-- 加载状态 -->
          <div v-if="getActiveTab()?.data?.loading" class="loading-container">
            <v-progress-circular
              color="primary"
              indeterminate
              size="64"
            ></v-progress-circular>
            <div class="text-body-1 mt-4">正在加载提交内容...</div>
          </div>
          <!-- 编辑器内容 -->
          <EditorMonacoComponent
            v-else
            ref="viewEditor"
            v-model="activeTabContent"
            :language="editorOptions.language"
            :options="viewEditorOptions"
            :readonly="true"
            :project-type="project?.type"
            @monaco-ready="handleViewEditorReady"
          />
        </div>
      </div>

      <!-- 没有打开标签页时的欢迎界面 -->
      <div v-else class="welcome-container">
        <v-card class="mx-auto" max-width="500">
          <v-card-text class="text-center pa-8">
            <v-icon size="64" color="primary" class="mb-4"
              >mdi-code-braces</v-icon
            >
            <div class="text-h5 mb-4">{{ project?.title || "项目编辑器" }}</div>
            <div class="text-body-1 mb-6">
              点击左侧文件浏览器中的文件开始编辑，或从Git历史中查看提交记录。
            </div>
            <v-btn
              v-if="project"
              color="primary"
              variant="elevated"
              @click="openMainEditor"
            >
              <v-icon start>mdi-file-code</v-icon>
              打开主文件
            </v-btn>
          </v-card-text>
        </v-card>
      </div>
    </div>

    <!-- 语言选择对话框 -->
    <v-dialog v-model="showLanguageDialog" max-width="400">
      <v-card>
        <v-card-title class="pa-4">
          <v-text-field
            v-model="languageSearch"
            ref="languageSearchInput"
            append-inner-icon="mdi-magnify"
            label="选择编程语言"
            placeholder="搜索语言..."
            variant="outlined"
            density="compact"
            hide-details
            @keydown.esc="showLanguageDialog = false"
            @input="debounceSearch"
          ></v-text-field>
        </v-card-title>

        <v-card-text class="language-list pa-0">
          <v-list density="compact" nav>
            <template v-for="lang in filteredLanguages" :key="lang.id">
              <v-list-item
                :active="editorOptions.language === lang.id"
                :title="lang.aliases?.[0] || lang.id"
                :subtitle="lang.id"
                @click="selectLanguage(lang.id)"
              >
                <template v-slot:prepend>
                  <v-icon size="small">mdi-code-braces</v-icon>
                </template>
              </v-list-item>
            </template>
          </v-list>
          <div
            v-if="filteredLanguages.length === 0"
            class="pa-4 text-center text-body-2"
          >
            未找到匹配的语言
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- 修改提交对话框 -->
    <v-dialog v-model="showSaveDialog" max-width="500">
      <v-card>
        <v-card-text class="pa-4">
          <div class="d-flex align-center mb-4">
            <v-icon color="primary" class="mr-2">mdi-source-repository</v-icon>
            <span class="text-h6">{{ project?.title || "项目" }}</span>
          </div>

          <div v-if="hasUnsavedChanges" class="mb-4">
            <div class="text-subtitle-2 mb-2">更改</div>
            <v-card variant="outlined" class="pa-2">
              <div class="d-flex align-center">
                <v-icon size="small" color="warning" class="mr-2"
                  >mdi-file-document</v-icon
                >
                <span class="text-body-2">已修改: {{ project?.name }}</span>
              </div>
            </v-card>
          </div>

          <v-text-field
            v-model="commitMessage"
            label="提交信息 (按 Ctrl+Enter 提交)"
            placeholder="输入提交信息..."
            variant="outlined"
            density="comfortable"
            hide-details
            class="mb-2"
            @keydown.ctrl.enter="confirmCommit"
          ></v-text-field>

          <v-expand-transition>
            <div v-show="showCommitDetails">
              <v-textarea
                v-model="commitDescription"
                label="详细描述"
                placeholder="输入详细的提交说明（可选）..."
                variant="outlined"
                density="comfortable"
                rows="3"
                hide-details
                class="mt-2"
              ></v-textarea>
            </div>
          </v-expand-transition>

          <v-btn
            variant="text"
            density="comfortable"
            class="mt-2"
            @click="showCommitDetails = !showCommitDetails"
          >
            {{ showCommitDetails ? "隐藏详细信息" : "添加详细信息..." }}
          </v-btn>
        </v-card-text>

        <v-card-actions class="pa-4 pt-0">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="showSaveDialog = false"> 取消 </v-btn>
          <v-btn
            color="primary"
            :disabled="!commitMessage.trim()"
            :loading="committing"
            @click="confirmCommit"
          >
            提交更改
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 确认对话框 -->
    <v-dialog v-model="confirmDialog.show" max-width="400">
      <v-card>
        <v-card-text class="pa-4">
          <div class="d-flex align-center mb-4">
            <v-icon :color="confirmDialog.color" class="mr-2">mdi-alert</v-icon>
            <span class="text-h6">{{ confirmDialog.title }}</span>
          </div>
          <p>{{ confirmDialog.message }}</p>
          <v-card variant="outlined" class="pa-2 mt-2">
            <p class="text-body-1 mb-2">{{ commitMessage }}</p>
            <p v-if="commitDescription" class="text-body-2 text-grey">
              {{ commitDescription }}
            </p>
          </v-card>
        </v-card-text>
        <v-card-actions class="pa-4 pt-0">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="handleConfirmDialogCancel">
            取消
          </v-btn>
          <v-btn
            :color="confirmDialog.color"
            :loading="confirmDialog.loading"
            @click="handleConfirmDialogConfirm"
          >
            {{ confirmDialog.confirmText }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 提交详情对话框 -->
    <v-dialog v-model="showCommitDetailsDialog" max-width="800">
      <v-card class="commit-details-dialog">
        <v-card-title class="pa-4 d-flex align-center">
          <v-icon class="mr-3" color="primary">mdi-source-commit</v-icon>
          <div>
            <div class="text-h6">{{ selectedCommit?.commit_message || '无提交信息' }}</div>
            <div class="text-caption text-medium-emphasis">
              {{ selectedCommit?.id?.substring(0, 7) }}
            </div>
          </div>
          <v-spacer></v-spacer>
          <v-btn icon="mdi-close" variant="text" @click="showCommitDetailsDialog = false"></v-btn>
        </v-card-title>

        <v-divider></v-divider>

        <v-card-text class="pa-0">
          <!-- 提交信息概览 -->
          <div class="pa-4">
            <v-row>
              <v-col cols="12" md="8">
                <div class="d-flex align-center mb-3">
                  <v-avatar size="32" class="mr-3">
                    <v-img
                      v-if="selectedCommit?.author?.avatar"
                      :src="getAvatarUrl(selectedCommit.author.avatar)"
                      :alt="selectedCommit.author.display_name"
                    ></v-img>
                    <v-icon v-else>mdi-account</v-icon>
                  </v-avatar>
                  <div>
                    <div class="text-subtitle-2">
                      {{ selectedCommit?.author?.display_name || selectedCommit?.author?.username || '未知用户' }}
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      @{{ selectedCommit?.author?.username }}
                    </div>
                  </div>
                </div>

                <div class="mb-3">
                  <div class="text-body-1 mb-2">
                    {{ selectedCommit?.commit_message || '无提交信息' }}
                  </div>
                  <div v-if="selectedCommit?.commit_description" class="text-body-2 text-medium-emphasis">
                    {{ selectedCommit.commit_description }}
                  </div>
                </div>
              </v-col>

              <v-col cols="12" md="4">
                <v-card variant="outlined" class="pa-3">
                  <div class="text-caption text-uppercase mb-2 text-medium-emphasis">提交信息</div>

                  <div class="d-flex align-center mb-2">
                    <v-icon size="16" class="mr-2 text-medium-emphasis">mdi-source-commit</v-icon>
                    <span class="text-body-2 font-weight-mono">{{ selectedCommit?.id?.substring(0, 7) }}</span>
                  </div>

                  <div class="d-flex align-center mb-2">
                    <v-icon size="16" class="mr-2 text-medium-emphasis">mdi-clock-outline</v-icon>
                    <span class="text-body-2">{{ formatCommitDate(selectedCommit?.commit_date) }}</span>
                  </div>

                  <div v-if="selectedCommit?.parent_commit_id" class="d-flex align-center mb-2">
                    <v-icon size="16" class="mr-2 text-medium-emphasis">mdi-source-branch</v-icon>
                    <span class="text-body-2 font-weight-mono">{{ selectedCommit.parent_commit_id.substring(0, 7) }}</span>
                  </div>

                  <div v-if="selectedCommit?.commit_file" class="d-flex align-center">
                    <v-icon size="16" class="mr-2 text-medium-emphasis">mdi-file-document</v-icon>
                    <span class="text-body-2 font-weight-mono">{{ selectedCommit.commit_file.substring(0, 7) }}</span>
                  </div>
                </v-card>
              </v-col>
            </v-row>
          </div>

          <v-divider></v-divider>

          <!-- 操作按钮 -->
          <div class="pa-4">
            <div class="d-flex gap-2">
              <v-btn
                variant="outlined"
                prepend-icon="mdi-eye"
                @click="viewCommitFromDetails(selectedCommit)"
              >
                查看代码
              </v-btn>
              <v-btn
                variant="outlined"
                prepend-icon="mdi-restore"
                @click="restoreCommitFromDetails(selectedCommit)"
              >
                恢复到此提交
              </v-btn>
              <v-btn
                variant="outlined"
                prepend-icon="mdi-content-copy"
                @click="copyCommitId(selectedCommit?.id)"
              >
                复制提交ID
              </v-btn>
            </div>
          </div>

          <v-divider></v-divider>

          <!-- 详细信息 -->
          <div class="pa-4">
            <div class="text-subtitle-2 mb-3">详细信息</div>
            <v-card variant="outlined" class="pa-3">
              <pre class="text-body-2 font-weight-mono">{{ formatCommitDetailsJson(selectedCommit) }}</pre>
            </v-card>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- 加载遮罩 -->
    <v-overlay v-model="loading" class="align-center justify-center" persistent>
      <v-card width="300">
        <v-card-text class="text-center">
          <v-progress-circular
            color="primary"
            indeterminate
            size="64"
          ></v-progress-circular>
          <div class="text-body-1 mt-4">{{ loadingMessage }}</div>
        </v-card-text>
      </v-card>
    </v-overlay>

    <!-- 全局提示条 -->
    <v-snackbar
      v-model="showSnackbar"
      :color="snackbarColor"
      :timeout="snackbarTimeout"
    >
      {{ snackbarMessage }}
      <template v-slot:actions>
        <v-btn color="white" variant="text" @click="showSnackbar = false">
          关闭
        </v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script>
import axios from "@/axios/axios";
import { defineAsyncComponent, toRaw, ref } from "vue";
import { localuser } from "@/services/localAccount";

const EditorMonacoComponent = defineAsyncComponent(() =>
  import("@/components/EditorMonacoComponent.vue")
);
const DiffMonacoComponent = defineAsyncComponent(() =>
  import("@/components/DiffMonacoComponent.vue")
);

export default {
  name: "ProjectEditor",
  components: {
    EditorMonacoComponent,
    DiffMonacoComponent,
  },
  data() {
    return {
      localuser,
      // 项目基本信息
      project: null,
      fileContent: null,
      fileSha256: null,
      branches: [],
      currentBranch: "main",
      commits: [],
      accessFileToken: "",

      // 加载状态
      loading: true,
      loadingMessage: "加载项目信息...",
      errorMessage: "",

      // 编辑器状态
      hasUnsavedChanges: false,
      monacoInstance: null,
      availableLanguages: [],

      // 标签页系统
      activeEditorTab: null,
      editorTabs: [],
      tabIdCounter: 0,
      tabInstances: new Map(), // 存储每个标签页的编辑器实例
      tabLoadingStates: new Map(), // 存储每个标签页的加载状态

      // UI状态
      activeTab: "files",
      showSaveDialog: false,
      showLanguageDialog: false,
      showCommitDetails: false,
      showConfirmDialog: false,
      committing: false,
      showCommitDetailsDialog: false,
      selectedCommit: null,

      // 提交相关
      commitMessage: "",
      commitDescription: "",

      // 语言搜索
      languageSearch: "",
      searchTimeout: null,

      // Monaco 编辑器配置
      editorOptions: {
        theme: "vs-dark",
        language: "javascript",
        fontSize: 14,
        tabSize: 2,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: "on",
        lineNumbers: "on",
        glyphMargin: true,
        folding: true,
        lineDecorationsWidth: 10,
        lineNumbersMinChars: 3,
      },

      // 只读编辑器配置
      viewEditorOptions: {
        theme: "vs-dark",
        fontSize: 14,
        tabSize: 2,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: "on",
        lineNumbers: "on",
        glyphMargin: true,
        folding: true,
        lineDecorationsWidth: 10,
        lineNumbersMinChars: 3,
        readOnly: true,
      },

      // 导航项目
      navigationItems: [
        { icon: "mdi-file-document-outline", title: "文件", value: "files" },
        { icon: "mdi-source-branch", title: "源代码管理", value: "git" },
        { icon: "mdi-magnify", title: "搜索", value: "search" },
        { icon: "mdi-cog", title: "设置", value: "settings" },
      ],

      // 全局提示条状态
      showSnackbar: false,
      snackbarMessage: "",
      snackbarColor: "",
      snackbarTimeout: 5000,

      // 确认对话框状态
      confirmDialog: {
        show: false,
        title: "",
        message: "",
        color: "warning",
        loading: false,
        confirmText: "确认",
        callback: null
      },
    };
  },

  computed: {
    projectId() {
      return this.$route.query.id;
    },
    projectNamespace() {
      // 从路由参数中获取用户名和项目名
      const username =
        this.$route.params.username || this.$route.query.username;
      const projectname =
        this.$route.params.projectname || this.$route.query.projectname;
      if (username && projectname) {
        return `${username}/${projectname}`;
      }
      return null;
    },

    filteredLanguages() {
      if (!this.languageSearch || !this.availableLanguages) {
        return this.availableLanguages || [];
      }
      const search = this.languageSearch.toLowerCase().trim();
      // 限制显示数量以提高性能
      return this.availableLanguages
        .filter((lang) => {
          const id = lang.id.toLowerCase();
          const aliases = lang.aliases || [];
          return (
            id.includes(search) ||
            aliases.some((alias) => alias.toLowerCase().includes(search))
          );
        })
        .slice(0, 50); // 限制最多显示50个结果
    },
    sidebarTitle() {
      switch (this.activeTab) {
        case "files":
          return "资源管理器";
        case "git":
          return "源代码管理";
        case "search":
          return "搜索";
        case "settings":
          return "设置";
        default:
          return "";
      }
    },
    sidebarIcon() {
      switch (this.activeTab) {
        case "files":
          return "mdi-file-document-outline";
        case "git":
          return "mdi-source-branch";
        case "search":
          return "mdi-magnify";
        case "settings":
          return "mdi-cog";
        default:
          return "";
      }
    },

    activeTabContent: {
      get() {
        return this.getActiveTab()?.data?.content || "";
      },
      set(value) {
        const activeTab = this.getActiveTab();
        if (activeTab) {
          activeTab.data.content = value;
          this.hasUnsavedChanges = true;
          this.setTabModified(activeTab.id, true);
        }
      },
    },
  },
  watch: {
    currentBranch: {
      immediate: true,
      async handler(newBranch, oldBranch) {
        if (newBranch && newBranch !== oldBranch && this.project?.id) {
          await this.loadCommitHistory();
        }
      },
    },
    project: {
      immediate: true,
      async handler(newProject) {
        if (newProject && newProject.id) {
          await this.loadCommitHistory();
          // 确保分支列表已加载
          if (this.branches.length === 0) {
            await this.loadBranches();
          }
        }
      },
    },
    showLanguageDialog(val) {
      if (val) {
        // 当对话框打开时，等待 DOM 更新后聚焦搜索框
        this.$nextTick(() => {
          this.$refs.languageSearchInput?.focus();
        });
      } else {
        // 当对话框关闭时，清空搜索内容
        this.languageSearch = "";
      }
    },

    activeEditorTab(newTabId, oldTabId) {
      if (newTabId !== oldTabId) {
        console.log("activeEditorTab changed:", oldTabId, "->", newTabId);

        // 先立即清理所有存在的编辑器实例
        this.cleanupAllEditorInstances();

        // 然后初始化新的编辑器实例
        this.$nextTick(() => {
          this.initCurrentTabEditor();
        });
      }
    },
  },
  async mounted() {
    // 加载项目
    this.loadProject();
  },

  beforeUnmount() {
    // 清理所有标签页实例
    this.cleanupAllTabs();
  },
  methods: {
    // ===============================
    // 标签页系统管理
    // ===============================
    // 强制更新编辑器内容
    forceUpdateEditor(tabId, content) {
      const editorInstance = this.tabInstances.get(tabId);
      if (editorInstance && editorInstance.$el) {
        console.log("Force updating editor content for tab:", tabId);
        // 触发组件重新渲染
        this.$forceUpdate();

        // 如果编辑器有直接的setValue方法，使用它
        this.$nextTick(() => {
          if (
            editorInstance.setValue &&
            typeof editorInstance.setValue === "function"
          ) {
            editorInstance.setValue(content);
          }
        });
      }
    },

    // 清理所有编辑器实例
    cleanupAllEditorInstances() {
      console.log("Cleaning up all editor instances");
      for (const [tabId, instance] of this.tabInstances) {
        if (instance && typeof instance.destroyEditor === "function") {
          try {
            instance.destroyEditor();
            console.log("Destroyed editor instance for tab:", tabId);
          } catch (error) {
            console.warn(
              "Error destroying editor instance for tab:",
              tabId,
              error
            );
          }
        }
      }
      this.tabInstances.clear();
    },

    cleanupAllTabs() {
      // 清理所有编辑器实例
      this.cleanupAllEditorInstances();
      this.tabLoadingStates.clear();
      this.editorTabs = [];
      this.activeEditorTab = null;
    },

    getActiveTab() {
      return (
        this.editorTabs.find((tab) => tab.id === this.activeEditorTab) || null
      );
    },

    addTab(config) {
      const tabId = `tab-${++this.tabIdCounter}`;
      const tab = {
        id: tabId,
        title: config.title || "未命名",
        icon: config.icon || "mdi-file-document",
        type: config.type || "editor", // editor, diff, view
        closeable: config.closeable !== false,
        modified: false,
        data: config.data || {},
        retryCount: 0, // 添加重试计数器
      };

      this.editorTabs.push(tab);
      this.activeEditorTab = tabId;

      return tab;
    },

    removeTab(tabId) {
      const index = this.editorTabs.findIndex((tab) => tab.id === tabId);
      if (index !== -1) {
        const tab = this.editorTabs[index];

        // 清理编辑器实例
        if (this.tabInstances.has(tabId)) {
          const instance = this.tabInstances.get(tabId);
          if (instance && typeof instance.destroyEditor === "function") {
            try {
              instance.destroyEditor();
              console.log("Destroyed editor instance for removed tab:", tabId);
            } catch (error) {
              console.warn(
                "Error destroying editor instance for removed tab:",
                tabId,
                error
              );
            }
          }
          this.tabInstances.delete(tabId);
        }

        // 清理加载状态
        this.tabLoadingStates.delete(tabId);

        this.editorTabs.splice(index, 1);

        // 如果被删除的是当前活动标签页，切换到下一个
        if (this.activeEditorTab === tabId) {
          if (this.editorTabs.length > 0) {
            // 优先选择下一个标签页，如果没有就选择前一个
            const nextIndex =
              index < this.editorTabs.length ? index : index - 1;
            this.activeEditorTab = this.editorTabs[nextIndex].id;
          } else {
            this.activeEditorTab = null;
          }
        }
      }
    },

    setTabModified(tabId, modified = true) {
      const tab = this.editorTabs.find((t) => t.id === tabId);
      if (tab) {
        tab.modified = modified;
      }
    },

    initCurrentTabEditor() {
      const activeTab = this.getActiveTab();
      if (!activeTab) {
        console.log("No active tab found for editor initialization");
        return;
      }

      console.log(
        "Initializing editor for tab:",
        activeTab.id,
        "type:",
        activeTab.type,
        "loading:",
        activeTab.data?.loading
      );

      // 如果正在加载，不初始化编辑器
      if (activeTab.data?.loading) {
        console.log("Tab is still loading, skipping editor initialization");
        return;
      }

      // 确保没有其他实例在运行
      this.cleanupAllEditorInstances();

      // 等待DOM完全渲染
      this.$nextTick(() => {
        let editorRef = null;
        let editorType = null;

        switch (activeTab.type) {
          case "editor":
            editorRef = this.$refs.mainEditor;
            editorType = "mainEditor";
            break;
          case "diff":
            editorRef = this.$refs.diffEditor;
            editorType = "diffEditor";
            break;
          case "view":
            editorRef = this.$refs.viewEditor;
            editorType = "viewEditor";
            break;
        }

        if (editorRef) {
          console.log(
            `Successfully got ${editorType} ref for tab:`,
            activeTab.id
          );
          this.tabInstances.set(activeTab.id, editorRef);

          // 如果编辑器有初始化方法，调用它
          if (
            editorRef.initEditor &&
            typeof editorRef.initEditor === "function"
          ) {
            editorRef.initEditor();
          }

          // 清理重试计数器
          activeTab.retryCount = 0;
        } else {
          console.warn(`Editor ref not found for tab type: ${activeTab.type}`);

          // 只在特定条件下重试
          const shouldRetry =
            !activeTab.data?.loading &&
            (!activeTab.retryCount || activeTab.retryCount < 3) &&
            activeTab.type !== "view";

          if (shouldRetry) {
            activeTab.retryCount = (activeTab.retryCount || 0) + 1;
            console.log(
              "Retrying editor initialization for tab:",
              activeTab.id,
              "attempt:",
              activeTab.retryCount
            );
            setTimeout(() => {
              this.initCurrentTabEditor();
            }, 100); // 使用固定的短延迟
          } else {
            console.error(
              "Failed to initialize editor after attempts for tab:",
              activeTab.id
            );
            // 如果是查看模式且重试失败，尝试重新加载内容
            if (activeTab.type === "view" && activeTab.data?.commit) {
              this.reloadCommitContent(activeTab);
            }
          }
        }
      });
    },

    // 添加新方法用于重新加载提交内容
    async reloadCommitContent(tab) {
      if (!tab || !tab.data?.commit) return;

      try {
        // 标记为加载中
        tab.data.loading = true;
        this.$forceUpdate();

        // 重新加载提交内容
        const content = await this.loadCommitContent(tab.data.commit);

        // 更新标签页数据
        tab.data.content = content;
        tab.data.loading = false;
        tab.retryCount = 0;

        // 强制更新视图
        this.$forceUpdate();

        // 重新初始化编辑器
        this.$nextTick(() => {
          if (this.activeEditorTab === tab.id) {
            this.initCurrentTabEditor();
          }
        });
      } catch (error) {
        console.error("重新加载提交内容失败:", error);
        tab.data.content = `// 加载失败: ${error.message}`;
        tab.data.loading = false;
        this.$forceUpdate();
      }
    },

    // ===============================
    // 标签页操作
    // ===============================
    openMainEditor() {
      console.log("openMainEditor called");
      if (!this.project) {
        console.log("No project loaded");
        return;
      }

      // 检查是否已经有主编辑器标签页
      const existingTab = this.editorTabs.find(
        (tab) => tab.type === "editor" && tab.data?.isMain
      );
      if (existingTab) {
        this.activeEditorTab = existingTab.id;
        return;
      }

      const tab = this.addTab({
        title: this.project.name || "main",
        icon: "mdi-file-code",
        type: "editor",
        data: {
          content: this.fileContent || "",
          language: this.editorOptions.language,
          isMain: true,
        },
      });

      console.log("Tab created:", tab);

      if (tab) {
        this.activeEditorTab = tab.id;
      }
    },

    viewCommit(commit) {
      console.log("viewCommit called:", commit);

      // 检查是否已经有相同提交的标签页
      const existingTab = this.editorTabs.find(
        (tab) => tab.type === "view" && tab.data?.commit?.id === commit.id
      );
      if (existingTab) {
        this.activeEditorTab = existingTab.id;
        // 如果标签页存在但内容为空，重新加载内容
        if (!existingTab.data.content) {
          this.reloadCommitContent(existingTab);
        }
        return;
      }

      // 创建一个新标签页
      const tempTab = this.addTab({
        title: `提交: ${commit.id.substring(0, 7)}`,
        icon: "mdi-source-commit",
        type: "view",
        closeable: true,
        data: {
          content: "",
          commit: commit,
          loading: true,
        },
      });

      if (tempTab) {
        this.activeEditorTab = tempTab.id;
        this.loadCommitContent(commit)
          .then((content) => {
            if (tempTab && this.editorTabs.find((t) => t.id === tempTab.id)) {
              tempTab.data.content = content;
              tempTab.data.loading = false;
              tempTab.retryCount = 0;

              // 强制更新视图
              this.$forceUpdate();

              // 使用nextTick确保DOM更新后再初始化编辑器
              this.$nextTick(() => {
                if (this.activeEditorTab === tempTab.id) {
                  this.initCurrentTabEditor();
                }
              });
            }
          })
          .catch((error) => {
            console.error("加载提交内容失败:", error);
            if (tempTab && this.editorTabs.find((t) => t.id === tempTab.id)) {
              tempTab.data.content = `// 加载失败: ${error.message}`;
              tempTab.data.loading = false;
              this.$forceUpdate();
            }
            this.showSnackbarMessage(
              "加载提交内容失败: " + (error.message || "未知错误"),
              "error"
            );
          });
      }
    },

    // ===============================
    // 编辑器事件处理
    // ===============================
    handleEditorChange(value) {
      const activeTab = this.getActiveTab();
      if (activeTab) {
        activeTab.data.content = value;
        this.hasUnsavedChanges = true;
        this.fileContent = value;
        this.setTabModified(activeTab.id, true);
      }
    },

    handleMonacoReady({ monaco, editor, availableLanguages }) {
      console.log("Monaco editor ready");
      this.monacoInstance = monaco;
      this.availableLanguages = availableLanguages;

      // 如果项目类型存在，设置对应的语言
      if (this.project?.type && availableLanguages?.length > 0) {
        const projectType = this.project.type.split("-")[0].toLowerCase();
        const matchedLang = availableLanguages.find(
          (lang) => lang.id === projectType
        );
        if (matchedLang) {
          console.log("根据项目类型设置语言:", matchedLang.id);
          this.editorOptions.language = matchedLang.id;
        }
      }

      // 设置编辑器实例
      const activeTab = this.getActiveTab();
      if (activeTab && activeTab.type === "editor") {
        console.log("Setting editor instance for tab:", activeTab.id);
        this.tabInstances.set(activeTab.id, this.$refs.mainEditor);
        activeTab.retryCount = 0;
      }
    },

    handleViewEditorReady({ monaco, editor, availableLanguages }) {
      console.log("Monaco view editor ready for tab:", this.activeEditorTab);
      const activeTab = this.getActiveTab();
      if (activeTab && activeTab.type === "view" && this.$refs.viewEditor) {
        console.log("Setting view editor instance for tab:", activeTab.id);
        this.tabInstances.set(activeTab.id, this.$refs.viewEditor);
        activeTab.retryCount = 0;
      }
    },

    // ===============================
    // 辅助方法
    // ===============================
    async loadCommitContent(commit) {
      try {
        console.log("Loading commit content for:", commit.id);

        const response = await axios.get(
          `/project/commit?projectid=${this.project.id}&commitid=${commit.id}`
        );

        console.log("Commit API response:", response.data);

        if (response.data.status === "success") {
          this.accessFileToken = response.data.accessFileToken;
          const commitFile = response.data.commit.commit_file;

          console.log("Commit file:", commitFile);

          if (commitFile) {
            const fileResponse = await axios.get(
              `/project/files/${commitFile}?accessFileToken=${this.accessFileToken}&content=true`
            );

            console.log("File response status:", fileResponse.status);

            if (fileResponse.status === 200) {
              let content = fileResponse.data;
              if (typeof content === "object") {
                content = JSON.stringify(content, null, 2);
              }
              console.log(
                "Successfully loaded commit content, length:",
                content.length
              );
              return content;
            }
          }
        }
        throw new Error("无法加载提交内容");
      } catch (error) {
        console.error("加载提交内容失败:", error);
        throw error;
      }
    },

    // ===============================
    // 项目加载
    // ===============================
    async loadProject() {
      try {
        this.loading = true;
        this.loadingMessage = "加载项目信息...";

        let response;
        if (this.projectId) {
          console.log("通过ID加载项目:", this.projectId);
          response = await axios.get(`/project/id/${this.projectId}`);
        } else if (this.projectNamespace) {
          console.log("通过命名空间加载项目:", this.projectNamespace);
          const [username, projectname] = this.projectNamespace.split("/");
          response = await axios.get(
            `/project/namespace/${username}/${projectname}`
          );
        } else {
          throw new Error("未提供项目ID或命名空间");
        }

        console.log("项目加载响应:", response.data);

        if (response.data.status === "success" || response.data.id) {
          this.project = response.data.data || response.data;

          if (!this.project || !this.project.id) {
            throw new Error("项目数据无效: " + JSON.stringify(this.project));
          }

          await this.loadBranches();
          await this.loadLatestCommit();
        } else {
          throw new Error(
            response.data.message || "加载项目失败: 服务器未返回有效数据"
          );
        }
      } catch (error) {
        console.error("加载项目失败:", error);
        const errMsg = error.response
          ? `服务器错误 (${error.response.status}): ${
              error.response.data?.message || "未知错误"
            }`
          : error.message || "网络错误或服务器无响应";
        this.loadingMessage = `加载失败: ${errMsg}`;
        this.errorMessage = errMsg;
        this.loading = false;
      }
    },

    async switchBranch() {
      try {
        if (this.projectId) {
          console.log("通过ID加载项目:", this.projectId);
          response = await axios.get(`/project/id/${this.projectId}`);
        } else if (this.projectNamespace) {
          console.log("通过命名空间加载项目:", this.projectNamespace);
          const [username, projectname] = this.projectNamespace.split("/");
          response = await axios.get(
            `/project/namespace/${username}/${projectname}`
          );
        } else {
          throw new Error("未提供项目ID或命名空间");
        }

        console.log("项目加载响应:", response.data);

        if (response.data.status === "success" || response.data.id) {
          this.project = response.data.data || response.data;

          if (!this.project || !this.project.id) {
            throw new Error("项目数据无效: " + JSON.stringify(this.project));
          }

          await this.loadBranches();
          await this.loadLatestCommit();
        } else {
          throw new Error(
            response.data.message || "加载项目失败: 服务器未返回有效数据"
          );
        }
      } catch (error) {
        console.error("加载项目失败:", error);
        const errMsg = error.response
          ? `服务器错误 (${error.response.status}): ${
              error.response.data?.message || "未知错误"
            }`
          : error.message || "网络错误或服务器无响应";
        this.loadingMessage = `加载失败: ${errMsg}`;
        this.errorMessage = errMsg;
        this.loading = false;
      }
    },

    async loadBranches() {
      try {
        this.loadingMessage = "加载分支信息...";
        console.log("加载分支, 项目ID:", this.project.id);

        const response = await axios.get(
          `/project/branches?projectid=${this.project.id}`
        );
        console.log("分支加载响应:", response.data);

        if (response.data.status === "success") {
          this.branches = response.data.data || [];
          if (this.branches.length > 0) {
            // 如果当前分支不在分支列表中，切换到第一个分支
            if (!this.branches.some((b) => b.name === this.currentBranch)) {
              this.currentBranch = this.branches[0].name;
            }
          } else {
            throw new Error("项目没有任何分支");
          }
        } else {
          throw new Error(
            response.data.message || "加载分支失败: 服务器未返回有效数据"
          );
        }
      } catch (error) {
        console.error("加载分支失败:", error);
        const errorMsg = error.response
          ? `服务器错误 (${error.response.status}): ${
              error.response.data?.message || "未知错误"
            }`
          : error.message || "网络错误或服务器无响应";
        this.loadingMessage = `加载分支失败: ${errorMsg}`;
        this.errorMessage = errorMsg;

        // 如果加载分支失败，清空分支列表并设置默认分支
        this.branches = [];
        this.currentBranch = "main";

        // 显示错误提示
        this.showSnackbarMessage("加载分支失败: " + errorMsg, "error");
      } finally {
        this.loading = false;
      }
    },

    async loadLatestCommit() {
      try {
        this.loadingMessage = "加载最新代码...";
        console.log(
          "加载最新提交, 项目ID:",
          this.project.id,
          "分支:",
          this.currentBranch
        );

        const response = await axios.get(
          `/project/${this.project.id}/${this.currentBranch}/latest`
        );
        console.log("最新提交响应:", response.data);

        if (response.data.status === "success") {
          if (!response.data.accessFileToken) {
            throw new Error("服务器未返回文件访问令牌");
          }

          this.accessFileToken = response.data.accessFileToken;

          if (!response.data.commit) {
            throw new Error("服务器返回的提交数据无效");
          }

          // 获取提交文件信息
          const commitFile = response.data.commit.commit_file;
          console.log(`获取提交文件: ${commitFile}`);

          if (!commitFile) {
            console.log("没有提交文件，创建新文件");
            this.fileContent = "";
            this.loading = false;
            return;
          }

          try {
            const commitFileResponse = await axios.get(
              `/project/files/${commitFile}?accessFileToken=${this.accessFileToken}&content=true`
            );
            console.log("提交文件响应:", commitFileResponse);

            if (commitFileResponse.status === 200) {
              // 直接使用文件内容
              let content = commitFileResponse.data;

              if (!content) {
                console.log("文件内容为空，创建新文件");
                this.fileContent = "";
              } else {
                if (typeof content === "object") {
                  content = JSON.stringify(content, null, 2);
                }
                console.log("获取到文件内容，长度:", content.length);
                this.fileContent = content;
                // 保存文件SHA256
                this.fileSha256 = commitFile;

                // 设置编辑器语言
                const filename = this.project.name || "file.js";
                this.editorOptions.language = this.detectLanguage(
                  content,
                  filename
                );
              }

              this.loading = false;
            } else {
              const errorMsg = commitFileResponse.data?.message || "未知错误";
              console.error(
                `获取提交文件失败: ${commitFile}`,
                commitFileResponse.data
              );
              // 创建空文件
              this.fileContent = "";
              this.loading = false;
            }
          } catch (fileError) {
            console.error("获取提交文件请求失败:", fileError);
            // 创建空文件
            this.fileContent = "";
            this.loading = false;
          }
        } else {
          this.loading = false;
          throw new Error(
            response.data.message || "加载最新提交失败: 服务器未返回有效数据"
          );
        }
      } catch (error) {
        console.error("加载最新提交失败:", error);
        const errorMsg = error.response
          ? `服务器错误 (${error.response.status}): ${
              error.response.data?.message || "未知错误"
            }`
          : `${error.message || "网络错误或服务器无响应"} [${
              error.stack?.split("\n")[1]?.trim() || "未知位置"
            }]`;
        this.loadingMessage = `加载最新提交失败: ${errorMsg}`;
        this.errorMessage = errorMsg;
        // 即使出错，也创建空文件让用户可以开始编辑
        this.fileContent = "";
        this.loading = false;
      }
    },

    getAvatarUrl(avatar) {
      return localuser.getUserAvatar(avatar);
    },

    async saveAndCommitCode() {
      if (this.fileContent === null) {
        this.showSnackbarMessage("文件内容未加载", "error");
        return;
      }

      this.showSaveDialog = true;
    },

    showCommitDialog() {
      this.commitMessage = "";
      this.commitDescription = "";
      this.showCommitDetails = false;
      this.showSaveDialog = true;
    },
    confirmCommit() {
      if (!this.commitMessage.trim()) {
        return;
      }
      this.showSaveDialog = false;
      this.showConfirmDialog = true;
    },
    async saveAndSubmitCommit() {
      try {
        this.committing = true;
        if (!this.commitMessage.trim()) {
          this.showSnackbarMessage("请输入提交信息", "warning");
          return;
        }

        // 准备要保存的内容
        let contentToSave = this.fileContent;
        let isValidJson;

        // 检查是否为JSON格式
        try {
          JSON.parse(contentToSave);
          isValidJson = true;
          console.log("内容已经是有效的JSON格式");
        } catch (e) {
          // 如果不是有效的JSON，则直接发送原始内容
          console.log("内容不是有效的JSON格式，将直接发送");
          isValidJson = false;
        }

        console.log("准备保存文件，内容长度:", contentToSave.length);
        console.log("isValidJson:", isValidJson);
        // 保存文件 - 使用不同的方式处理JSON和非JSON内容
        const saveResponse = await axios.post(
          `/project/savefile?json=${isValidJson}&${isValidJson ? "source=index" : ""}`,
          isValidJson
            ? contentToSave
            : JSON.stringify({ index: this.fileContent }),
          {
            headers: {
              "Content-Type": "application/json",
              "X-Project-ID": this.project.id,
            },
          }
        );

        console.log("保存文件响应:", saveResponse.data);

        if (saveResponse.data.status !== "success") {
          throw new Error(saveResponse.data.message || "保存文件失败");
        }

        // 更新访问令牌和文件SHA256
        this.accessFileToken = saveResponse.data.accessFileToken;
        this.fileSha256 = saveResponse.data.sha256; // 从响应中获取新的SHA256

        if (!this.fileSha256) {
          console.error("服务器未返回文件SHA256");
          throw new Error("服务器未返回文件SHA256，无法完成提交");
        }

        console.log("文件保存成功，使用SHA256:", this.fileSha256);
        console.log("准备提交代码，分支:", this.currentBranch);

        // 提交代码
        const commitData = {
          branch: this.currentBranch,
          projectid: this.project.id,
          accessFileToken: this.accessFileToken,
          message: this.commitMessage,
          commit_description: this.commitDescription,
          commit_file: this.fileSha256,
        };

        console.log("提交数据:", commitData);

        const commitResponse = await axios.put(
          `/project/commit/id/${this.project.id}`,
          commitData
        );

        console.log("提交响应:", commitResponse.data);

        if (commitResponse.data.status === "success") {
          this.commitMessage = "";
          this.commitDescription = "";
          this.hasUnsavedChanges = false;

          // 更新所有标签页的修改状态
          this.editorTabs.forEach((tab) => {
            this.setTabModified(tab.id, false);
          });

          // 刷新提交历史
          await this.loadCommitHistory();

          this.showSnackbarMessage(
            "代码保存并提交成功",
            // + (!isValidJson ? " (已转换为JSON格式)" : "")
            "success"
          );
        } else {
          throw new Error(commitResponse.data.message || "提交代码失败");
        }
        this.showConfirmDialog = false;
        this.committing = false;
      } catch (error) {
        console.error("提交失败:", error);
        this.showSnackbarMessage(
          "提交失败: " +
            (error.response?.data?.message || error.message || "未知错误"),
          "error"
        );
        this.committing = false;
      }
    },

    async loadCommitHistory() {
      if (!this.project || !this.project.id) {
        console.error("项目未加载，无法获取提交历史");
        return;
      }

      try {
        this.loadingHistory = true;

        const response = await axios.get(
          `/project/commits?projectid=${this.project.id}&branch=${this.currentBranch}`
        );
        if (response.data.status === "success") {
          this.commits = response.data.data || [];

          // 确保每个提交对象都有必要的属性，防止undefined错误
          this.commits = this.commits.map((commit) => {
            return {
              ...commit,
              hash: commit.hash || "unknown",
              message: commit.message || "无提交信息",
              date: commit.date || new Date().toISOString(),
              author: commit.author || { username: "未知用户" },
            };
          });
        } else {
          console.error("加载提交历史失败:", response.data.message);
        }
      } catch (error) {
        console.error("加载提交历史失败:", error);
      } finally {
        this.loadingHistory = false;
      }
    },

    async showHistory() {
      try {
        await this.loadCommitHistory();
        this.showHistoryDialog = true;
      } catch (error) {
        console.error("显示历史对话框失败:", error);
        this.showSnackbarMessage(
          "加载提交历史失败: " + (error.message || "未知错误"),
          "error"
        );
      }
    },

    async toggleHistorySidebar() {
      this.showHistorySidebar = !this.showHistorySidebar;

      if (this.showHistorySidebar && this.commits.length === 0) {
        await this.loadCommitHistory();
      }
    },

    formatCommitInfo(commit) {
      if (!commit) return "未知提交信息";

      const username = commit.author?.username || "未知用户";
      const date = commit.date ? this.formatDate(commit.date) : "未知时间";

      return `${username} · ${date}`;
    },

    formatDate(dateString) {
      const date = new Date(dateString);
      return date.toLocaleString();
    },

    // ===============================
    // 提交相关操作
    // ===============================
    showCommitDialog() {
      this.commitMessage = "";
      this.commitDescription = "";
      this.showCommitDetails = false;
      this.showSaveDialog = true;
    },

    confirmCommit() {
      if (!this.commitMessage.trim()) {
        return;
      }
      this.saveAndSubmitCommit();
    },


    async restoreCommit(commit) {
      if (!commit || !commit.id) {
        this.showSnackbarMessage("无效的提交信息", "error");
        return;
      }

      const commitId = commit.id.substring(0, 7);

      this.openConfirmDialog(
        "恢复提交",
        `确定要恢复到提交 ${commitId} 的状态吗？`,
        () => this.handleRestoreCommit(commit),
        "warning",
        false,
        "恢复"
      );
    },

    async handleRestoreCommit(commit) {
      try {
        this.loading = true;
        this.loadingMessage = "恢复提交...";

        const content = await this.loadCommitContent(commit);
        this.fileContent = content;

        // 自动提交恢复的内容
        this.commitMessage = `恢复到提交 ${commit.id.substring(0, 7)}`;
        this.commitDescription = `恢复到提交 ${commit.id}，原提交信息: ${
          commit.commit_message || "无提交信息"
        }`;

        await this.saveAndSubmitCommit();

        this.showSnackbarMessage("代码恢复成功", "success");
      } catch (error) {
        console.error("恢复代码失败:", error);
        this.showSnackbarMessage(
          "恢复代码失败: " +
            (error.response?.data?.message || error.message || "未知错误"),
          "error"
        );
      } finally {
        this.loading = false;
      }
    },

    // ===============================
    // 语言选择相关
    // ===============================
    debounceSearch(event) {
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
      }
      this.searchTimeout = setTimeout(() => {
        this.languageSearch = event.target.value;
      }, 300);
    },

    selectLanguage(languageId) {
      this.editorOptions.language = languageId;
      this.showLanguageDialog = false;
      this.languageSearch = "";
    },

    detectLanguage(content, filename) {
      // 如果项目类型已经指定了语言，优先使用项目类型
      if (this.project?.type && this.availableLanguages?.length > 0) {
        const projectType = this.project.type.split("-")[0].toLowerCase();
        const matchedLang = this.availableLanguages.find(
          (lang) => lang.id === projectType
        );
        if (matchedLang) {
          return matchedLang.id;
        }
      }

      // 如果内容是JSON格式，设置为json
      try {
        JSON.parse(content);
        return "json";
      } catch (e) {
        // 不是JSON，根据文件扩展名判断
        if (filename) {
          const ext = filename.split(".").pop().toLowerCase();
          const langMap = {
            js: "javascript",
            ts: "typescript",
            html: "html",
            css: "css",
            scss: "scss",
            less: "less",
            vue: "html",
            json: "json",
            md: "markdown",
            py: "python",
            java: "java",
            c: "c",
            cpp: "cpp",
            cs: "csharp",
            go: "go",
            php: "php",
            rb: "ruby",
            rs: "rust",
            sh: "shell",
            sql: "sql",
            xml: "xml",
            yaml: "yaml",
            yml: "yaml",
          };
          return langMap[ext] || "plaintext";
        }
      }

      return "plaintext";
    },

    // ===============================
    // 全局提示条
    // ===============================
    showSnackbarMessage(message, color = "info", timeout = 5000) {
      this.snackbarMessage = message;
      this.snackbarColor = color;
      this.snackbarTimeout = timeout;
      this.showSnackbar = true;
    },

    // ===============================
    // 确认对话框
    // ===============================
    openConfirmDialog(
      title,
      message,
      callback,
      color = "warning",
      loading = false,
      confirmText = "确认"
    ) {
      this.confirmDialog = {
        show: true,
        title,
        message,
        color,
        loading,
        confirmText,
        callback
      };
    },

    handleConfirmDialogCancel() {
      this.confirmDialog.show = false;
      this.confirmDialog.callback = null;
    },

    handleConfirmDialogConfirm() {
      const callback = this.confirmDialog.callback;
      this.confirmDialog.show = false;
      this.confirmDialog.callback = null;
      if (callback) {
        callback();
      }
    },

    // ===============================
    // 提交详情对话框
    // ===============================
    openCommitDetails(commit) {
      this.selectedCommit = commit;
      this.showCommitDetailsDialog = true;
    },

    viewCommitFromDetails(commit) {
      this.showCommitDetailsDialog = false;
      this.viewCommit(commit);
    },

    restoreCommitFromDetails(commit) {
      this.showCommitDetailsDialog = false;
      this.restoreCommit(commit);
    },

    copyCommitId(commitId) {
      if (commitId) {
        navigator.clipboard.writeText(commitId).then(() => {
          this.showSnackbarMessage("提交ID已复制到剪贴板", "success");
        }).catch(() => {
          this.showSnackbarMessage("复制失败", "error");
        });
      }
    },

    formatCommitDate(dateString) {
      if (!dateString) return "未知时间";
      const date = new Date(dateString);
      return date.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    },

    formatCommitDetailsJson(commit) {
      if (!commit) return "无提交信息";

      return JSON.stringify({
        id: commit.id,
        commit_message: commit.commit_message,
        commit_description: commit.commit_description,
        commit_date: commit.commit_date,
        commit_file: commit.commit_file,
        parent_commit_id: commit.parent_commit_id,
        depth: commit.depth,
        author: commit.author
      }, null, 2);
    },
  },
};
</script>

<style scoped>
.project-editor {
  position: fixed;
  top: var(--v-layout-top, 64px);
  bottom: 0;
  left: var(--v-layout-left, 0);
  right: var(--v-layout-right, 0);
  display: flex;
  flex-direction: row;
  overflow: hidden;
}

.editor-main-container {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.editor-tabs-bar {
  border-bottom: 1px solid rgba(var(--v-border-color), 0.12);
  background-color: rgba(var(--v-theme-surface), 0.9);
}

.editor-tabs {
  min-height: 48px;
}

.editor-tab {
  min-width: 120px;
  max-width: 200px;
  text-transform: none;
  border-right: 1px solid rgba(var(--v-border-color), 0.12);
  position: relative;
}

.editor-tab--modified .tab-title::after {
  content: "●";
  color: rgb(var(--v-theme-warning));
  margin-left: 4px;
}

.editor-tab .close-btn {
  opacity: 0;
  transition: opacity 0.2s;
}

.editor-tab:hover .close-btn {
  opacity: 1;
}

.tab-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
  font-size: 13px;
}

.tab-content-container {
  flex: 1;
  position: relative;
  height: 100%;
  min-height: 0;
}

.editor-content,
.diff-content,
.view-content {
  height: 100%;
  width: 100%;
  position: relative;
}

.loading-container {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(var(--v-theme-surface), 0.1);
}

.welcome-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(var(--v-theme-surface), 0.1);
}

.branch-selector {
  min-width: 120px;
}

:deep(.v-navigation-drawer--rail) {
  width: 56px !important;
}

.monospace {
  font-family: "Consolas", "Monaco", "Courier New", monospace;
}

.language-card {
  cursor: pointer;
  transition: all 0.3s ease;
}

.language-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.language-dialog {
  border-radius: 4px;
}

.language-search {
  width: 100%;
}

.language-list {
  max-height: 400px;
  overflow-y: auto;
}

.language-list::-webkit-scrollbar {
  width: 8px;
}

.language-list::-webkit-scrollbar-track {
  background: transparent;
}

.language-list::-webkit-scrollbar-thumb {
  background: rgba(127, 127, 127, 0.4);
  border-radius: 4px;
}

.language-list::-webkit-scrollbar-thumb:hover {
  background: rgba(127, 127, 127, 0.6);
}

.language-list-item {
  transition: background-color 0.2s ease;
  border-radius: 2px;
  margin: 1px 4px;
}

.language-list-item:hover {
  background-color: rgba(127, 127, 127, 0.1);
}

.language-list-item.v-list-item--active {
  background-color: rgba(var(--v-theme-primary), 0.1);
}

.language-list-item.v-list-item--active:hover {
  background-color: rgba(var(--v-theme-primary), 0.15);
}

/* 提交详情对话框样式 */
.font-weight-mono {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
}

.commit-details-dialog .v-card-title {
  border-bottom: 1px solid rgba(var(--v-border-color), 0.12);
}

.commit-details-dialog pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 300px;
  overflow-y: auto;
}

.commit-details-dialog .v-avatar {
  border: 1px solid rgba(var(--v-border-color), 0.12);
}
</style>
