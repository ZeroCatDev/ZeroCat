<template>
  <div class="feed-card-container">
    <!-- Content Area (Player or Thumbnail) -->
    <div class="content-wrapper">
      <div v-if="isPlaying" class="player-container">
        <ProjectPlayer
          :project-id="project.id"
          :type="project.type || 'scratch'"
          :branch="'main'"
          :commit-id="'latest'"
          :showplayer="true"
          class="player-instance"
        />
      </div>

      <v-img
        v-else
        :src="getS3staticurl(project.thumbnail)"
        cover
        class="feed-thumbnail"
        @click="togglePlay"
      >
        <div class="play-overlay d-flex justify-center align-center fill-height">
          <v-btn icon="mdi-play" size="x-large" variant="text" color="white" class="play-button" />
        </div>
      </v-img>
    </div>

    <!-- Info Overlay -->
    <div class="info-overlay" :class="{ 'is-playing': isPlaying }">
      <div class="d-flex align-center mb-2 pointer-events-auto" @click.stop="navigateToProject">
        <h2 class="text-h6 text-white font-weight-bold mr-2 text-shadow">{{ project.title }}</h2>
        <v-icon icon="mdi-chevron-right" color="white" />
      </div>

      <div class="d-flex align-center mb-2 pointer-events-auto" @click.stop="navigateToAuthor">
        <v-avatar size="24" class="mr-2" :image="localuser.getUserAvatar(project.author?.avatar)"></v-avatar>
        <span class="text-subtitle-2 text-white font-weight-bold text-shadow">@{{ project.author?.display_name || project.author?.username }}</span>
      </div>

      <p class="text-body-2 text-white mb-2 text-truncate-2 text-shadow" style="max-width: 80%">
        {{ project.description || '暂无描述' }}
      </p>

      <div class="d-flex flex-wrap gap-2 mb-4 pointer-events-auto">
        <v-chip
          v-for="tag in (project.project_tags || [])"
          :key="tag.id"
          size="small"
          variant="outlined"
          color="white"
          class="mr-2 mb-1 bg-black-alpha"
          @click.stop="navigateToTag(tag.name)"
        >
          #{{ tag.name }}
        </v-chip>
      </div>
    </div>

    <!-- Right Actions Bar -->
    <div class="actions-overlay d-flex flex-column align-center">
      <div class="action-item mb-6">
        <v-avatar size="48" border class="pointer-events-auto" @click.stop="navigateToAuthor">
          <v-img :src="localuser.getUserAvatar(project.author?.avatar)" cover />
        </v-avatar>
        <transition name="scale">
          <v-btn
            v-if="!isFollowing && localuser.user.value?.id !== project.author?.id"
            icon="mdi-plus"
            color="primary"
            size="x-small"
            class="follow-badge rounded-circle"
            :loading="followLoading"
            @click.stop="toggleFollow"
            style="width: 20px; height: 20px; min-width: 0;"
          />
          <v-icon
            v-else-if="isFollowing"
            icon="mdi-check-circle"
            color="success"
            class="follow-badge bg-white rounded-circle"
            size="20"
            @click.stop="toggleFollow"
          />
        </transition>
      </div>

      <div class="action-item mb-4">
        <v-btn
          :icon="isStarred ? 'mdi-heart' : 'mdi-heart-outline'"
          variant="text"
          :color="isStarred ? 'red' : 'white'"
          size="large"
          class="text-shadow"
          :class="{ 'heart-beat': isStarred }"
          @click.stop="toggleStar"
        />
        <span class="text-caption text-white font-weight-bold text-shadow">{{ starCount }}</span>
      </div>

      <div class="action-item mb-4">
        <v-btn icon="mdi-comment-processing-outline" variant="text" color="white" size="large" class="text-shadow" @click.stop="navigateToProject" />
        <span class="text-caption text-white font-weight-bold text-shadow">评论</span>
      </div>

      <div class="action-item mb-4">
        <v-btn icon="mdi-share" variant="text" color="white" size="large" class="text-shadow" @click.stop="shareProject" />
        <span class="text-caption text-white font-weight-bold text-shadow">分享</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import ProjectPlayer from '@/components/project/ProjectPlayer.vue';
import { getS3staticurl } from '@/services/projectService';
import { localuser } from "@/services/localAccount";
import {
  checkStarStatus,
  starProject,
  unstarProject,
  getProjectStarCount
} from "@/services/projectListService";
import request from "@/axios/axios";

const props = defineProps({
  project: {
    type: Object,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['play']);

const router = useRouter();
const isPlaying = ref(false);

const togglePlay = () => {
  const willPlay = !isPlaying.value;
  isPlaying.value = willPlay;

  if (willPlay && props.project?.id) {
    emit('play', props.project.id);
  }
};

const navigateToProject = () => {
  if (props.project.author?.username && props.project.name) {
    router.push(`/${props.project.author.username}/${props.project.name}`);
  }
};

const navigateToAuthor = () => {
  if (props.project.author?.username) {
    router.push(`/${props.project.author.username}`);
  }
};

const navigateToTag = (tagName) => {
  if (tagName) {
    router.push(`/app/projects/tag/${tagName}`);
  }
};

// Interaction State
const isStarred = ref(false);
const starCount = ref(0);
const starLoading = ref(false);

const isFollowing = ref(false);
const followLoading = ref(false);

const checkStar = async () => {
  if (!props.project.id) return;

  // Set initial count from props if available
  if (props.project.star_count !== undefined) {
    starCount.value = props.project.star_count;
  }

  // Get fresh count
  try {
    const countRes = await getProjectStarCount(props.project.id);
    if (countRes?.status === "success") {
      starCount.value = countRes.data;
    }
  } catch (e) {
    console.error("Failed to get star count", e);
  }

  // Check if starred by current user
  if (localuser.isLogin.value) {
    try {
      const statusRes = await checkStarStatus(props.project.id);
      if (statusRes?.status === "success") {
        isStarred.value = statusRes.star;
      }
    } catch (e) {
      console.error("Failed to check star status", e);
    }
  }
};

const toggleStar = async () => {
  if (!localuser.isLogin.value) {
    // Redirect to login or show sync/login modal?
    // For now, maybe just do nothing or show toast (if toast available)
    // Or redirect:
    router.push('/login');
    return;
  }

  if (starLoading.value) return;
  starLoading.value = true;

  // Optimistic update
  const originalStarred = isStarred.value;
  const originalCount = starCount.value;

  isStarred.value = !isStarred.value;
  starCount.value = isStarred.value ? starCount.value + 1 : Math.max(0, starCount.value - 1);

  try {
    const action = originalStarred ? unstarProject : starProject;
    const res = await action(props.project.id);
    if (res?.status !== "success") {
      throw new Error(res?.message);
    }
  } catch (e) {
    // Revert
    isStarred.value = originalStarred;
    starCount.value = originalCount;
    console.error("Star toggle failed", e);
  } finally {
    starLoading.value = false;
  }
};

const checkFollow = async () => {
  if (!localuser.isLogin.value || !props.project.author?.id) return;
  // Don't check follow for self
  if (localuser.user.value?.id === props.project.author.id) return;

  try {
    const response = await request.get(`/follows/check/${props.project.author.id}`);
    if (response.data.success) {
      isFollowing.value = response.data.data.isFollowing;
    }
  } catch (e) {
    console.error("Check follow failed", e);
  }
};

const toggleFollow = async () => {
  if (!localuser.isLogin.value) {
    router.push('/login');
    return;
  }
  if (!props.project.author?.id) return;

  if (followLoading.value) return;
  followLoading.value = true;

  // Optimistic update
  const originalFollowing = isFollowing.value;
  isFollowing.value = !isFollowing.value;

  try {
    if (originalFollowing) {
      await request.delete(`/follows/${props.project.author.id}`);
    } else {
      await request.post(`/follows/${props.project.author.id}`);
    }
  } catch (e) {
    isFollowing.value = originalFollowing;
    console.error("Follow toggle failed", e);
  } finally {
    followLoading.value = false;
  }
};

const shareProject = async () => {
  const shareData = {
    title: props.project.title,
    text: props.project.description || `查看 ${props.project.author?.display_name || '用户'} 的作品`,
    url: window.location.origin + `/${props.project.author?.username}/${props.project.name}`,
  };

  try {
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(shareData.url);
      // Optional: Show toast "Link copied"
      alert('链接已复制到剪贴板');
    }
  } catch (err) {
    console.error('Share failed:', err);
  }
};

onMounted(() => {
  checkStar();
  checkFollow();
});

watch(() => props.project.id, () => {
  isPlaying.value = false;
  checkStar();
  checkFollow();
});

watch(() => props.isActive, (isActive) => {
  if (!isActive && isPlaying.value) {
    isPlaying.value = false;
  }
}, { immediate: true });

</script>

<style scoped>
.feed-card-container {
  position: relative;
  --frame-width: min(100vw, calc(100dvh * 4 / 3));
  width: 100%;
  height: 100%;
  background: #000;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}

.content-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}

.player-container {
  width: 100%;
  height: 100%;
  /* Ensure player fits nicely - use contain or cover strategy depending on pref */
  display: flex;
  justify-content: center;
  align-items: center;
  background: black;
}

/* Adjust ProjectPlayer sizing if possible via deep selection or props */
:deep(.v-card) {
  width: min(100vw, calc(100vh * 4 / 3));
  max-width: 100%;
  border: none !important;
  background: transparent !important;
}

.feed-thumbnail {
  width: 100%;
  height: 100%;
  opacity: 0.8;
}

.play-overlay {
  background: rgba(0, 0, 0, 0.2);
}

.play-button {
  transform: scale(1.5);
  text-shadow: 0 2px 8px rgba(0,0,0,0.5);
}

.info-overlay {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: min(100%, var(--frame-width));
  padding: 20px clamp(12px, 2.4vw, 24px) 80px clamp(12px, 2.4vw, 24px);
  z-index: 5;
  pointer-events: none;
  position: absolute;
}

.info-overlay::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.86) 0%, rgba(0,0,0,0.38) 58%, rgba(0,0,0,0.1) 78%, transparent 100%);
  z-index: -1;
  opacity: 1;
  transition: opacity 0.35s ease;
}

.info-overlay.is-playing::before {
  opacity: 0;
}

.actions-overlay {
  position: absolute;
  bottom: 100px;
  right: calc((100% - min(100%, var(--frame-width))) / 2 + 12px);
  z-index: 10;
  width: 60px;
  pointer-events: none; /* Make container click-through */
}

@media (min-width: 1280px) {
  .info-overlay {
    padding-bottom: 92px;
  }

  .actions-overlay {
    bottom: 108px;
  }
}

.action-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  pointer-events: auto; /* Re-enable for items */
}

.follow-badge {
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
}

.heart-beat {
  animation: heart-beat 0.3s ease-in-out;
}

@keyframes heart-beat {
  0% { transform: scale(1); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}

.scale-enter-active,
.scale-leave-active {
  transition: transform 0.2s ease;
}

.scale-enter-from,
.scale-leave-to {
  transform: scale(0) translateX(-50%);
}

.text-shadow {
  text-shadow: 1px 1px 2px rgba(0,0,0,0.6);
}

.pointer-events-auto {
  pointer-events: auto;
  cursor: pointer;
}

.text-truncate-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.bg-black-alpha {
  background: rgba(0,0,0,0.4) !important;
  border-color: rgba(255,255,255,0.3) !important;
}
</style>
