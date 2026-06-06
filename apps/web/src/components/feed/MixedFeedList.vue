<template>
  <div class="mixed-feed-list">
    <!-- Loading skeleton -->
    <div v-if="loading" class="feed-skeleton">
      <div v-for="i in 3" :key="i" class="skeleton-item">
        <v-skeleton-loader type="article" />
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="!items.length" class="feed-empty">
      <v-icon size="64" color="grey-lighten-1">mdi-post-outline</v-icon>
      <h3 class="empty-title">{{ emptyTitle }}</h3>
      <p class="empty-text">{{ emptyText }}</p>
    </div>

    <!-- Feed items -->
    <TransitionGroup v-else name="feed-item" tag="div" class="feed-items">
      <MixedFeedCard
        v-for="(item, index) in items"
        :key="`${item.type}-${item.data?.id || index}`"
        :item="item"
        :includes="includes"
      />
    </TransitionGroup>

    <!-- Load more trigger -->
    <div ref="sentinelRef" class="load-more-sentinel">
      <div v-if="loadingMore" class="loading-more">
        <v-progress-circular indeterminate size="24" color="primary" />
        <span class="loading-text">加载中...</span>
      </div>
      <div v-else-if="!hasMore && items.length" class="no-more">
        <span class="no-more-text">已经到底了</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import MixedFeedCard from './MixedFeedCard.vue';

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
  includes: {
    type: Object,
    default: () => ({ posts: {} }),
  },
  loading: {
    type: Boolean,
    default: false,
  },
  loadingMore: {
    type: Boolean,
    default: false,
  },
  hasMore: {
    type: Boolean,
    default: true,
  },
  emptyTitle: {
    type: String,
    default: '暂无内容',
  },
  emptyText: {
    type: String,
    default: '当有新的推荐时，它们将显示在这里。',
  },
});

const emit = defineEmits(['load-more']);

const sentinelRef = ref(null);
let observer = null;

const setupObserver = () => {
  if (observer) observer.disconnect();
  if (!sentinelRef.value) return;

  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && props.hasMore && !props.loading && !props.loadingMore) {
        emit('load-more');
      }
    },
    { rootMargin: '200px' }
  );
  observer.observe(sentinelRef.value);
};

onMounted(() => {
  setupObserver();
});

onUnmounted(() => {
  if (observer) observer.disconnect();
});

watch(() => sentinelRef.value, () => {
  setupObserver();
});
</script>

<style scoped>
.mixed-feed-list {
  min-height: 200px;
}

.feed-skeleton {
  display: flex;
  flex-direction: column;
}

.skeleton-item {
  padding: 16px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.06);
}

.feed-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  text-align: center;
}

.empty-title {
  font-size: 18px;
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface));
  margin-top: 16px;
  margin-bottom: 8px;
}

.empty-text {
  font-size: 14px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  max-width: 300px;
}

.feed-items {
  position: relative;
}

.load-more-sentinel {
  padding: 20px 0;
}

.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.loading-text {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.5);
}

.no-more {
  text-align: center;
}

.no-more-text {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.4);
}

/* Transition animations */
.feed-item-enter-active {
  transition: all 0.3s ease;
}

.feed-item-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
</style>
