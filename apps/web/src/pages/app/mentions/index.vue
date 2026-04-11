<template>
  <div class="mentions-page">
    <!-- 页面头部 -->
    <header class="mentions-header">
      <v-btn
        icon
        variant="text"
        size="small"
        class="header-back"
        @click="goBack"
      >
        <v-icon>mdi-arrow-left</v-icon>
      </v-btn>
      <div class="header-info">
        <h1 class="header-title">提及</h1>
        <p class="header-subtitle">@{{ currentUsername }}</p>
      </div>
    </header>

    <!-- 未登录提示 -->
    <div v-if="!isLoggedIn" class="login-prompt">
      <v-icon size="48" color="primary" class="mb-4">mdi-at</v-icon>
      <h2 class="login-prompt-title">查看提及你的帖子</h2>
      <p class="login-prompt-text">登录后可以看到其他用户在帖子中提及你的内容。</p>
      <v-btn color="primary" size="large" rounded to="/app/account/login">
        登录
      </v-btn>
    </div>

    <!-- 帖子列表 -->
    <PostList
      v-else
      :items="posts"
      :includes="includes"
      :loading="loading"
      :loading-more="loadingMore"
      :has-more="hasMore"
      empty-title="暂无提及"
      empty-text="当有人在帖子中提及你时，它们将显示在这里。"
      @deleted="removeFromList"
      @created="addToList"
      @load-more="loadMore"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { localuser } from '@/services/localAccount';
import PostsService from '@/services/postsService';
import { showSnackbar } from '@/composables/useNotifications';
import PostList from '@/components/posts/PostList.vue';
import { useHead } from '@unhead/vue';

useHead({
  title: '提及'
});

const router = useRouter();

// State
const posts = ref([]);
const includes = ref({ posts: {} });
const loading = ref(false);
const loadingMore = ref(false);
const cursor = ref(null);
const hasMore = ref(true);

const isLoggedIn = computed(() => localuser.isLogin.value);
const currentUsername = computed(() => localuser.user.value?.username || '');

// Navigation
const goBack = () => {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push('/app/posts');
  }
};

// Load mentions
const loadMentions = async (isInitial = false) => {
  if (!isLoggedIn.value) return;

  if (isInitial) {
    loading.value = true;
    cursor.value = null;
    posts.value = [];
    includes.value = { posts: {} };
  } else {
    loadingMore.value = true;
  }

  try {
    const res = await PostsService.getMentions({
      cursor: isInitial ? undefined : cursor.value,
      limit: 20
    });

    if (isInitial) {
      posts.value = res.posts;
      includes.value = res.includes;
    } else {
      posts.value.push(...res.posts);
      Object.assign(includes.value.posts, res.includes.posts);
    }

    cursor.value = res.nextCursor;
    hasMore.value = res.hasMore;
  } catch (e) {
    showSnackbar(e?.message || '加载失败', 'error');
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
};

const loadMore = () => {
  if (!hasMore.value || loadingMore.value || loading.value) return;
  loadMentions(false);
};

// List management
const removeFromList = (postId) => {
  posts.value = posts.value.filter((p) => (p?.id ?? p?.postId) !== postId);
};

const addToList = (data) => {
  const post = data?.post ?? data;
  const newIncludes = data?.includes?.posts;

  if (post) {
    posts.value.unshift(post);
  }
  if (newIncludes) {
    Object.assign(includes.value.posts, newIncludes);
  }
};

// Watch login state
watch(isLoggedIn, (val) => {
  if (val) {
    loadMentions(true);
  }
});

onMounted(() => {
  if (isLoggedIn.value) {
    loadMentions(true);
  }
});
</script>

<style scoped>
.mentions-page {
  max-width: 600px;
  margin: 0 auto;
  min-height: 100vh;
  border-left: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

/* Header */
.mentions-header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  padding: 0 8px;
  height: 53px;
  background: rgba(var(--v-theme-surface), 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.header-back {
  margin-right: 16px;
}

.header-info {
  min-width: 0;
}

.header-title {
  font-size: 20px;
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface));
  line-height: 1.2;
}

.header-subtitle {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin: 0;
}

/* Login prompt */
.login-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 32px;
  text-align: center;
}

.login-prompt-title {
  font-size: 24px;
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface));
  margin-bottom: 8px;
}

.login-prompt-text {
  font-size: 15px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-bottom: 24px;
  max-width: 300px;
}
</style>
