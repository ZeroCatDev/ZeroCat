<template>
  <v-container max-width="800" class="py-8">
    <!-- Loading -->
    <div v-if="loading" class="d-flex flex-column align-center justify-center py-16">
      <v-progress-circular indeterminate color="primary" size="48" />
    </div>

    <!-- Error -->
    <div v-else-if="loadError" class="d-flex flex-column align-center justify-center py-16">
      <v-icon size="64" color="error" class="mb-4">mdi-alert-circle-outline</v-icon>
      <div class="text-h6 mb-2">{{ loadError }}</div>
      <v-btn color="primary" variant="tonal" @click="load">重试</v-btn>
    </div>

    <!-- Article -->
    <template v-else>
      <!-- Header -->
      <div class="mb-6">
        <div class="d-flex flex-wrap align-center ga-2 mb-3 article-header-actions">
          <v-chip
            v-if="article.state === 'private'"
            size="small"
            color="warning"
            prepend-icon="mdi-lock-outline"
          >草稿</v-chip>

          <div class="text-caption text-medium-emphasis d-flex align-center mr-auto">
            <v-icon size="14" class="mr-1">mdi-clock-outline</v-icon>
            <TimeAgo :date="article.time" />
          </div>

          <v-btn
            v-if="article.id"
            variant="tonal"
            size="small"
            prepend-icon="mdi-share-variant"
            @click="shareArticle"
          >分享</v-btn>

          <v-btn
            v-if="isAuthor"
            variant="tonal"
            size="small"
            prepend-icon="mdi-cog-outline"
            @click="openManageDialog"
          >管理</v-btn>

          <v-btn
            v-if="isAuthor"
            :to="`/${username}/articles/${slug}/edit`"
            variant="tonal"
            size="small"
            prepend-icon="mdi-pencil-outline"
          >编辑</v-btn>
        </div>

        <h1 class="text-h3 font-weight-bold mb-4">{{ article.title }}</h1>

        <!-- Author info -->
        <div class="d-flex align-center">
          <v-avatar size="36" class="mr-3">
            <v-img :src="localuser.getUserAvatar(article.author?.avatar)" />
          </v-avatar>
          <div>
            <router-link
              :to="`/${username}`"
              class="text-body-1 font-weight-medium text-decoration-none"
            >{{ article.author?.display_name || username }}</router-link>
            <div class="text-caption text-medium-emphasis">@{{ username }}</div>
          </div>
        </div>
      </div>

      <v-divider class="mb-8" />

      <!-- Content -->
      <div v-if="content" class="markdown-body article-content">
        <Markdown>{{ content }}</Markdown>
      </div>
      <div v-else class="text-center py-12 text-medium-emphasis">
        <v-icon size="48" class="mb-4">mdi-file-document-outline</v-icon>
        <div>这篇文章还没有内容</div>
        <v-btn
          v-if="isAuthor"
          :to="`/${username}/articles/${slug}/edit`"
          color="primary"
          variant="tonal"
          class="mt-4"
          prepend-icon="mdi-pencil"
        >开始写作</v-btn>
      </div>

      <v-divider class="mt-12 mb-6" />

      <!-- Footer: back to articles -->
      <div class="d-flex align-center">
        <v-btn
          :to="`/${username}/articles`"
          variant="text"
          prepend-icon="mdi-arrow-left"
          size="small"
        >{{ article.author?.display_name || username }} 的所有文章</v-btn>
      </div>

      <!-- Comments -->
      <div class="mt-8">
        <RelatedPostsPanel
          v-if="article.id"
          type="article"
          :id="article.id"
          :hide-current-context-base="true"
        />
      </div>

      <v-dialog v-model="manageDialog" max-width="720">
        <v-card rounded="lg">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2">mdi-cog-outline</v-icon>
            文章管理
          </v-card-title>
          <v-card-subtitle>修改文章基础信息</v-card-subtitle>

          <v-card-text class="pt-4">
            <v-row>
              <v-col cols="12">
                <v-text-field
                  v-model="manageForm.title"
                  label="标题"
                  variant="outlined"
                  density="comfortable"
                />
              </v-col>

              <v-col cols="12">
                <v-textarea
                  v-model="manageForm.description"
                  label="简介"
                  variant="outlined"
                  rows="3"
                  counter="500"
                  auto-grow
                />
              </v-col>

              <v-col cols="12" md="8">
                <v-text-field
                  v-model="manageForm.name"
                  label="Slug（链接标识）"
                  variant="outlined"
                  density="comfortable"
                  hint="用于文章 URL，仅支持字母、数字、-、_"
                  persistent-hint
                />
              </v-col>

              <v-col cols="12" md="4">
                <v-select
                  v-model="manageForm.state"
                  :items="stateOptions"
                  label="可见性"
                  variant="outlined"
                  density="comfortable"
                />
              </v-col>

              <v-col cols="12">
                <v-text-field
                  :model-value="String(article.id || '')"
                  label="文章 ID"
                  variant="outlined"
                  density="comfortable"
                  readonly
                />
              </v-col>
            </v-row>
          </v-card-text>

          <v-card-actions class="px-6 pb-5">
            <v-btn variant="text" @click="manageDialog = false">取消</v-btn>
            <v-spacer />
            <v-btn
              color="primary"
              variant="elevated"
              prepend-icon="mdi-content-save-outline"
              :loading="savingManage"
              @click="saveManageForm"
            >保存修改</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="2600">
        {{ snackbar.message }}
      </v-snackbar>
    </template>
  </v-container>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'
import { localuser } from '@/services/localAccount'
import { getProjectInfoByNamespace } from '@/services/projectService'
import Markdown from '@/components/Markdown.vue'
import TimeAgo from '@/components/TimeAgo.vue'
import RelatedPostsPanel from '@/components/posts/RelatedPostsPanel.vue'
import { openFloatingPostBar } from '@/composables/useFloatingPostBar'
import 'github-markdown-css'
import request from '@/axios/axios'

const route = useRoute()
const router = useRouter()
const username = computed(() => route.params.username)
const slug = computed(() => route.params.slug)

const article = ref({ id: 0, title: '', state: 'public', author: null, time: null })
const content = ref('')
const loading = ref(true)
const loadError = ref('')
const manageDialog = ref(false)
const savingManage = ref(false)
const stateOptions = [
  { title: '公开', value: 'public' },
  { title: '草稿', value: 'private' },
]
const manageForm = ref({
  title: '',
  description: '',
  name: '',
  state: 'private',
})
const snackbar = ref({ show: false, color: 'success', message: '' })

const isAuthor = computed(() =>
  localuser.isLogin.value && localuser.user.value?.id === article.value.authorid
)

useHead({ title: computed(() => article.value.title || slug.value) })

function toast(message, color = 'success') {
  snackbar.value = { show: true, color, message }
}

function shareArticle() {
  if (!article.value.id) return
  openFloatingPostBar({
    text: `@${article.value.author?.username || username.value} 的文章 ${article.value.title || ''}`,
    embed: {
      type: 'article',
      id: article.value.id,
      username: article.value.author?.username || username.value,
      slug: article.value.name || slug.value,
    },
    placeholder: `分享关于《${article.value.title || '这篇文章'}》的内容...`,
  })
}

function openManageDialog() {
  manageForm.value = {
    title: article.value.title || '',
    description: article.value.description || '',
    name: article.value.name || slug.value || '',
    state: article.value.state || 'private',
  }
  manageDialog.value = true
}

async function saveManageForm() {
  if (!article.value.id) return
  const nextName = (manageForm.value.name || '').trim()
  if (!nextName) {
    toast('Slug 不能为空', 'error')
    return
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(nextName)) {
    toast('Slug 仅支持字母、数字、-、_', 'error')
    return
  }

  savingManage.value = true
  const oldName = article.value.name || slug.value
  try {
    await request.put(`/project/id/${article.value.id}`, {
      title: (manageForm.value.title || '').trim() || '无标题文章',
      description: (manageForm.value.description || '').trim(),
      state: manageForm.value.state,
      name: nextName,
    })

    article.value = {
      ...article.value,
      title: (manageForm.value.title || '').trim() || '无标题文章',
      description: (manageForm.value.description || '').trim(),
      state: manageForm.value.state,
      name: nextName,
    }

    manageDialog.value = false
    toast('文章信息已更新')

    if (oldName !== nextName) {
      await router.replace(`/${username.value}/articles/${nextName}`)
      await load()
    }
  } catch (e) {
    toast(e?.response?.data?.message || e?.message || '保存失败', 'error')
  } finally {
    savingManage.value = false
  }
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const info = await getProjectInfoByNamespace(username.value, slug.value)
    if (!info || !info.id || info.id === 0) {
      loadError.value = '文章不存在'
      return
    }
    if (info.type !== 'article') {
      loadError.value = '该内容不是文章类型'
      return
    }
    article.value = info

    // Load content
    try {
      const commitRes = await request.get(`/project/${info.id}/main/latest`)
      if (commitRes.data?.status === 'success') {
        const token = commitRes.data.accessFileToken
        const commitFile = commitRes.data.commit?.commit_file
        if (commitFile) {
          const fileRes = await request.get(
            `/project/files/${commitFile}?accessFileToken=${token}&content=true`
          )
          let raw = fileRes.data
          if (typeof raw === 'object') {
            raw = raw.index ?? JSON.stringify(raw, null, 2)
          }
          content.value = typeof raw === 'string' ? raw : ''
        }
      }
    } catch (_) {
      content.value = ''
    }
  } catch (e) {
    loadError.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

load()
</script>

<style scoped>
.article-content {
  font-size: 1.05rem;
  line-height: 1.8;
}

.article-header-actions :deep(.v-btn) {
  text-transform: none;
}
</style>
