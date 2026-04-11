<template>
  <aside class="home-right-sidebar">
    <transition name="search-scrim">
      <div v-if="showSearchOverlay" class="search-scrim" @click="closeSearchOverlay" />
    </transition>

    <div ref="searchShellRef" class="search-shell">
      <v-form class="search-box" :class="{ 'search-box-active': showSearchOverlay }" @submit.prevent="goToSearch">
        <v-text-field
          v-model="searchText"
          class="search-input"
          density="compact"
          hide-details
          placeholder="搜索帖子"
          prepend-inner-icon="mdi-magnify"
          variant="plain"
          @focus="openSearchOverlay"
          @click="openSearchOverlay"
          @keyup.enter="goToSearch"
        />
        <v-btn
          class="search-submit"
          color="primary"
          icon="mdi-magnify"
          size="small"
          variant="text"
          aria-label="搜索帖子"
          @click="goToSearch"
        />
      </v-form>

      <transition name="search-popover">
        <div v-if="showSearchOverlay" class="search-popover">
          <div class="search-history-title">搜索历史</div>
          <div v-if="searchHistory.length" class="search-history-list">
            <v-chip
              v-for="(term, index) in searchHistory"
              :key="`${term}-${index}`"
              class="search-history-chip"
              size="small"
              @click="searchFromHistory(term)"
            >
              {{ term }}
            </v-chip>
          </div>
          <div v-else class="search-history-empty">暂无搜索历史</div>
        </div>
      </transition>
    </div>

    <!-- Who to follow Card -->
    <div v-if="isLogin && $route.path === '/'" class="sidebar-card recommend-card">
      <div class="recommend-header">
        <h2 class="card-title recommend-title">推荐关注</h2>
        <v-btn
          size="x-small"
          variant="text"
          color="primary"
          :loading="recommendLoading"
          @click="refreshRecommendations"
        >
          换一批
        </v-btn>
      </div>

      <div v-if="recommendLoading" class="recommend-loading">
        <div v-for="idx in 3" :key="idx" class="recommend-item recommend-item--skeleton">
          <v-skeleton-loader type="avatar" class="recommend-skeleton-avatar" />
          <div class="recommend-skeleton-content">
            <v-skeleton-loader type="text" width="120" class="mb-1" />
            <v-skeleton-loader type="text" width="90" />
          </div>
        </div>
      </div>

      <div v-else-if="recommendUsers.length" class="recommend-list">
        <div
          v-for="user in recommendUsers"
          :key="user.id"
          class="recommend-item"
        >
          <router-link :to="`/${user.username}`" class="recommend-user-link">
            <v-avatar size="44" class="recommend-avatar">
              <v-img :src="getAvatarUrl(user.avatar)" :alt="user.display_name || user.username" />
            </v-avatar>
            <div class="recommend-user-content">
              <div class="recommend-user-name">{{ user.display_name || user.username }}</div>
              <div class="recommend-user-handle">@{{ user.username }}</div>
              <div v-if="user.bio" class="recommend-user-bio">{{ user.bio }}</div>
            </div>
          </router-link>

          <v-btn
            class="recommend-follow-btn"
            size="small"
            rounded="pill"
            :variant="isFollowingUser(user.id) ? 'outlined' : 'flat'"
            :color="isFollowingUser(user.id) ? 'default' : 'primary'"
            :loading="isFollowPending(user.id)"
            @click="toggleFollow(user)"
          >
            {{ isFollowingUser(user.id) ? '已关注' : '关注' }}
          </v-btn>
        </div>

        <v-btn
          v-if="recommendHasMore"
          variant="text"
          color="primary"
          size="small"
          class="recommend-more-btn"
          :loading="recommendLoadingMore"
          @click="loadMoreRecommendations"
        >
          显示更多
        </v-btn>
      </div>

      <div v-else class="recommend-empty">
        {{ recommendError || '暂无推荐用户' }}
      </div>
    </div>

    <!-- About ZeroCat Card -->
    <div class="sidebar-card about-card">
      <h2 class="card-title">ZeroCat 零猫</h2>
      <p class="card-description">
        新一代，开源，编程社区。
      </p>
      <router-link to="/app/about" class="card-link">
        了解更多
        <v-icon size="16">mdi-arrow-right</v-icon>
      </router-link>
    </div>

    <!-- Quick Links Card -->
    <div class="sidebar-card links-card">
      <div class="quick-links">
        <router-link to="/app/explore" class="quick-link">
          <v-icon size="18">mdi-compass</v-icon>
          <span>探索项目</span>
        </router-link>
        <a href="https://github.com/ZeroCatDev" target="_blank" class="quick-link">
          <v-icon size="18">mdi-github</v-icon>
          <span>GitHub</span>
        </a>
        <a href="https://kernyr.wuyuan.dev" class="quick-link">
          <v-icon size="18">mdi-github</v-icon>
          <span>Kernyr</span>
        </a>
        <a href="https://qm.qq.com/q/E3eF6xtoHe" target="_blank" class="quick-link"> <v-icon size="18">mdi-mail</v-icon>
          <span>QQ 群</span>
        </a>
         <a href="https://houlang.cloud" class="quick-link"> <v-icon size="18">mdi-earth</v-icon>
          <span>厚浪云</span>
        </a>
      </div>
    </div>

    <!-- Footer Links -->
    <div class="sidebar-footer">
      <div class="footer-links">
        <router-link to="/app/legal/terms" class="footer-link">服务条款</router-link>
        <router-link to="/app/legal/privacy" class="footer-link">隐私政策</router-link>
        <router-link to="/app/legal/community-guidelines" class="footer-link">社区准则</router-link>
        <router-link to="/app/about" class="footer-link">关于</router-link>
      </div>
      <div class="footer-links">
        <a href="https://t.me/zerocatdev" target="_blank" class="footer-link">Telegram</a>
        <a href="https://qm.qq.com/q/W4YRztB94q" target="_blank" class="footer-link">QQ群</a>
        <a href="https://discord.gg/YmW2JWnbdy" target="_blank" class="footer-link">Discord</a>
      </div>
      <div class="footer-links">
        <a href="https://sbox.yearnstudio.cn" target="_blank" class="footer-link">小盒子社区</a>
        <a href="https://www.40code.com/" target="_blank" class="footer-link">40code</a>
      </div>
      <div class="footer-copyright">
        &copy; {{ currentYear }} ZeroCat
        <span class="footer-separator">·</span>
        <a href="https://houlang.cloud/zh-CN/article/about/team" target="_blank" class="footer-link">厚浪开发组</a>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { addToSearchHistory, loadSearchHistory } from '@/services/searchService';
import axios from '@/axios/axios';
import { localuser } from '@/services/localAccount';
import UserRecommendationService from '@/services/userRecommendationService';
import { showSnackbar } from '@/composables/useNotifications';

const router = useRouter();
const searchText = ref('');
const searchHistory = ref([]);
const showSearchOverlay = ref(false);
const searchShellRef = ref(null);
const isLogin = computed(() => localuser.isLogin.value);

const RECOMMEND_LIMIT = 3;
const recommendUsers = ref([]);
const recommendLoading = ref(false);
const recommendLoadingMore = ref(false);
const recommendOffset = ref(0);
const recommendHasMore = ref(false);
const recommendError = ref('');
const followStateMap = ref({});
const followLoadingMap = ref({});

const currentYear = computed(() => new Date().getFullYear());

const getAvatarUrl = (avatar) => {
  try {
    return localuser.getUserAvatar(avatar);
  } catch {
    return '/default-avatar.png';
  }
};

const isFollowingUser = (userId) => {
  return Boolean(followStateMap.value[userId]);
};

const isFollowPending = (userId) => {
  return Boolean(followLoadingMap.value[userId]);
};

const mergeUsers = (oldUsers, newUsers) => {
  const map = new Map();
  oldUsers.forEach((item) => map.set(Number(item.id), item));
  newUsers.forEach((item) => map.set(Number(item.id), item));
  return Array.from(map.values());
};

const syncFollowStateFromUsers = (users) => {
  const next = { ...followStateMap.value };
  users.forEach((user) => {
    const userId = Number(user.id);
    if (!Number.isFinite(userId)) return;
    if (typeof user?.isFollowing === 'boolean') {
      next[userId] = user.isFollowing;
      return;
    }
    if (typeof user?.is_following === 'boolean') {
      next[userId] = user.is_following;
      return;
    }
    if (typeof user?.following === 'boolean') {
      next[userId] = user.following;
    }
  });
  followStateMap.value = next;
};

const fetchFollowState = async (users) => {
  if (!isLogin.value || !users.length) return;

  const results = await Promise.allSettled(
    users.map((user) => axios.get(`/follows/relationships/${user.id}`))
  );

  const next = { ...followStateMap.value };
  results.forEach((result, idx) => {
    const userId = Number(users[idx]?.id);
    if (!Number.isFinite(userId)) return;

    if (result.status === 'fulfilled') {
      const data = result.value?.data?.data || result.value?.data || {};
      next[userId] = Boolean(data?.isFollowing);
      return;
    }

    if (next[userId] === undefined) {
      next[userId] = false;
    }
  });

  followStateMap.value = next;
};

const loadRecommendations = async ({ append = false } = {}) => {
  if (!isLogin.value) return;

  const params = {
    offset: append ? recommendOffset.value : 0,
    limit: RECOMMEND_LIMIT,
  };

  if (append) {
    recommendLoadingMore.value = true;
  } else {
    recommendLoading.value = true;
    recommendError.value = '';
  }

  try {
    const result = await UserRecommendationService.getMyRecommendations(params);
    const currentUserId = Number(localuser.user.value?.id);
    const incomingUsers = (result.users || []).filter((user) => {
      const userId = Number(user?.id);
      return Number.isFinite(userId) && userId !== currentUserId;
    });

    recommendUsers.value = append
      ? mergeUsers(recommendUsers.value, incomingUsers)
      : incomingUsers;

    syncFollowStateFromUsers(incomingUsers);
    await fetchFollowState(incomingUsers);

    const responseOffset = Number.isFinite(Number(result.offset))
      ? Number(result.offset)
      : params.offset;
    const responseLimit = Number.isFinite(Number(result.limit))
      ? Number(result.limit)
      : RECOMMEND_LIMIT;

    recommendOffset.value = responseOffset + responseLimit;
    recommendHasMore.value = Boolean(result.hasMore);
    recommendError.value = '';
  } catch (error) {
    recommendError.value = error?.message || '获取推荐关注失败';
    if (!append) {
      recommendUsers.value = [];
      recommendHasMore.value = false;
    }
  } finally {
    recommendLoading.value = false;
    recommendLoadingMore.value = false;
  }
};

const refreshRecommendations = async () => {
  recommendOffset.value = 0;
  await loadRecommendations({ append: false });
};

const loadMoreRecommendations = async () => {
  if (recommendLoading.value || recommendLoadingMore.value || !recommendHasMore.value) {
    return;
  }
  await loadRecommendations({ append: true });
};

const toggleFollow = async (user) => {
  const userId = Number(user?.id);
  if (!Number.isFinite(userId)) return;

  if (!isLogin.value) {
    await router.push('/app/account/login');
    return;
  }

  if (followLoadingMap.value[userId]) return;

  followLoadingMap.value = {
    ...followLoadingMap.value,
    [userId]: true,
  };

  try {
    const following = isFollowingUser(userId);
    if (following) {
      await axios.delete(`/follows/${userId}`);
      followStateMap.value = { ...followStateMap.value, [userId]: false };
      showSnackbar(`已取消关注 @${user.username}`, 'info');
    } else {
      await axios.post(`/follows/${userId}`);
      followStateMap.value = { ...followStateMap.value, [userId]: true };
      showSnackbar(`已关注 @${user.username}`, 'success');
    }
  } catch (error) {
    showSnackbar(error?.response?.data?.message || '关注操作失败', 'error');
  } finally {
    followLoadingMap.value = {
      ...followLoadingMap.value,
      [userId]: false,
    };
  }
};

const openSearchOverlay = () => {
  showSearchOverlay.value = true;
};

const closeSearchOverlay = () => {
  showSearchOverlay.value = false;
};

const goToSearch = async () => {
  const keyword = searchText.value.trim();
  if (keyword) {
    searchHistory.value = await addToSearchHistory(keyword, searchHistory.value);
  }
  closeSearchOverlay();
  await router.push({
    path: '/app/search',
    query: {
      keyword,
      scope: 'posts',
      page: '1',
      perPage: '20'
    }
  });
};

const searchFromHistory = async (term) => {
  searchText.value = term;
  await goToSearch();
};

const handleDocumentPointerDown = (event) => {
  if (!showSearchOverlay.value) return;
  const shell = searchShellRef.value;
  if (shell && shell.contains(event.target)) return;
  closeSearchOverlay();
};

const handleDocumentKeydown = (event) => {
  if (event.key === 'Escape') {
    closeSearchOverlay();
  }
};

onMounted(async () => {
  searchHistory.value = await loadSearchHistory();
  document.addEventListener('mousedown', handleDocumentPointerDown);
  document.addEventListener('keydown', handleDocumentKeydown);
  if (isLogin.value) {
    await loadRecommendations({ append: false });
  }
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleDocumentPointerDown);
  document.removeEventListener('keydown', handleDocumentKeydown);
});

watch(isLogin, async (value) => {
  if (value) {
    recommendOffset.value = 0;
    await loadRecommendations({ append: false });
    return;
  }

  recommendUsers.value = [];
  recommendHasMore.value = false;
  recommendError.value = '';
  followStateMap.value = {};
  followLoadingMap.value = {};
});
</script>

<style scoped>
.home-right-sidebar {
  position: sticky;
  top: 64px;
  height: calc(100vh - 64px);
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.search-scrim {
  position: fixed;
  inset: 0;
  background: rgba(15, 20, 25, 0.12);
  z-index: 10;
}

.search-shell {
  position: relative;
  z-index: 20;
}

/* Search Box */
.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(var(--v-theme-on-surface), 0.05);
  border-radius: 9999px;
  transition: background-color 0.2s, box-shadow 0.2s;
}

.search-box:hover {
  background: rgba(var(--v-theme-on-surface), 0.08);
}

.search-box-active {
  background: rgba(var(--v-theme-surface), 0.98);
  box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.18);
}

.search-input {
  flex: 1;
}

.search-input :deep(.v-input__control) {
  min-height: 36px;
}

.search-input :deep(.v-field__input) {
  min-height: 36px;
  padding-top: 0;
  padding-bottom: 0;
}

.search-submit {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
}

.search-popover {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  padding: 12px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 16px;
  box-shadow: 0 12px 30px rgba(15, 20, 25, 0.14);
}

.search-history-title {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.65);
  margin-bottom: 8px;
}

.search-history-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.search-history-chip {
  max-width: 100%;
}

.search-history-chip :deep(.v-chip__content) {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-history-empty {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.55);
  padding: 6px 2px;
}

.search-popover-enter-active,
.search-popover-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.search-popover-enter-from,
.search-popover-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.search-scrim-enter-active,
.search-scrim-leave-active {
  transition: opacity 0.16s ease;
}

.search-scrim-enter-from,
.search-scrim-leave-to {
  opacity: 0;
}

/* Sidebar Card */
.sidebar-card {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 16px;
  padding: 16px;
}

.card-title {
  font-size: 16px;
  font-weight: 800;
  color: rgb(var(--v-theme-on-surface));
  margin-bottom: 12px;
}

.recommend-card {
  padding-top: 12px;
}

.recommend-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.recommend-title {
  margin-bottom: 0;
}

.recommend-loading,
.recommend-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.recommend-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.recommend-item--skeleton {
  align-items: center;
}

.recommend-skeleton-avatar {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
}

.recommend-skeleton-content {
  flex: 1;
}

.recommend-user-link {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
  flex: 1;
  text-decoration: none;
  color: inherit;
}

.recommend-avatar {
  flex-shrink: 0;
}

.recommend-user-content {
  min-width: 0;
}

.recommend-user-name {
  font-size: 14px;
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface));
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recommend-user-handle {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.62);
  line-height: 1.25;
}

.recommend-user-bio {
  margin-top: 3px;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  line-height: 1.35;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.recommend-follow-btn {
  margin-top: 2px;
  min-width: 72px;
}

.recommend-more-btn {
  align-self: flex-start;
  margin-top: 2px;
  padding-left: 0;
}

.recommend-empty {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.58);
}

/* About Card */
.about-card .card-description {
  font-size: 15px;
  color: rgba(var(--v-theme-on-surface), 0.8);
  line-height: 1.5;
  margin-bottom: 16px;
}

.card-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
  font-size: 15px;
  font-weight: 500;
  transition: opacity 0.2s;
}

.card-link:hover {
  opacity: 0.8;
}

/* Quick Links Card */
.quick-links {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.quick-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  text-decoration: none;
  color: rgb(var(--v-theme-on-surface));
  font-size: 15px;
  transition: background-color 0.2s;
}

.quick-link:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
}

.quick-link .v-icon {
  color: rgba(var(--v-theme-on-surface), 0.6);
}

/* Footer */
.sidebar-footer {
  margin-top: auto;
  padding: 12px 0;
}

.footer-links {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin-bottom: 8px;
}

.footer-link {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  text-decoration: none;
  transition: color 0.2s;
}

.footer-link:hover {
  color: rgba(var(--v-theme-on-surface), 0.8);
  text-decoration: underline;
}

.footer-copyright {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  margin-top: 12px;
}

.footer-separator {
  margin: 0 4px;
}

/* Scrollbar */
.home-right-sidebar::-webkit-scrollbar {
  width: 0;
}

/* Hide on medium screens */
@media (max-width: 1279px) {
  .home-right-sidebar {
    display: none;
  }
}
</style>
