<template>
  <v-app-bar :elevation="2" fixed>
    <template #prepend>
      <v-app-bar-nav-icon
        @click.stop="$emit('toggle-drawer')"
      ></v-app-bar-nav-icon>
    </template>
    <v-btn :active="false" icon variant="text" @click="goHome">
      <v-icon>
        <svg
          fill="none"
          height="200"
          viewBox="0 0 200 200"
          width="200"
          xmlns="http://www.w3.org/2000/svg"
          xmlns:xlink="http://www.w3.org/1999/xlink"
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
      </v-icon>
    </v-btn>
    <v-app-bar-title>
      <template v-if="isProjectPath">
        <div class="d-flex align-center">
          <v-btn
            :to="`/${getPathSegments[0]}`"
            class="text-none"
            variant="text"
          >
            {{ getPathSegments[0] }}
          </v-btn>
          <span class="mx-1">/</span>
          <v-btn
            :to="`/${getPathSegments[0]}/${getPathSegments[1]}`"
            class="text-none"
            variant="text"
          >
            {{ getPathSegments[1] }}
          </v-btn>
        </div>
      </template>
      <template v-else><strong>Zero</strong>Cat</template>
    </v-app-bar-title>
    <template #append>
      <SearchDialog />
      <v-menu>
        <template v-slot:activator="{ props }">
          <v-btn icon="mdi-plus" v-bind="props"></v-btn>
        </template>
        <v-list>
                <v-list-item prepend-icon="mdi-pencil" @click="clickOpenPostDialog()">
            <v-list-item-title>帖子</v-list-item-title>
            <v-list-item-subtitle>what's happend?</v-list-item-subtitle>
          </v-list-item>
          <v-list-item to="/app/new" prepend-icon="mdi-plus">
            <v-list-item-title>项目</v-list-item-title>
            <v-list-item-subtitle>创建新的项目</v-list-item-subtitle>
          </v-list-item>
          <v-list-item to="/app/articles/new" prepend-icon="mdi-file-document-edit-outline">
            <v-list-item-title>文章</v-list-item-title>
            <v-list-item-subtitle>写一篇长文章</v-list-item-subtitle>
          </v-list-item>
          <v-list-item to="/app/extensions/my" prepend-icon="mdi-puzzle">
            <v-list-item-title>扩展</v-list-item-title>
            <v-list-item-subtitle>发布你的Scratch扩展</v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-menu>

      <!-- 用户菜单 -->
      <v-menu :close-on-content-click="false" location="bottom">
        <template #activator="{ props, isActive }">
          <template v-if="localuser.isLogin.value">
            <v-btn icon v-bind="props">
              <v-badge
                v-if="unreadCount > 0"
                :content="unreadCount"
                color="error"
                location="top end"
                offset-x="2"
                offset-y="2"
              >
                <v-avatar :image="localuser.getUserAvatar()"></v-avatar>
              </v-badge>
              <v-avatar v-else :image="localuser.getUserAvatar()"></v-avatar>
            </v-btn>
          </template>
          <template v-else>
            <v-btn
              rounded="xl"
              @click="authStore.showLoginDialog()"
            >登录</v-btn>
            <v-btn
              color="primary"
              rounded="xl"
              text="注册"
              to="/app/account/register"
              variant="tonal"
            ></v-btn>
          </template>
        </template>
        <v-card border min-width="300px"
          ><v-tabs v-model="userTab" grow>
            <v-tab value="notifications">通知</v-tab>
            <v-tab value="profile">个人资料</v-tab>
          </v-tabs>
          <v-divider></v-divider>

          <v-tabs-window v-model="userTab">
            <v-tabs-window-item value="notifications">
              <NotificationsCard
                min-width="400px"
                max-width="500px"
                ref="notificationsCard"
                :autoFetch="true"
                :maxHeight="'420px'"
                :menuMode="true"
                :showHeader="false"
                @update:unread-count="updateUnreadCount"
              />
            </v-tabs-window-item>

            <v-tabs-window-item value="profile">
              <v-card
                :append-avatar="localuser.getUserAvatar()"
                :subtitle="localuser.user.value.username"
                :title="localuser.user.value.display_name"
                @click="reloadinfos()"
              ></v-card>

              <v-list>
                <v-list-item
                  :to="`/${localuser.user.value.username}`"
                  color="primary"
                  prepend-icon="mdi-account"
                  rounded="xl"
                  title="个人主页"
                ></v-list-item>
                <v-list-item
                  color="primary"
                  prepend-icon="mdi-cog"
                  rounded="xl"
                  title="设置"
                  to="/app/account"
                ></v-list-item>
                <v-list-item
                  color="primary"
                  prepend-icon="mdi-xml"
                  rounded="xl"
                  title="项目"
                  to="/app/project"
                ></v-list-item>
                <v-list-item
                  color="primary"
                  prepend-icon="mdi-format-list-bulleted"
                  rounded="xl"
                  title="列表"
                  to="/app/projectlist"
                ></v-list-item>
              </v-list>
              <v-divider></v-divider>
              <v-list>
                <v-list-item
                  active
                  color="error"
                  prepend-icon="mdi-logout"
                  rounded="xl"
                  title="退出"
                  to="/app/account/logout"
                  variant="plain"
                ></v-list-item>
              </v-list>
            </v-tabs-window-item>


          </v-tabs-window>
        </v-card>
      </v-menu>
    </template>
    <template v-if="subNavItems.length || showEditorTabs" v-slot:extension>
      <transition name="fade">
        <!-- 编辑器标签页 -->
        <v-tabs
          v-if="showEditorTabs"
          v-model="activeEditorTab"
          class="editor-tabs"
          density="compact"
          show-arrows
        >
          <v-tab
            v-for="tab in editorTabs"
            :key="tab.id"
            :value="tab.id"
            class="editor-tab"
            :class="{ 'editor-tab--modified': tab.modified }"
          >
            <div class="d-flex align-center">
              <v-icon :icon="tab.icon" size="16" class="mr-2"></v-icon>
              <span class="tab-title">{{ tab.title }}</span>
              <v-btn
                v-if="tab.closeable"
                icon
                size="x-small"
                variant="text"
                class="ml-2 close-btn"
                @click.stop="closeTab(tab.id)"
              >
                <v-icon size="12">mdi-close</v-icon>
              </v-btn>
            </div>
          </v-tab>
        </v-tabs>
        <!-- 原有的导航标签页 -->
        <v-tabs
          v-else-if="subNavItems.length"
          v-model="activeTab"
          align-tabs="center"
        >
          <div v-for="item in subNavItems" :key="item.name">
            <v-tab
              :disabled="item.disabled"
              :to="item.link"
              :value="item.name"
              rounded="lg"
            >
              {{ item.title }}
            </v-tab>
          </div>
        </v-tabs>
      </transition>
    </template>
  </v-app-bar>
</template>

<script>
import { localuser } from "@/services/localAccount";
import { useTheme } from "vuetify";
import { ref, onMounted, watch, nextTick, computed } from "vue";
import { storeToRefs } from "pinia";
import { useRoute, useRouter } from "vue-router";
import NotificationsCard from "@/components/NotificationsCard.vue";
import SearchDialog from "@/components/SearchDialog.vue";
import { get, fetchConfig } from "@/services/serverConfig";
import { useNotificationStore } from "@/stores/notification";
import { useAuthStore } from "@/stores/auth";
import { openPostDialog } from '@/composables/usePostDialog';

export default {
  components: {
    NotificationsCard,
    SearchDialog,

  },
  props: {},
  emits: ['toggle-drawer', 'tab-switched', 'tab-added', 'tab-removing', 'tab-removed'],
  async mounted() {
    this.s3BucketUrl = get("s3.staticurl");
    // 获取scratchproxy.enabled配置
    this.proxyEnabled = get("scratchproxy.enabled");
  },
  setup(props) {
    const route = useRoute();
    const router = useRouter();
    const notificationsCard = ref(null);
    const notificationStore = useNotificationStore();
    const authStore = useAuthStore();
    const { unreadCount } = storeToRefs(notificationStore);

    // 监听登录状态变化
    watch(
      () => localuser.isLogin.value,
      async (isLogin) => {
        if (isLogin) {
          // 获取未读通知数量
          await fetchUnreadCount();
        } else {
          notificationStore.resetUnreadCount();
        }
      }
    );

    // 更新未读通知计数
    const updateUnreadCount = (count) => {
      notificationStore.setUnreadCount(count);
    };

    // 从 Pinia store 同步未读通知数量
    const fetchUnreadCount = async () => {
      await notificationStore.fetchUnreadCount();
    };

    onMounted(async () => {
      // 如果用户已登录，获取未读通知数量
      if (localuser.isLogin.value) {
        await fetchUnreadCount();
      }
    });

    return {
      notificationsCard,
      unreadCount,
      updateUnreadCount,
      fetchUnreadCount,
      localuser,
      authStore,
      s3BucketUrl: "",
    };
  },
  data() {
    return {
      BASE_API: import.meta.env.VITE_APP_BASE_API,
      isLogin: localuser.isLogin,
      items: this.initializeNavItems(),
      subNavItems: [],
      hideNavPaths: ["/app", "/404"],
      hideExactPaths: ["/", "/index.html"],
      activeTab: "notifications",
      isDarkTheme: false,
      theme: null,
      userTab: "profile",
      proxyEnabled: false,
      // 编辑器标签页相关
      showEditorTabs: false,
      activeEditorTab: null,
      editorTabs: [],
      tabIdCounter: 0,
    };
  },
  created() {
    const savedTheme = localStorage.getItem("theme");

    this.updateSubNavItems(this.$route);

    // Initialize theme — 无存储时跟随系统
    this.theme = useTheme();
    if (savedTheme) {
      this.isDarkTheme = savedTheme === "dark";
    } else {
      this.isDarkTheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    this.applyTheme();
  },
  watch: {
    userInfo() {
      this.$forceUpdate();
    },
    $route(to) {
      this.updateSubNavItems(to);
    },
    activeTab(newVal) {
      this.setSubNavItems(this.$route);
    },
    "localuser.isLogin"(newVal) {
      if (newVal && this.notificationsCard) {
        this.notificationsCard.checkUnreadNotifications();
      }
    },

    activeEditorTab(newTabId, oldTabId) {
      if (newTabId !== oldTabId) {
        const previousTab = this.editorTabs.find((tab) => tab.id === oldTabId);
        const currentTab = this.editorTabs.find((tab) => tab.id === newTabId);

        this.$emit("tab-switched", {
          from: previousTab,
          to: currentTab,
        });
      }
    },
  },
  methods: {
    clickOpenPostDialog() {
      openPostDialog();
      this.$emit('open-composer');
    },
    reloadinfos() {
      localuser.loadUser(true);
      if (this.notificationsCard) {
        this.notificationsCard.checkUnreadNotifications();
      }
      this.$router.push('/' + localuser.user.value.username);
    },
    goHome() {
      if (this.$route.path === "/") {
        window.location.reload();
      } else {
        this.$router.push("/");
      }
    },
    checkNotifications() {
      if (this.notificationsCard) {
        this.notificationsCard.notificationsHandler.fetchNotifications();
      }
    },

    toggleTheme() {
      this.isDarkTheme = !this.isDarkTheme;
      localStorage.setItem("theme", this.isDarkTheme ? "dark" : "light");
      this.applyTheme();
    },

    applyTheme() {
      if (this.theme) {
        this.theme.global.name = this.isDarkTheme ? "dark" : "light";
      }
    },

    initializeNavItems() {
      const items = {
        main: {
          title: "导航",
          icon: "mdi-menu",
          login: false,
          list: [
            { title: "首页", link: "/", icon: "mdi-home", login: false },
            {
              title: "仪表盘",
              link: "/app/dashboard",
              icon: "mdi-view-dashboard",
              login: true,
            },
            {
              title: "帖文",
              link: "/app/posts",
              icon: "mdi-twitter",
              login: false,
            },
            {
              title: "项目",
              link: "/app/explore",
              icon: "mdi-xml",
              login: false,
            },
            {
              title: "搜索",
              link: "/app/search",
              icon: "mdi-earth",
              login: false,
            },
          ],
        },
        tools: {
          login: false,
          icon: "mdi-tools",
          title: "工具",
          list: [
            {
              title: "桌面版镜像",
              link: "/app/tools/asdm",
              icon: "mdi-download",
              login: false,
            },
            {
              title: "项目比较器",
              link: "/app/tools/comparer",
              icon: "mdi-xml",
              login: false,
            },
          ],
        },
      };

      // 只有当proxyEnabled为true时才添加mirror部分
      if (this.proxyEnabled) {
        items.mirror = {
          title: "镜像",
          icon: "mdi-link-variant",
          login: true,
          list: [
            {
              title: "首页",
              link: "/app/proxy",
              icon: "mdi-home",
              login: false,
            },
            {
              title: "探索",
              link: "/app/proxy/explore",
              icon: "mdi-earth",
              login: false,
            },
            {
              title: "搜索",
              link: "/app/proxy/search",
              icon: "mdi-xml",
              login: false,
            },
            {
              title: "新闻",
              link: "/app/proxy/news",
              icon: "mdi-newspaper",
              login: false,
            },
            {
              title: "打开",
              link: "/app/proxy/open",
              icon: "mdi-link",
              login: false,
            },
          ],
        };
      }

      return items;
    },
    updateSubNavItems(route) {
      if (this.shouldHideNav(route.path)) {
        this.subNavItems = [];
        this.activeTab = null;
      } else {
        this.setSubNavItems(route);
      }
    },
    shouldHideNav(path) {
      // /app/proxy 需要显示子项目 tabs
      if (path.startsWith("/app/proxy")) return false;
      return (
        this.hideNavPaths.some((hidePath) => path.startsWith(hidePath)) ||
        this.hideExactPaths.includes(path)
      );
    },
    setSubNavItems(route) {
      // /app/proxy 子项目 tabs
      if (route.path.startsWith("/app/proxy")) {
        this.subNavItems = this.getProxySubNavItems();
        const matched = this.subNavItems.find((i) => i.link === route.path);
        this.activeTab = matched?.name || null;
        return;
      }

      const pathSegments = route.path.split("/").filter(Boolean);
      if (this.shouldHideNav(route.path)) {
        this.subNavItems = [];
        this.activeTab = null;
      } else if (pathSegments.length === 1) {
        this.subNavItems = this.getUserSubNavItems(pathSegments[0]);
        this.activeTab = route.query.tab || "home";
      } else if (pathSegments[1] === 'articles') {
        // Articles section — show user subnav, mark articles tab active
        // /username/articles (list), /username/articles/slug (detail), /username/articles/slug/edit (editor)
        if (pathSegments.length >= 3 && pathSegments[3] === 'edit') {
          // Full-screen editor: hide subnav
          this.subNavItems = [];
          this.activeTab = null;
        } else {
          this.subNavItems = this.getUserSubNavItems(pathSegments[0]);
          this.activeTab = 'articles';
        }
      } else {
        this.subNavItems = this.getProjectSubNavItems(
          pathSegments[1],
          pathSegments[0]
        );
        this.activeTab = pathSegments[2] || "home";
      }
    },
    getProxySubNavItems() {
      if (!this.proxyEnabled) return [];
      return [
        { title: "首页", link: "/app/proxy",name:"proxy-home"},
        { title: "探索", link: "/app/proxy/explore", name: "proxy-explore" },
        { title: "搜索", link: "/app/proxy/search", name: "proxy-search" },
        { title: "新闻", link: "/app/proxy/news", name: "proxy-news" },
        { title: "打开", link: "/app/proxy/open", name: "proxy-open" },
      ];
    },
    getUserSubNavItems(userId) {
      return [
        { title: "主页", link: `/${userId}`, name: "home" },
        { title: "项目", link: `/${userId}/?tab=projects`, name: "projects" },
        { title: "列表", link: `/${userId}/?tab=lists`, name: "lists" },
        { title: "文章", link: `/${userId}/articles`, name: "articles" },
        { title: "关注者", link: `/${userId}/?tab=followers`, name: "followers" },
        { title: "关注的人", link: `/${userId}/?tab=following`, name: "following" },
        { title: "时间线", link: `/${userId}/?tab=timeline`, name: "timeline" },
        { title: "评论", link: `/${userId}/?tab=comment`, name: "comment" },
      ];
    },
    getProjectSubNavItems(projectname, authorname) {
      const isAuthor = localuser.user.value.username == authorname;
      return [
        { title: "代码", link: `/${authorname}/${projectname}`, name: "home" },
        {
          title: "分析",
          link: `/${authorname}/${projectname}/analytics`,
          name: "analytics",
        },
        ...(isAuthor
          ? [
              {
                title: "设置",
                link: `/${authorname}/${projectname}/settings`,
                name: "settings",
              },
            ]
          : []),
      ];
    },
    // 编辑器标签页管理方法
    enableEditorTabs() {
      this.showEditorTabs = true;
    },

    disableEditorTabs() {
      this.showEditorTabs = false;
      this.editorTabs = [];
      this.activeEditorTab = null;
    },

    addTab(tabConfig) {
      const tabId = `tab-${++this.tabIdCounter}`;
      const tab = {
        id: tabId,
        title: tabConfig.title || "未命名",
        icon: tabConfig.icon || "mdi-file-document",
        type: tabConfig.type || "editor", // editor, diff, view
        closeable: tabConfig.closeable !== false,
        modified: false,
        data: tabConfig.data || {},
      };

      this.editorTabs.push(tab);
      this.activeEditorTab = tabId;

      // 通知父组件标签页已创建
      this.$emit("tab-added", tab);

      return tab;
    },

    removeTab(tabId) {
      const index = this.editorTabs.findIndex((tab) => tab.id === tabId);
      if (index !== -1) {
        const tab = this.editorTabs[index];

        // 通知父组件标签页即将被移除
        this.$emit("tab-removing", tab);

        this.editorTabs.splice(index, 1);

        // 如果被删除的是当前活动标签页，切换到下一个
        if (this.activeEditorTab === tabId) {
          if (this.editorTabs.length > 0) {
            // 优先选择下一个标签页，如果没有就选择前一个
            const nextIndex =
              index < this.editorTabs.length ? index : index - 1;
            this.activeEditorTab = this.editorTabs[nextIndex].id;
          } else {
            this.activeEditorTab = null;
          }
        }

        // 通知父组件标签页已被移除
        this.$emit("tab-removed", tab);
      }
    },

    closeTab(tabId) {
      const tab = this.editorTabs.find((t) => t.id === tabId);
      if (tab && tab.modified) {
        // 如果有未保存的更改，弹出确认对话框
        if (confirm(`标签页 "${tab.title}" 有未保存的更改，确定要关闭吗？`)) {
          this.removeTab(tabId);
        }
      } else {
        this.removeTab(tabId);
      }
    },

    updateTab(tabId, updates) {
      const tab = this.editorTabs.find((t) => t.id === tabId);
      if (tab) {
        Object.assign(tab, updates);
      }
    },

    setTabModified(tabId, modified = true) {
      this.updateTab(tabId, { modified });
    },

    getActiveTab() {
      return this.editorTabs.find((tab) => tab.id === this.activeEditorTab);
    },

    switchToTab(tabId) {
      if (this.editorTabs.find((tab) => tab.id === tabId)) {
        const previousTab = this.getActiveTab();
        this.activeEditorTab = tabId;
        const currentTab = this.getActiveTab();

        // 通知父组件标签页切换
        this.$emit("tab-switched", {
          from: previousTab,
          to: currentTab,
        });
      }
    },
  },
  computed: {
    getPathSegments() {
      return decodeURIComponent(this.$route.path).split("/").filter(Boolean);
    },
    isProjectPath() {
      const pathSegments = this.getPathSegments;
      return (
        pathSegments.length >= 2 &&
        !this.hideNavPaths.some((path) => this.$route.path.startsWith(path))
      );
    },
    isAdminRoute() {
      return this.$route.path.startsWith("/app/admin");
    },
    isHomePage() {
      return this.$route.path === "/" || this.$route.path === "/index.html";
    },
  },
};
</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s;
}

.fade-enter,
.fade-leave-to {
  opacity: 0;
}

/* 编辑器标签页样式 */
.editor-tabs {
  border-bottom: 1px solid rgba(var(--v-border-color), 0.12);
}

.editor-tab {
  min-width: 120px;
  max-width: 200px;
  text-transform: none;
  border-right: 1px solid rgba(var(--v-border-color), 0.12);
  position: relative;
}

.editor-tab--modified .tab-title::after {
  content: "●";
  color: rgb(var(--v-theme-warning));
  margin-left: 4px;
}

.editor-tab .close-btn {
  opacity: 0;
  transition: opacity 0.2s;
}

.editor-tab:hover .close-btn {
  opacity: 1;
}

.tab-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
  font-size: 13px;
}
</style>



