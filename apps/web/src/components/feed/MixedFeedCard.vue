<template>
  <div class="mixed-feed-card">
    <!-- Post Card -->
    <PostCard
      v-if="item.type === 'post'"
      :post="item.data"
      :includes="includes"
    />

    <!-- Project Card -->
    <div
      v-else-if="item.type === 'project'"
      class="project-card"
      @click="goToProject"
    >
      <div class="project-card-inner">
        <div class="project-thumbnail">
          <v-img
            :src="getProjectThumbnail(item.data)"
            :alt="item.data.title || item.data.name"
            cover
            height="100%"
            class="project-thumb-img"
          >
            <template #placeholder>
              <div class="thumb-placeholder">
                <v-icon size="32" color="grey-lighten-1">mdi-folder-outline</v-icon>
              </div>
            </template>
            <template #error>
              <div class="thumb-placeholder">
                <v-icon size="32" color="grey-lighten-1">mdi-folder-outline</v-icon>
              </div>
            </template>
          </v-img>
          <div class="project-type-badge">
            <v-icon size="14">{{ projectTypeIcon }}</v-icon>
            {{ projectTypeLabel }}
          </div>
        </div>
        <div class="project-info">
          <div class="project-header">
            <h3 class="project-title">{{ item.data.title || item.data.name }}</h3>
            <v-chip
              v-if="item.data.type"
              size="x-small"
              variant="tonal"
              color="primary"
              class="project-chip"
            >
              {{ projectTypeLabel }}
            </v-chip>
          </div>
          <p v-if="item.data.description" class="project-desc">
            {{ item.data.description }}
          </p>
          <div class="project-meta">
            <router-link
              v-if="item.data.author"
              :to="`/${item.data.author.username}`"
              class="project-author"
              @click.stop
            >
              <v-avatar size="20" class="author-mini-avatar">
                <v-img :src="getAvatarUrl(item.data.author.avatarURL || item.data.author.avatar)" />
              </v-avatar>
              <span class="author-name">{{ item.data.author.display_name || item.data.author.username }}</span>
            </router-link>
            <div class="project-stats">
              <span class="stat-item">
                <v-icon size="14">mdi-star-outline</v-icon>
                {{ item.data.star_count || 0 }}
              </span>
              <span class="stat-item">
                <v-icon size="14">mdi-eye-outline</v-icon>
                {{ item.data.view_count || 0 }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- User Card -->
    <div
      v-else-if="item.type === 'user'"
      class="user-card"
    >
      <div class="user-card-inner">
        <router-link :to="`/${item.data.username}`" class="user-link">
          <v-avatar size="48" class="user-avatar">
            <v-img :src="getAvatarUrl(item.data.avatarURL || item.data.avatar)" />
          </v-avatar>
          <div class="user-info">
            <div class="user-name">{{ item.data.display_name || item.data.username }}</div>
            <div class="user-handle">@{{ item.data.username }}</div>
            <div v-if="item.data.bio || item.data.motto" class="user-bio">
              {{ item.data.bio || item.data.motto }}
            </div>
          </div>
        </router-link>
        <v-btn
          class="follow-btn"
          size="small"
          rounded="pill"
          :variant="isFollowing ? 'outlined' : 'flat'"
          :color="isFollowing ? 'default' : 'primary'"
          :loading="followLoading"
          @click="toggleFollow"
        >
          {{ isFollowing ? '已关注' : '关注' }}
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { localuser } from '@/services/localAccount';
import { getS3staticurl } from '@/services/projectService';
import PostCard from '@/components/posts/PostCard.vue';
import axios from '@/axios/axios';
import { showSnackbar } from '@/composables/useNotifications';

const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
  includes: {
    type: Object,
    default: () => ({ posts: {} }),
  },
});

const router = useRouter();
const isLogin = computed(() => localuser.isLogin.value);

// Follow state for user cards
const isFollowing = ref(false);
const followLoading = ref(false);

// Check follow status on mount for user cards
onMounted(async () => {
  if (props.item.type === 'user' && isLogin.value) {
    try {
      const res = await axios.get(`/follows/relationships/${props.item.data.id}`);
      isFollowing.value = Boolean(res.data?.data?.isFollowing);
    } catch {
      // ignore
    }
  }
});

const toggleFollow = async () => {
  if (!isLogin.value) {
    router.push('/app/account/login');
    return;
  }
  followLoading.value = true;
  try {
    if (isFollowing.value) {
      await axios.delete(`/follows/${props.item.data.id}`);
      isFollowing.value = false;
      showSnackbar(`已取消关注 @${props.item.data.username}`, 'info');
    } else {
      await axios.post(`/follows/${props.item.data.id}`);
      isFollowing.value = true;
      showSnackbar(`已关注 @${props.item.data.username}`, 'success');
    }
  } catch (e) {
    showSnackbar(e?.response?.data?.message || '关注操作失败', 'error');
  } finally {
    followLoading.value = false;
  }
};

const getAvatarUrl = (avatar) => {
  try {
    return localuser.getUserAvatar(avatar);
  } catch {
    return '/default-avatar.png';
  }
};

const getProjectThumbnail = (project) => {
  if (project.thumbnail) {
    return getS3staticurl(project.thumbnail);
  }
  return '';
};

const projectTypeIcon = computed(() => {
  const type = props.item.data?.type;
  if (type === 'scratch') return 'mdi-language-scratch';
  if (type === 'python') return 'mdi-language-python';
  if (type === 'article') return 'mdi-file-document-outline';
  return 'mdi-code-braces';
});

const projectTypeLabel = computed(() => {
  const type = props.item.data?.type;
  if (type === 'scratch') return 'Scratch';
  if (type === 'python') return 'Python';
  if (type === 'article') return '文章';
  if (type === 'text') return '文本';
  return '作品';
});

const goToProject = () => {
  const project = props.item.data;
  if (project.author?.username && project.name) {
    router.push(`/${project.author.username}/${project.name}`);
  }
};
</script>

<style scoped>
.mixed-feed-card {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.06);
}

/* ==================== Project Card ==================== */
.project-card {
  padding: 16px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.project-card:hover {
  background: rgba(var(--v-theme-on-surface), 0.03);
}

.project-card-inner {
  display: flex;
  gap: 14px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 14px;
  overflow: hidden;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}

.project-card:hover .project-card-inner {
  border-color: rgba(var(--v-theme-primary), 0.25);
  box-shadow: 0 2px 12px rgba(var(--v-theme-primary), 0.08);
}

.project-thumbnail {
  width: 140px;
  min-height: 120px;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
  background: rgba(var(--v-theme-on-surface), 0.04);
}

.project-thumb-img {
  width: 100%;
  height: 100%;
}

.thumb-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 120px;
  background: rgba(var(--v-theme-on-surface), 0.04);
}

.project-type-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(8px);
  border-radius: 6px;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
}

.project-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 12px 14px 12px 0;
}

.project-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.project-title {
  font-size: 15px;
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface));
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.project-chip {
  flex-shrink: 0;
}

.project-desc {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  line-height: 1.45;
  margin: 0 0 10px;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.project-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.project-author {
  display: flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  color: rgba(var(--v-theme-on-surface), 0.7);
  font-size: 13px;
  transition: color 0.15s;
}

.project-author:hover {
  color: rgb(var(--v-theme-primary));
}

.author-mini-avatar {
  flex-shrink: 0;
}

.author-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-stats {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.55);
}

/* ==================== User Card ==================== */
.user-card {
  padding: 16px;
}

.user-card-inner {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 14px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.user-card:hover .user-card-inner {
  border-color: rgba(var(--v-theme-primary), 0.2);
  box-shadow: 0 2px 12px rgba(var(--v-theme-primary), 0.06);
}

.user-link {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex: 1;
  min-width: 0;
  text-decoration: none;
  color: inherit;
}

.user-avatar {
  flex-shrink: 0;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 15px;
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface));
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-handle {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  line-height: 1.3;
}

.user-bio {
  margin-top: 4px;
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.72);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.follow-btn {
  flex-shrink: 0;
  min-width: 72px;
  margin-top: 2px;
  font-weight: 600;
}

/* ==================== Responsive ==================== */
@media (max-width: 600px) {
  .project-thumbnail {
    width: 100px;
    min-height: 90px;
  }

  .project-type-badge {
    display: none;
  }

  .project-info {
    padding: 10px 10px 10px 0;
  }

  .project-title {
    font-size: 14px;
  }

  .project-desc {
    font-size: 12px;
    -webkit-line-clamp: 1;
  }
}
</style>
