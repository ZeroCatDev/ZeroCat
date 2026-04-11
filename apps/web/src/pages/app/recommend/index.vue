<template>
  <div class="recommend-feed-container" @scroll="handleScroll">
    <div
      v-for="(project, index) in projects"
      :key="project.id"
      class="feed-item"
    >
      <ProjectFeedCard
        v-if="shouldRenderProject(index)"
        :project="project"
        :is-active="index === activeIndex"
        @play="handleProjectPlay"
      />
    </div>

    <div v-if="loading" class="loading-indicator">
      <v-progress-circular indeterminate color="white" />
    </div>

    <div v-if="!loading && projects.length === 0" class="empty-state">
      <div class="text-center">
        <v-icon icon="mdi-robot-confused-outline" size="64" color="white" class="mb-4" />
        <p class="text-white text-h6">在这里发现更多精彩</p>
        <p class="text-medium-emphasis text-body-2 mt-2">正在为你准备推荐内容...</p>
        <v-btn class="mt-4" color="primary" @click="fetchProjects">刷新试试</v-btn>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useHead } from '@unhead/vue';
import ProjectRecommendationService from '@/services/projectRecommendationService';
import ProjectFeedCard from '@/components/project/ProjectFeedCard.vue';

useHead({ title: '发现 - 猜你喜欢' });

const projects = ref([]);
const loading = ref(false);
const offset = ref(0);
const activeIndex = ref(0);
const hasMore = ref(true);
const limit = 5;
const readReportedIds = new Set();

const fetchProjects = async () => {
  if (loading.value || (!hasMore.value && offset.value > 0)) return;

  loading.value = true;
  try {
    const res = await ProjectRecommendationService.getMyRecommendations({
      limit,
      offset: offset.value,
    });

    const newList = res.data?.projects || [];

    // De-duplicate just in case
    const existingIds = new Set(projects.value.map(p => p.id));
    const uniqueNew = newList.filter(p => !existingIds.has(p.id));

    projects.value.push(...uniqueNew);

    offset.value += limit;
    hasMore.value = res.data?.has_more ?? (newList.length >= limit);

  } catch (e) {
    console.error('Failed to load recommendations', e);
  } finally {
    loading.value = false;
  }
};

const handleScroll = (e) => {
  const { scrollTop, clientHeight, scrollHeight } = e.target;
  const nextActiveIndex = Math.max(0, Math.round(scrollTop / clientHeight));
  if (nextActiveIndex !== activeIndex.value) {
    activeIndex.value = nextActiveIndex;
  }

  // Load more when user scrolls near bottom (1 screen away)
  if (scrollHeight - scrollTop - clientHeight < clientHeight) {
    fetchProjects();
  }
};

const shouldRenderProject = (index) => index === activeIndex.value || index === activeIndex.value + 1;

const handleProjectPlay = async (projectId) => {
  if (!projectId || readReportedIds.has(projectId)) return;

  readReportedIds.add(projectId);
  await ProjectRecommendationService.markProjectRead(projectId);
};

onMounted(() => {
  fetchProjects();
});
</script>

<style scoped>
.recommend-feed-container {
  /* Attempt to fill the remaining height in v-main */
  /* Fallback to calc(100vh - 64px) assuming standard header */
  height: calc(100dvh - 64px);
  width: 100%;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  background-color: #000;
  position: relative;
}

.feed-item {
  height: 100%;
  width: 100%;
  scroll-snap-align: start;
  position: relative;
}

.loading-indicator {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
}

.empty-state {
  height: 100%;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
