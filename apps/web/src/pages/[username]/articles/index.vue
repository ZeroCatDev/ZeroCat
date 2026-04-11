<template>
  <v-container max-width="800" class="py-6">
    <!-- Header -->
    <div class="d-flex align-center mb-6">
      <v-avatar size="40" class="mr-3">
        <v-img :src="localuser.getUserAvatar(userInfo.avatar)" />
      </v-avatar>
      <div class="mr-auto">
        <div class="text-h6 font-weight-bold">{{ userInfo.display_name || username }} 的文章</div>
        <div class="text-caption text-medium-emphasis">@{{ username }}</div>
      </div>
      <v-btn
        v-if="isCurrentUser"
        to="/app/articles/new"
        color="primary"
        variant="elevated"
        prepend-icon="mdi-plus"
        size="small"
      >新建文章</v-btn>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="d-flex justify-center py-12">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <!-- Empty state -->
    <div v-else-if="allArticles.length === 0" class="text-center py-16">
      <v-icon size="64" class="mb-4 text-medium-emphasis">mdi-file-document-outline</v-icon>
      <div class="text-h6 mb-2">{{ isCurrentUser ? '你还没有发布文章' : '暂无文章' }}</div>
      <v-btn
        v-if="isCurrentUser"
        to="/app/articles/new"
        color="primary"
        variant="tonal"
        prepend-icon="mdi-pencil-outline"
        class="mt-2"
      >写第一篇文章</v-btn>
    </div>

    <!-- Article list -->
    <div v-else class="articles-list">
      <v-card
        v-for="article in allArticles"
        :key="article.id"
        rounded="lg"
        border
        class="mb-4 article-card"
        :to="`/${username}/articles/${article.name}`"
        hover
      >
        <v-card-text class="pa-5">
          <div class="d-flex align-start">
            <div class="flex-grow-1 mr-4">
              <div class="d-flex align-center mb-1">
                <v-chip
                  v-if="article.state === 'private'"
                  size="x-small"
                  color="warning"
                  class="mr-2"
                >草稿</v-chip>
              </div>
              <div class="text-h6 font-weight-bold mb-2 article-title">
                {{ article.title || article.name }}
              </div>
              <div
                v-if="article.description"
                class="text-body-2 text-medium-emphasis mb-3 article-description"
              >{{ article.description }}</div>
              <div class="d-flex align-center text-caption text-medium-emphasis">
                <v-icon size="14" class="mr-1">mdi-clock-outline</v-icon>
                <TimeAgo :date="article.time" />

              </div>
            </div>
            <!-- Edit button for author -->
            <v-btn
              v-if="isCurrentUser"
              :to="`/${username}/articles/${article.name}/edit`"
              icon="mdi-pencil-outline"
              variant="text"
              size="small"
              @click.prevent
            />
          </div>
        </v-card-text>
      </v-card>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="d-flex justify-center mt-6">
        <v-pagination v-model="page" :length="totalPages" @update:model-value="loadArticles" />
      </div>
    </div>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useHead } from '@unhead/vue'
import { localuser } from '@/services/localAccount'
import { getUserByUsername } from '@/stores/user'
import TimeAgo from '@/components/TimeAgo.vue'
import request from '@/axios/axios'

const route = useRoute()
const username = computed(() => route.params.username)

const userInfo = ref({})
const allArticles = ref([])
const loading = ref(true)
const page = ref(1)
const pageSize = 20
const total = ref(0)

const isCurrentUser = computed(
  () => localuser.isLogin.value && localuser.user.value?.username === username.value
)
const totalPages = computed(() => Math.ceil(total.value / pageSize))

useHead({ title: computed(() => `${userInfo.value.display_name || username.value} 的文章`) })

async function loadArticles() {
  if (!userInfo.value.id) return
  loading.value = true
  try {
    const res = await request.get('/searchapi', {
      params: {
        search_userid: userInfo.value.id,
        search_type: 'article',
        search_orderby: 'time_down',
        limit: pageSize,
        curr: page.value,
      },
    })
    allArticles.value = res.data?.projects || []
    total.value = res.data?.total ?? res.data?.totalCount ?? allArticles.value.length
  } catch (_) {
    allArticles.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  userInfo.value = (await getUserByUsername(username.value)) || {}
  await loadArticles()
})
</script>

<style scoped>
.article-card {
  transition: box-shadow 0.2s;
  cursor: pointer;
}
.article-title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.article-description {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
