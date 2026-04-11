<template>
  <v-card class="mt-4">
    <v-tabs v-model="tab" bg-color="surface" color="primary">
      <v-tab value="context">猜你喜欢</v-tab>
      <v-tab value="similar">相似作品</v-tab>
    </v-tabs>
    <v-divider />

    <v-card-text>
      <v-window v-model="tab">
        <v-window-item value="context">
          <div v-if="contextLoading" class="d-flex justify-center py-4">
            <v-progress-circular indeterminate color="primary" />
          </div>
          <div v-else-if="contextError" class="text-center text-error py-4">
            {{ contextError }}
            <v-btn variant="text" color="primary" @click="fetchContext" class="ml-2">重试</v-btn>
          </div>
          <div v-else-if="!contextProjects.length" class="text-center text-medium-emphasis py-4">
            暂无推荐内容
          </div>
          <template v-else>
             <v-row>
               <v-col v-for="project in contextProjects" :key="project.id" cols="12">
                 <ProjectCard :project="project" :show-author="true" :author="project.author" />
               </v-col>
             </v-row>
             <div class="d-flex justify-center mt-4" v-if="contextHasMore">
               <v-btn :loading="contextLoadingMore" variant="text" @click="loadMoreContext">加载更多</v-btn>
             </div>
          </template>
        </v-window-item>

        <v-window-item value="similar">
          <div v-if="similarLoading" class="d-flex justify-center py-4">
            <v-progress-circular indeterminate color="primary" />
          </div>
          <div v-else-if="similarError" class="text-center text-error py-4">
            {{ similarError }}
            <v-btn variant="text" color="primary" @click="fetchSimilar" class="ml-2">重试</v-btn>
          </div>
           <div v-else-if="!similarProjects.length" class="text-center text-medium-emphasis py-4">
            暂无相似作品
          </div>
          <template v-else>
             <v-row>
               <v-col v-for="project in similarProjects" :key="project.id" cols="12">
                 <ProjectCard :project="project" :show-author="true" :author="project.author" />
               </v-col>
             </v-row>
             <div class="d-flex justify-center mt-4" v-if="similarHasMore">
               <v-btn :loading="similarLoadingMore" variant="text" @click="loadMoreSimilar">加载更多</v-btn>
             </div>
          </template>
        </v-window-item>
      </v-window>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import ProjectRecommendationService from '@/services/projectRecommendationService';
import ProjectCard from '@/components/project/ProjectCard.vue';

const props = defineProps({
  projectId: {
    type: [Number, String],
    required: true,
  },
});

const tab = ref('context');

// Context Recommendation State
const contextProjects = ref([]);
const contextLoading = ref(false);
const contextLoadingMore = ref(false);
const contextError = ref(null);
const contextOffset = ref(0);
const contextHasMore = ref(true);
const limit = 12; // Use smaller limit for panel

// Similar Projects State
const similarProjects = ref([]);
const similarLoading = ref(false);
const similarLoadingMore = ref(false);
const similarError = ref(null);
const similarOffset = ref(0);
const similarHasMore = ref(true);

const fetchContext = async (loadMore = false) => {
  if (loadMore) {
    contextLoadingMore.value = true;
  } else {
    contextLoading.value = true;
    contextOffset.value = 0;
    contextProjects.value = [];
  }
  contextError.value = null;

  try {
    const res = await ProjectRecommendationService.getContextRecommendations(props.projectId, {
      limit,
      offset: contextOffset.value,
      min_similarity: 0.6,
    });

    // Check for "not ready" message but success status
    if (res.data?.projects?.length === 0 && res.data?.message?.includes('向量')) {
       // Ideally we might want to poll or just show empty for now with message
       // But user req says handled by frontend? Just standard fallback.
    }

    const newProjects = res.data?.projects || [];
    if (loadMore) {
      contextProjects.value.push(...newProjects);
    } else {
      contextProjects.value = newProjects;
    }

    contextHasMore.value = res.data?.has_more ?? (newProjects.length >= limit);
    contextOffset.value += limit;

  } catch (err) {
    contextError.value = err.message;
  } finally {
    contextLoading.value = false;
    contextLoadingMore.value = false;
  }
};

const fetchSimilar = async (loadMore = false) => {
  if (loadMore) {
    similarLoadingMore.value = true;
  } else {
    similarLoading.value = true;
    similarOffset.value = 0;
    similarProjects.value = [];
  }
  similarError.value = null;

  try {
    const res = await ProjectRecommendationService.getSimilarProjects(props.projectId, {
      limit,
      offset: similarOffset.value,
    });

    const newProjects = res.data?.projects || [];
    if (loadMore) {
      similarProjects.value.push(...newProjects);
    } else {
      similarProjects.value = newProjects;
    }
    similarHasMore.value = res.data?.has_more ?? (newProjects.length >= limit);
    similarOffset.value += limit;

  } catch (err) {
    similarError.value = err.message;
  } finally {
    similarLoading.value = false;
    similarLoadingMore.value = false;
  }
};

const loadMoreContext = () => fetchContext(true);
const loadMoreSimilar = () => fetchSimilar(true);

// Watch for tab and projectId changes
watch(() => props.projectId, () => {
  if (tab.value === 'context') fetchContext();
  else fetchSimilar();
});

watch(tab, (newTab) => {
  if (newTab === 'context' && !contextProjects.value.length && !contextLoading.value) {
    fetchContext();
  } else if (newTab === 'similar' && !similarProjects.value.length && !similarLoading.value) {
    fetchSimilar();
  }
});

onMounted(() => {
  // Initial fetch based on default tab
  fetchContext(); // Default is context
});
</script>
