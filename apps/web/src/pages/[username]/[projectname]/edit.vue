<template>
  <div class="project-editor">
    <!-- 侧边栏 -->
    <div v-show="sidebarOpen" class="sidebar">
      <div class="sidebar-header d-flex align-center px-2">
        <span class="text-caption font-weight-bold">资源管理</span>
        <v-spacer />
        <v-btn icon="mdi-chevron-left" size="x-small" variant="text" @click="sidebarOpen = false" />
      </div>

      <v-divider />

      <div class="sidebar-content">
        <!-- 文件 -->
        <v-list density="compact" nav>
          <v-list-subheader>项目文件</v-list-subheader>
          <v-list-item v-if="project" @click="openMainEditor">
            <template #prepend>
              <v-icon icon="mdi-file-code" size="18" />
            </template>
            <v-list-item-title class="text-body-2">{{ project.name || 'main' }}</v-list-item-title>
            <template #append>
              <span class="text-caption text-medium-emphasis">{{ editorOptions.language }}</span>
            </template>
          </v-list-item>
        </v-list>

        <v-divider />

        <!-- 分支 -->
        <div class="pa-2">
          <v-select
            v-model="currentBranch"
            :items="branches.map(b => b.name)"
            density="compact"
            hide-details
            label="分支"
            prepend-inner-icon="mdi-source-branch"
            variant="outlined"
            @update:model-value="onBranchChange"
          />
        </div>

        <div v-if="hasUnsavedChanges" class="px-2 pb-2">
          <v-btn block size="small" color="primary" @click="showCommitDialog">提交更改</v-btn>
        </div>

        <v-divider />

        <!-- 提交历史 -->
        <v-list density="compact" nav>
          <v-list-subheader>提交历史</v-list-subheader>
          <v-list-item
            v-for="commit in commits"
            :key="commit.id"
            lines="two"
            @click="viewCommit(commit)"
          >
            <template #prepend>
              <v-avatar size="24" color="surface-variant">
                <v-img v-if="commit.author?.avatar" :src="getAvatarUrl(commit.author.avatar)" />
                <v-icon v-else icon="mdi-account" size="14" />
              </v-avatar>
            </template>
            <v-list-item-title class="text-body-2">
              {{ commit.commit_message || '无提交信息' }}
            </v-list-item-title>
            <v-list-item-subtitle class="text-caption">
              {{ commit.author?.username || '未知' }} · {{ formatRelativeTime(commit.commit_date) }}
            </v-list-item-subtitle>
            <template #append>
              <v-menu location="end">
                <template #activator="{ props }">
                  <v-btn icon="mdi-dots-vertical" size="x-small" variant="text" v-bind="props" @click.stop />
                </template>
                <v-list density="compact" min-width="140">
                  <v-list-item @click.stop="viewCommit(commit)">
                    <v-list-item-title>查看</v-list-item-title>
                  </v-list-item>
                  <v-list-item @click.stop="openCommitDetails(commit)">
                    <v-list-item-title>详情</v-list-item-title>
                  </v-list-item>
                  <v-list-item @click.stop="restoreCommit(commit)">
                    <v-list-item-title>恢复</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </template>
          </v-list-item>
          <v-list-item v-if="commits.length === 0">
            <v-list-item-title class="text-caption text-medium-emphasis">暂无提交记录</v-list-item-title>
          </v-list-item>
        </v-list>

        <v-divider />

        <!-- 语言 -->
        <v-list density="compact" nav>
          <v-list-subheader>语言</v-list-subheader>
          <v-list-item @click="showLanguageDialog = true">
            <template #prepend>
              <v-icon icon="mdi-code-braces" size="18" />
            </template>
            <v-list-item-title class="text-body-2">{{ editorOptions.language }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </div>
    </div>

    <!-- 主编辑区 -->
    <div class="editor-main-container">
      <!-- 标签页 -->
      <div class="editor-tabs-bar d-flex align-center">
        <v-btn
          :icon="sidebarOpen ? 'mdi-chevron-left' : 'mdi-chevron-right'"
          size="x-small"
          variant="text"
          @click="sidebarOpen = !sidebarOpen"
        />
        <v-tabs v-if="editorTabs.length > 0" v-model="activeEditorTab" density="compact" show-arrows height="34" class="flex-grow-1">
          <v-tab
            v-for="tab in editorTabs"
            :key="tab.id"
            :value="tab.id"
            size="small"
            class="text-none"
          >
            <v-icon :icon="tab.icon" size="14" class="mr-1" />
            <span class="text-body-2">{{ tab.title }}</span>
            <span v-if="tab.modified" class="ml-1 text-warning">●</span>
            <v-btn
              v-if="tab.closeable !== false"
              icon="mdi-close"
              size="x-small"
              variant="text"
              class="ml-1"
              @click.stop="closeTab(tab.id)"
            />
          </v-tab>
        </v-tabs>
      </div>

      <!-- 编辑器内容 -->
      <div v-if="activeEditorTab" class="editor-content-area">
        <template v-if="getActiveTab()?.type === 'editor'">
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
        </template>
        <template v-else-if="getActiveTab()?.type === 'diff'">
          <DiffMonacoComponent
            ref="diffEditor"
            :original-value="getActiveTab()?.data?.originalContent || ''"
            :modified-value="getActiveTab()?.data?.modifiedContent || ''"
            :language="editorOptions.language"
            :show-header="false"
            style="height: 100%"
          />
        </template>
        <template v-else-if="getActiveTab()?.type === 'view'">
          <div v-if="getActiveTab()?.data?.loading" class="d-flex align-center justify-center fill-height">
            <v-progress-circular color="primary" indeterminate size="36" />
          </div>
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
        </template>
      </div>

      <!-- 欢迎 -->
      <div v-else class="d-flex align-center justify-center fill-height">
        <div class="text-center">
          <v-icon icon="mdi-code-braces" size="48" color="primary" class="mb-3" />
          <div class="text-h6 mb-1">{{ project?.title || "项目编辑器" }}</div>
          <div class="text-body-2 text-medium-emphasis mb-4">
            点击左侧文件或从 Git 历史中查看提交记录
          </div>
          <v-btn v-if="project" color="primary" prepend-icon="mdi-file-code" @click="openMainEditor">
            打开主文件
          </v-btn>
        </div>
      </div>

    </div>

    <!-- 语言选择对话框 -->
    <v-dialog v-model="showLanguageDialog" max-width="400">
      <v-card>
        <v-card-text class="pa-4 pb-2">
          <v-text-field
            v-model="languageSearch"
            ref="languageSearchInput"
            append-inner-icon="mdi-magnify"
            label="选择编程语言"
            placeholder="搜索语言..."
            variant="outlined"
            density="compact"
            hide-details
            autofocus
            @keydown.esc="showLanguageDialog = false"
          />
        </v-card-text>
        <v-divider />
        <v-card-text class="pa-0" style="max-height: 400px; overflow-y: auto">
          <v-list density="compact" nav>
            <v-list-item
              v-for="lang in filteredLanguages"
              :key="lang.id"
              :active="editorOptions.language === lang.id"
              @click="selectLanguage(lang.id)"
            >
              <v-list-item-title class="text-body-2">{{ lang.aliases?.[0] || lang.id }}</v-list-item-title>
              <v-list-item-subtitle>{{ lang.id }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
          <div v-if="filteredLanguages.length === 0" class="pa-4 text-center text-body-2 text-medium-emphasis">
            未找到匹配的语言
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- 提交对话框 -->
    <v-dialog v-model="showSaveDialog" max-width="500">
      <v-card>
        <v-card-title class="text-h6 pa-4 pb-2">{{ project?.title || "项目" }}</v-card-title>
        <v-card-text class="pa-4 pt-0">
          <v-text-field
            v-model="commitMessage"
            label="提交信息"
            placeholder="输入提交信息... (Ctrl+Enter 提交)"
            variant="outlined"
            density="compact"
            hide-details
            autofocus
            @keydown.ctrl.enter="confirmCommit"
          />
          <v-textarea
            v-if="showCommitDetails"
            v-model="commitDescription"
            label="详细描述（可选）"
            variant="outlined"
            density="compact"
            rows="2"
            hide-details
            class="mt-2"
          />
          <v-btn variant="text" size="small" class="mt-1" @click="showCommitDetails = !showCommitDetails">
            {{ showCommitDetails ? '隐藏描述' : '添加描述...' }}
          </v-btn>
        </v-card-text>
        <v-card-actions class="pa-4 pt-0">
          <v-spacer />
          <v-btn variant="text" @click="showSaveDialog = false">取消</v-btn>
          <v-btn color="primary" :disabled="!commitMessage.trim()" :loading="committing" @click="confirmCommit">
            提交
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 确认对话框 -->
    <v-dialog v-model="confirmDialog.show" max-width="400">
      <v-card>
        <v-card-text class="pa-4">
          <div class="d-flex align-center mb-2">
            <v-icon :icon="confirmDialog.icon" :color="confirmDialog.color" class="mr-2" />
            <span class="text-h6">{{ confirmDialog.title }}</span>
          </div>
          <p class="text-body-2">{{ confirmDialog.message }}</p>
        </v-card-text>
        <v-card-actions class="pa-4 pt-0">
          <v-spacer />
          <v-btn variant="text" @click="handleConfirmDialogCancel">取消</v-btn>
          <v-btn :color="confirmDialog.color" :loading="confirmDialog.loading" @click="handleConfirmDialogConfirm">
            {{ confirmDialog.confirmText }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 提交详情对话框 -->
    <v-dialog v-model="showCommitDetailsDialog" max-width="700">
      <v-card v-if="selectedCommit">
        <v-card-title class="d-flex align-center pa-4 pb-2">
          <span class="text-h6">{{ selectedCommit.commit_message || '无提交信息' }}</span>
          <v-chip size="small" class="ml-2">{{ selectedCommit.id?.substring(0, 7) }}</v-chip>
          <v-spacer />
          <v-btn icon="mdi-close" size="small" variant="text" @click="showCommitDetailsDialog = false" />
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-0">
          <div class="pa-4">
            <v-row>
              <v-col cols="12" md="8">
                <div class="d-flex align-center mb-3">
                  <v-avatar size="32" class="mr-3">
                    <v-img v-if="selectedCommit.author?.avatar" :src="getAvatarUrl(selectedCommit.author.avatar)" />
                    <v-icon v-else icon="mdi-account" />
                  </v-avatar>
                  <div>
                    <div class="text-subtitle-2">
                      {{ selectedCommit.author?.display_name || selectedCommit.author?.username || '未知' }}
                    </div>
                    <div class="text-caption text-medium-emphasis">@{{ selectedCommit.author?.username }}</div>
                  </div>
                </div>
                <div class="text-body-2 mb-2">{{ selectedCommit.commit_message || '无提交信息' }}</div>
                <div v-if="selectedCommit.commit_description" class="text-body-2 text-medium-emphasis">
                  {{ selectedCommit.commit_description }}
                </div>
              </v-col>
              <v-col cols="12" md="4">
                <div class="text-caption text-medium-emphasis mb-2">提交信息</div>
                <div class="d-flex align-center mb-2">
                  <v-icon icon="mdi-source-commit" size="16" class="mr-2" />
                  <span class="text-body-2">{{ selectedCommit.id?.substring(0, 7) }}</span>
                </div>
                <div class="d-flex align-center mb-2">
                  <v-icon icon="mdi-clock-outline" size="16" class="mr-2" />
                  <span class="text-body-2">{{ formatCommitDate(selectedCommit.commit_date) }}</span>
                </div>
                <div v-if="selectedCommit.parent_commit_id" class="d-flex align-center mb-2">
                  <v-icon icon="mdi-source-branch" size="16" class="mr-2" />
                  <span class="text-body-2">{{ selectedCommit.parent_commit_id.substring(0, 7) }}</span>
                </div>
                <div v-if="selectedCommit.commit_file" class="d-flex align-center">
                  <v-icon icon="mdi-file-document" size="16" class="mr-2" />
                  <span class="text-body-2">{{ selectedCommit.commit_file.substring(0, 7) }}</span>
                </div>
              </v-col>
            </v-row>
          </div>

          <v-divider />

          <div class="pa-4">
            <div class="d-flex ga-2">
              <v-btn size="small" variant="outlined" prepend-icon="mdi-eye" @click="viewCommitFromDetails(selectedCommit)">
                查看代码
              </v-btn>
              <v-btn size="small" variant="outlined" prepend-icon="mdi-restore" @click="restoreCommitFromDetails(selectedCommit)">
                恢复到此提交
              </v-btn>
              <v-btn size="small" variant="outlined" prepend-icon="mdi-content-copy" @click="copyCommitId(selectedCommit.id)">
                复制ID
              </v-btn>
            </div>
          </div>

          <v-divider />

          <v-expansion-panels variant="accordion">
            <v-expansion-panel title="详细信息">
              <v-expansion-panel-text>
                <pre class="text-body-2" style="white-space: pre-wrap; font-size: 12px; font-family: monospace">{{ formatCommitDetailsJson(selectedCommit) }}</pre>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- 加载遮罩 -->
    <v-overlay :model-value="loading" class="align-center justify-center" persistent>
      <v-card width="260">
        <v-card-text class="text-center pa-6">
          <v-progress-circular color="primary" indeterminate size="40" />
          <div class="text-body-2 mt-3">{{ loadingMessage }}</div>
        </v-card-text>
      </v-card>
    </v-overlay>

    <!-- 全局提示条 -->
    <v-snackbar v-model="showSnackbar" :color="snackbarColor" :timeout="snackbarTimeout" location="bottom end">
      {{ snackbarMessage }}
      <template #actions>
        <v-btn variant="text" @click="showSnackbar = false">关闭</v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script>
import axios from "@/axios/axios";
import { defineAsyncComponent } from "vue";
import { localuser } from "@/services/localAccount";

const EditorMonacoComponent = defineAsyncComponent(() =>
  import("@/components/EditorMonacoComponent.vue")
);
const DiffMonacoComponent = defineAsyncComponent(() =>
  import("@/components/DiffMonacoComponent.vue")
);

export default {
  name: "ProjectEditor",
  components: { EditorMonacoComponent, DiffMonacoComponent },

  data() {
    return {
      localuser,
      project: null,
      fileContent: null,
      fileSha256: null,
      branches: [],
      currentBranch: "main",
      commits: [],
      accessFileToken: "",

      loading: true,
      loadingMessage: "加载项目信息...",
      errorMessage: "",

      hasUnsavedChanges: false,
      monacoInstance: null,
      availableLanguages: [],

      activeEditorTab: null,
      editorTabs: [],
      tabIdCounter: 0,
      tabInstances: new Map(),

      sidebarOpen: true,
      showSaveDialog: false,
      showLanguageDialog: false,
      showCommitDetails: false,
      committing: false,
      showCommitDetailsDialog: false,
      selectedCommit: null,

      commitMessage: "",
      commitDescription: "",

      languageSearch: "",

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

      showSnackbar: false,
      snackbarMessage: "",
      snackbarColor: "",
      snackbarTimeout: 5000,

      confirmDialog: {
        show: false,
        title: "",
        message: "",
        color: "warning",
        icon: "mdi-alert",
        loading: false,
        confirmText: "确认",
        callback: null,
      },

      abortController: null,
    };
  },

  computed: {
    projectId() {
      return this.$route.query.id;
    },
    projectNamespace() {
      const username = this.$route.params.username || this.$route.query.username;
      const projectname = this.$route.params.projectname || this.$route.query.projectname;
      if (username && projectname) return `${username}/${projectname}`;
      return null;
    },
    filteredLanguages() {
      if (!this.languageSearch || !this.availableLanguages) return this.availableLanguages || [];
      const search = this.languageSearch.toLowerCase().trim();
      return this.availableLanguages
        .filter((lang) => {
          const id = lang.id.toLowerCase();
          return id.includes(search) || (lang.aliases || []).some((a) => a.toLowerCase().includes(search));
        })
        .slice(0, 50);
    },
    activeTabContent: {
      get() { return this.getActiveTab()?.data?.content || ""; },
      set(value) {
        const tab = this.getActiveTab();
        if (tab) {
          tab.data.content = value;
          this.hasUnsavedChanges = true;
          this.setTabModified(tab.id, true);
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
          if (this.branches.length === 0) await this.loadBranches();
        }
      },
    },
    fileContent(newContent) {
      if (newContent !== null && this.project) this.openMainEditor();
    },
    showLanguageDialog(val) {
      if (!val) this.languageSearch = "";
    },
    activeEditorTab(newTabId, oldTabId) {
      if (newTabId !== oldTabId) {
        this.cleanupAllEditorInstances();
        this.$nextTick(() => this.initCurrentTabEditor());
      }
    },
  },

  async mounted() {
    await this.loadProject();
    document.addEventListener("keydown", this.handleKeydown);
  },

  beforeUnmount() {
    this.cleanupAllTabs();
    this.cancelPendingRequests();
    document.removeEventListener("keydown", this.handleKeydown);
  },

  methods: {
    handleKeydown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        this.saveAndCommitCode();
      }
    },

    cleanupAllEditorInstances() {
      for (const [tabId, instance] of this.tabInstances) {
        if (instance?.destroyEditor) try { instance.destroyEditor(); } catch (e) { /* */ }
      }
      this.tabInstances.clear();
    },

    cleanupAllTabs() {
      this.cleanupAllEditorInstances();
      this.editorTabs = [];
      this.activeEditorTab = null;
    },

    getActiveTab() {
      return this.editorTabs.find((tab) => tab.id === this.activeEditorTab) || null;
    },

    addTab(config) {
      const tabId = `tab-${++this.tabIdCounter}`;
      const tab = {
        id: tabId,
        title: config.title || "未命名",
        icon: config.icon || "mdi-file-document",
        type: config.type || "editor",
        closeable: config.closeable !== false,
        modified: false,
        data: config.data || {},
        retryCount: 0,
      };
      this.editorTabs.push(tab);
      this.activeEditorTab = tabId;
      return tab;
    },

    removeTab(tabId) {
      const index = this.editorTabs.findIndex((tab) => tab.id === tabId);
      if (index === -1) return;
      if (this.tabInstances.has(tabId)) {
        const instance = this.tabInstances.get(tabId);
        if (instance?.destroyEditor) try { instance.destroyEditor(); } catch (e) { /* */ }
        this.tabInstances.delete(tabId);
      }
      this.editorTabs.splice(index, 1);
      if (this.activeEditorTab === tabId) {
        this.activeEditorTab = this.editorTabs.length > 0
          ? this.editorTabs[Math.min(index, this.editorTabs.length - 1)].id
          : null;
      }
    },

    closeTab(tabId) { this.removeTab(tabId); },

    setTabModified(tabId, modified = true) {
      const tab = this.editorTabs.find((t) => t.id === tabId);
      if (tab) tab.modified = modified;
    },

    initCurrentTabEditor() {
      const activeTab = this.getActiveTab();
      if (!activeTab || activeTab.data?.loading) return;
      this.cleanupAllEditorInstances();
      this.$nextTick(() => {
        let editorRef = null;
        switch (activeTab.type) {
          case "editor": editorRef = this.$refs.mainEditor; break;
          case "diff": editorRef = this.$refs.diffEditor; break;
          case "view": editorRef = this.$refs.viewEditor; break;
        }
        if (editorRef) {
          this.tabInstances.set(activeTab.id, editorRef);
          if (editorRef.initEditor) editorRef.initEditor();
          activeTab.retryCount = 0;
        } else if (!activeTab.retryCount || activeTab.retryCount < 3) {
          activeTab.retryCount = (activeTab.retryCount || 0) + 1;
          setTimeout(() => this.initCurrentTabEditor(), 100);
        }
      });
    },

    openMainEditor() {
      if (!this.project) return;
      const existingTab = this.editorTabs.find((t) => t.type === "editor" && t.data?.isMain);
      if (existingTab) { this.activeEditorTab = existingTab.id; return; }
      const tab = this.addTab({
        title: this.project.name || "main",
        icon: "mdi-file-code",
        type: "editor",
        data: { content: this.fileContent || "", language: this.editorOptions.language, isMain: true },
      });
      if (tab) this.activeEditorTab = tab.id;
    },

    viewCommit(commit) {
      const existingTab = this.editorTabs.find((t) => t.type === "view" && t.data?.commit?.id === commit.id);
      if (existingTab) {
        this.activeEditorTab = existingTab.id;
        if (!existingTab.data.content) this.reloadCommitContent(existingTab);
        return;
      }
      const tab = this.addTab({
        title: `提交: ${commit.id.substring(0, 7)}`,
        icon: "mdi-source-commit",
        type: "view",
        data: { content: "", commit, loading: true },
      });
      if (tab) {
        this.activeEditorTab = tab.id;
        this.loadCommitContent(commit)
          .then((content) => {
            if (this.editorTabs.find((t) => t.id === tab.id)) {
              tab.data.content = content;
              tab.data.loading = false;
              this.$nextTick(() => { if (this.activeEditorTab === tab.id) this.initCurrentTabEditor(); });
            }
          })
          .catch((error) => {
            if (this.editorTabs.find((t) => t.id === tab.id)) {
              tab.data.content = `// 加载失败: ${error.message}`;
              tab.data.loading = false;
            }
            this.showSnackbarMessage("加载失败: " + (error.message || "未知错误"), "error");
          });
      }
    },

    openDiffView() {
      if (!this.hasUnsavedChanges || !this.fileContent) {
        this.showSnackbarMessage("没有可对比的更改", "info");
        return;
      }
      const existingTab = this.editorTabs.find((t) => t.type === "diff");
      if (existingTab) { this.activeEditorTab = existingTab.id; return; }
      const tab = this.addTab({
        title: "差异对比",
        icon: "mdi-compare",
        type: "diff",
        data: { originalContent: this.fileContent, modifiedContent: this.activeTabContent },
      });
      if (tab) this.activeEditorTab = tab.id;
    },

    async reloadCommitContent(tab) {
      if (!tab || !tab.data?.commit) return;
      try {
        tab.data.loading = true;
        tab.data.content = await this.loadCommitContent(tab.data.commit);
        tab.data.loading = false;
        this.$nextTick(() => { if (this.activeEditorTab === tab.id) this.initCurrentTabEditor(); });
      } catch (error) {
        tab.data.content = `// 加载失败: ${error.message}`;
        tab.data.loading = false;
      }
    },

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
      this.monacoInstance = monaco;
      this.availableLanguages = availableLanguages;
      if (this.project?.type && availableLanguages?.length > 0) {
        const projectType = this.project.type.split("-")[0].toLowerCase();
        const matchedLang = availableLanguages.find((l) => l.id === projectType);
        if (matchedLang) this.editorOptions.language = matchedLang.id;
      }
      const activeTab = this.getActiveTab();
      if (activeTab?.type === "editor") this.tabInstances.set(activeTab.id, this.$refs.mainEditor);
    },

    handleViewEditorReady() {
      const activeTab = this.getActiveTab();
      if (activeTab?.type === "view" && this.$refs.viewEditor) {
        this.tabInstances.set(activeTab.id, this.$refs.viewEditor);
      }
    },

    cancelPendingRequests() {
      if (this.abortController) this.abortController.abort();
      this.abortController = new AbortController();
    },

    async loadProject() {
      try {
        this.loading = true;
        this.loadingMessage = "加载项目信息...";
        this.cancelPendingRequests();
        let response;
        if (this.projectId) {
          response = await axios.get(`/project/id/${this.projectId}`, { signal: this.abortController?.signal });
        } else if (this.projectNamespace) {
          const [username, projectname] = this.projectNamespace.split("/");
          response = await axios.get(`/project/namespace/${username}/${projectname}`, { signal: this.abortController?.signal });
        } else {
          throw new Error("未提供项目ID或命名空间");
        }
        if (response.data.status === "success" || response.data.id) {
          this.project = response.data.data || response.data;
          if (!this.project?.id) throw new Error("项目数据无效");
          await this.loadBranches();
          await this.loadLatestCommit();
        } else {
          throw new Error(response.data.message || "加载项目失败");
        }
      } catch (error) {
        if (error.name === "CanceledError" || error.name === "AbortError") return;
        const errMsg = error.response
          ? `服务器错误 (${error.response.status}): ${error.response.data?.message || "未知错误"}`
          : error.message || "网络错误";
        this.loadingMessage = `加载失败: ${errMsg}`;
        this.errorMessage = errMsg;
        this.loading = false;
      }
    },

    async onBranchChange() {
      this.cancelPendingRequests();
      this.loading = true;
      this.loadingMessage = "切换分支...";
      try {
        await this.loadLatestCommit();
      } catch (e) {
        if (e.name !== "CanceledError" && e.name !== "AbortError") {
          this.showSnackbarMessage("切换分支失败", "error");
        }
      } finally {
        this.loading = false;
      }
    },

    async loadBranches() {
      try {
        this.loadingMessage = "加载分支信息...";
        const response = await axios.get(`/project/branches?projectid=${this.project.id}`, { signal: this.abortController?.signal });
        if (response.data.status === "success") {
          this.branches = response.data.data || [];
          if (this.branches.length > 0 && !this.branches.some((b) => b.name === this.currentBranch)) {
            this.currentBranch = this.branches[0].name;
          }
        }
      } catch (error) {
        if (error.name !== "CanceledError" && error.name !== "AbortError") {
          this.branches = [];
          this.currentBranch = "main";
        }
      }
    },

    async loadLatestCommit() {
      try {
        this.loadingMessage = "加载最新代码...";
        const response = await axios.get(
          `/project/${this.project.id}/${this.currentBranch}/latest`,
          { signal: this.abortController?.signal }
        );
        if (response.data.status === "success") {
          if (!response.data.accessFileToken) throw new Error("服务器未返回文件访问令牌");
          this.accessFileToken = response.data.accessFileToken;
          const commitFile = response.data.commit?.commit_file;
          if (!commitFile) { this.fileContent = ""; this.loading = false; return; }
          try {
            const fileResponse = await axios.get(
              `/project/files/${commitFile}?accessFileToken=${this.accessFileToken}&content=true`,
              { signal: this.abortController?.signal }
            );
            if (fileResponse.status === 200) {
              let content = fileResponse.data;
              if (!content) { this.fileContent = ""; }
              else {
                if (typeof content === "object") content = JSON.stringify(content, null, 2);
                this.fileContent = content;
                this.fileSha256 = commitFile;
                this.editorOptions.language = this.detectLanguage(content, this.project.name || "file.js");
              }
            } else { this.fileContent = ""; }
          } catch { this.fileContent = ""; }
        } else { throw new Error(response.data.message || "加载最新提交失败"); }
      } catch (error) {
        if (error.name === "CanceledError" || error.name === "AbortError") throw error;
        this.fileContent = "";
      } finally { this.loading = false; }
    },

    async loadCommitContent(commit) {
      const response = await axios.get(
        `/project/commit?projectid=${this.project.id}&commitid=${commit.id}`,
        { signal: this.abortController?.signal }
      );
      if (response.data.status === "success") {
        this.accessFileToken = response.data.accessFileToken;
        const commitFile = response.data.commit?.commit_file;
        if (commitFile) {
          const fileResponse = await axios.get(
            `/project/files/${commitFile}?accessFileToken=${this.accessFileToken}&content=true`,
            { signal: this.abortController?.signal }
          );
          if (fileResponse.status === 200) {
            let content = fileResponse.data;
            if (typeof content === "object") content = JSON.stringify(content, null, 2);
            return content;
          }
        }
      }
      throw new Error("无法加载提交内容");
    },

    async loadCommitHistory() {
      if (!this.project?.id) return;
      try {
        const response = await axios.get(
          `/project/commits?projectid=${this.project.id}&branch=${this.currentBranch}`,
          { signal: this.abortController?.signal }
        );
        if (response.data.status === "success") {
          this.commits = (response.data.data || []).map((c) => ({
            ...c, hash: c.hash || "unknown", message: c.message || "无提交信息",
            date: c.date || new Date().toISOString(), author: c.author || { username: "未知用户" },
          }));
        }
      } catch (error) {
        if (error.name !== "CanceledError" && error.name !== "AbortError") console.error("加载提交历史失败:", error);
      }
    },

    async saveAndCommitCode() {
      if (this.fileContent === null) { this.showSnackbarMessage("文件内容未加载", "error"); return; }
      this.showSaveDialog = true;
    },

    showCommitDialog() {
      this.commitMessage = "";
      this.commitDescription = "";
      this.showCommitDetails = false;
      this.showSaveDialog = true;
    },

    confirmCommit() {
      if (!this.commitMessage.trim()) return;
      this.showSaveDialog = false;
      this.confirmDialog = {
        show: true, title: "确认提交", message: "确定要提交这些更改吗？",
        color: "primary", icon: "mdi-source-commit", loading: false,
        confirmText: "确认提交", callback: () => this.saveAndSubmitCommit(),
      };
    },

    async saveAndSubmitCommit() {
      try {
        this.committing = true;
        if (!this.commitMessage.trim()) { this.showSnackbarMessage("请输入提交信息", "warning"); return; }
        let contentToSave = this.fileContent;
        let isValidJson;
        try { JSON.parse(contentToSave); isValidJson = true; } catch { isValidJson = false; }
        const saveResponse = await axios.post(
          `/project/savefile?json=${isValidJson}&${isValidJson ? "source=index" : ""}`,
          isValidJson ? contentToSave : JSON.stringify({ index: this.fileContent }),
          { headers: { "Content-Type": "application/json", "X-Project-ID": this.project.id } }
        );
        if (saveResponse.data.status !== "success") throw new Error(saveResponse.data.message || "保存文件失败");
        this.accessFileToken = saveResponse.data.accessFileToken;
        this.fileSha256 = saveResponse.data.sha256;
        if (!this.fileSha256) throw new Error("服务器未返回文件SHA256");
        const commitResponse = await axios.put(`/project/commit/id/${this.project.id}`, {
          branch: this.currentBranch, projectid: this.project.id,
          accessFileToken: this.accessFileToken, message: this.commitMessage,
          commit_description: this.commitDescription, commit_file: this.fileSha256,
        });
        if (commitResponse.data.status === "success") {
          this.commitMessage = ""; this.commitDescription = ""; this.hasUnsavedChanges = false;
          this.editorTabs.forEach((t) => this.setTabModified(t.id, false));
          await this.loadCommitHistory();
          this.showSnackbarMessage("提交成功", "success");
        } else { throw new Error(commitResponse.data.message || "提交失败"); }
        this.showConfirmDialog = false;
      } catch (error) {
        this.showSnackbarMessage("提交失败: " + (error.response?.data?.message || error.message || "未知错误"), "error");
      } finally { this.committing = false; }
    },

    restoreCommit(commit) {
      if (!commit?.id) return;
      this.openConfirmDialog(
        "恢复提交", `确定要恢复到提交 ${commit.id.substring(0, 7)} 吗？`,
        () => this.handleRestoreCommit(commit), "warning", "mdi-restore"
      );
    },

    async handleRestoreCommit(commit) {
      try {
        this.loading = true; this.loadingMessage = "恢复提交...";
        const content = await this.loadCommitContent(commit);
        this.fileContent = content;
        this.commitMessage = `恢复到提交 ${commit.id.substring(0, 7)}`;
        this.commitDescription = `原提交信息: ${commit.commit_message || "无"}`;
        await this.saveAndSubmitCommit();
        this.showSnackbarMessage("恢复成功", "success");
      } catch (error) {
        this.showSnackbarMessage("恢复失败: " + (error.message || "未知错误"), "error");
      } finally { this.loading = false; }
    },

    openCommitDetails(commit) { this.selectedCommit = commit; this.showCommitDetailsDialog = true; },
    viewCommitFromDetails(commit) { this.showCommitDetailsDialog = false; this.viewCommit(commit); },
    restoreCommitFromDetails(commit) { this.showCommitDetailsDialog = false; this.restoreCommit(commit); },
    copyCommitId(commitId) {
      if (!commitId) return;
      navigator.clipboard.writeText(commitId).then(() => this.showSnackbarMessage("已复制", "success"));
    },

    selectLanguage(languageId) { this.editorOptions.language = languageId; this.showLanguageDialog = false; },

    detectLanguage(content, filename) {
      if (this.project?.type && this.availableLanguages?.length > 0) {
        const projectType = this.project.type.split("-")[0].toLowerCase();
        const matched = this.availableLanguages.find((l) => l.id === projectType);
        if (matched) return matched.id;
      }
      try { JSON.parse(content); return "json"; } catch {
        if (filename) {
          const ext = filename.split(".").pop().toLowerCase();
          const map = { js: "javascript", ts: "typescript", html: "html", css: "css", vue: "html", json: "json", md: "markdown", py: "python", java: "java", go: "go", rs: "rust", sh: "shell" };
          return map[ext] || "plaintext";
        }
      }
      return "plaintext";
    },

    formatRelativeTime(dateString) {
      if (!dateString) return "";
      const diff = Date.now() - new Date(dateString).getTime();
      const sec = Math.floor(diff / 1000);
      if (sec < 60) return "刚刚";
      const min = Math.floor(sec / 60);
      if (min < 60) return `${min}分钟前`;
      const hr = Math.floor(min / 60);
      if (hr < 24) return `${hr}小时前`;
      const day = Math.floor(hr / 24);
      if (day < 30) return `${day}天前`;
      return new Date(dateString).toLocaleDateString("zh-CN");
    },

    formatCommitDate(dateString) {
      if (!dateString) return "未知时间";
      return new Date(dateString).toLocaleString("zh-CN", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      });
    },

    getAvatarUrl(avatar) { return localuser.getUserAvatar(avatar); },

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
        author: commit.author,
      }, null, 2);
    },

    showSnackbarMessage(message, color = "info", timeout = 5000) {
      this.snackbarMessage = message; this.snackbarColor = color;
      this.snackbarTimeout = timeout; this.showSnackbar = true;
    },

    openConfirmDialog(title, message, callback, color = "warning", icon = "mdi-alert") {
      this.confirmDialog = { show: true, title, message, color, icon, loading: false, confirmText: "确认", callback };
    },

    handleConfirmDialogCancel() { this.confirmDialog.show = false; this.confirmDialog.callback = null; },
    handleConfirmDialogConfirm() {
      const cb = this.confirmDialog.callback;
      this.confirmDialog.show = false; this.confirmDialog.callback = null;
      if (cb) cb();
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
  overflow: hidden;
}

.sidebar {
  width: 260px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(var(--v-border-color), 0.12);
  background: rgb(var(--v-theme-surface));
  flex-shrink: 0;
}

.sidebar-header {
  height: 36px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(var(--v-border-color), 0.12);
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
}

.editor-main-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.editor-tabs-bar {
  border-bottom: 1px solid rgba(var(--v-border-color), 0.12);
  flex-shrink: 0;
  min-height: 34px;
}

.editor-content-area {
  flex: 1;
  min-height: 0;
  position: relative;
}
</style>
