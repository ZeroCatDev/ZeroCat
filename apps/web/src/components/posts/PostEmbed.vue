<template>
  <div class="post-embed-wrapper">
    <!-- 项目嵌入 - Scratch 作品直接显示播放器 -->
    <template v-if="embed.type === 'project'">
      <div
        class="post-embed post-embed--project"
        :class="{ 'post-embed--compact': compact }"
      >
        <!-- Scratch 项目：直接显示 ProjectPlayer -->
        <template v-if="isScratchProject && !compact">
          <div class="embed-player-wrapper">
            <ProjectPlayer
              :project-id="embed.id"
              :branch="embed.branch || 'main'"
              :commit-id="embed.commit || 'latest'"
              :showplayer="true"
              :type="projectData?.type || 'scratch'"
            />
          </div>
        </template>

        <!-- 非 Scratch 项目或 compact 模式：显示缩略图 -->
        <template v-else>
          <div class="embed-thumbnail-area" @click="handleClick">
            <div v-if="projectData?.thumbnail" class="embed-thumbnail-large">
              <v-img
                :src="getThumbnailUrl(projectData.thumbnail)"
                cover
                class="embed-thumbnail-img"
              >
                <template #placeholder>
                  <div class="d-flex align-center justify-center fill-height">
                    <v-progress-circular indeterminate size="24" width="2" />
                  </div>
                </template>
              </v-img>
            </div>
            <div v-else class="embed-thumbnail-placeholder">
              <v-icon size="48" color="primary">mdi-cube-outline</v-icon>
            </div>
          </div>
        </template>

        <!-- 项目信息栏 -->
        <div class="embed-info" @click="handleClick">
          <div class="embed-info-row">
            <div class="embed-info-left">
              <div class="embed-type-badge">
                <v-icon size="14">mdi-cube-outline</v-icon>
                <span>{{ projectTypeLabel }}</span>
              </div>
              <div class="embed-title">
                {{ projectData?.title || `项目 #${embed.id}` }}
              </div>
              <!-- 作者信息 -->
              <div v-if="projectData?.author" class="embed-author">
                <v-avatar size="18">
                  <v-img
                    v-if="projectData.author.avatar"
                    :src="getAvatarUrl(projectData.author.avatar)"
                  />
                  <v-icon v-else size="10">mdi-account</v-icon>
                </v-avatar>
                <span class="embed-author-name">{{
                  projectData.author.display_name || projectData.author.username
                }}</span>
              </div>
            </div>
            <div class="embed-info-right">
              <!-- 分支/提交信息 -->
              <div
                v-if="(embed.branch && embed.branch !== 'main') || embed.commit"
                class="embed-version-info"
              >
                <span
                  v-if="embed.branch && embed.branch !== 'main'"
                  class="embed-version-item"
                >
                  <v-icon size="12">mdi-source-branch</v-icon>
                  {{ embed.branch }}
                </span>
                <span v-if="embed.commit" class="embed-version-item">
                  <v-icon size="12">mdi-source-commit</v-icon>
                  {{ embed.commit.slice(0, 7) }}
                </span>
              </div>
              <v-icon class="embed-arrow" size="16">mdi-arrow-top-right</v-icon>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 列表嵌入 -->
    <template v-else-if="embed.type === 'list'">
      <div
        class="post-embed"
        :class="{ 'post-embed--compact': compact }"
        @click="handleClick"
      >
        <div class="embed-icon embed-icon--list">
          <v-icon size="20">mdi-format-list-bulleted</v-icon>
        </div>
        <div class="embed-content">
          <div class="embed-label">列表</div>
          <div class="embed-title">
            {{ listData?.name || `列表 #${embed.id}` }}
          </div>
          <div v-if="listData?.description" class="embed-description">
            {{ listData.description }}
          </div>
          <div v-if="listData?.itemCount" class="embed-meta">
            <span class="embed-meta-item">
              <v-icon size="14">mdi-file-document-outline</v-icon>
              {{ listData.itemCount }} 个项目
            </span>
          </div>
        </div>
        <v-icon class="embed-arrow" size="16">mdi-arrow-top-right</v-icon>
      </div>
    </template>

    <!-- 文章嵌入 -->
    <template v-else-if="embed.type === 'article'">
      <div
        class="post-embed"
        :class="{ 'post-embed--compact': compact }"
        @click="handleClick"
      >
        <div class="embed-icon embed-icon--list">
          <v-icon size="20">mdi-file-document-outline</v-icon>
        </div>
        <div class="embed-content">
          <div class="embed-label">文章</div>
          <div class="embed-title">
            {{ articleData?.title || `文章 #${embed.id}` }}
          </div>
          <div v-if="articleData?.description" class="embed-description">
            {{ articleData.description }}
          </div>
          <div v-if="articleData?.author?.username" class="embed-meta">
            <span class="embed-meta-item">
              <v-icon size="14">mdi-account-outline</v-icon>
              @{{ articleData.author.username }}
            </span>
          </div>
        </div>
        <v-icon class="embed-arrow" size="16">mdi-arrow-top-right</v-icon>
      </div>
    </template>

    <!-- 用户嵌入 -->
    <template v-else-if="embed.type === 'user'">
      <div
        class="user-embed-card"
        :class="{ 'user-embed-card--compact': compact }"
        @click="handleClick"
      >
        <!-- 背景装饰 -->
        <div class="user-embed-bg">
          <div class="user-embed-bg-pattern" />
        </div>

        <!-- 主内容区 -->
        <div class="user-embed-content">
          <!-- 头部：头像 + 关注按钮 -->
          <div class="user-embed-header">
            <v-avatar :size="compact ? 48 : 64" class="user-embed-avatar">
              <v-img
                v-if="userData?.avatar"
                :src="getAvatarUrl(userData.avatar)"
                cover
              />
              <v-icon v-else :size="compact ? 24 : 32">mdi-account</v-icon>
            </v-avatar>

            <v-btn
              v-if="!isSelf && !compact"
              :variant="isFollowingUser ? 'outlined' : 'flat'"
              :color="isFollowingUser ? 'default' : 'primary'"
              size="small"
              class="user-embed-follow-btn"
              :loading="userFollowLoading"
              @click.stop="toggleUserFollow"
            >
              {{ isFollowingUser ? "已关注" : "关注" }}
            </v-btn>
          </div>

          <!-- 用户信息 -->
          <div class="user-embed-info">
            <div class="user-embed-names">
              <span class="user-embed-display-name">
                {{
                  userData?.display_name ||
                  userData?.username ||
                  embed.username ||
                  `用户 #${embed.id}`
                }}
              </span>
              <v-icon
                v-if="userData?.role === 'admin'"
                size="16"
                color="primary"
                class="user-embed-badge"
              >
                mdi-check-decagram
              </v-icon>
            </div>
            <div class="user-embed-username">
              @{{ userData?.username || embed.username || embed.id }}
            </div>
          </div>

          <!-- 简介 -->
          <div v-if="userData?.bio && !compact" class="user-embed-bio">
            {{ userData.bio }}
          </div>

          <!-- 统计信息 -->
          <div v-if="!compact" class="user-embed-stats">
            <div class="user-embed-stat">
              <span class="user-embed-stat-value">{{
                formatStatNumber(userData?.following_count || 0)
              }}</span>
              <span class="user-embed-stat-label">正在关注</span>
            </div>
            <div class="user-embed-stat">
              <span class="user-embed-stat-value">{{
                formatStatNumber(userData?.followers_count || 0)
              }}</span>
              <span class="user-embed-stat-label">关注者</span>
            </div>
            <div v-if="userData?.project_count" class="user-embed-stat">
              <span class="user-embed-stat-value">{{
                formatStatNumber(userData.project_count)
              }}</span>
              <span class="user-embed-stat-label">作品</span>
            </div>
          </div>
        </div>

        <!-- 悬浮箭头 -->
        <v-icon class="user-embed-arrow" size="16">mdi-arrow-top-right</v-icon>
      </div>
    </template>

    <!-- URL 嵌入 -->
    <template v-else-if="embed.type === 'url'">
      <div
        class="post-embed post-embed--url"
        :class="{
          'post-embed--compact': compact,
          'post-embed--url-large': !compact,
        }"
        @click="handleClick"
      >
        <template v-if="!compact">
          <div v-if="urlImage" class="embed-url-hero">
            <v-img :src="urlImage" cover class="embed-url-hero-content">
              <template #placeholder>
                <div class="d-flex align-center justify-center fill-height">
                  <v-progress-circular indeterminate size="20" width="2" />
                </div>
              </template>
            </v-img>
          </div>
          <div v-else class="embed-url-hero embed-url-hero--placeholder">
            <v-icon size="44">mdi-link-variant</v-icon>
          </div>

          <div class="embed-url-body">
            <div class="embed-url-site">
              <v-img
                v-if="urlIcon"
                :src="urlIcon"
                aspect-ratio="1/1"
                :height="16"
                :width="16"
                style="flex: 0 0 auto !important"
              />
              <v-icon v-else size="14" class="embed-url-site-fallback"
                >mdi-web</v-icon
              >
              <span class="embed-url-site-name">{{ urlPublisher }}</span>
              <v-spacer />
              <v-icon class="embed-arrow" size="16">mdi-arrow-top-right</v-icon>
            </div>

            <div class="embed-title embed-title--url-large">{{ urlTitle }}</div>
            <div
              v-if="urlDescription"
              class="embed-description embed-description--url"
            >
              {{ urlDescription }}
            </div>
            <div v-else class="embed-url-path">{{ urlPath }}</div>
          </div>
        </template>

        <template v-else>
          <div class="embed-icon embed-icon--url">
            <v-img v-if="urlIcon" :src="urlIcon" class="embed-url-icon" />
            <v-icon v-else size="20">mdi-link-variant</v-icon>
          </div>

          <div class="embed-content embed-content--url">
            <div class="embed-label">{{ urlPublisher }}</div>
            <div class="embed-title">{{ urlTitle }}</div>
          </div>
          <v-icon class="embed-arrow" size="16">mdi-arrow-top-right</v-icon>
        </template>
      </div>
    </template>

    <!-- 未知类型 -->
    <template v-else>
      <div
        class="post-embed"
        :class="{ 'post-embed--compact': compact }"
        @click="handleClick"
      >
        <div class="embed-icon">
          <v-icon size="20">mdi-link-variant</v-icon>
        </div>
        <div class="embed-content">
          <div class="embed-label">链接</div>
          <div class="embed-title">{{ embed.type }} #{{ embed.id }}</div>
        </div>
        <v-icon class="embed-arrow" size="16">mdi-arrow-top-right</v-icon>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { localuser } from "@/services/localAccount";
import { getProjectInfo, getS3staticurl } from "@/services/projectService";
import axios from "@/axios/axios";
import ProjectPlayer from "@/components/project/ProjectPlayer.vue";

const props = defineProps({
  embed: { type: Object, required: true },
  compact: { type: Boolean, default: false },
});

const router = useRouter();

// Loaded data
const projectData = ref(null);
const listData = ref(null);
const articleData = ref(null);
const userData = ref(null);
const loading = ref(false);

// User follow state
const userFollowLoading = ref(false);
const isFollowingUser = ref(false);

// Check if viewing own profile
const isSelf = computed(() => {
  if (!localuser.isLogin.value || !userData.value?.id) return true;
  return Number(localuser.user.value?.id) === Number(userData.value.id);
});

// Computed properties
const isScratchProject = computed(() => {
  const type = projectData.value?.type || "scratch";
  return ["scratch", "scratch3", "scratch-clipcc"].includes(type);
});

const projectTypeLabel = computed(() => {
  const type = projectData.value?.type || "scratch";
  const labels = {
    scratch: "Scratch 作品",
    scratch3: "Scratch 作品",
    "scratch-clipcc": "Scratch (ClipCC) 作品",
    "scratch-extension": "扩展",
    python: "Python",
    javascript: "JavaScript",
    text: "文本",
  };
  return labels[type] || "项目";
});

// URL embed computed properties
const urlDomain = computed(() => {
  if (props.embed.type !== "url" || !props.embed.url) return "链接";
  try {
    const url = new URL(props.embed.url);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return "链接";
  }
});

const urlPublisher = computed(() => {
  if (props.embed.type !== "url") return "链接";
  return props.embed.publisher || urlDomain.value;
});

const urlTitle = computed(() => {
  if (props.embed.type !== "url" || !props.embed.url) return "";
  if (props.embed.title) return props.embed.title;
  try {
    const url = new URL(props.embed.url);
    if (!url.pathname || url.pathname === "/") {
      return url.hostname.replace(/^www\./, "");
    }

    const pathParts = url.pathname.split("/").filter(Boolean);
    if (pathParts.length > 0) {
      const tail = decodeURIComponent(pathParts[pathParts.length - 1]).replace(
        /[-_]/g,
        " ",
      );
      return tail || url.hostname.replace(/^www\./, "");
    }
    return url.hostname.replace(/^www\./, "");
  } catch {
    return props.embed.url;
  }
});

const urlDescription = computed(() => {
  if (props.embed.type !== "url") return "";
  return props.embed.description || "";
});

const urlImage = computed(() => {
  if (props.embed.type !== "url") return "";
  return "https://imageproxy.192325.xyz/?url=" + props.embed.image || "";
});

const urlIcon = computed(() => {
  if (props.embed.type !== "url") return "";
  return "https://imageproxy.192325.xyz/?url=" + props.embed.icon || "";
});

const urlPath = computed(() => {
  if (props.embed.type !== "url" || !props.embed.url) return "";
  try {
    const url = new URL(props.embed.url);
    const path = `${url.pathname}${url.search}`;
    return path && path !== "/" ? path : url.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
});

// Get URLs
const getAvatarUrl = (avatar) => localuser.getUserAvatar(avatar);
const getThumbnailUrl = (thumbnail) => getS3staticurl(thumbnail);

// Format number for stats
const formatStatNumber = (num) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 10000) return `${(num / 1000).toFixed(1)}K`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

// Toggle user follow
const toggleUserFollow = async () => {
  if (!localuser.isLogin.value) {
    router.push("/login");
    return;
  }
  if (!userData.value?.id) return;

  userFollowLoading.value = true;
  try {
    if (isFollowingUser.value) {
      await axios.delete(`/follows/${userData.value.id}`);
      isFollowingUser.value = false;
      if (userData.value.followers_count > 0) {
        userData.value.followers_count--;
      }
    } else {
      await axios.post(`/follows/${userData.value.id}`);
      isFollowingUser.value = true;
      userData.value.followers_count =
        (userData.value.followers_count || 0) + 1;
    }
  } catch (e) {
    console.error("Follow action failed:", e);
  } finally {
    userFollowLoading.value = false;
  }
};

// Check user follow status
const checkUserFollowStatus = async () => {
  if (!localuser.isLogin.value || !userData.value?.id || isSelf.value) return;
  try {
    const res = await axios.get(`/follows/relationships/${userData.value.id}`);
    const data = res.data?.data || res.data;
    isFollowingUser.value = data?.isFollowing || false;
  } catch {
    isFollowingUser.value = false;
  }
};

// Load embed data
const loadEmbedData = async () => {
  if (!props.embed?.id && !props.embed?.username) return;

  loading.value = true;
  try {
    switch (props.embed.type) {
      case "project":
        const projects = await getProjectInfo([props.embed.id]);
        if (projects?.length) {
          projectData.value = projects[0];
        }
        break;
      case "list":
        try {
          const res = await axios.get(
            `/projectlist/lists/listid/${props.embed.id}`,
          );
          if (res.data?.status === "success" && res.data?.data) {
            listData.value = {
              id: props.embed.id,
              name: res.data.data.title,
              description: res.data.data.description,
              itemCount: res.data.data.projects?.length || 0,
            };
          } else {
            listData.value = { id: props.embed.id };
          }
        } catch {
          listData.value = { id: props.embed.id };
        }
        break;
      case "article":
        const articles = await getProjectInfo([props.embed.id]);
        if (articles?.length) {
          articleData.value = articles[0];
        }
        break;
      case "user":
        // Fetch user data from API
        try {
          const endpoint = props.embed.id
            ? `/user/id/${props.embed.id}`
            : `/user/name/${props.embed.username}`;
          const res = await axios.get(endpoint);
          if (res.data?.status === "success" && res.data?.data) {
            userData.value = res.data.data;
            // Check follow status after loading user data
            checkUserFollowStatus();
          } else {
            userData.value = {
              id: props.embed.id,
              username: props.embed.username,
            };
          }
        } catch {
          userData.value = {
            id: props.embed.id,
            username: props.embed.username,
          };
        }
        break;
    }
  } catch (e) {
    console.error("Failed to load embed data:", e);
  } finally {
    loading.value = false;
  }
};

// Handle click - navigate to project page
const handleClick = () => {
  switch (props.embed.type) {
    case "project":
      if (projectData.value?.author?.username && projectData.value?.name) {
        router.push(
          `/${projectData.value.author.username}/${projectData.value.name}`,
        );
      } else {
        router.push(`/app/project/${props.embed.id}`);
      }
      break;
    case "list":
      router.push(`/app/projectlist/${props.embed.id}`);
      break;
    case "article":
      if (articleData.value?.author?.username && articleData.value?.name) {
        router.push(
          `/${articleData.value.author.username}/articles/${articleData.value.name}`,
        );
      } else if (props.embed.username && props.embed.slug) {
        router.push(`/${props.embed.username}/articles/${props.embed.slug}`);
      } else if (props.embed.id) {
        router.push(`/app/project/${props.embed.id}`);
      }
      break;
    case "user":
      if (userData.value?.username || props.embed.username) {
        router.push(`/${userData.value?.username || props.embed.username}`);
      } else {
        router.push(`/app/posts/user/${props.embed.id}`);
      }
      break;
    case "url":
      if (props.embed.url) {
        window.open(props.embed.url, "_blank", "noopener,noreferrer");
      }
      break;
  }
};

// Watch for embed changes
watch(() => props.embed, loadEmbedData, { immediate: true, deep: true });
</script>

<style scoped>
.post-embed-wrapper {
  width: 100%;
}

/* Base embed styles */
.post-embed {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(var(--v-theme-on-surface), 0.03);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.post-embed:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
  border-color: rgba(var(--v-theme-on-surface), 0.15);
}

.post-embed--compact {
  padding: 10px 12px;
}

/* Project embed - card style */
.post-embed--project {
  flex-direction: column;
  padding: 0;
  overflow: hidden;
  cursor: default;
}

/* Player wrapper - direct display */
.embed-player-wrapper {
  width: 100%;
  background: rgb(var(--v-theme-surface));
}

.embed-player-wrapper :deep(.v-card) {
  border-radius: 0 !important;
  border: none !important;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.1) !important;
}

/* Thumbnail area for non-scratch or compact */
.embed-thumbnail-area {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: rgba(var(--v-theme-on-surface), 0.05);
  overflow: hidden;
  cursor: pointer;
}

.post-embed--compact .embed-thumbnail-area {
  aspect-ratio: 4 / 3;
  max-height: 120px;
}

.embed-thumbnail-large {
  width: 100%;
  height: 100%;
  position: relative;
}

.embed-thumbnail-large .embed-thumbnail-img {
  width: 100%;
  height: 100%;
}

.embed-thumbnail-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    135deg,
    rgba(var(--v-theme-primary), 0.1) 0%,
    rgba(var(--v-theme-primary), 0.05) 100%
  );
}

/* Project info bar */
.embed-info {
  padding: 10px 14px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.embed-info:hover {
  background: rgba(var(--v-theme-on-surface), 0.03);
}

.post-embed--compact .embed-info {
  padding: 8px 12px;
}

.embed-info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.embed-info-left {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.embed-info-right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.embed-type-badge {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.1);
  border-radius: 4px;
}

.embed-info .embed-title {
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.post-embed--compact .embed-info .embed-title {
  font-size: 13px;
}

.embed-author {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 5px;
}

.embed-author-name {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  white-space: nowrap;
}

.embed-version-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.embed-version-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  padding: 2px 6px;
  background: rgba(var(--v-theme-on-surface), 0.05);
  border-radius: 4px;
}

/* Original embed styles for list/user/unknown */
.embed-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(var(--v-theme-primary), 0.1);
  border-radius: 8px;
}

.embed-icon .v-icon {
  color: rgb(var(--v-theme-primary));
}

.embed-icon--list {
  background: rgba(var(--v-theme-secondary), 0.1);
}

.embed-icon--list .v-icon {
  color: rgb(var(--v-theme-secondary));
}

.embed-icon--url {
  background: rgba(var(--v-theme-on-surface), 0.08);
}

.embed-icon--url .v-icon {
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.embed-url-icon {
  width: 20px;
  height: 20px;
  aspect-ratio: 1 / 1;
  min-width: 20px;
  min-height: 20px;
  max-height: 20px;
  border-radius: 4px;
  overflow: hidden;
  background: rgba(var(--v-theme-on-surface), 0.06);
}

.embed-content--url {
  display: flex;
  flex-direction: column;
}

.post-embed--url-large {
  flex-direction: column;
  align-items: stretch;
  gap: 0;
  padding: 0;
  overflow: hidden;
}

.embed-url-hero {
  width: 100%;
  aspect-ratio: 1.91 / 1;
  background: rgba(var(--v-theme-on-surface), 0.05);
  overflow: hidden;
}

.embed-url-hero-content {
  width: 100%;
  height: 100%;
}

.embed-url-hero--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(var(--v-theme-on-surface), 0.45);
}

.embed-url-body {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 14px;
}

.embed-url-site {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
  min-height: 16px;
}

.embed-url-site-icon {
  width: 16px;
  height: 16px;
  aspect-ratio: 1 / 1 !important;

  background: rgba(var(--v-theme-on-surface), 0.06);
}

.embed-url-site-fallback {
  color: rgba(var(--v-theme-on-surface), 0.5);
}

.embed-url-site-name {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.embed-title--url-large {
  font-size: 16px;
  line-height: 1.35;
}

.embed-description--url {
  -webkit-line-clamp: 2;
  margin-top: 4px;
}

.embed-url-path {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.post-embed--compact .embed-icon {
  width: 32px;
  height: 32px;
}

.embed-user-avatar {
  flex-shrink: 0;
  border: 2px solid rgba(var(--v-theme-on-surface), 0.1);
}

.embed-content {
  flex: 1;
  min-width: 0;
}

.embed-label {
  font-size: 12px;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
}

.post-embed--compact .embed-label {
  font-size: 11px;
}

.embed-title {
  font-size: 15px;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.post-embed--compact .embed-title {
  font-size: 14px;
  -webkit-line-clamp: 1;
}

.embed-username {
  font-size: 14px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-top: 2px;
}

.embed-description {
  font-size: 14px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  line-height: 1.4;
  margin-top: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.post-embed--compact .embed-description {
  display: none;
}

.embed-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.post-embed--compact .embed-meta {
  margin-top: 4px;
}

.embed-meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.embed-arrow {
  flex-shrink: 0;
  color: rgba(var(--v-theme-on-surface), 0.4);
}

/* User embed specific */
.post-embed--user {
  align-items: center;
}

/* Modern User Embed Card */
.user-embed-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
}

.user-embed-card:hover {
  border-color: rgba(var(--v-theme-primary), 0.3);
  box-shadow: 0 4px 20px rgba(var(--v-theme-primary), 0.08);
}

.user-embed-card--compact {
  flex-direction: row;
  align-items: center;
  padding: 12px 16px;
  gap: 12px;
}

/* Background decoration */
.user-embed-bg {
  position: relative;
  height: 60px;
  background: linear-gradient(
    135deg,
    rgba(var(--v-theme-primary), 0.15) 0%,
    rgba(var(--v-theme-primary), 0.05) 50%,
    rgba(var(--v-theme-secondary), 0.1) 100%
  );
  overflow: hidden;
}

.user-embed-card--compact .user-embed-bg {
  display: none;
}

.user-embed-bg-pattern {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(
      circle at 20% 80%,
      rgba(var(--v-theme-primary), 0.1) 0%,
      transparent 50%
    ),
    radial-gradient(
      circle at 80% 20%,
      rgba(var(--v-theme-secondary), 0.08) 0%,
      transparent 50%
    );
}

/* Main content area */
.user-embed-content {
  padding: 0 16px 16px;
  margin-top: -32px;
  position: relative;
}

.user-embed-card--compact .user-embed-content {
  padding: 0;
  margin-top: 0;
  flex: 1;
  min-width: 0;
}

/* Header with avatar and follow button */
.user-embed-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 12px;
}

.user-embed-card--compact .user-embed-header {
  display: contents;
}

.user-embed-avatar {
  border: 3px solid rgb(var(--v-theme-surface));
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

.user-embed-card--compact .user-embed-avatar {
  border-width: 2px;
  margin-right: 12px;
}

.user-embed-follow-btn {
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0;
  border-radius: 20px;
  padding: 0 16px;
  height: 32px !important;
  min-width: 80px;
}

.user-embed-follow-btn:hover {
  transform: scale(1.02);
}

/* User info section */
.user-embed-info {
  margin-bottom: 8px;
}

.user-embed-card--compact .user-embed-info {
  margin-bottom: 0;
}

.user-embed-names {
  display: flex;
  align-items: center;
  gap: 4px;
}

.user-embed-display-name {
  font-size: 17px;
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface));
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-embed-card--compact .user-embed-display-name {
  font-size: 15px;
}

.user-embed-badge {
  flex-shrink: 0;
}

.user-embed-username {
  font-size: 14px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-embed-card--compact .user-embed-username {
  font-size: 13px;
}

/* Bio section */
.user-embed-bio {
  font-size: 14px;
  line-height: 1.5;
  color: rgb(var(--v-theme-on-surface));
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Stats section */
.user-embed-stats {
  display: flex;
  gap: 16px;
}

.user-embed-stat {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.user-embed-stat-value {
  font-size: 14px;
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface));
}

.user-embed-stat-label {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

/* Arrow icon */
.user-embed-arrow {
  position: absolute;
  top: 12px;
  right: 12px;
  color: rgba(var(--v-theme-on-surface), 0.3);
  opacity: 0;
  transition: all 0.2s ease;
}

.user-embed-card:hover .user-embed-arrow {
  opacity: 1;
  color: rgb(var(--v-theme-primary));
}

.user-embed-card--compact .user-embed-arrow {
  position: static;
  opacity: 0.4;
  flex-shrink: 0;
}

.user-embed-card--compact:hover .user-embed-arrow {
  opacity: 1;
}
</style>
