<template>
  <div class="post-list" ref="listRef">
    <!-- 加载状态 -->
    <div v-if="loading && !items.length" class="post-list-loading">
      <v-progress-circular indeterminate color="primary" size="32" width="3" />
    </div>

    <!-- 空状态 -->
    <div v-else-if="!items.length" class="post-list-empty">
      <div class="empty-icon">
        <v-icon size="48" color="primary">mdi-message-text-outline</v-icon>
      </div>
      <div class="empty-title">{{ emptyTitle }}</div>
      <div class="empty-text">{{ emptyText }}</div>
    </div>

    <!-- 帖子列表 -->
    <template v-else>
      <TransitionGroup name="post-list" tag="div">
        <PostCard
          v-for="(post, index) in items"
          :key="getPostKey(post)"
          :post="getActualPost(post)"
          :includes="mergedIncludes"
          :show-thread-line="showThreadLine(index)"
          :hide-reply-indicator="threadMode"
          :retweet-author="getRetweetAuthor(post)"
          :embed-mode="embedMode"
          :context-project-route-base="contextProjectRouteBase"
          :context-embed-data="contextEmbedData"
          :hide-current-context-base="hideCurrentContextBase"
          @deleted="onDeleted"
          @created="onCreated"
          @updated="onUpdated"
        />
      </TransitionGroup>

      <!-- 加载更多 -->
      <div v-if="hasMore" ref="loadMoreRef" class="post-list-load-more">
        <v-progress-circular
          v-if="loadingMore"
          indeterminate
          color="primary"
          size="24"
          width="2"
        />
        <v-btn
          v-else
          variant="text"
          color="primary"
          @click="$emit('load-more')"
        >
          加载更多
        </v-btn>
      </div>

      <!-- 没有更多
      <div v-else-if="showEndMessage" class="post-list-end">
        <v-icon size="20" class="mr-2">mdi-check-circle-outline</v-icon>
        已加载全部内容
      </div> -->
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import PostCard from './PostCard.vue';

const props = defineProps({
  items: { type: Array, default: () => [] },
  includes: { type: Object, default: () => ({ posts: {} }) },
  loading: { type: Boolean, default: false },
  loadingMore: { type: Boolean, default: false },
  hasMore: { type: Boolean, default: true },
  emptyTitle: { type: String, default: '暂无内容' },
  emptyText: { type: String, default: '这里还没有任何帖子' },
  showEndMessage: { type: Boolean, default: true },
  threadMode: { type: Boolean, default: false },
  infiniteScroll: { type: Boolean, default: true },
  embedMode: { type: String, default: 'full' },
  contextProjectRouteBase: { type: String, default: '' },
  contextEmbedData: { type: Object, default: () => ({}) },
  hideCurrentContextBase: { type: Boolean, default: false }
});

const emit = defineEmits(['deleted', 'created', 'updated', 'load-more']);

const listRef = ref(null);
const loadMoreRef = ref(null);

// 根据ID查找帖子（先在includes中找，再在items中找）
const findPostById = (id) => {
  if (!id) return null;
  const posts = props.includes?.posts || {};
  // 先在includes中查找
  let found = posts[id] || posts[String(id)];
  if (found) return found;
  // 再在items中查找
  return props.items.find(p => p.id === id || p.id === Number(id));
};

// Get unique key for post
const getPostKey = (post) => {
  return post?.id ?? post?.postId ?? JSON.stringify(post);
};

// Handle retweet posts - get the actual content post
const getActualPost = (post) => {
  if (post?.type === 'retweet' && post?.retweet_of_id) {
    const retweetedPost = findPostById(post.retweet_of_id);
    if (retweetedPost) {
      return retweetedPost;
    }
  }
  return post;
};

// 获取合并后的includes（包含items中的帖子，用于传递给PostCard）
const mergedIncludes = computed(() => {
  const result = { posts: { ...props.includes?.posts } };
  // 将items中的帖子也加入，以便PostCard能查找到引用的帖子
  for (const post of props.items) {
    if (post?.id) {
      result.posts[post.id] = post;
      result.posts[String(post.id)] = post;
    }
  }
  return result;
});

// Get retweet author if this is a retweet
const getRetweetAuthor = (post) => {
  if (post?.type === 'retweet' && post?.author) {
    return post.author;
  }
  return null;
};

// Show thread line between consecutive posts in thread mode
const showThreadLine = (index) => {
  if (!props.threadMode) return false;
  return index < props.items.length - 1;
};

// Event handlers
const onDeleted = (postId) => {
  emit('deleted', postId);
};

const onCreated = (post) => {
  emit('created', post);
};

const onUpdated = (post) => {
  emit('updated', post);
};

// Infinite scroll
let observer = null;

const setupInfiniteScroll = () => {
  if (!props.infiniteScroll || !loadMoreRef.value) return;

  observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (entry.isIntersecting && props.hasMore && !props.loadingMore && !props.loading) {
        emit('load-more');
      }
    },
    {
      rootMargin: '200px',
      threshold: 0
    }
  );

  observer.observe(loadMoreRef.value);
};

const cleanupInfiniteScroll = () => {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
};

// Watch for loadMoreRef changes
watch(
  () => loadMoreRef.value,
  (el) => {
    cleanupInfiniteScroll();
    if (el) {
      nextTick(setupInfiniteScroll);
    }
  }
);

onMounted(() => {
  if (loadMoreRef.value) {
    setupInfiniteScroll();
  }
});

onUnmounted(() => {
  cleanupInfiniteScroll();
});
</script>

<style scoped>
.post-list {
  min-height: 200px;
}

.post-list-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 48px 16px;
}

.post-list-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.empty-icon {
  margin-bottom: 16px;
  padding: 20px;
  background: rgba(var(--v-theme-primary), 0.1);
  border-radius: 50%;
}

.empty-title {
  font-size: 20px;
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface));
  margin-bottom: 8px;
}

.empty-text {
  font-size: 15px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  max-width: 320px;
}

.post-list-load-more {
  display: flex;
  justify-content: center;
  padding: 24px 16px;
}

.post-list-end {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  font-size: 14px;
  color: rgba(var(--v-theme-on-surface), 0.5);
}

/* Transitions */
.post-list-enter-active {
  transition: all 0.3s ease-out;
}

.post-list-leave-active {
  transition: all 0.2s ease-in;
}

.post-list-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.post-list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.post-list-move {
  transition: transform 0.3s ease;
}
</style>

