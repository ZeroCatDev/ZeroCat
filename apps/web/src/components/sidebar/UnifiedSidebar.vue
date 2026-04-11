<template>
  <nav class="sidebar-twitter" :class="{ 'sidebar-twitter--vuetify': isVuetify }">
    <div class="sidebar-content">
      <!-- Vuetify 模式顶部：用户信息 -->
      <div v-if="isVuetify" class="drawer-header">
        <v-btn
          icon
          variant="text"
          size="small"
          class="drawer-theme-btn"
          @click="toggleTheme"
        >
          <v-icon :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'" />
        </v-btn>
        <router-link v-if="isLogin && user" :to="`/${user.username}`" class="drawer-user-link" v-ripple>
          <v-avatar size="40">
            <v-img :src="userAvatar" alt="avatar" />
          </v-avatar>
          <div class="drawer-user-name">{{ user.display_name || user.username }}</div>
          <div class="drawer-user-handle">@{{ user.username }}</div>
        </router-link>
      </div>

      <!-- Logo (独立侧栏模式) -->
      <router-link v-if="!isVuetify" to="/" class="sidebar-logo" v-ripple @click="goHome">
        <div class="logo-icon">
          <svg fill="none" height="32" viewBox="0 0 200 200" width="32" xmlns="http://www.w3.org/2000/svg">
            <circle cx="100" cy="100" fill="#FFFFFF" r="100"></circle>
            <path d="M38 162.867L100.5 100.367L100.5 162.867L38 162.867ZM163 100.367L100.5 100.367L100.5 162.867L163 100.367Z" fill="#415F91" fill-rule="evenodd"></path>
            <path d="M38 100.367L100.5 37.8672L100.5 100.367L38 100.367ZM163 37.8672L100.5 37.8672L100.5 100.367L163 37.8672Z" fill="#8EACE3" fill-rule="evenodd"></path>
          </svg>
        </div>
      </router-link>

      <!-- Navigation Items -->
      <div class="nav-items">
        <router-link
          v-for="item in unifiedNavItems"
          :key="item.name"
          :to="item.to"
          class="nav-item"
          :class="{ 'nav-item--active': isRouteActive(item.to) }"
          v-ripple
        >
          <v-icon class="nav-icon" :icon="item.icon" />
          <span class="nav-label">{{ item.label }}</span>
        </router-link>
      </div>

      <!-- Post Button -->
      <v-btn
        v-if="isLogin"
        color="primary"
        :size="isSmallScreen ? 'large' : 'x-large'"
        rounded="pill"
        class="mt-4"
        @click="handleOpenComposer"
      >
        <v-icon class="post-button-icon">mdi-pencil</v-icon>
        <span class="post-button-label">发帖</span>
      </v-btn>

      <!-- Spacer -->
      <div class="sidebar-spacer" />

      <!-- 独立侧栏模式底部：主题切换 + 用户信息 -->
      <template v-if="!isVuetify">
        <button class="theme-toggle" v-ripple @click="toggleTheme">
          <v-icon :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'" />
          <span class="nav-label">{{ isDark ? '浅色模式' : '深色模式' }}</span>
        </button>

        <router-link
          v-if="isLogin && user"
          :to="`/${user.username}`"
          class="user-profile"
          v-ripple
        >
          <v-avatar size="40" class="user-avatar">
            <v-img :src="userAvatar" alt="avatar" />
          </v-avatar>
          <div class="user-info">
            <div class="user-name">{{ user.display_name || user.username }}</div>
            <div class="user-handle">@{{ user.username }}</div>
          </div>
          <v-icon class="user-menu-icon">mdi-dots-horizontal</v-icon>
        </router-link>
      </template>
    </div>
  </nav>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useDisplay } from 'vuetify';
import { useSidebarContent } from '@/composables/useSidebarContent';
import { openPostDialog } from '@/composables/usePostDialog';

const props = defineProps({
  mode: {
    type: String,
    default: 'twitter',
    validator: (v) => ['twitter', 'vuetify'].includes(v)
  }
});

const emit = defineEmits(['open-composer']);

const display = useDisplay();

const isVuetify = computed(() => props.mode === 'vuetify');
const isSmallScreen = computed(() => (display.width?.value ?? window.innerWidth) < 1024);

const {
  isLogin,
  user,
  userAvatar,
  isDark,
  unifiedNavItems,
  initConfig,
  toggleTheme,
  isRouteActive,
  goHome,
} = useSidebarContent();

const handleOpenComposer = () => {
  openPostDialog();
  emit('open-composer');
};

onMounted(() => {
  initConfig();
});
</script>

<style scoped>
.sidebar-twitter {
  position: sticky;
  top: 64px;
  height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  padding: 0 12px;
  z-index: 2;
  overflow-y: auto;
}

.sidebar-twitter--vuetify {
  position: static;
  top: auto;
  height: auto;
}

.sidebar-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px 0;
}

.sidebar-twitter--vuetify .sidebar-content {
  height: auto;
}

/* Vuetify drawer header */
.drawer-header {
  position: relative;
  padding: 4px 12px 8px;
}

.drawer-theme-btn {
  position: absolute;
  top: 4px;
  right: 4px;
}

.drawer-user-link {
  display: block;
  text-decoration: none;
  color: rgb(var(--v-theme-on-surface));
  margin-bottom: 12px;
  overflow: hidden;
  position: relative;
  border-radius: 12px;
}

.drawer-user-name {
  font-size: 17px;
  font-weight: 700;
  line-height: 1.3;
  margin-top: 8px;
}

.drawer-user-handle {
  font-size: 15px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  line-height: 1.3;
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
  overflow: hidden;
  position: relative;
}

.sidebar-logo:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
}

.logo-icon {
  width: 32px;
  height: 32px;
}

/* Nav */
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
  overflow: hidden;
  position: relative;
}

.nav-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
}

.nav-item--active {
  font-weight: 700;
}

.nav-icon {
  font-size: 26px;
}

.nav-label {
  white-space: nowrap;
}

/* Post Button */
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
  color: rgb(var(--v-theme-on-surface));
  font-size: 20px;
  background: none;
  border: none;
  cursor: pointer;
  width: 100%;
  transition: background-color 0.2s;
  overflow: hidden;
  position: relative;
}

.theme-toggle:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
}

.sidebar-spacer {
  flex: 1;
}

/* User Profile (standalone mode bottom) */
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
  overflow: hidden;
  position: relative;
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

/* Medium screens - icon only for standalone */
@media (max-width: 1279px) {
  .sidebar-twitter:not(.sidebar-twitter--vuetify) {
    padding: 0 4px;
  }

  .sidebar-twitter:not(.sidebar-twitter--vuetify) .sidebar-logo {
    justify-content: center;
  }

  .sidebar-twitter:not(.sidebar-twitter--vuetify) .nav-item {
    justify-content: center;
    padding: 12px;
  }

  .sidebar-twitter:not(.sidebar-twitter--vuetify) .nav-label {
    display: none;
  }

  .sidebar-twitter:not(.sidebar-twitter--vuetify) .post-button-icon {
    display: block;
  }

  .sidebar-twitter:not(.sidebar-twitter--vuetify) .post-button-label {
    display: none;
  }

  .sidebar-twitter:not(.sidebar-twitter--vuetify) .theme-toggle {
    justify-content: center;
  }

  .sidebar-twitter:not(.sidebar-twitter--vuetify) .theme-toggle .nav-label {
    display: none;
  }

  .sidebar-twitter:not(.sidebar-twitter--vuetify) .user-profile {
    justify-content: center;
    padding: 12px;
  }

  .sidebar-twitter:not(.sidebar-twitter--vuetify) .user-info,
  .sidebar-twitter:not(.sidebar-twitter--vuetify) .user-menu-icon {
    display: none;
  }
}

/* Small screens - hide standalone */
@media (max-width: 1023px) {
  .sidebar-twitter:not(.sidebar-twitter--vuetify) {
    display: none;
  }
}
</style>

