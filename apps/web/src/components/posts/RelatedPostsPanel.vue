<template>
  <PostList
    :items="posts"
    :includes="includes"
    :loading="loading"
    :loading-more="loadingMore"
    :has-more="hasMore"
    :embed-mode="compactEmbed ? 'compact' : 'full'"
    :context-project-route-base="projectRouteBase"
    :context-embed-data="requestEmbedData"
    :hide-current-context-base="hideCurrentContextBase"
    @load-more="loadMore"
    @deleted="removeFromList"
    @created="addToList"
    @updated="updatePost"
  />
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import PostList from './PostList.vue';
import PostsService from '@/services/postsService';
import { showSnackbar } from '@/composables/useNotifications';
import { buildRelatedEmbedData } from '@/utils/embedContext';

const props = defineProps({
  type: { type: String, required: true },
  id: { type: [String, Number], required: true },
  branch: { type: String, default: '' },
  commit: { type: String, default: '' },
  embedData: { type: Object, default: () => ({}) },
  cursor: { type: [String, Number], default: null },
  limit: { type: Number, default: 20 },
  includeReplies: { type: Boolean, default: false },
  compactEmbed: { type: Boolean, default: true },
  projectRouteBase: { type: String, default: '' },
  hideCurrentContextBase: { type: Boolean, default: false }
});

const posts = ref([]);
const includes = ref({ posts: {} });
const loading = ref(false);
const loadingMore = ref(false);
const hasMore = ref(true);
const nextCursor = ref(null);

const requestEmbedData = computed(() => buildRelatedEmbedData({
  type: props.type,
  id: props.id,
  branch: props.branch,
  commit: props.commit,
  embedData: props.embedData
}));

const canQuery = computed(() => {
  return Object.keys(requestEmbedData.value).length > 0;
});

const postIdOf = (post) => post?.id ?? post?.postId;

const mergeIncludePosts = (postMap) => {
  if (!postMap || typeof postMap !== 'object') return;
  Object.assign(includes.value.posts, postMap);
};

const upsertIncludePost = (post) => {
  const id = postIdOf(post);
  if (id === undefined || id === null) return;
  includes.value.posts[id] = post;
  includes.value.posts[String(id)] = post;
};

const resetState = () => {
  posts.value = [];
  includes.value = { posts: {} };
  hasMore.value = true;
  nextCursor.value = null;
};

const loadRelatedPosts = async (isInitial = false) => {
  if (!canQuery.value) {
    resetState();
    loading.value = false;
    loadingMore.value = false;
    return;
  }

  if (isInitial) {
    loading.value = true;
    resetState();
    if (props.cursor !== null && props.cursor !== undefined && `${props.cursor}` !== '') {
      nextCursor.value = props.cursor;
    }
  } else {
    loadingMore.value = true;
  }

  try {
    const res = await PostsService.getRelatedPosts({
      embedData: requestEmbedData.value,
      cursor: nextCursor.value || undefined,
      limit: props.limit,
      includeReplies: props.includeReplies
    });

    const fetchedPosts = Array.isArray(res.posts) ? res.posts : [];
    const fetchedIncludes = res.includes?.posts || {};

    if (isInitial) {
      posts.value = fetchedPosts;
      includes.value = { posts: { ...fetchedIncludes } };
    } else {
      posts.value.push(...fetchedPosts);
      mergeIncludePosts(fetchedIncludes);
    }

    nextCursor.value = res.nextCursor ?? null;
    hasMore.value = Boolean(res.hasMore);
  } catch (error) {
    if (isInitial) {
      resetState();
      hasMore.value = false;
    }
    showSnackbar(error?.message || '加载关联帖子失败', 'error');
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
};

const loadMore = () => {
  if (!hasMore.value || loading.value || loadingMore.value) return;
  loadRelatedPosts(false);
};

const removeFromList = (postId) => {
  posts.value = posts.value.filter((post) => postIdOf(post) !== postId);
};

const addToList = (data) => {
  const post = data?.post ?? data;
  const includePosts = data?.includes?.posts;

  if (includePosts) mergeIncludePosts(includePosts);
  if (!post) return;

  const id = postIdOf(post);
  if (id !== undefined && id !== null) {
    posts.value = posts.value.filter((item) => postIdOf(item) !== id);
  }
  posts.value.unshift(post);
  upsertIncludePost(post);
};

const updatePost = (post) => {
  const id = postIdOf(post);
  if (id === undefined || id === null) return;
  const index = posts.value.findIndex((item) => postIdOf(item) === id);
  if (index !== -1) {
    posts.value[index] = post;
  }
  upsertIncludePost(post);
};

watch(
  () => [
    props.includeReplies,
    props.limit,
    JSON.stringify(requestEmbedData.value)
  ],
  () => {
    loadRelatedPosts(true);
  },
  { immediate: true }
);
</script>
