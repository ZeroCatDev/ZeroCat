import { createApp, h, ref, nextTick } from "vue";
import { useUserHoverCard } from "@/composables/useUserHoverCard";
import { localuser } from "@/services/localAccount";
import request from "@/axios/axios";

/**
 * v-user-hover 指令
 *
 * 用于在 v-html 渲染的内容中，自动为 .post-mention 链接附加用户悬停卡片。
 * 因为 v-html 内容无法使用 Vue 组件，所以通过指令在 DOM 层面处理。
 *
 * 用法：
 *   <div v-html="formattedContent" v-user-hover />
 */

// 全局共享 hover card 实例（同时只显示一个）
let activePopup = null;
let popupEl = null;
let hoverTimer = null;
let leaveTimer = null;
const HOVER_DELAY = 400;
const LEAVE_DELAY = 200;

// 复用 composable 中的缓存逻辑
const hoverCard = useUserHoverCard({ hoverDelay: 0, leaveDelay: 0 });

function createPopupElement() {
  if (popupEl) return;
  popupEl = document.createElement("div");
  popupEl.className = "user-hover-directive-popup";
  popupEl.style.cssText = `
    position: fixed;
    z-index: 2100;
    pointer-events: auto;
    opacity: 0;
    transform: scale(0.95) translateY(-4px);
    transition: opacity 0.15s ease, transform 0.15s ease;
  `;
  popupEl.addEventListener("mouseenter", () => {
    if (leaveTimer) {
      clearTimeout(leaveTimer);
      leaveTimer = null;
    }
  });
  popupEl.addEventListener("mouseleave", () => {
    scheduleHide();
  });
  document.body.appendChild(popupEl);
}

function showPopup(targetEl, username) {
  createPopupElement();

  // 获取用户数据
  hoverCard.fetchUser(username).then((data) => {
    if (!popupEl || popupEl._currentUsername !== username) return;
    if (!data || !data.id) {
      popupEl.innerHTML = buildErrorHTML();
      return;
    }
    popupEl.innerHTML = buildCardHTML(data);
    // 绑定内部链接事件
    popupEl.querySelectorAll("[data-profile-link]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        hidePopup();
        // 使用 history API 导航
        const href = el.getAttribute("href") || el.dataset.profileLink;
        if (href) {
          window.dispatchEvent(new CustomEvent("user-hover-navigate", { detail: href }));
        }
      });
    });
    popupEl.querySelectorAll("[data-follow-btn]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleFollowClick(data, btn);
      });
    });
    // 检查关注状态
    checkAndUpdateFollowButton(data);
  });

  popupEl._currentUsername = username;
  popupEl.innerHTML = buildSkeletonHTML();

  // 定位
  positionPopup(targetEl);

  // 显示动画
  requestAnimationFrame(() => {
    if (popupEl) {
      popupEl.style.opacity = "1";
      popupEl.style.transform = "scale(1) translateY(0)";
    }
  });
}

function positionPopup(targetEl) {
  if (!popupEl) return;
  const rect = targetEl.getBoundingClientRect();
  const popupWidth = 320;
  const popupMaxHeight = 280;

  let left = rect.left;
  let top = rect.bottom + 8;

  // 防止超出右侧
  if (left + popupWidth > window.innerWidth - 16) {
    left = window.innerWidth - popupWidth - 16;
  }
  // 防止超出左侧
  if (left < 16) left = 16;

  // 如果底部空间不足，显示在上方
  if (top + popupMaxHeight > window.innerHeight - 16) {
    top = rect.top - popupMaxHeight - 8;
    if (top < 16) top = 16;
  }

  popupEl.style.left = `${left}px`;
  popupEl.style.top = `${top}px`;
  popupEl.style.width = `${popupWidth}px`;
}

function hidePopup() {
  if (!popupEl) return;
  popupEl.style.opacity = "0";
  popupEl.style.transform = "scale(0.95) translateY(-4px)";
  setTimeout(() => {
    if (popupEl) {
      popupEl.innerHTML = "";
      popupEl._currentUsername = null;
    }
  }, 160);
}

function scheduleHide() {
  if (leaveTimer) clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => {
    hidePopup();
  }, LEAVE_DELAY);
}

function getUserAvatarUrl(avatar) {
  if (!avatar) return "";
  return localuser.getUserAvatar(avatar);
}

function formatCount(num) {
  if (num == null) return "0";
  num = Number(num);
  if (num >= 10000) return (num / 10000).toFixed(1) + "万";
  if (num >= 1000) return (num / 1000).toFixed(1) + "k";
  return String(num);
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildSkeletonHTML() {
  return `
    <div style="background: rgb(var(--v-theme-surface)); border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.18); padding: 16px; font-family: inherit;">
      <div style="display: flex; align-items: center; margin-bottom: 12px;">
        <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(var(--v-theme-on-surface), 0.08); margin-right: 12px;"></div>
        <div style="flex:1;">
          <div style="width: 120px; height: 14px; background: rgba(var(--v-theme-on-surface), 0.08); border-radius: 4px; margin-bottom: 8px;"></div>
          <div style="width: 80px; height: 12px; background: rgba(var(--v-theme-on-surface), 0.08); border-radius: 4px;"></div>
        </div>
      </div>
      <div style="width: 100%; height: 12px; background: rgba(var(--v-theme-on-surface), 0.06); border-radius: 4px; margin-bottom: 6px;"></div>
      <div style="width: 80%; height: 12px; background: rgba(var(--v-theme-on-surface), 0.06); border-radius: 4px;"></div>
    </div>
  `;
}

function buildErrorHTML() {
  return `
    <div style="background: rgb(var(--v-theme-surface)); border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.18); padding: 24px; text-align: center; color: rgba(var(--v-theme-on-surface), 0.6); font-family: inherit;">
      <div style="font-size: 24px; margin-bottom: 4px;">😕</div>
      <div>无法加载用户信息</div>
    </div>
  `;
}

function buildCardHTML(data) {
  const avatarUrl = getUserAvatarUrl(data.avatar);
  const displayName = escapeHtml(data.display_name || data.username);
  const username = escapeHtml(data.username);
  const bio = data.bio && data.bio !== "用户信息未缓存" ? escapeHtml(data.bio.length > 120 ? data.bio.slice(0, 120) + "…" : data.bio) : "";
  const isAdmin = data.type === "administrator" || data.role === "admin";
  const projectCount = formatCount(data.project_count);
  const followingCount = formatCount(data.following_count);
  const followersCount = formatCount(data.followers_count);

  const currentUser = localuser.user?.value;
  const showFollow = currentUser && currentUser.id && currentUser.id !== data.id;

  const avatarHTML = avatarUrl
    ? `<img src="${escapeHtml(avatarUrl)}" alt="${displayName}" style="width: 56px; height: 56px; border-radius: 50%; object-fit: cover; cursor: pointer;" data-profile-link="/${username}" />`
    : `<div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(var(--v-theme-on-surface), 0.12); display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 24px; color: rgba(var(--v-theme-on-surface), 0.5);" data-profile-link="/${username}">👤</div>`;

  const adminBadge = isAdmin ? `<span style="color: rgb(var(--v-theme-primary)); margin-left: 4px; font-size: 14px;">✓</span>` : "";

  const followBtnHTML = showFollow
    ? `<button data-follow-btn data-user-id="${data.id}" style="
        border: 1.5px solid rgb(var(--v-theme-primary));
        background: transparent;
        color: rgb(var(--v-theme-primary));
        border-radius: 20px;
        padding: 4px 16px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s;
        white-space: nowrap;
      ">关注</button>`
    : "";

  return `
    <div style="background: rgb(var(--v-theme-surface)); border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.18); padding: 16px; font-family: inherit; color: rgb(var(--v-theme-on-surface));">
      <!-- Header -->
      <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 8px;">
        ${avatarHTML}
        ${followBtnHTML}
      </div>

      <!-- Names -->
      <a href="/${username}" data-profile-link="/${username}" style="text-decoration: none; color: inherit; display: block; cursor: pointer;">
        <div style="font-weight: 700; font-size: 15px; line-height: 1.3;">
          ${displayName}${adminBadge}
        </div>
        <div style="color: rgba(var(--v-theme-on-surface), 0.6); font-size: 14px;">
          @${username}
        </div>
      </a>

      ${bio ? `<div style="font-size: 14px; line-height: 1.5; margin-top: 8px; word-break: break-word; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${bio}</div>` : ""}

      <!-- Stats -->
      <div style="display: flex; gap: 16px; margin-top: 12px; font-size: 14px;">
        <a href="/${username}" data-profile-link="/${username}" style="text-decoration: none; color: inherit; cursor: pointer;">
          <span style="font-weight: 700;">${projectCount}</span>
          <span style="color: rgba(var(--v-theme-on-surface), 0.6); margin-left: 2px;">作品</span>
        </a>
        <a href="/${username}?tab=following" data-profile-link="/${username}?tab=following" style="text-decoration: none; color: inherit; cursor: pointer;">
          <span style="font-weight: 700;">${followingCount}</span>
          <span style="color: rgba(var(--v-theme-on-surface), 0.6); margin-left: 2px;">关注</span>
        </a>
        <a href="/${username}?tab=followers" data-profile-link="/${username}?tab=followers" style="text-decoration: none; color: inherit; cursor: pointer;">
          <span style="font-weight: 700;">${followersCount}</span>
          <span style="color: rgba(var(--v-theme-on-surface), 0.6); margin-left: 2px;">粉丝</span>
        </a>
      </div>
    </div>
  `;
}

async function checkAndUpdateFollowButton(data) {
  if (!popupEl) return;
  const btn = popupEl.querySelector("[data-follow-btn]");
  if (!btn) return;
  try {
    const { data: res } = await request.get(`/follows/relationships/${data.id}`);
    const isFollowing = res?.data?.isFollowing ?? false;
    if (isFollowing) {
      btn.textContent = "已关注";
      btn.style.background = "transparent";
      btn.style.color = "rgb(var(--v-theme-primary))";
      btn.dataset.following = "true";
    }
  } catch {
    // ignore
  }
}

async function handleFollowClick(data, btn) {
  if (btn.disabled) return;
  btn.disabled = true;
  btn.style.opacity = "0.6";

  const isFollowing = btn.dataset.following === "true";
  try {
    if (isFollowing) {
      await request.delete(`/follows/${data.id}`);
      btn.textContent = "关注";
      btn.style.background = "transparent";
      btn.dataset.following = "false";
    } else {
      await request.post(`/follows/${data.id}`);
      btn.textContent = "已关注";
      btn.dataset.following = "true";
    }
  } catch (e) {
    console.error("[UserHoverDirective] 关注操作失败:", e);
  } finally {
    btn.disabled = false;
    btn.style.opacity = "1";
  }
}

function extractUsernameFromMention(el) {
  // 从 href 提取用户名
  const href = el.getAttribute("href") || "";
  // 联邦用户 /user@domain.tld → "user@domain.tld"
  const fedMatch = href.match(/^\/(\w+@[\w.-]+\.\w{2,})$/);
  if (fedMatch) return fedMatch[1];
  // 本地用户 /username → "username"
  const localMatch = href.match(/^\/(\w+)$/);
  return localMatch ? localMatch[1] : null;
}

function attachListeners(el) {
  // 查找所有 .post-mention 链接
  const mentions = el.querySelectorAll(".post-mention");
  if (!mentions.length) return;

  // 存储清理函数
  if (!el._hoverCleanups) el._hoverCleanups = [];

  mentions.forEach((mention) => {
    if (mention._hoverAttached) return;
    mention._hoverAttached = true;

    const username = extractUsernameFromMention(mention);
    if (!username) return;

    const onEnter = () => {
      if (leaveTimer) {
        clearTimeout(leaveTimer);
        leaveTimer = null;
      }
      if (hoverTimer) clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        showPopup(mention, username);
      }, HOVER_DELAY);
    };

    const onLeave = () => {
      if (hoverTimer) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
      }
      scheduleHide();
    };

    mention.addEventListener("mouseenter", onEnter);
    mention.addEventListener("mouseleave", onLeave);

    el._hoverCleanups.push(() => {
      mention.removeEventListener("mouseenter", onEnter);
      mention.removeEventListener("mouseleave", onLeave);
      mention._hoverAttached = false;
    });
  });
}

function cleanupListeners(el) {
  if (el._hoverCleanups) {
    el._hoverCleanups.forEach((fn) => fn());
    el._hoverCleanups = [];
  }
}

// Vue 指令定义
export const vUserHover = {
  mounted(el) {
    nextTick(() => attachListeners(el));
  },
  updated(el) {
    // v-html 内容更新后重新绑定
    cleanupListeners(el);
    nextTick(() => attachListeners(el));
  },
  beforeUnmount(el) {
    cleanupListeners(el);
    if (hoverTimer) clearTimeout(hoverTimer);
    if (leaveTimer) clearTimeout(leaveTimer);
  },
};

/**
 * 安装为全局指令（在 main.js 中使用）
 * app.use(UserHoverDirectivePlugin)
 */
export const UserHoverDirectivePlugin = {
  install(app) {
    app.directive("user-hover", vUserHover);

    // 监听导航事件
    if (typeof window !== "undefined") {
      window.addEventListener("user-hover-navigate", (e) => {
        const router = app.config.globalProperties.$router;
        if (router && e.detail) {
          router.push(e.detail);
        }
      });
    }
  },
};

export default vUserHover;
