<template>
  <div class="posts-layout">
    <div class="posts-container">
      <UnifiedSidebar
        mode="twitter"
        class="posts-left-sidebar"
      />
      <main class="posts-main">
        <div class="user-posts-page">
    <!-- 页面头部 -->
    <header class="user-header">
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
        <h1 class="header-title">{{ userDisplayName }}</h1>
        <p class="header-subtitle">{{ postCountText }}</p>
      </div>
    </header>

    <!-- 用户信息卡片 -->
    <div v-if="userInfo" class="user-profile">
      <div class="profile-banner" />
      <div class="profile-content">
        <div class="profile-avatar-row">
          <v-avatar size="80" class="profile-avatar">
            <v-img :src="userAvatar" :alt="userInfo.username" />
          </v-avatar>
          <v-spacer />
          <v-btn
            v-if="!isCurrentUser"
            :variant="isFollowing ? 'outlined' : 'flat'"
            :color="isFollowing ? '' : 'primary'"
            class="profile-follow-btn"
            @click="toggleFollow"
          >
            {{ isFollowing ? '正在关注' : '关注' }}
          </v-btn>
        </div>
        <div class="profile-names">
          <h2 class="profile-display-name">{{ userDisplayName }}</h2>
          <p class="profile-username">@{{ userInfo.username }}</p>
        </div>
        <p v-if="userInfo.bio" class="profile-bio">{{ userInfo.bio }}</p>
        <div v-if="userInfo.created_at" class="profile-meta">
          <v-icon size="16" class="mr-1">mdi-calendar-outline</v-icon>
          {{ joinDate }} 加入
        </div>
        <div class="profile-stats">
          <router-link :to="`/${userInfo.username}/following`" class="profile-stat">
            <span class="profile-stat-value">{{ formatCount(userInfo.following_count || 0) }}</span>
            <span class="profile-stat-label">正在关注</span>
          </router-link>
          <router-link :to="`/${userInfo.username}/followers`" class="profile-stat">
            <span class="profile-stat-value">{{ formatCount(userInfo.followers_count || 0) }}</span>
            <span class="profile-stat-label">关注者</span>
          </router-link>
        </div>
      </div>
    </div>

    <!-- 标签页 -->
    <div class="user-tabs">
      <button
        class="user-tab"
        :class="{ 'user-tab--active': activeTab === 'posts' }"
        @click="activeTab = 'posts'"
      >
        帖子
      </button>
      <button
        class="user-tab"
        :class="{ 'user-tab--active': activeTab === 'replies' }"
        @click="activeTab = 'replies'"
      >
        回复
      </button>
      <button
        class="user-tab"
        :class="{ 'user-tab--active': activeTab === 'media' }"
        @click="activeTab = 'media'"
      >
        媒体
      </button>
      <button
        class="user-tab"
        :class="{ 'user-tab--active': activeTab === 'likes' }"
        @click="activeTab = 'likes'"
      >
        喜欢
      </button>
    </div>

    <!-- 帖子列表 -->
    <PostList
      :items="posts"
      :includes="includes"
      :loading="loading"
      :loading-more="loadingMore"
      :has-more="hasMore"
      :empty-title="emptyTitle"
      :empty-text="emptyText"
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
import { useRoute, useRouter } from 'vue-router';
import { localuser } from '@/services/localAccount';
import PostsService from '@/services/postsService';
import { showSnackbar } from '@/composables/useNotifications';
import PostList from '@/components/posts/PostList.vue';
import UnifiedSidebar from '@/components/sidebar/UnifiedSidebar.vue';
import HomeRightSidebar from '@/components/home/HomeRightSidebar.vue';

const route = useRoute();
const router = useRouter();

const userId = computed(() => route.params.userid);

// State
const posts = ref([]);
const includes = ref({ posts: {} });
const loading = ref(false);
const loadingMore = ref(false);
const cursor = ref(null);
const hasMore = ref(true);
const activeTab = ref('posts');

// User info
const userInfo = ref(null);
const isFollowing = ref(false);

// Computed
const isCurrentUser = computed(() => {
  return localuser.user.value?.id && Number(localuser.user.value.id) === Number(userId.value);
});

const userAvatar = computed(() => {
  if (!userInfo.value?.avatar) return '/default-avatar.png';
  return localuser.getUserAvatar(userInfo.value.avatar);
});

const userDisplayName = computed(() => {
  return userInfo.value?.display_name || userInfo.value?.username || `用户 ${userId.value}`;
});

const joinDate = computed(() => {
  if (!userInfo.value?.created_at) return '';
  return new Date(userInfo.value.created_at).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long'
  });
});

const postCountText = computed(() => {
  const count = posts.value.length;
  return `${count} 条帖子`;
});

const emptyTitle = computed(() => {
  switch (activeTab.value) {
    case 'posts': return '暂无帖子';
    case 'replies': return '暂无回复';
    case 'media': return '暂无媒体';
    case 'likes': return '暂无喜欢';
    default: return '暂无内容';
  }
});

const emptyText = computed(() => {
  const name = userInfo.value?.display_name || '该用户';
  switch (activeTab.value) {
    case 'posts': return `${name}还没有发布任何帖子。`;
    case 'replies': return `${name}还没有回复任何帖子。`;
    case 'media': return `${name}还没有发布任何包含媒体的帖子。`;
    case 'likes': return `${name}还没有喜欢任何帖子。`;
    default: return '这里还没有任何内容。';
  }
});

// Navigation
const goBack = () => {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push('/app/posts');
  }
};

// Utility
const formatCount = (count) => {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
};

// Load user posts
const loadUserPosts = async (isInitial = false) => {
  if (!userId.value) return;

  if (isInitial) {
    loading.value = true;
    cursor.value = null;
    posts.value = [];
    includes.value = { posts: {} };
  } else {
    loadingMore.value = true;
  }

  try {
    const includeReplies = activeTab.value === 'replies';
    const res = await PostsService.getUserPosts(userId.value, {
      cursor: isInitial ? undefined : cursor.value,
      limit: 20,
      includeReplies
    });

    if (isInitial) {
      posts.value = res.posts;
      includes.value = res.includes;

      // 从第一个帖子获取用户信息（如果还没有的话）
      if (!userInfo.value && res.posts.length > 0) {
        const firstPost = res.posts[0];
        if (firstPost?.author) {
          userInfo.value = firstPost.author;
        }
      }
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
  loadUserPosts(false);
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

// Follow
const toggleFollow = async () => {
  if (!localuser.isLogin.value) {
    showSnackbar('请先登录', 'warning');
    return;
  }
  // TODO: Implement follow/unfollow API
  isFollowing.value = !isFollowing.value;
  showSnackbar(isFollowing.value ? '已关注' : '已取消关注', 'success');
};

// Watch for tab changes
watch(activeTab, () => {
  loadUserPosts(true);
});

// Watch for route changes
watch(() => userId.value, () => {
  userInfo.value = null;
  loadUserPosts(true);
});

onMounted(() => {
  loadUserPosts(true);
});
</script>

<style scoped>
.user-posts-page {
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
.user-header {
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-subtitle {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin: 0;
}

/* Profile */
.user-profile {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.profile-banner {
  height: 150px;
  background: linear-gradient(135deg,
    rgba(var(--v-theme-primary), 0.3) 0%,
    rgba(var(--v-theme-primary), 0.1) 100%
  );
}

.profile-content {
  padding: 0 16px 16px;
}

.profile-avatar-row {
  display: flex;
  align-items: flex-end;
  margin-top: -40px;
  margin-bottom: 12px;
}

.profile-avatar {
  border: 4px solid rgb(var(--v-theme-surface));
  background: rgb(var(--v-theme-surface));
}

.profile-follow-btn {
  font-weight: 700;
  border-radius: 20px;
}

.profile-names {
  margin-bottom: 12px;
}

.profile-display-name {
  font-size: 20px;
  font-weight: 800;
  color: rgb(var(--v-theme-on-surface));
  line-height: 1.2;
}

.profile-username {
  font-size: 15px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin: 0;
}

.profile-bio {
  font-size: 15px;
  color: rgb(var(--v-theme-on-surface));
  line-height: 1.4;
  margin: 0 0 12px;
  white-space: pre-wrap;
}

.profile-meta {
  display: flex;
  align-items: center;
  font-size: 15px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-bottom: 12px;
}

.profile-stats {
  display: flex;
  gap: 20px;
}

.profile-stat {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  text-decoration: none;
}

.profile-stat:hover {
  text-decoration: underline;
}

.profile-stat-value {
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface));
}

/* Tabs */
.user-tabs {
  display: flex;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.user-tab {
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

.user-tab:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
}

.user-tab--active {
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface));
}

.user-tab--active::after {
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
</style>
