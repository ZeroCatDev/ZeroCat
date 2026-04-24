<template>
  <div class="article-editor-layout">
    <!-- Top bar -->
    <div class="article-editor-topbar d-flex align-center px-4">
      <v-btn
        :to="`/${username}/articles/${slug}`"
        icon="mdi-arrow-left"
        variant="text"
        size="small"
        class="mr-2"
      />
      <v-icon size="18" class="mr-2 text-medium-emphasis">mdi-file-document-edit-outline</v-icon>
      <span class="text-body-2 text-medium-emphasis mr-2">{{ article.title || slug }}</span>
      <v-spacer />

      <!-- Save status -->
      <transition name="fade">
        <span v-if="saveStatus === 'saving'" class="text-caption text-medium-emphasis mr-3">
          <v-progress-circular size="12" indeterminate class="mr-1" />
          保存中…
        </span>
        <span v-else-if="saveStatus === 'saved'" class="text-caption text-success mr-3">
          <v-icon size="14" class="mr-1">mdi-check-circle-outline</v-icon>草稿已保存
        </span>
        <span v-else-if="saveStatus === 'error'" class="text-caption text-error mr-3">
          <v-icon size="14" class="mr-1">mdi-alert-circle-outline</v-icon>保存失败
        </span>
      </transition>

      <v-chip
        v-if="hasUnpublishedChanges"
        size="small"
        color="warning"
        variant="tonal"
        class="mr-2"
      >
        <v-icon start size="14">mdi-pencil-outline</v-icon>未发布
      </v-chip>

      <!-- Visibility toggle -->
      <v-chip
        :color="article.state === 'public' ? 'success' : 'default'"
        size="small"
        class="mr-2"
        style="cursor:pointer"
        @click="toggleVisibility"
      >
        <v-icon start size="14">{{ article.state === 'public' ? 'mdi-earth' : 'mdi-lock-outline' }}</v-icon>
        {{ article.state === 'public' ? '公开' : '草稿' }}
      </v-chip>

      <v-btn
        variant="tonal"
        size="small"
        prepend-icon="mdi-content-save-outline"
        :loading="saveStatus === 'saving'"
        :disabled="saveStatus === 'saving'"
        class="mr-2"
        @click="manualSave"
      >保存</v-btn>
      <v-btn
        color="primary"
        variant="elevated"
        size="small"
        prepend-icon="mdi-cloud-upload-outline"
        :loading="publishing"
        :disabled="publishing || !article.id"
        class="mr-2"
        @click="publishArticle"
      >发布</v-btn>
      <v-btn
        :to="`/${username}/articles/${slug}`"
        variant="tonal"
        size="small"
        prepend-icon="mdi-eye-outline"
      >预览</v-btn>
    </div>

    <!-- Loading overlay -->
    <div v-if="loading" class="article-editor-loading d-flex flex-column align-center justify-center">
      <v-progress-circular indeterminate color="primary" size="48" />
      <div class="text-body-2 mt-4 text-medium-emphasis">加载文章中…</div>
    </div>

    <!-- Error state -->
    <div v-else-if="loadError" class="article-editor-loading d-flex flex-column align-center justify-center">
      <v-icon size="48" color="error" class="mb-4">mdi-alert-circle-outline</v-icon>
      <div class="text-body-1 mb-2">{{ loadError }}</div>
      <v-btn color="primary" variant="tonal" @click="loadArticle">重试</v-btn>
    </div>

    <!-- Editor -->
    <div v-else class="article-editor-body">
      <!-- Title input -->
      <div class="article-title-area px-6 pt-6 pb-2">
        <textarea
          v-model="article.title"
          class="article-title-input"
          placeholder="文章标题…"
          rows="1"
          @input="onTitleInput"
        />
      </div>
      <v-divider class="mx-6 mb-0" />

      <!-- Monaco markdown editor -->
      <div class="article-monaco-area">
        <EditorMonacoComponent
          v-if="editorReady"
          ref="monacoRef"
          v-model="markdownContent"
          language="markdown"
          :options="editorOptions"
          @change="onContentChange"
          @update:modelValue="onContentChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount, defineAsyncComponent, nextTick, onMounted } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { useHead } from '@unhead/vue'
import { localuser } from '@/services/localAccount'
import { getProjectInfoByNamespace } from '@/services/projectService'
import request from '@/axios/axios'

const EditorMonacoComponent = defineAsyncComponent(() =>
  import('@/components/EditorMonacoComponent.vue')
)

const route = useRoute()
const router = useRouter()

const username = computed(() => route.params.username)
const slug = computed(() => route.params.slug)

// ——————— State ———————
const article = ref({ id: 0, title: '', state: 'private', authorid: 0 })
const markdownContent = ref('')
const loading = ref(true)
const loadError = ref('')
const editorReady = ref(false)
const lastSavedContent = ref('')
const lastSavedTitle = ref('')
const isReadyForAutosave = ref(false)
const publishing = ref(false)
const hasUnpublishedChanges = ref(false)
const draftBaseCommitId = ref('')

useHead({ title: computed(() => `编辑 · ${article.value.title || slug.value}`) })

const AUTO_SAVE_DELAY_DRAFT = 2500
const AUTO_SAVE_DELAY_PUBLISHED = 8000
const getAutoSaveDelay = () => (
  article.value.state === 'public' ? AUTO_SAVE_DELAY_PUBLISHED : AUTO_SAVE_DELAY_DRAFT
)
const hasUnsavedChanges = computed(() => (
  markdownContent.value !== lastSavedContent.value
  || (article.value.title || '') !== lastSavedTitle.value
))

// Auto-save
const saveStatus = ref('') // 'saving' | 'saved' | 'error' | ''
let autoSaveTimer = null

const editorOptions = {
  theme: 'vs-dark',
  fontSize: 15,
  lineNumbers: 'off',
  minimap: { enabled: false },
  wordWrap: 'on',
  scrollBeyondLastLine: false,
  automaticLayout: true,
  padding: { top: 24, bottom: 24 },
  lineDecorationsWidth: 0,
  lineNumbersMinChars: 0,
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  renderLineHighlight: 'none',
}

// ——————— Load ———————
async function loadArticle() {
  loading.value = true
  loadError.value = ''
  isReadyForAutosave.value = false
  try {
    const info = await getProjectInfoByNamespace(username.value, slug.value)
    if (!info || !info.id || info.id === 0) {
      loadError.value = '文章不存在或无权访问'
      return
    }
    article.value = info

    // Auth check — only author can edit
    if (localuser.user.value.id !== info.authorid && !localuser.isAdministrator?.value) {
      router.replace(`/${username.value}/articles/${slug.value}`)
      return
    }

    // 1. 先尝试拉取 KV 草稿
    let draftHit = false
    try {
      const draftRes = await request.get(`/blog/drafts/${info.id}`)
      if (draftRes.data?.status === 'success' && draftRes.data.data) {
        const draft = draftRes.data.data
        markdownContent.value = typeof draft.content === 'string' ? draft.content : ''
        if (draft.title) article.value.title = draft.title
        draftBaseCommitId.value = draft.baseCommitId || ''
        hasUnpublishedChanges.value = true
        draftHit = true
      }
    } catch (_) {
      // 无草稿，继续走发布版
    }

    // 2. 无草稿 → 拉最新提交内容
    if (!draftHit) {
      try {
        const commitRes = await request.get(`/project/${info.id}/main/latest`)
        if (commitRes.data?.status === 'success') {
          const accessToken = commitRes.data.accessFileToken || ''
          draftBaseCommitId.value = commitRes.data.commit?.id || ''
          const commitFile = commitRes.data.commit?.commit_file
          if (commitFile) {
            const fileRes = await request.get(
              `/project/files/${commitFile}?accessFileToken=${accessToken}&content=true`
            )
            let raw = fileRes.data
            if (typeof raw === 'object') {
              raw = raw.index ?? JSON.stringify(raw, null, 2)
            }
            markdownContent.value = typeof raw === 'string' ? raw : ''
          }
        }
      } catch (_) {
        markdownContent.value = ''
      }
    }

    lastSavedContent.value = markdownContent.value
    lastSavedTitle.value = article.value.title || ''
    editorReady.value = true
    await nextTick()
    isReadyForAutosave.value = true
  } catch (e) {
    loadError.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

// 手动保存
function manualSave() {
  clearTimeout(autoSaveTimer)
  doSave()
}

// ——————— Auto-save (到 KV 草稿，无历史) ———————
function onContentChange() {
  if (!isReadyForAutosave.value) return
  clearTimeout(autoSaveTimer)
  saveStatus.value = ''
  autoSaveTimer = setTimeout(doSave, getAutoSaveDelay())
}

async function doSave() {
  if (!article.value.id) return
  saveStatus.value = 'saving'
  try {
    await request.put(`/blog/drafts/${article.value.id}`, {
      title: article.value.title,
      content: markdownContent.value,
    })
    lastSavedContent.value = markdownContent.value
    lastSavedTitle.value = article.value.title || ''
    hasUnpublishedChanges.value = true
    saveStatus.value = 'saved'
    setTimeout(() => { if (saveStatus.value === 'saved') saveStatus.value = '' }, 3000)
  } catch (e) {
    console.error('Draft save failed:', e)
    saveStatus.value = 'error'
  }
}

// ——————— Publish（从 KV 落 commit） ———————
async function publishArticle() {
  if (!article.value.id || publishing.value) return
  // 发布前先同步保存最新草稿
  clearTimeout(autoSaveTimer)
  publishing.value = true
  try {
    await request.put(`/blog/drafts/${article.value.id}`, {
      title: article.value.title,
      content: markdownContent.value,
    })
    const res = await request.post(`/blog/drafts/${article.value.id}/publish`, {
      message: '发布',
    })
    if (res.data?.status !== 'success') {
      throw new Error(res.data?.message || '发布失败')
    }
    draftBaseCommitId.value = res.data.data?.commit?.id || draftBaseCommitId.value
    hasUnpublishedChanges.value = false
    saveStatus.value = 'saved'
    setTimeout(() => { if (saveStatus.value === 'saved') saveStatus.value = '' }, 3000)
  } catch (e) {
    console.error('Publish failed:', e)
    saveStatus.value = 'error'
    window.alert(e?.response?.data?.message || e?.message || '发布失败')
  } finally {
    publishing.value = false
  }
}

// ——————— Title save (复用草稿保存) ———————
let titleTimer = null
function onTitleInput() {
  clearTimeout(titleTimer)
  titleTimer = setTimeout(() => {
    if (!isReadyForAutosave.value) return
    clearTimeout(autoSaveTimer)
    doSave()
  }, 1500)
}

// ——————— Visibility ———————
async function toggleVisibility() {
  const next = article.value.state === 'public' ? 'private' : 'public'
  try {
    await request.put(`/project/id/${article.value.id}`, { state: next })
    article.value.state = next
  } catch (_) {}
}

// ——————— Lifecycle ———————
loadArticle()

const beforeUnloadHandler = (event) => {
  if (!hasUnsavedChanges.value) return
  event.preventDefault()
  event.returnValue = ''
}

onBeforeRouteLeave(() => {
  if (!hasUnsavedChanges.value) return true
  return window.confirm('当前内容未保存，确定要离开吗？')
})

onMounted(() => {
  window.addEventListener('beforeunload', beforeUnloadHandler)
})

onBeforeUnmount(() => {
  clearTimeout(autoSaveTimer)
  clearTimeout(titleTimer)
  window.removeEventListener('beforeunload', beforeUnloadHandler)
})
</script>

<style scoped>
.article-editor-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.article-editor-topbar {
  height: 48px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgb(var(--v-theme-surface));
}

.article-editor-loading {
  flex: 1;
}

.article-editor-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.article-title-area {
  flex-shrink: 0;
}

.article-title-input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.3;
  resize: none;
  color: inherit;
  font-family: inherit;
}

.article-monaco-area {
  flex: 1;
  overflow: hidden;
}

.article-monaco-area > * {
  height: 100% !important;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
