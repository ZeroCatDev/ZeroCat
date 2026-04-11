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
          <v-icon size="14" class="mr-1">mdi-check-circle-outline</v-icon>已保存
        </span>
        <span v-else-if="saveStatus === 'error'" class="text-caption text-error mr-3">
          <v-icon size="14" class="mr-1">mdi-alert-circle-outline</v-icon>保存失败
        </span>
      </transition>

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
import { ref, computed, onBeforeUnmount, defineAsyncComponent, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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

useHead({ title: computed(() => `编辑 · ${article.value.title || slug.value}`) })

// Auto-save
const saveStatus = ref('') // 'saving' | 'saved' | 'error' | ''
let autoSaveTimer = null
let currentAccessToken = ''
let currentParentCommit = ''

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

    // Load latest content
    try {
      const commitRes = await request.get(`/project/${info.id}/main/latest`)
      if (commitRes.data?.status === 'success') {
        currentAccessToken = commitRes.data.accessFileToken || ''
        currentParentCommit = commitRes.data.commit?.id || ''
        const commitFile = commitRes.data.commit?.commit_file
        if (commitFile) {
          const fileRes = await request.get(
            `/project/files/${commitFile}?accessFileToken=${currentAccessToken}&content=true`
          )
          let raw = fileRes.data
          if (typeof raw === 'object') {
            // Stored as JSON {index: '...'}
            raw = raw.index ?? JSON.stringify(raw, null, 2)
          }
          markdownContent.value = typeof raw === 'string' ? raw : ''
        }
      }
    } catch (_) {
      // No content yet — start fresh
      markdownContent.value = ''
    }

    editorReady.value = true
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

// ——————— Auto-save ———————
function onContentChange() {
  clearTimeout(autoSaveTimer)
  saveStatus.value = ''
  autoSaveTimer = setTimeout(doSave, 2500)
}

async function doSave() {
  if (!article.value.id) return
  saveStatus.value = 'saving'
  try {
    const content = markdownContent.value
    const saveRes = await request.post(
      `/project/savefile?json=false`,
      content,
      { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
    )
    const token = saveRes.data?.accessFileToken
    if (!token) throw new Error('No accessFileToken returned')

    await request.put(`/project/commit/id/${article.value.id}`, {
      branch: 'main',
      projectid: article.value.id,
      accessFileToken: token,
      message: '自动保存',
      parent_commit: currentParentCommit,
    })

    // Update parent commit for next save
    if (saveRes.data?.commit?.id) currentParentCommit = saveRes.data.commit.id
    currentAccessToken = token
    saveStatus.value = 'saved'
    setTimeout(() => { if (saveStatus.value === 'saved') saveStatus.value = '' }, 3000)
  } catch (e) {
    console.error('Auto-save failed:', e)
    saveStatus.value = 'error'
  }
}

// ——————— Title save ———————
let titleTimer = null
function onTitleInput() {
  clearTimeout(titleTimer)
  titleTimer = setTimeout(saveTitle, 1500)
}

async function saveTitle() {
  if (!article.value.id) return
  try {
    await request.put(`/project/id/${article.value.id}`, {
      title: article.value.title,
    })
  } catch (_) {}
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

onBeforeUnmount(() => {
  clearTimeout(autoSaveTimer)
  clearTimeout(titleTimer)
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
