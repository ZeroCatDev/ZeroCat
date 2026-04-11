import { ref, shallowReactive } from "vue";
import { getUserByUsername } from "@/stores/user";
import request from "@/axios/axios";

/**
 * 用户悬停卡片 composable
 * 提供用户信息的获取、缓存和加载状态管理
 *
 * 全局共享缓存，避免重复请求同一用户
 */

// 全局用户信息缓存 —— 在所有组件实例之间共享
const userCache = shallowReactive(new Map());
// 正在请求中的 Promise 缓存（防止并发重复请求）
const pendingRequests = new Map();

/**
 * 获取用户基础信息后，并行补充统计数据（关注数、粉丝数、作品数）
 */
async function enrichUserStats(userData) {
  if (!userData || !userData.id) return userData;

  const enriched = { ...userData };

  try {
    const [followersRes, followingRes, projectsRes] = await Promise.allSettled([
      request.get(`/follows/followers/${userData.id}`, { params: { limit: 1, offset: 0 } }),
      request.get(`/follows/following/${userData.id}`, { params: { limit: 1, offset: 0 } }),
      request.get(`/searchapi`, {
        params: {
          search_userid: userData.id,
          search_state: "public",
          limit: 1,
          curr: 1,
        },
      }),
    ]);

    if (followersRes.status === "fulfilled" && followersRes.value.data?.success) {
      enriched.followers_count = followersRes.value.data.data.total ?? 0;
    }
    if (followingRes.status === "fulfilled" && followingRes.value.data?.success) {
      enriched.following_count = followingRes.value.data.data.total ?? 0;
    }
    if (projectsRes.status === "fulfilled") {
      const pData = projectsRes.value.data;
      // searchapi 返回格式: { totalCount, total_count, totals: { projects } }
      enriched.project_count = pData?.totalCount ?? pData?.total_count ?? pData?.totals?.projects ?? 0;
    }
  } catch (e) {
    console.warn("[useUserHoverCard] 获取用户统计失败:", e);
  }

  return enriched;
}

/**
 * @param {Object} options
 * @param {number} [options.hoverDelay=400] - 悬停多久后触发加载（毫秒）
 * @param {number} [options.leaveDelay=200] - 鼠标离开后延迟关闭（毫秒）
 */
export function useUserHoverCard(options = {}) {
  const { hoverDelay = 400, leaveDelay = 200 } = options;

  const isVisible = ref(false);
  const isLoading = ref(false);
  const userData = ref(null);

  let hoverTimer = null;
  let leaveTimer = null;

  /**
   * 根据用户名获取用户信息（带缓存）
   */
  async function fetchUser(username) {
    if (!username) return null;

    // 命中缓存直接返回
    if (userCache.has(username)) {
      return userCache.get(username);
    }

    // 已有相同请求在进行中，复用 promise
    if (pendingRequests.has(username)) {
      return pendingRequests.get(username);
    }

    const promise = getUserByUsername(username)
      .then(async (data) => {
        if (data && data.id) {
          // 补充统计数据（关注、粉丝、作品数）
          const enriched = await enrichUserStats(data);
          userCache.set(username, enriched);
          return enriched;
        }
        return data;
      })
      .finally(() => {
        pendingRequests.delete(username);
      });

    pendingRequests.set(username, promise);
    return promise;
  }

  /**
   * 鼠标进入触发区域
   */
  function onMouseEnter(username) {
    // 取消可能存在的关闭定时器
    if (leaveTimer) {
      clearTimeout(leaveTimer);
      leaveTimer = null;
    }

    // 如果已经可见且是同一个用户，直接返回
    if (isVisible.value && userData.value?.username === username) {
      return;
    }

    hoverTimer = setTimeout(async () => {
      isLoading.value = true;
      isVisible.value = true;

      try {
        const data = await fetchUser(username);
        userData.value = data;
      } catch (e) {
        console.error("[UserHoverCard] 获取用户信息失败:", e);
        userData.value = null;
      } finally {
        isLoading.value = false;
      }
    }, hoverDelay);
  }

  /**
   * 鼠标离开触发区域
   */
  function onMouseLeave() {
    // 取消未触发的悬停定时器
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }

    // 延迟关闭，给用户移动到弹出卡片上的时间
    leaveTimer = setTimeout(() => {
      isVisible.value = false;
    }, leaveDelay);
  }

  /**
   * 鼠标进入弹出卡片（阻止关闭）
   */
  function onCardMouseEnter() {
    if (leaveTimer) {
      clearTimeout(leaveTimer);
      leaveTimer = null;
    }
  }

  /**
   * 鼠标离开弹出卡片
   */
  function onCardMouseLeave() {
    leaveTimer = setTimeout(() => {
      isVisible.value = false;
    }, leaveDelay);
  }

  /**
   * 手动关闭
   */
  function close() {
    isVisible.value = false;
    if (hoverTimer) clearTimeout(hoverTimer);
    if (leaveTimer) clearTimeout(leaveTimer);
  }

  /**
   * 预热缓存（不显示卡片）
   */
  function prefetch(username) {
    if (username && !userCache.has(username)) {
      fetchUser(username);
    }
  }

  /**
   * 清除指定用户的缓存
   */
  function invalidateCache(username) {
    userCache.delete(username);
  }

  return {
    isVisible,
    isLoading,
    userData,
    onMouseEnter,
    onMouseLeave,
    onCardMouseEnter,
    onCardMouseLeave,
    close,
    prefetch,
    invalidateCache,
    fetchUser,
  };
}
