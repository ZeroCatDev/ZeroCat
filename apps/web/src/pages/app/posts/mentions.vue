<template>
  <div class="posts-layout">
    <div class="posts-container">
      <UnifiedSidebar
        mode="twitter"
        class="posts-left-sidebar"
      />
      <main class="posts-main">
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

    <!-- 帖子列表 -->
    <PostList
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
      </main>
      <HomeRightSidebar class="posts-right-sidebar" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { localuser } from '@/services/localAccount';
import PostsService from '@/services/postsService';
import { showSnackbar } from '@/composables/useNotifications';
import PostList from '@/components/posts/PostList.vue';
import UnifiedSidebar from '@/components/sidebar/UnifiedSidebar.vue';
import HomeRightSidebar from '@/components/home/HomeRightSidebar.vue';

const router = useRouter();

// State
const posts = ref([]);
const includes = ref({ posts: {} });
const loading = ref(false);
const loadingMore = ref(false);
const cursor = ref(null);
const hasMore = ref(true);

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
  // 支持 { post, includes } 格式或直接传入 post
  const post = data?.post ?? data;
  const newIncludes = data?.includes?.posts;

  if (post) {
    posts.value.unshift(post);
  }
  if (newIncludes) {
    Object.assign(includes.value.posts, newIncludes);
  }
};

onMounted(() => {
  loadMentions(true);
});
</script>

<style scoped>
.mentions-page {
  width: 100%;
  min-height: 100vh;
  border-left: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.posts-layout {
  min-height: 100vh;
}

.posts-container {
  display: flex;
  justify-content: center;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 16px;
}

.posts-left-sidebar {
  width: 275px;
  flex-shrink: 0;
}

.posts-main {
  width: 100%;
  max-width: 600px;
  flex-shrink: 0;
}

.posts-right-sidebar {
  width: 350px;
  flex-shrink: 0;
}

/* Large screens (≥1280px) */
@media (min-width: 1280px) {
  .posts-left-sidebar { width: 275px; }
  .posts-main { max-width: 600px; }
  .posts-right-sidebar { width: 350px; }
}

/* Medium screens (1024-1279px) */
@media (min-width: 1024px) and (max-width: 1279px) {
  .posts-left-sidebar { width: 88px; }
  .posts-main { max-width: 600px; }
  .posts-right-sidebar { display: none; }
}

/* Tablet (768-1023px) */
@media (min-width: 768px) and (max-width: 1023px) {
  .posts-container { padding: 0; }
  .posts-left-sidebar { display: none; }
  .posts-main { max-width: 100%; }
  .posts-right-sidebar { display: none; }
}

/* Mobile (<768px) */
@media (max-width: 767px) {
  .posts-container { padding: 0; }
  .posts-left-sidebar { display: none; }
  .posts-main { max-width: 100%; }
  .posts-right-sidebar { display: none; }
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
</style>
