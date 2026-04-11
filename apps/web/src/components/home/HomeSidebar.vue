<template>
  <nav class="home-sidebar">
    <div class="sidebar-content">
      <!-- Logo -->
      <router-link to="/" class="sidebar-logo">
        <div class="logo-icon">
          <svg
            fill="none"
            height="32"
            viewBox="0 0 200 200"
            width="32"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="100" cy="100" fill="#FFFFFF" r="100"></circle>
            <path
              d="M38 162.867L100.5 100.367L100.5 162.867L38 162.867ZM163 100.367L100.5 100.367L100.5 162.867L163 100.367Z"
              fill="#415F91"
              fill-rule="evenodd"
            ></path>
            <path
              d="M38 100.367L100.5 37.8672L100.5 100.367L38 100.367ZM163 37.8672L100.5 37.8672L100.5 100.367L163 37.8672Z"
              fill="#8EACE3"
              fill-rule="evenodd"
            ></path>
          </svg>
        </div>
      </router-link>

      <!-- Navigation Items -->
      <div class="nav-items">
        <router-link
          v-for="item in navItems"
          :key="item.name"
          :to="item.to"
          class="nav-item"
          :class="{ 'nav-item--active': isActive(item) }"
        >
          <v-icon class="nav-icon" :icon="item.icon" />
          <span class="nav-label">{{ item.label }}</span>
        </router-link>
      </div>

      <!-- Post Button -->
      <button
        v-if="isLogin"
        class="post-button"
        @click="openComposer"
      >
        <v-icon class="post-button-icon">mdi-pencil</v-icon>
        <span class="post-button-label">发帖</span>
      </button>

      <!-- Spacer -->
      <div class="sidebar-spacer" />

      <!-- Theme Toggle -->
      <button class="theme-toggle" @click="toggleTheme">
        <v-icon :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'" />
        <span class="nav-label">{{ isDark ? '浅色模式' : '深色模式' }}</span>
      </button>

      <!-- User Profile (when logged in) -->
      <router-link
        v-if="isLogin && user"
        :to="`/${user.username}`"
        class="user-profile"
      >
        <v-avatar size="40" class="user-avatar">
          <v-img :src="avatarUrl" alt="avatar" />
        </v-avatar>
        <div class="user-info">
          <div class="user-name">{{ user.display_name || user.username }}</div>
          <div class="user-handle">@{{ user.username }}</div>
        </div>
        <v-icon class="user-menu-icon">mdi-dots-horizontal</v-icon>
      </router-link>
    </div>
  </nav>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useTheme } from 'vuetify';
import { localuser } from '@/services/localAccount';

const emit = defineEmits(['open-composer']);

const route = useRoute();
const theme = useTheme();

const isLogin = computed(() => localuser.isLogin.value);
const user = computed(() => localuser.user.value);
const isDark = computed(() => theme.global.name.value === 'dark');

const avatarUrl = computed(() => {
  try {
    if (!isLogin.value) return '/default-avatar.png';
    return localuser.getUserAvatar(user.value?.avatar);
  } catch {
    return '/default-avatar.png';
  }
});

const navItems = computed(() => {
  const items = [
    { name: 'home', label: '首页', icon: 'mdi-home', to: '/' },
    { name: 'explore', label: '探索项目', icon: 'mdi-compass', to: '/app/explore' },
  ];

  if (isLogin.value) {
    items.push(
      { name: 'notifications', label: '通知', icon: 'mdi-bell-outline', to: '/app/notifications' },
      { name: 'mentions', label: '提及', icon: 'mdi-at', to: '/app/mentions' },
      { name: 'profile', label: '个人主页', icon: 'mdi-account-outline', to: user.value ? `/${user.value.username}` : '/app/account' },
      { name: 'settings', label: '设置', icon: 'mdi-cog-outline', to: '/app/account' }
    );
  } else {
    items.push(
      { name: 'login', label: '登录', icon: 'mdi-login', to: '/app/account/login' },
      { name: 'register', label: '注册', icon: 'mdi-account-plus-outline', to: '/app/account/register' }
    );
  }

  return items;
});

const isActive = (item) => {
  if (item.to === '/') {
    return route.path === '/';
  }
  return route.path.startsWith(item.to);
};

const toggleTheme = () => {
  const newTheme = isDark.value ? 'light' : 'dark';
  theme.global.name.value = newTheme;
  localStorage.setItem('theme', newTheme);
};

const openComposer = () => {
  emit('open-composer');
};
</script>

<style scoped>
.home-sidebar {
  position: sticky;
  top: 64px;
  height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  padding: 0 12px;
}

.sidebar-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px 0;
}

/* Logo */
.sidebar-logo {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 12px;
  margin-bottom: 8px;
  border-radius: 9999px;
  transition: background-color 0.2s;
  text-decoration: none;
}

.sidebar-logo:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
}

.logo-icon {
  width: 32px;
  height: 32px;
}

/* Nav Items */
.nav-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 12px;
  border-radius: 9999px;
  text-decoration: none;
  color: rgb(var(--v-theme-on-surface));
  font-size: 20px;
  font-weight: 400;
  transition: background-color 0.2s;
}

.nav-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
}

.nav-item--active {
  font-weight: 700;
}

.nav-item--active .nav-icon {
  font-weight: 700;
}

.nav-icon {
  font-size: 26px;
}

.nav-label {
  white-space: nowrap;
}

/* Post Button */
.post-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  margin-top: 16px;
  padding: 16px 32px;
  background: rgb(var(--v-theme-primary));
  color: white;
  border: none;
  border-radius: 9999px;
  font-size: 17px;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.2s, transform 0.1s;
}

.post-button:hover {
  background: rgba(var(--v-theme-primary), 0.9);
}

.post-button:active {
  transform: scale(0.98);
}

.post-button-icon {
  display: none;
}

.post-button-label {
  display: block;
}

/* Theme Toggle */
.theme-toggle {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 12px;
  border-radius: 9999px;
  text-decoration: none;
  color: rgb(var(--v-theme-on-surface));
  font-size: 20px;
  font-weight: 400;
  background: none;
  border: none;
  cursor: pointer;
  width: 100%;
  transition: background-color 0.2s;
}

.theme-toggle:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
}

/* Spacer */
.sidebar-spacer {
  flex: 1;
}

/* User Profile */
.user-profile {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 9999px;
  text-decoration: none;
  color: rgb(var(--v-theme-on-surface));
  transition: background-color 0.2s;
  margin-top: 12px;
}

.user-profile:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
}

.user-avatar {
  flex-shrink: 0;
}

.user-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.user-name {
  font-size: 15px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-handle {
  font-size: 15px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-menu-icon {
  flex-shrink: 0;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

/* Medium screens - icon only */
@media (max-width: 1279px) {
  .home-sidebar {
    padding: 0 4px;
  }

  .sidebar-logo {
    justify-content: center;
  }

  .nav-item {
    justify-content: center;
    padding: 12px;
  }

  .nav-label {
    display: none;
  }

  .post-button {
    width: 50px;
    height: 50px;
    padding: 0;
  }

  .post-button-icon {
    display: block;
  }

  .post-button-label {
    display: none;
  }

  .theme-toggle {
    justify-content: center;
  }

  .theme-toggle .nav-label {
    display: none;
  }

  .user-profile {
    justify-content: center;
    padding: 12px;
  }

  .user-info,
  .user-menu-icon {
    display: none;
  }
}

/* Hide on small screens */
@media (max-width: 1023px) {
  .home-sidebar {
    display: none;
  }
}
</style>
