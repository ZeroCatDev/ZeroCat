<template>
  <div
    class="quoted-post"
    :class="{
      'quoted-post--compact': compact,
      'quoted-post--deleted': isDeleted
    }"
  >
    <div v-if="isDeleted" class="quoted-deleted">
      <v-icon size="16" class="mr-1">mdi-alert-circle-outline</v-icon>
      此帖文不可用
    </div>

    <template v-else>
      <!-- 作者信息 -->
      <div class="quoted-header">
        <UserHoverCard :username="authorUsername" inline>
          <v-avatar size="20" class="quoted-avatar">
            <v-img :src="authorAvatar" :alt="authorUsername" />
          </v-avatar>
        </UserHoverCard>
        <UserHoverCard :username="authorUsername" inline>
          <span class="quoted-display-name">{{ authorDisplayName }}</span>
          <span class="quoted-username">@{{ authorUsername }}</span>
        </UserHoverCard>
        <span class="quoted-separator">·</span>
        <span class="quoted-time">{{ timeAgo }}</span>
      </div>

      <!-- 内容 -->
      <div class="quoted-content">
        {{ displayContent }}
      </div>

      <!-- 媒体预览 -->
      <div v-if="hasMedia && !compact" class="quoted-media">
        <v-img
          :src="firstMediaUrl"
          cover
          height="120"
          class="quoted-media-img"
        />
        <div v-if="mediaCount > 1" class="quoted-media-count">
          +{{ mediaCount - 1 }}
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { localuser } from '@/services/localAccount';
import UserHoverCard from '@/components/UserHoverCard.vue';

const props = defineProps({
  post: { type: Object, required: true },
  isDeleted: { type: Boolean, default: false },
  compact: { type: Boolean, default: false }
});

// Author
const author = computed(() => props.post?.author || props.post?.user || {});
const authorUsername = computed(() => author.value?.username ?? props.post?.username ?? 'unknown');
const authorDisplayName = computed(() =>
  author.value?.display_name ?? author.value?.displayName ?? authorUsername.value
);
const authorAvatar = computed(() => {
  const avatar = author.value?.avatar;
  if (!avatar) return '/default-avatar.png';
  return localuser.getUserAvatar(avatar);
});

// Time
const createdAt = computed(() =>
  props.post?.created_at ?? props.post?.createdAt ?? props.post?.time ?? props.post?.created
);

const timeAgo = computed(() => {
  if (!createdAt.value) return '';
  const date = new Date(createdAt.value);
  const now = new Date();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return '刚刚';
  if (minutes < 60) return `${minutes}分钟`;
  if (hours < 24) return `${hours}小时`;
  if (days < 7) return `${days}天`;

  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
});

// Content
const displayContent = computed(() => {
  const content = props.post?.content ?? '';
  if (props.compact && content.length > 100) {
    return content.slice(0, 100) + '...';
  }
  return content;
});

// Media
const mediaItems = computed(() => {
  const media = props.post?.media || props.post?.mediaAssets || props.post?.assets || [];
  return Array.isArray(media) ? media : [];
});

const hasMedia = computed(() => mediaItems.value.length > 0);
const mediaCount = computed(() => mediaItems.value.length);

const firstMediaUrl = computed(() => {
  const media = mediaItems.value[0];
  if (!media) return '';
  if (media.url) return media.url;
  if (media.md5) return localuser.getUserAvatar(media.md5);
  return media.src || media.href || '';
});
</script>

<style scoped>
.quoted-post {
  padding: 12px;
  background: transparent;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 16px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.quoted-post:hover {
  background: rgba(var(--v-theme-on-surface), 0.03);
}

.quoted-post--compact {
  padding: 10px 12px;
}

.quoted-post--deleted {
  opacity: 0.6;
}

.quoted-deleted {
  display: flex;
  align-items: center;
  font-size: 14px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.quoted-header {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}

.quoted-avatar {
  flex-shrink: 0;
}

.quoted-display-name {
  font-size: 14px;
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.quoted-username {
  font-size: 14px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.quoted-separator {
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.quoted-time {
  font-size: 14px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  white-space: nowrap;
}

.quoted-content {
  font-size: 15px;
  line-height: 1.4;
  color: rgb(var(--v-theme-on-surface));
  word-break: break-word;
  white-space: pre-wrap;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.quoted-post--compact .quoted-content {
  font-size: 14px;
  -webkit-line-clamp: 2;
}

.quoted-media {
  position: relative;
  margin-top: 8px;
  border-radius: 12px;
  overflow: hidden;
}

.quoted-media-img {
  width: 100%;
}

.quoted-media-count {
  position: absolute;
  bottom: 8px;
  right: 8px;
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  font-size: 13px;
  font-weight: 500;
  border-radius: 4px;
}
</style>
