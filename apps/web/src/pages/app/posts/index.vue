<template>
  <div class="posts-layout">
    <div class="posts-container">
      <UnifiedSidebar
        mode="twitter"
        class="posts-left-sidebar"
      />
      <main class="posts-main">
        <div class="posts-page">
    <!-- 页面头部 -->
    <header class="posts-header">
      <div class="header-content">
        <h1 class="header-title">首页</h1>

      </div>
      <div class="header-tabs">
        <button
          class="header-tab"
          :class="{ 'header-tab--active': feedType === 'recommend' }"
          @click="feedType = 'recommend'"
        >
          推荐
        </button>
        <button
          class="header-tab"
          :class="{ 'header-tab--active': feedType === 'for-you' }"
          @click="feedType = 'for-you'"
        >
          最新
        </button>
        <button
          v-if="isLogin"
          class="header-tab"
          :class="{ 'header-tab--active': feedType === 'following' }"
          @click="feedType = 'following'"
        >
          关注
        </button>
        <button
          class="header-tab"
          :class="{ 'header-tab--active': feedType === 'global' }"
          @click="feedType = 'global'"
        >
          全局
        </button>
      </div>
    </header>

    <!-- 发帖区 -->
    <PostComposer
      v-if="isLogin"
      :submit="submitPost"
      placeholder="有什么新鲜事？"
      submit-label="发布"
      class="posts-composer"
    />

    <!-- 未登录提示 -->
    <div v-else class="posts-login-prompt">
      <div class="login-prompt-content">
        <h2 class="login-prompt-title">加入对话</h2>
        <p class="login-prompt-text">登录后即可发帖、点赞、转推和回复。</p>
        <div class="login-prompt-actions">
          <v-btn
            color="primary"
            variant="flat"
            to="/app/account/login"
            class="login-prompt-btn"
          >
            登录
          </v-btn>
          <v-btn
            variant="outlined"
            to="/app/account/register"
            class="login-prompt-btn"
          >
            注册
          </v-btn>
        </div>
      </div>
    </div>

    <!-- 分割线 -->
    <div class="posts-divider" />

    <!-- 帖子列表 -->
    <PostList
      :items="posts"
      :includes="includes"
      :loading="loading"
      :loading-more="loadingMore"
      :has-more="hasMore"
      empty-title="欢迎来到社区"
      empty-text="当有新的帖子时，它们将显示在这里。"
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
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { localuser } from '@/services/localAccount';
import PostsService from '@/services/postsService';
import { showSnackbar } from '@/composables/useNotifications';
import PostComposer from '@/components/posts/PostComposer.vue';
import PostList from '@/components/posts/PostList.vue';
import UnifiedSidebar from '@/components/sidebar/UnifiedSidebar.vue';
import HomeRightSidebar from '@/components/home/HomeRightSidebar.vue';

// State
const posts = ref([]);
const includes = ref({ posts: {} });
const loading = ref(false);
const loadingMore = ref(false);
const cursor = ref(null);
const recommendOffset = ref(0); // 推荐接口使用 offset 分页
const hasMore = ref(true);
const feedType = ref('recommend');
const postSearchQuery = ref('');

const router = useRouter();

const isLogin = computed(() => localuser.isLogin.value);

// Load feed
const loadFeed = async (isInitial = false) => {
  if (isInitial) {
    loading.value = true;
    cursor.value = null;
    recommendOffset.value = 0;
    posts.value = [];
    includes.value = { posts: {} };
  } else {
    loadingMore.value = true;
  }

  try {
    let res;
    if (feedType.value === 'recommend') {
      // Gorse 个性化推荐，offset 分页
      res = await PostsService.getRecommendFeed({
        offset: isInitial ? 0 : recommendOffset.value,
        limit: 20,
      });
      if (res.nextOffset !== null && res.nextOffset !== undefined) {
        recommendOffset.value = res.nextOffset;
      } else if (res.nextCursor) {
        cursor.value = res.nextCursor;
      }
    } else if (feedType.value === 'global') {
      res = await PostsService.getGlobalFeed({
        cursor: isInitial ? undefined : cursor.value,
        limit: 20,
        includeReplies: false,
      });
      cursor.value = res.nextCursor;
    } else {
      // for-you（最新）/ following
      res = await PostsService.getFeed({
        cursor: isInitial ? undefined : cursor.value,
        limit: 20,
        includeReplies: false,
        followingOnly: feedType.value === 'following',
      });
      cursor.value = res.nextCursor;
    }

    if (isInitial) {
      posts.value = res.posts;
      includes.value = res.includes;
    } else {
      posts.value.push(...res.posts);
      // Merge includes
      Object.assign(includes.value.posts, res.includes.posts);
    }

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
  loadFeed(false);
};

const goSearchPosts = () => {
  const keyword = postSearchQuery.value.trim();
  router.push({
    path: '/app/search',
    query: {
      keyword,
      scope: 'posts',
      page: '1',
      perPage: '20'
    }
  });
};

// Submit post
const submitPost = async ({ content, mediaIds, embed }) => {
  if (!isLogin.value) throw new Error('请先登录');
  const res = await PostsService.createPost({ content, mediaIds, embed });
  if (res.post) {
    posts.value.unshift(res.post);
    // 合并includes（引用/回复的帖子）
    if (res.includes?.posts) {
      Object.assign(includes.value.posts, res.includes.posts);
    }
  }
  showSnackbar('发布成功', 'success');
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

// Watch feed type change
watch(feedType, () => {
  loadFeed(true);
});

onMounted(() => {
  loadFeed(true);
});
</script>

<style scoped>
.posts-page {
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

.posts-search-inline {
  margin-top: 10px;
  display: flex;
  gap: 8px;
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
.posts-header {
  position: sticky;
  top: 64px;
  z-index: 100;
  background: rgba(var(--v-theme-surface), 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.header-content {
  display: flex;
  align-items: center;
  padding: 0 16px;
  height: 53px;
}

.header-title {
  font-size: 20px;
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface));
}

.header-tabs {
  display: flex;
  border-bottom: 1px solid transparent;
}

.header-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 53px;
  padding: 0 16px;
  font-size: 15px;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.6);
  background: none;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
}

.header-tab:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
}

.header-tab--active {
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface));
}

.header-tab--active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 56px;
  height: 4px;
  background: rgb(var(--v-theme-primary));
  border-radius: 2px;
}

/* Composer */
.posts-composer {
  border-bottom: none;
}

/* Login prompt */
.posts-login-prompt {
  padding: 24px 16px;
  background: rgb(var(--v-theme-surface));
}

.login-prompt-content {
  padding: 24px;
  background: rgba(var(--v-theme-primary), 0.05);
  border: 1px solid rgba(var(--v-theme-primary), 0.1);
  border-radius: 16px;
}

.login-prompt-title {
  font-size: 23px;
  font-weight: 800;
  color: rgb(var(--v-theme-on-surface));
  margin-bottom: 8px;
}

.login-prompt-text {
  font-size: 15px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin-bottom: 20px;
}

.login-prompt-actions {
  display: flex;
  gap: 12px;
}

.login-prompt-btn {
  flex: 1;
  font-weight: 700;
  border-radius: 20px;
}

/* Divider */
.posts-divider {
  height: 12px;
  background: rgba(var(--v-theme-on-surface), 0.03);
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
</style>
