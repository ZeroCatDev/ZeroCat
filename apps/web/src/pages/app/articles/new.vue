<template>
  <v-container max-width="680" class="py-8">
    <div class="d-flex align-center mb-6">
      <v-icon size="28" class="mr-3" color="primary">mdi-file-document-edit-outline</v-icon>
      <h1 class="text-h5 font-weight-bold">新建文章</h1>
    </div>

    <v-card rounded="lg" border>
      <v-card-text class="pa-6">
        <v-text-field
          v-model="form.title"
          label="文章标题"
          variant="outlined"
          autofocus
          class="mb-4"
        />

        <v-textarea
          v-model="form.description"
          label="文章简介（选填）"
          variant="outlined"
          rows="3"
          counter="500"
          class="mb-4"
        />

        <v-radio-group v-model="form.state" inline class="mb-2">
          <v-radio value="private">
            <template #label>
              <div>
                <strong>草稿</strong>
                <div class="text-caption text-medium-emphasis">仅自己可见，随时可发布</div>
              </div>
            </template>
          </v-radio>
          <v-radio value="public">
            <template #label>
              <div>
                <strong>公开</strong>
                <div class="text-caption text-medium-emphasis">所有人可见</div>
              </div>
            </template>
          </v-radio>
        </v-radio-group>
      </v-card-text>

      <v-divider />
      <v-card-actions class="pa-4">
        <v-btn variant="text" @click="$router.back()">取消</v-btn>
        <v-spacer />
        <v-btn
          color="primary"
          variant="elevated"
          :loading="creating"
          prepend-icon="mdi-pencil"
          @click="createArticle"
        >
          创建并开始写作
        </v-btn>
      </v-card-actions>
    </v-card>

    <!-- Error snackbar -->
    <v-snackbar v-model="snackbar" color="error" :timeout="4000">
      {{ errorMessage }}
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'
import { localuser } from '@/services/localAccount'
import { initProject } from '@/services/projectService'
import request from '@/axios/axios'

useHead({ title: '新建文章' })

const router = useRouter()

const form = ref({
  title: '',
  description: '',
  state: 'private',
})

const creating = ref(false)
const snackbar = ref(false)
const errorMessage = ref('')

function generateSlug() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16)
}

async function createArticle() {
  creating.value = true
  try {
    const slug = generateSlug()
    const payload = {
      name: slug,
      title: form.value.title || '无标题文章',
      description: form.value.description,
      state: form.value.state,
      type: 'article',
      license: 'None',
    }
    const res = await request.post('/project/', payload)
    if (res.data.status === 'error') {
      errorMessage.value = res.data.message || '创建失败'
      snackbar.value = true
      return
    }

    // 初始化仓库（使用纯文本类型）
    const projectId = res.data.data?.id ?? res.data.id
    if (projectId) {
      await initProject(projectId, 'text')
    }

    const username = localuser.user.value.username
    router.push(`/${username}/articles/${slug}/edit`)
  } catch (e) {
    errorMessage.value = e?.response?.data?.message || e.message || '网络错误'
    snackbar.value = true
  } finally {
    creating.value = false
  }
}
</script>
