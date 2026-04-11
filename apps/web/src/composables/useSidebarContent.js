import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTheme } from 'vuetify';
import { localuser } from '@/services/localAccount';
import { get } from '@/services/serverConfig';

/**
 * 统一侧边栏内容提供者
 */
export function useSidebarContent() {
  const route = useRoute();
  const router = useRouter();
  const theme = useTheme();

  const proxyEnabled = ref(false);

  const initConfig = () => {
    proxyEnabled.value = get('scratchproxy.enabled') || false;
  };

  const isLogin = computed(() => localuser.isLogin.value);
  const user = computed(() => localuser.user.value);

  const userAvatar = computed(() => {
    try {
      if (!isLogin.value) return '/default-avatar.png';
      return localuser.getUserAvatar(user.value?.avatar);
    } catch {
      return '/default-avatar.png';
    }
  });

  const isDark = computed(() => theme.global.name.value === 'dark');

  const toggleTheme = () => {
    const newTheme = isDark.value ? 'light' : 'dark';
    theme.global.name.value = newTheme;
    localStorage.setItem('theme', newTheme);
  };

  const isRouteActive = (path) => {
    if (path === '/') {
      return route.path === '/' || route.path === '/index.html';
    }
    return route.path.startsWith(path);
  };

  const isAdminRoute = computed(() => route.path.startsWith('/app/admin'));

  // 管理员导航项
  const adminNavItems = computed(() => [
    { name: 'admin-back', label: '返回', icon: 'mdi-arrow-left', to: '/' },
    { name: 'admin-users', label: '用户管理', icon: 'mdi-account-group', to: '/app/admin/users' },
    { name: 'admin-project', label: '项目管理', icon: 'mdi-xml', to: '/app/admin/project' },
    { name: 'admin-config', label: '系统设置', icon: 'mdi-cog', to: '/app/admin/config' },
    { name: 'admin-sitemap', label: '站点地图', icon: 'mdi-sitemap', to: '/app/admin/sitemap' },
    { name: 'admin-extensions', label: '扩展管理', icon: 'mdi-puzzle', to: '/app/admin/extensions' },
    { name: 'admin-oauth', label: 'OAuth应用', icon: 'mdi-shield-key', to: '/app/admin/oauth/applications' },
    { name: 'admin-comment', label: '评论服务', icon: 'mdi-comment-text-multiple-outline', to: '/app/admin/commentservice' },
  ]);

  // 统一导航项
  const unifiedNavItems = computed(() => {
    if (isAdminRoute.value) return adminNavItems.value;

    const items = [
      { name: 'home', label: '首页', icon: 'mdi-home', to: '/' },
      { name: 'explore', label: '探索项目', icon: 'mdi-compass', to: '/app/explore' },
      { name: 'recommend', label: '猜你喜欢', icon: 'mdi-heart', to: '/app/recommend' },
    ];

    if (isLogin.value) {
      items.push(
        { name: 'notifications', label: '通知', icon: 'mdi-bell-outline', to: '/app/notifications' },
        { name: 'mentions', label: '提及', icon: 'mdi-at', to: '/app/mentions' },
        { name: 'dashboard', label: '仪表盘', icon: 'mdi-view-dashboard-outline', to: '/app/dashboard' },
        { name: 'profile', label: '个人主页', icon: 'mdi-account-outline', to: user.value ? `/${user.value.username}` : '/app/account' },
        { name: 'settings', label: '设置', icon: 'mdi-cog-outline', to: '/app/account' },
      );
    }

    items.push(
      { name: 'scratch', label: 'Scratch', icon: 'mdi-cat', to: '/app/scratch' },
      { name: 'services', label: '云服务', icon: 'mdi-cloud-outline', to: '/app/services' },
    );

    if (!isLogin.value) {
      items.push(
        { name: 'login', label: '登录', icon: 'mdi-login', to: '/app/account/login' },
        { name: 'register', label: '注册', icon: 'mdi-account-plus-outline', to: '/app/account/register' },
      );
    }

    return items;
  });

  const goHome = () => {
    if (route.path === '/') {
      window.location.reload();
    } else {
      router.push('/');
    }
  };

  return {
    isLogin,
    user,
    userAvatar,
    isDark,
    proxyEnabled,
    isAdminRoute,
    adminNavItems,
    unifiedNavItems,
    initConfig,
    toggleTheme,
    isRouteActive,
    goHome,
  };
}
