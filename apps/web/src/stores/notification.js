import { defineStore } from "pinia";
import { ref } from "vue";
import { localuser } from "@/services/localAccount";
import {
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
} from "@/services/notificationService";

const normalizeCount = (count) => {
  const value = Number(count);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
};

export const useNotificationStore = defineStore("notification", () => {
  const unreadCount = ref(0);
  const unreadCountLoading = ref(false);

  const setUnreadCount = (count) => {
    unreadCount.value = normalizeCount(count);
  };

  const decrementUnreadCount = (delta = 1) => {
    const step = normalizeCount(delta);
    setUnreadCount(unreadCount.value - step);
  };

  const resetUnreadCount = () => {
    unreadCount.value = 0;
  };

  const fetchUnreadCount = async () => {
    if (!localuser.isLogin.value) {
      resetUnreadCount();
      return unreadCount.value;
    }

    unreadCountLoading.value = true;
    try {
      const result = await getUnreadNotificationCount();
      setUnreadCount(result?.count ?? 0);
      return unreadCount.value;
    } catch (error) {
      console.error("加载未读通知数量失败:", error);
      return unreadCount.value;
    } finally {
      unreadCountLoading.value = false;
    }
  };

  const markAllAsRead = async () => {
    const result = await markAllNotificationsAsRead();
    setUnreadCount(0);
    return result;
  };

  return {
    unreadCount,
    unreadCountLoading,
    setUnreadCount,
    decrementUnreadCount,
    resetUnreadCount,
    fetchUnreadCount,
    markAllAsRead,
  };
});
