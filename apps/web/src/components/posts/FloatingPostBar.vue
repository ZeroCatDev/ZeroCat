<template>
  <PostComposer
    ref="composerRef"
    floating
    :floating-visible="floatingVisible"
    v-model:floating-expanded="isExpanded"
    :submit="handleSubmit"
    :initial-embed="currentEmbed"
    :placeholder="currentPlaceholder"
    @submitted="onSubmitted"
  >
    <!-- 快捷嵌入菜单 -->
    <template #embed-quick>
      <div v-if="detectedContext" class="embed-quick-section">
        <div class="embed-quick-label">当前页面</div>
        <v-btn
          block
          variant="tonal"
          :color="isCurrentContextEmbedded ? 'success' : 'primary'"
          class="embed-quick-btn"
          :loading="contextLoading"
          @click="toggleContextEmbed"
        >
          <v-icon start size="18">{{ contextIcon }}</v-icon>
          <span class="embed-quick-text">{{ contextDescription }}</span>
          <v-icon v-if="isCurrentContextEmbedded" end size="18">mdi-check</v-icon>
        </v-btn>
      </div>

      <v-btn
        block
        variant="outlined"
        class="mb-3"
        @click="embedCurrentUrl"
      >
        <v-icon start size="18">mdi-link</v-icon>
        嵌入当前 URL
      </v-btn>

      <v-divider class="mb-3" />
    </template>
  </PostComposer>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { localuser } from '@/services/localAccount';
import { getProjectInfoByNamespace } from '@/services/projectService';
import PostsService from '@/services/postsService';
import { showSnackbar } from '@/composables/useNotifications';
import { floatingPostBarExpanded, floatingPostBarConfig, resetFloatingPostBarConfig } from '@/composables/useFloatingPostBar';
import PostComposer from './PostComposer.vue';
import axios from '@/axios/axios';

const route = useRoute();
const router = useRouter();

// Refs
const composerRef = ref(null);

// State
const isExpanded = floatingPostBarExpanded;
const externalConfig = floatingPostBarConfig;
const shouldHide = ref(false);
const currentEmbed = ref(null);
const currentPlaceholder = ref('有什么新鲜事？');

// Context detection
const detectedContext = ref(null);
const contextLoading = ref(false);
const autoEmbeddedContextKey = ref(null);

// Auth & Visibility
const isLogin = computed(() => localuser.isLogin.value);
const floatingVisible = computed(() => isLogin.value && !shouldHide.value);

// Context computed
const contextIcon = computed(() => {
  if (!detectedContext.value) return 'mdi-link';
  if (detectedContext.value.type === 'project') return 'mdi-cube-outline';
  if (detectedContext.value.type === 'article') return 'mdi-file-document-outline';
  return 'mdi-account';
});

const contextDescription = computed(() => {
  if (!detectedContext.value) return '';
  if (detectedContext.value.type === 'project') {
    let desc = `${detectedContext.value.username}/${detectedContext.value.projectname}`;
    if (detectedContext.value.commit) {
      desc += ` @ ${detectedContext.value.commit.slice(0, 7)}`;
    } else if (detectedContext.value.branch && detectedContext.value.branch !== 'main') {
      desc += ` (${detectedContext.value.branch})`;
    }
    return desc;
  }
  if (detectedContext.value.type === 'article') {
    return `${detectedContext.value.username}/articles/${detectedContext.value.slug}`;
  }
  return `@${detectedContext.value.username}`;
});

const contextKey = computed(() => {
  if (!detectedContext.value) return null;
  const ctx = detectedContext.value;
  if (ctx.type === 'project') {
    return `project:${ctx.username}/${ctx.projectname}:${ctx.branch || ''}:${ctx.commit || ''}`;
  }
  if (ctx.type === 'article') {
    return `article:${ctx.username}/${ctx.slug}`;
  }
  return `user:${ctx.username}`;
});

const isCurrentContextEmbedded = computed(() => {
  if (!currentEmbed.value || !contextKey.value) return false;
  return autoEmbeddedContextKey.value === contextKey.value;
});

// Parse route context
const parseRouteContext = () => {
  const path = route.path;
  const segments = path.split('/').filter(Boolean);
  const skipPaths = ['app', 'login', 'register', 'settings', 'admin', 'api'];

  if (segments.length === 0 || skipPaths.includes(segments[0])) {
    detectedContext.value = null;
    return;
  }

  if (segments.length >= 4 && segments[2] === 'commit') {
    detectedContext.value = { type: 'project', username: segments[0], projectname: segments[1], commit: segments[3], branch: null };
  } else if (segments.length >= 4 && segments[2] === 'tree') {
    detectedContext.value = { type: 'project', username: segments[0], projectname: segments[1], branch: segments[3], commit: null };
  } else if (segments.length >= 3 && segments[1] === 'articles') {
    detectedContext.value = { type: 'article', username: segments[0], slug: segments[2] };
  } else if (segments.length === 2) {
    detectedContext.value = { type: 'project', username: segments[0], projectname: segments[1], branch: null, commit: null };
  } else if (segments.length === 1 && !skipPaths.includes(segments[0])) {
    detectedContext.value = { type: 'user', username: segments[0] };
  } else {
    detectedContext.value = null;
  }
};

// Auto embed context
const autoEmbedContext = async () => {
  if (!detectedContext.value || !contextKey.value) return;
  if (currentEmbed.value && autoEmbeddedContextKey.value !== contextKey.value) return;

  contextLoading.value = true;
  try {
    await embedContextInternal();
    autoEmbeddedContextKey.value = contextKey.value;
  } finally {
    contextLoading.value = false;
  }
};

const embedContextInternal = async () => {
  if (!detectedContext.value) return;

  if (detectedContext.value.type === 'project') {
    const projectRes = await getProjectInfoByNamespace(detectedContext.value.username, detectedContext.value.projectname);
    const projectId = projectRes?.data?.id || projectRes?.id;
    if (projectId) {
      const embed = { type: 'project', id: projectId };
      if (detectedContext.value.branch && detectedContext.value.branch !== 'main') embed.branch = detectedContext.value.branch;
      if (detectedContext.value.commit) embed.commit = detectedContext.value.commit;
      currentEmbed.value = embed;
    }
  } else if (detectedContext.value.type === 'article') {
    const articleRes = await getProjectInfoByNamespace(detectedContext.value.username, detectedContext.value.slug);
    const article = articleRes?.data || articleRes;
    if (article?.id && article?.type === 'article') {
      currentEmbed.value = {
        type: 'article',
        id: article.id,
        username: article.author?.username || detectedContext.value.username,
        slug: article.name || detectedContext.value.slug,
      };
    }
  } else if (detectedContext.value.type === 'user') {
    try {
      const res = await axios.get(`/user/name/${detectedContext.value.username}`);
      const userData = res.data?.data;
      if (userData?.id) {
        currentEmbed.value = { type: 'user', id: userData.id, username: userData.username };
      }
    } catch { /* silent */ }
  }
};

const toggleContextEmbed = async () => {
  if (isCurrentContextEmbedded.value) {
    currentEmbed.value = null;
    autoEmbeddedContextKey.value = null;
  } else {
    contextLoading.value = true;
    try {
      await embedContextInternal();
      autoEmbeddedContextKey.value = contextKey.value;
    } finally {
      contextLoading.value = false;
    }
  }
};

const embedCurrentUrl = () => {
  currentEmbed.value = { type: 'url', url: window.location.href };
  autoEmbeddedContextKey.value = null;
};

// Submit
const handleSubmit = async (postData) => {
  await PostsService.createPost(postData);
  showSnackbar('发布成功', 'success');
  if (!route.path.startsWith('/app/posts')) {
    router.push('/app/posts');
  }
};

const onSubmitted = () => {
  currentEmbed.value = null;
  currentPlaceholder.value = '有什么新鲜事？';
  autoEmbeddedContextKey.value = null;
  resetFloatingPostBarConfig();
};

// Hide on certain pages
const checkShouldHide = () => {
  const hidePrefixes = ['/app/account/login', '/app/account/register', '/app/posts'];
  shouldHide.value = route.path === '/' || hidePrefixes.some(p => route.path.startsWith(p));
};

// Watch route
watch(() => route.path, () => {
  parseRouteContext();
  checkShouldHide();
  if (detectedContext.value && !currentEmbed.value) {
    autoEmbedContext();
  }
}, { immediate: true });

watch(floatingVisible, (visible) => {
  if (!visible && isExpanded.value) {
    isExpanded.value = false;
  }
});

// Watch for external config changes when expanded
watch(isExpanded, (expanded) => {
  if (expanded && externalConfig.value) {
    const config = externalConfig.value;
    // 应用外部传入的配置
    if (config.embed) {
      currentEmbed.value = config.embed;
      autoEmbeddedContextKey.value = null; // 不是自动检测的
    }
    if (config.placeholder) {
      currentPlaceholder.value = config.placeholder;
    }
    // 设置初始文本内容
    if (config.text && composerRef.value) {
      nextTick(() => {
        if (composerRef.value?.content !== undefined) {
          composerRef.value.content = config.text;
        }
      });
    }
  }
});

// Keyboard shortcuts
const handleKeydown = (e) => {
  if (e.key === 'Escape' && isExpanded.value) {
    isExpanded.value = false;
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
  if (detectedContext.value && !currentEmbed.value) {
    autoEmbedContext();
  }
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.embed-quick-section {
  margin-bottom: 12px;
}

.embed-quick-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  margin-bottom: 6px;
}

.embed-quick-btn {
  justify-content: flex-start;
  text-transform: none;
  font-weight: 500;
}

.embed-quick-text {
  flex: 1;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
