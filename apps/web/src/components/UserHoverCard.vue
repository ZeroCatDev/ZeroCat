<template>
  <div
    class="user-hover-card-wrapper"
    :style="{ display: inline ? 'inline' : 'block' }"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <!-- 触发区域：包裹任意内容 -->
    <slot />

    <!-- 悬浮卡片 (teleport 到 body) -->
    <v-menu
      v-model="isVisible"
      :activator="'parent'"
      :open-on-hover="false"
      :close-on-content-click="false"
      :open-on-click="false"
      location="bottom start"
      :offset="8"
      :max-width="360"
      :min-width="300"
      transition="scale-transition"
      :z-index="2100"
    >
      <v-card
        class="user-hover-popup"
        elevation="8"
        rounded="xl"
        @mouseenter="onCardMouseEnter"
        @mouseleave="onCardMouseLeave"
      >
        <!-- 加载骨架屏 -->
        <template v-if="isLoading && !userData">
          <v-card-text class="pa-4">
            <div class="d-flex align-center mb-3">
              <v-skeleton-loader type="avatar" class="mr-3" />
              <div class="flex-grow-1">
                <v-skeleton-loader type="text" width="120" class="mb-1" />
                <v-skeleton-loader type="text" width="80" />
              </div>
            </div>
            <v-skeleton-loader type="paragraph" />
            <div class="d-flex gap-4 mt-3">
              <v-skeleton-loader type="text" width="60" />
              <v-skeleton-loader type="text" width="60" />
              <v-skeleton-loader type="text" width="60" />
            </div>
          </v-card-text>
        </template>

        <!-- 用户信息 -->
        <template v-else-if="userData && userData.id">
          <v-card-text class="pa-4 pb-2">
            <!-- 头部：头像 + 关注按钮 -->
            <div class="d-flex align-start justify-space-between mb-2">
              <v-avatar
                size="56"
                class="user-hover-avatar"
                @click="goToProfile"
              >
                <v-img
                  v-if="userAvatar"
                  :src="userAvatar"
                  :alt="userData.display_name"
                />
                <v-icon v-else icon="mdi-account" size="28" />
              </v-avatar>

              <v-btn
                v-if="showFollowButton"
                :color="'primary'"
                :variant="isFollowing ? 'outlined' : 'flat'"
                :prepend-icon="isFollowing ? 'mdi-check' : 'mdi-account-plus'"
                :loading="followLoading"
                rounded="pill"
                size="small"
                @click.stop="toggleFollow"
              >
                {{ isFollowing ? '已关注' : '关注' }}
              </v-btn>
            </div>

            <!-- 名称 -->
            <div class="user-hover-names" @click="goToProfile">
              <div class="user-hover-display-name text-body-1 font-weight-bold">
                {{ userData.display_name || userData.username }}
                <v-icon
                  v-if="isAdmin"
                  icon="mdi-shield-check"
                  size="16"
                  color="primary"
                  class="ml-1"
                />
              </div>
              <div class="user-hover-username text-body-2 text-medium-emphasis">
                @{{ userData.username }}
              </div>
            </div>
            <!-- bio -->
            <div
              v-if="truncatedBio"
              class="user-hover-bio text-body-2 text-medium-emphasis mt-1"
            >
              {{ truncatedBio }}
            </div>
          </v-card-text>

          <!-- 数据统计 -->
          <v-card-text class="px-4 pt-0 pb-3">
            <div class="d-flex gap-4 user-hover-stats">
              <router-link
                :to="`/${userData.username}`"
                class="user-hover-stat"
                @click="close"
              >
                <span class="font-weight-bold">{{ formatCount(userData.project_count) }}</span>
                <span class="text-medium-emphasis ml-1">作品</span>
              </router-link>
              <router-link
                :to="`/${userData.username}?tab=following`"
                class="user-hover-stat"
                @click="close"
              >
                <span class="font-weight-bold">{{ formatCount(userData.following_count) }}</span>
                <span class="text-medium-emphasis ml-1">关注</span>
              </router-link>
              <router-link
                :to="`/${userData.username}?tab=followers`"
                class="user-hover-stat"
                @click="close"
              >
                <span class="font-weight-bold">{{ formatCount(userData.followers_count) }}</span>
                <span class="text-medium-emphasis ml-1">粉丝</span>
              </router-link>
            </div>
          </v-card-text>
        </template>

        <!-- 加载失败 -->
        <template v-else>
          <v-card-text class="pa-4 text-center text-medium-emphasis">
            <v-icon icon="mdi-account-alert" size="32" class="mb-2" />
            <div>无法加载用户信息</div>
          </v-card-text>
        </template>
      </v-card>
    </v-menu>
  </div>
</template>

<script setup>
import { computed, toRef, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import { useUserHoverCard } from "@/composables/useUserHoverCard";
import { localuser } from "@/services/localAccount";
import request from "@/axios/axios";
import { ref } from "vue";

const props = defineProps({
  /** 目标用户名（必填） */
  username: {
    type: String,
    required: true,
  },
  /** 是否以 inline 方式显示（用于行内文本如 @提及） */
  inline: {
    type: Boolean,
    default: false,
  },
  /** 悬停延迟（毫秒） */
  hoverDelay: {
    type: Number,
    default: 400,
  },
  /** 离开延迟（毫秒） */
  leaveDelay: {
    type: Number,
    default: 200,
  },
});

const router = useRouter();

const {
  isVisible,
  isLoading,
  userData,
  onMouseEnter,
  onMouseLeave,
  onCardMouseEnter,
  onCardMouseLeave,
  close,
} = useUserHoverCard({
  hoverDelay: props.hoverDelay,
  leaveDelay: props.leaveDelay,
});

// ==================== 头像 ====================
const userAvatar = computed(() => {
  if (!userData.value?.avatar) return "";
  return localuser.getUserAvatar(userData.value.avatar);
});

// ==================== 简介截断 ====================
const truncatedBio = computed(() => {
  const bio = userData.value?.bio || "";
  return bio.length > 120 ? bio.slice(0, 120) + "…" : bio;
});

// ==================== 角色判断 ====================
const isAdmin = computed(() => {
  return userData.value?.type === "administrator" || userData.value?.role === "admin";
});

// ==================== 关注相关 ====================
const isFollowing = ref(false);
const followLoading = ref(false);

const showFollowButton = computed(() => {
  // 不显示自己的关注按钮
  const currentUser = localuser.user?.value;
  if (!currentUser || !currentUser.id) return false;
  if (!userData.value?.id) return false;
  return currentUser.id !== userData.value.id;
});

async function checkFollowStatus() {
  if (!showFollowButton.value) return;
  try {
    const { data } = await request.get(`/follows/relationships/${userData.value.id}`);
    isFollowing.value = data?.data?.isFollowing ?? false;
  } catch {
    isFollowing.value = false;
  }
}

async function toggleFollow() {
  if (!userData.value?.id || followLoading.value) return;
  followLoading.value = true;
  try {
    if (isFollowing.value) {
      await request.delete(`/follows/${userData.value.id}`);
      isFollowing.value = false;
    } else {
      await request.post(`/follows/${userData.value.id}`);
      isFollowing.value = true;
    }
  } catch (e) {
    console.error("[UserHoverCard] 关注操作失败:", e);
  } finally {
    followLoading.value = false;
  }
}

// 监听用户数据加载完成后检查关注状态
import { watch } from "vue";
watch(userData, (val) => {
  if (val?.id) {
    checkFollowStatus();
  }
});

// ==================== 数字格式化 ====================
function formatCount(num) {
  if (num == null) return "0";
  num = Number(num);
  if (num >= 10000) return (num / 10000).toFixed(1) + "万";
  if (num >= 1000) return (num / 1000).toFixed(1) + "k";
  return String(num);
}

// ==================== 事件处理 ====================
function handleMouseEnter() {
  onMouseEnter(props.username);
}

function handleMouseLeave() {
  onMouseLeave();
}

function goToProfile() {
  close();
  router.push(`/${userData.value?.username || props.username}`);
}

// ==================== 清理 ====================
onBeforeUnmount(() => {
  close();
});
</script>

<style scoped>
.user-hover-card-wrapper {
  cursor: pointer;
}

.user-hover-popup {
  overflow: visible;
}

.user-hover-avatar {
  cursor: pointer;
  transition: opacity 0.2s;
}

.user-hover-avatar:hover {
  opacity: 0.85;
}

.user-hover-names {
  cursor: pointer;
}

.user-hover-names:hover .user-hover-display-name {
  text-decoration: underline;
}

.user-hover-bio {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
  line-height: 1.5;
}

.user-hover-stats {
  font-size: 0.875rem;
}

.user-hover-stat {
  text-decoration: none;
  color: inherit;
  transition: opacity 0.15s;
}

.user-hover-stat:hover {
  text-decoration: underline;
}
</style>
