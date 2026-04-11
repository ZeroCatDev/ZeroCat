<template>
  <div>
    <!-- 加载中 -->
    <div v-if="loading" class="d-flex justify-center align-center py-4">
      <v-progress-circular indeterminate></v-progress-circular>
    </div>

    <!-- 加载错误 -->
    <div v-else-if="error" class="text-center py-4 text-error">
      {{ error }}
      <v-btn variant="text" @click="fetchNotifications()">重试</v-btn>
    </div>

    <!-- 通知列表 -->
    <template v-else>
      <div
        ref="notificationsContainer"
        :style="{ 'overflow-y': 'auto' }"
        @scroll="handleScroll"
      >
        <v-list v-if="notifications.length > 0" class="notifications-list">
          <v-list-item
            v-for="notification in notifications"
            :key="notification.id"
            :active="!notification.read"
            :class="[
              'notification-item',
              {
                'clickable-item': true,
                'unread-notification': !notification.read,
                'is-page-mode': showPagination
              }
            ]"
            color="primary"
            @click="handleNotificationClick(notification)"
          >
            <template v-slot:prepend>
              <!-- 使用actor用户的头像 -->
              <v-avatar v-if="notification.actor?.avatar" size="36">
                <v-img
                  :src="localuser.getUserAvatar(notification.actor.avatar)"
                  alt="用户头像"
                ></v-img>
              </v-avatar>
              <v-avatar
                v-else-if="notification.template_info?.icon"
                class="system-avatar"
                color="primary"
                size="36"
              >
                <v-icon>{{
                  getIconForType(notification.template_info.icon)
                }}</v-icon>
              </v-avatar>
              <v-avatar v-else class="system-avatar" color="primary" size="36">
                <v-icon>mdi-bell</v-icon>
              </v-avatar>
            </template>

            <div class="notification-main">
              <div class="notification-row-top">
                <div class="notification-title-text" :class="showPagination ? 'font-weight-medium' : 'text-body-2'">
                  {{ notification.title || "系统消息" }}
                </div>
                <div class="notification-meta d-flex align-center">
                  <span class="text-caption text-grey">{{ formatRelativeTime(notification.created_at) }}</span>
                  <v-icon
                    v-if="!notification.read"
                    color="primary"
                    size="14"
                    class="ml-1"
                  >
                    mdi-circle
                  </v-icon>
                </div>
              </div>

              <div v-if="showPagination" class="notification-subtitle text-body-2">
                <span v-if="notification.template_info?.template">
                  <template v-if="notification.rendered_content">
                    {{ notification.rendered_content }}
                  </template>
                  <template v-else>
                    加载中...
                  </template>
                </span>
                <span v-else>{{ notification.content || "新的通知" }}</span>
              </div>
            </div>

            <template v-slot:append>
              <div class="d-flex align-center">
                <v-btn
                  size="x-small"
                  variant="text"
                  color="primary"
                  class="notification-detail-btn"
                  @click.stop="openNotificationDetail(notification)"
                >
                  详情
                </v-btn>
              </div>
            </template>
          </v-list-item>
        </v-list>

        <!-- 无通知状态 -->
        <div v-else class="py-8 text-center">
          <v-icon color="grey" size="large">mdi-bell-off</v-icon>
          <div class="text-body-2 text-grey mt-2">暂无通知</div>
        </div>

        <!-- 加载更多区域 -->
        <div v-if="hasMoreNotifications" class="text-center py-4">
          <v-btn
            v-if="!autoLoadMore"
            :loading="loadingMore"
            variant="text"
            @click="loadMoreNotifications"
          >
            加载更多
          </v-btn>
          <v-progress-circular
            v-else-if="loadingMore"
            indeterminate
            size="24"
          ></v-progress-circular>
        </div>
      </div>

      <!-- 底部控制区 -->
      <template v-if="!showPagination">
        <v-divider class="my-1"></v-divider>
        <div class="d-flex align-center justify-space-between pa-2">
          <v-btn
            :disabled="!hasUnread"
            size="small"
            variant="text"
            @click="markAllAsRead"
          >
            标记全部已读
          </v-btn>
          <v-btn size="small" to="/app/notifications" variant="text">
            查看全部通知
            <v-icon end>mdi-arrow-right</v-icon>
          </v-btn>
        </div>
      </template>

      <!-- 页面模式下的底部控制区 -->
      <template v-else>
        <v-divider class="my-1"></v-divider>
        <div class="d-flex align-center justify-space-between pa-2">
          <v-btn
            :disabled="!hasUnread"
            size="small"
            variant="text"
            @click="markAllAsRead"
          >
            标记全部已读
          </v-btn>

          <!-- 加载更多按钮（页面模式） -->
          <v-btn
            v-if="hasMoreNotifications && !autoLoadMore"
            :loading="loadingMore"
            size="small"
            variant="outlined"
            @click="loadMoreNotifications"
          >
            加载更多通知
          </v-btn>

          <!-- 自动加载模式下的加载指示器 -->
          <div v-else-if="hasMoreNotifications && autoLoadMore && loadingMore" class="d-flex align-center">
            <v-progress-circular
              indeterminate
              size="20"
              width="2"
              class="mr-2"
            ></v-progress-circular>
            <span class="text-caption">加载中...</span>
          </div>

          <!-- 没有更多数据时的提示 -->
          <span v-else-if="!hasMoreNotifications && notifications.length > 0" class="text-caption text-grey">
            已加载全部通知
          </span>
        </div>
      </template>
    </template>

    <!-- 通知详情对话框 -->
    <v-dialog
      v-model="showDetailDialog"
      max-width="700px"
      scrollable
      persistent
    >
      <v-card v-if="selectedNotification">
        <!-- 标题栏 -->
        <v-card-title class="d-flex align-center justify-space-between pa-4">
          <div class="d-flex align-center">
            <!-- 头像 -->
            <v-avatar
              v-if="selectedNotification.actor?.avatar"
              :image="
                localuser.getUserAvatar(selectedNotification.actor.avatar)
              "
              size="40"
              class="mr-3"
            ></v-avatar>
            <v-avatar
              v-else-if="getNotificationIcon(selectedNotification)"
              color="primary"
              size="40"
              class="mr-3"
            >
              <v-icon>{{ getNotificationIcon(selectedNotification) }}</v-icon>
            </v-avatar>
            <v-avatar v-else color="grey" size="40" class="mr-3">
              <v-icon>mdi-bell</v-icon>
            </v-avatar>

            <div>
              <h3 class="text-h6">{{ getNotificationTitle() }}</h3>
              <div class="text-caption text-grey">
                {{ formatDate(selectedNotification.created_at) }}
              </div>
            </div>
          </div>

          <div class="d-flex align-center ga-2">
            <!-- 状态标签 -->
            <v-chip
              v-if="!selectedNotification.read"
              color="error"
              size="small"
              variant="tonal"
            >
              未读
            </v-chip>

            <v-chip
              v-if="selectedNotification.high_priority"
              color="warning"
              size="small"
              variant="tonal"
            >
              重要
            </v-chip>

            <v-btn
              icon="mdi-close"
              size="small"
              variant="text"
              @click="closeDetailDialog"
            ></v-btn>
          </div>
        </v-card-title>

        <v-divider></v-divider>

        <!-- 内容区域 -->
        <v-card-text class="pa-4">
          <!-- 通知内容 -->
          <div class="mb-4">

            <p class="text-body-1">
              {{ getNotificationContent() }}
            </p>
          </div>

          <!-- 发送者信息 -->
          <div v-if="selectedNotification.actor" class="mb-4">
            <v-card variant="tonal" @click="visitUserProfile">
              <v-card-text class="pa-3">
                <div class="d-flex align-center">
                  <v-avatar
                    v-if="selectedNotification.actor.avatar"
                    :image="
                      localuser.getUserAvatar(selectedNotification.actor.avatar)
                    "
                    size="48"
                    class="mr-3"
                  ></v-avatar>
                  <v-avatar v-else color="grey" size="48" class="mr-3">
                    <v-icon>mdi-account</v-icon>
                  </v-avatar>

                  <div class="flex-1">
                    <div class="text-body-1 font-weight-medium">
                      由 {{
                        selectedNotification.actor.display_name ||
                        selectedNotification.actor.username
                      }} 产生
                    </div>
                    <div class="text-caption text-grey">
                      @{{ selectedNotification.actor.username }}
                    </div>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </div>

          <!-- 相关链接 -->
          <div v-if="hasNotificationLink()" class="mb-4">
            <!-- 目标链接卡片 -->
            <div v-if="hasTargetLink()" class="mb-3">
              <h4 class="text-subtitle-1 mb-2">
                <v-icon start>mdi-target</v-icon>
                相关内容
              </h4>
              <v-card variant="tonal" @click="openTargetLink">
                <v-card-text class="pa-3">
                  <div class="d-flex align-center justify-space-between">
                    <div class="d-flex align-center">
                      <v-icon color="primary" class="mr-3">mdi-link</v-icon>
                      <div>
                        <div class="text-body-2 font-weight-medium">
                          {{ getTargetLinkDescription() }}
                        </div>
                        <div class="text-caption text-grey">
                          链接到 {{ getTargetLink() }}
                        </div>
                      </div>
                    </div>
                    <v-btn
                      color="primary"
                      variant="tonal"
                      size="small"
                      prepend-icon="mdi-open-in-new"
                      @click.stop="openTargetLink"
                    >
                      访问
                    </v-btn>
                  </div>
                </v-card-text>
              </v-card>
            </div>

            <!-- 原始链接卡片 -->
            <div v-if="hasOriginalLink()">
              <h4 v-if="hasTargetLink()" class="text-subtitle-1 mb-2">
                <v-icon start>mdi-link-variant</v-icon>
                附加链接
              </h4>
              <h4 v-else class="text-subtitle-1 mb-2">
                <v-icon start>mdi-link</v-icon>
                相关链接
              </h4>
              <v-card variant="tonal" @click="openOriginalLink">
                <v-card-text class="pa-3">
                  <div class="d-flex align-center justify-space-between">
                    <div class="d-flex align-center">
                      <v-icon color="secondary" class="mr-3">
                        {{ getOriginalLink().startsWith('http') ? 'mdi-open-in-new' : 'mdi-link' }}
                      </v-icon>
                      <div>
                        <div class="text-body-2 font-weight-medium">
                          {{ getOriginalLinkDescription() }}
                        </div>
                        <div class="text-caption text-grey">
                          {{ getOriginalLink() }}
                        </div>
                      </div>
                    </div>
                    <v-btn
                      color="secondary"
                      variant="tonal"
                      size="small"
                      :prepend-icon="getOriginalLink().startsWith('http') ? 'mdi-open-in-new' : 'mdi-arrow-right'"
                      @click.stop="openOriginalLink"
                    >
                      {{ getOriginalLink().startsWith('http') ? '打开' : '访问' }}
                    </v-btn>
                  </div>
                </v-card-text>
              </v-card>
            </div>
          </div>

          <!-- 其他信息 -->
          <div v-if="selectedNotification.data" class="mb-4">
            <v-expansion-panels variant="accordion">
              <v-expansion-panel>
                <v-expansion-panel-title>
                  <v-icon start>mdi-information</v-icon>
                  展开查看详细信息
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <pre class="detail-info">{{
                    JSON.stringify(selectedNotification.data, null, 2)
                  }}</pre>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </div>

          <!-- 元数据 -->
          <div class="metadata-section">
            <v-divider class="mb-3"></v-divider>
            <div class="d-flex flex-wrap ga-4">
              <div class="metadata-item">
                <span class="text-caption text-grey">通知ID：</span>
                <code class="text-caption">{{ selectedNotification.id }}</code>
              </div>

              <div class="metadata-item">
                <span class="text-caption text-grey">类型：</span>
                <v-chip size="small" variant="tonal">
                  {{ getNotificationType() }}
                </v-chip>
              </div>

              <div v-if="selectedNotification.read_at" class="metadata-item">
                <span class="text-caption text-grey">已读时间：</span>
                <span class="text-caption">{{
                  formatDate(selectedNotification.read_at)
                }}</span>
              </div>
            </div>
          </div>
        </v-card-text>

        <v-divider></v-divider>

        <!-- 操作按钮 -->
        <v-card-actions class="pa-4">
          <div class="d-flex justify-space-between w-100">
            <div class="d-flex ga-2">

            </div>

            <div class="d-flex ga-2">


              <v-btn @click="closeDetailDialog">
                关闭
              </v-btn>
            </div>
          </div>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import {
  getNotifications,
  markNotificationAsRead,
} from "@/services/notificationService";
import { getProjectInfo, getProjectListById } from "@/services/projectService";
import { get } from "@/services/serverConfig";
import { localuser } from "@/services/localAccount";
import { useNotificationStore } from "@/stores/notification";
export default {
  name: "NotificationsCardContent",
  props: {
    showPagination: {
      type: Boolean,
      default: false,
    },
    autoLoadMore: {
      type: Boolean,
      default: true,
    },
    autoFetch: {
      type: Boolean,
      default: true,
    },
    notification: {
      type: Object,
      required: false,
      default: () => ({}),
    },
    maxItems: {
      type: Number,
      default: 0, // 0 表示不限制
    },
    useWindowScroll: {
      type: Boolean,
      default: false, // 是否使用窗口滚动来触发加载更多
    },
  },
  emits: ["update:unread-count"],
  async setup(props, { emit }) {
    const router = useRouter();
    const notificationStore = useNotificationStore();
    const notifications = ref([]);
    const loading = ref(false);
    const loadingMore = ref(false);
    const error = ref(null);
    const unreadCount = computed(() => notificationStore.unreadCount);
    const hasMoreNotifications = ref(false);
    const loadMoreUrl = ref(null);
    const notificationsContainer = ref(null);
    const s3BucketUrl = ref("");
    const projectCache = ref({});
    const projectListCache = ref({});
    const userCache = ref({}); // 新增用户缓存

    // 详情对话框状态
    const showDetailDialog = ref(false);
    const selectedNotification = ref(null);

    // Initialize s3BucketUrl
    onMounted(async () => {
      try {
        s3BucketUrl.value = get("s3.staticurl");
      } catch (err) {
        console.error("Failed to get s3BucketUrl:", err);
        s3BucketUrl.value = "";
      }
    });

    const hasUnread = computed(() => unreadCount.value > 0);

    // 处理API错误
    const handleApiError = (error, customMessage = "操作失败") => {
      console.error(error);
      return error.response?.data?.message || error.message || customMessage;
    };

    // 获取通知数据
    const fetchNotifications = async () => {
      if (loading.value) return;

      loading.value = true;
      error.value = null;

      try {
        // 如果设置了 maxItems，使用它作为 limit
        const limit = props.maxItems > 0 ? props.maxItems : 20;
        const data = await getNotifications({ limit });
        let notificationsList = data.notifications || [];

        // 如果设置了 maxItems，截取前 N 条
        if (props.maxItems > 0 && notificationsList.length > props.maxItems) {
          notificationsList = notificationsList.slice(0, props.maxItems);
        }

        notifications.value = notificationsList;

        // 如果设置了 maxItems 限制，不显示加载更多
        if (props.maxItems > 0) {
          loadMoreUrl.value = null;
          hasMoreNotifications.value = false;
        } else {
          loadMoreUrl.value = data.load_more_notifications || null;
          hasMoreNotifications.value = !!loadMoreUrl.value;
        }

        await updateUnreadCount();

        // 处理通知模板
        await prepareTemplateData(notifications.value);
        processNotificationTemplates(notifications.value);
      } catch (err) {
        error.value = handleApiError(err, "加载通知失败");
      } finally {
        loading.value = false;
      }
    };

    // 加载更多通知
    const loadMoreNotifications = async () => {
      if (loadingMore.value || !loadMoreUrl.value) return;

      loadingMore.value = true;
      try {
        const data = await getNotifications({ url: loadMoreUrl.value });
        const newNotifications = data.notifications || [];
        notifications.value = [...notifications.value, ...newNotifications];
        loadMoreUrl.value = data.load_more_notifications || null;
        hasMoreNotifications.value = !!loadMoreUrl.value;

        // 处理新加载的通知模板
        await prepareTemplateData(newNotifications);
        processNotificationTemplates(newNotifications);
      } catch (err) {
        error.value = handleApiError(err, "加载更多通知失败");
      } finally {
        loadingMore.value = false;
      }
    };

    // 预先加载通知所需的项目、项目列表和用户数据
    const prepareTemplateData = async (notificationsList) => {
      try {
        // 收集所有需要获取的项目、项目列表和用户ID
        const projectIds = new Set();
        const projectListIds = new Set();
        const userIds = new Set();

        // 收集所有需要的ID
        notificationsList.forEach((notification) => {
          // 收集target IDs
          if (notification.target_id) {
            if (notification.target_type === "project") {
              projectIds.add(notification.target_id);
            } else if (notification.target_type === "projectlist") {
              projectListIds.add(notification.target_id);
            } else if (notification.target_type === "user") {
              userIds.add(notification.target_id);
            }
          }

          // 收集data中可能的项目ID
          if (notification.data?.project_id) {
            projectIds.add(notification.data.project_id);
          }

          // 收集actor用户ID
          if (notification.actor?.id) {
            userIds.add(notification.actor.id);
          }
        });

        // 过滤掉已缓存的ID，只获取尚未缓存的数据
        const uncachedProjectIds = Array.from(projectIds).filter(
          (id) => !projectCache.value[id]
        );

        // 批量获取数据
        const promises = [];

        if (uncachedProjectIds.length > 0) {
          console.log("获取项目数据:", uncachedProjectIds);
          promises.push(
            getProjectInfo(uncachedProjectIds)
              .then((projects) => {
                console.log("获取到项目数据:", projects);
                // 将项目数据转换为以ID为键的对象格式
                if (Array.isArray(projects)) {
                  // 处理数组返回结果
                  const projectsObj = {};
                  projects.forEach((project) => {
                    if (project && project.id) {
                      projectsObj[project.id] = project;
                    }
                  });
                  // 合并到缓存中
                  projectCache.value = {
                    ...projectCache.value,
                    ...projectsObj,
                  };
                  console.log("转换后的项目数据:", projectCache.value);
                } else if (projects && projects.id) {
                  // 处理单个项目返回结果
                  projectCache.value[projects.id] = projects;
                }
              })
              .catch((err) => {
                console.error("获取项目数据失败:", err);
              })
          );
        }

        // 单独获取每个项目列表（因为API不支持批量获取）
        for (const projectListId of projectListIds) {
          if (!projectListCache.value[projectListId]) {
            console.log("获取项目列表数据:", projectListId);
            promises.push(
              getProjectListById(projectListId)
                .then((projectList) => {
                  console.log("获取到项目列表数据:", projectList);
                  // 如果成功获取到列表数据，就加入缓存
                  if (projectList && projectList.id) {
                    projectListCache.value[projectList.id] = projectList;
                  }
                })
                .catch((err) => {
                  console.error(`获取项目列表${projectListId}失败:`, err);
                  // 缓存空对象以避免重复请求不存在的资源
                  projectListCache.value[projectListId] = { error: true };
                })
            );
          }
        }

        // 等待所有数据加载完成
        await Promise.allSettled(promises);

        console.log("缓存状态:", {
          projects: projectCache.value,
          projectLists: projectListCache.value,
          users: userCache.value,
        });

        // 处理redirect_url - 智能生成基于target的链接
        notificationsList.forEach((notification) => {
          // 根据通知类型和目标构造redirect_url，优先使用target信息
          if (notification.target_type && notification.target_id) {
            if (notification.target_type === "project") {
              const project = projectCache.value[notification.target_id];
              if (project && project.author) {
                // 生成项目链接：/username/projectname
                const projectName = project.name || project.title;
                notification.redirect_url = `/${project.author.username}/${projectName}`;
                //notification.link = notification.redirect_url; // 同时更新link字段
                console.log(
                  `为通知${notification.id}生成项目链接:`,
                  notification.redirect_url
                );
              }
            } else if (notification.target_type === "user") {
              // 对于用户类型，使用actor的用户名（通常target_type为user时，actor就是目标用户）
              if (notification.actor?.username) {
                notification.redirect_url = `/${notification.actor.username}`;
                  //notification.link = notification.redirect_url;
                console.log(
                  `为通知${notification.id}生成用户链接:`,
                  notification.redirect_url
                );
              }
            } else if (notification.target_type === "projectlist") {
              const projectList =
                projectListCache.value[notification.target_id];
              if (projectList && !projectList.error) {
                // 生成项目列表链接
                notification.redirect_url = `/app/projectlist/${projectList.id}`;
                //notification.link = notification.redirect_url;
                console.log(
                  `为通知${notification.id}生成项目列表链接:`,
                  notification.redirect_url
                );
              }
            } else if (notification.target_type === "comment") {
              // 评论类型，尝试根据data中的项目信息生成链接
              if (notification.data?.project_id) {
                const project =
                  projectCache.value[notification.data.project_id];
                if (project && project.author) {
                  const projectName = project.name || project.title;
                  notification.redirect_url = `/${project.author.username}/${projectName}#comment-${notification.target_id}`;
                  //notification.link = notification.redirect_url;
                  console.log(
                    `为通知${notification.id}生成评论链接:`,
                    notification.redirect_url
                  );
                }
              }
              // 如果data中没有项目信息，但有actor信息，则链接到用户页面
              else if (notification.actor?.username) {
                notification.redirect_url = `/${notification.actor.username}`;
                //notification.link = notification.redirect_url;
                console.log(
                  `为通知${notification.id}生成评论备用用户链接:`,
                  notification.redirect_url
                );
              }
            } else if (
              notification.target_type === "follow" ||
              notification.target_type === "like"
            ) {
              // 关注和点赞类型，通常链接到actor用户页面
              if (notification.actor?.username) {
                notification.redirect_url = `/${notification.actor.username}`;
                //notification.link = notification.redirect_url;
                console.log(
                  `为通知${notification.id}生成${notification.target_type}链接:`,
                  notification.redirect_url
                );
              }
            }
          }

          // 如果没有通过target生成链接，但有原始链接，则保持原有逻辑
          if (!notification.redirect_url && !notification.link) {
            // 备用链接生成逻辑（基于actor信息）
            if (notification.actor?.username) {
              notification.redirect_url = `/${notification.actor.username}`;
              //notification.link = notification.redirect_url;
              console.log(
                `为通知${notification.id}生成备用用户链接:`,
                notification.redirect_url
              );
            }
          }
        });
      } catch (err) {
        console.error("Error preparing template data:", err);
      }
    };

    // 处理通知模板内容
    const processNotificationTemplates = (notificationsList) => {
      for (const notification of notificationsList) {
        if (notification.template_info?.template) {
          // 同步渲染模板内容
          notification.rendered_content = renderTemplate(
            notification.template_info.template,
            notification
          );
        }
      }
    };

    // 渲染通知模板
    const renderTemplate = (template, notification) => {
      if (!template) return "";

      let result = template;
      const { actor, target_type, target_id, data } = notification;

      // 使用actor信息
      if (actor) {
        result = result.replace(
          /{{actor_name}}/g,
          actor.display_name || actor.username || ""
        );
        result = result.replace(/{{actor_id}}/g, actor.id || "");
      } else {
        result = result.replace(/{{actor_name}}/g, "未知用户");
        result = result.replace(/{{actor_id}}/g, "");
      }

      // 根据目标类型获取相应信息
      if (target_type && target_id) {
        if (target_type === "user" && notification.actor) {
          result = result.replace(
            /{{target_name}}/g,
            notification.actor.display_name || notification.actor.username || ""
          );
          result = result.replace(
            /{{target_id}}/g,
            notification.actor.id || ""
          );
        } else if (target_type === "project") {
          const targetInfo = projectCache.value[target_id];
          if (targetInfo) {
            result = result.replace(/{{target_name}}/g, targetInfo.title || "");
            result = result.replace(/{{target_id}}/g, targetInfo.id || "");
          } else {
            result = result.replace(/{{target_name}}/g, "未知项目");
            result = result.replace(/{{target_id}}/g, target_id);
          }
        } else if (target_type === "projectlist") {
          const targetInfo = projectListCache.value[target_id];
          if (targetInfo && !targetInfo.error) {
            result = result.replace(/{{target_name}}/g, targetInfo.name || "");
            result = result.replace(/{{target_id}}/g, targetInfo.id || "");
          } else {
            result = result.replace(/{{target_name}}/g, "未知项目列表");
            result = result.replace(/{{target_id}}/g, target_id);
          }
        }
      }

      // 替换data字段中的变量
      if (data && typeof data === "object") {
        Object.entries(data).forEach(([key, value]) => {
          const regex = new RegExp(`{{${key}}}`, "g");
          if (typeof value === "object") {
            // 如果值是对象，尝试使用其display_name, name, 或 title属性
            const displayValue =
              value.display_name ||
              value.name ||
              value.title ||
              JSON.stringify(value);
            result = result.replace(regex, displayValue);
          } else {
            result = result.replace(regex, value?.toString() || "");
          }
        });
      }

      // 替换其他模板变量
      Object.entries(notification.template_data || {}).forEach(
        ([key, value]) => {
          result = result.replace(new RegExp(`{{${key}}}`, "g"), value || "");
        }
      );

      return result;
    };

    // 处理滚动加载
    const handleScroll = async (event) => {
      if (
        !props.autoLoadMore ||
        !hasMoreNotifications.value ||
        loadingMore.value ||
        props.maxItems > 0 // 如果设置了 maxItems，不自动加载更多
      )
        return;

      const container = event.target;
      const { scrollHeight, scrollTop, clientHeight } = container;
      const scrollBottom = scrollHeight - scrollTop - clientHeight;

      if (scrollBottom < 50) {
        await loadMoreNotifications();
      }
    };

    // 处理窗口滚动加载（用于页面模式）
    const handleWindowScroll = async () => {
      if (
        !props.useWindowScroll ||
        !props.autoLoadMore ||
        !hasMoreNotifications.value ||
        loadingMore.value ||
        props.maxItems > 0
      )
        return;

      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;
      const scrollBottom = scrollHeight - scrollTop - clientHeight;

      if (scrollBottom < 100) {
        await loadMoreNotifications();
      }
    };

    // 标记通知为已读
    const markAsRead = async (id) => {
      try {
        await markNotificationAsRead(id);
        const notification = notifications.value.find((n) => n.id === id);
        if (notification) {
          notification.read = true;
          await updateUnreadCount("decrement");
        }
      } catch (err) {
        console.error("Error marking notification as read:", err);
      }
    };

    // 标记所有通知为已读
    const markAllAsRead = async () => {
      try {
        await notificationStore.markAllAsRead();
        notifications.value.forEach((notification) => {
          notification.read = true;
        });
        await updateUnreadCount("reset");
      } catch (err) {
        console.error("Error marking all notifications as read:", err);
      }
    };

    // 更新未读计数
    const updateUnreadCount = async (mode = "fetch") => {
      if (mode === "decrement") {
        notificationStore.decrementUnreadCount();
      } else if (mode === "reset") {
        notificationStore.setUnreadCount(0);
      } else {
        await notificationStore.fetchUnreadCount();
      }
      emit("update:unread-count", unreadCount.value);
    };

    const resolveNotificationUrl = (notification) => {
      if (notification?.redirect_url) return notification.redirect_url;

      const rawLink = notification?.link;
      if (rawLink && rawLink !== "auto" && rawLink !== "target") {
        return rawLink;
      }

      if (notification?.actor?.username) {
        return `/${notification.actor.username}`;
      }

      return "";
    };

    const navigateNotification = (notification) => {
      const url = resolveNotificationUrl(notification);
      if (!url) return false;

      if (url.startsWith("http")) {
        window.open(url, "_blank");
      } else {
        router.push(url);
      }
      return true;
    };

    // 处理通知点击
    const handleNotificationClick = async (notification) => {
      // 自动标记为已读
      if (!notification.read) {
        await markAsRead(notification.id);
      }

      // 默认点击优先跳转到对象链接；无链接时回退到详情
      const jumped = navigateNotification(notification);
      if (jumped) return;

      selectedNotification.value = notification;
      showDetailDialog.value = true;
    };

    const openNotificationDetail = async (notification) => {
      if (!notification.read) {
        await markAsRead(notification.id);
      }
      selectedNotification.value = notification;
      showDetailDialog.value = true;
    };

    // 格式化日期
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSecs < 60) return "刚刚";
      if (diffMins < 60) return `${diffMins}分钟前`;
      if (diffHours < 24) return `${diffHours}小时前`;
      if (diffDays < 30) return `${diffDays}天前`;
      return date.toLocaleDateString();
    };

    // 格式化相对时间
    const formatRelativeTime = (dateString) => {
      return formatDate(dateString);
    };

    // 获取类型颜色
    const getTypeColor = (type) => {
      const colorMap = {
        follow: "blue",
        like: "red",
        comment: "green",
        fork: "purple",
        mention: "orange",
        system: "grey",
        admin: "deep-purple",
        update: "teal",
      };
      return colorMap[type] || "primary";
    };

    // 获取类型标签
    const getTypeLabel = (type) => {
      const typeMap = {
        follow: "关注",
        like: "点赞",
        comment: "评论",
        fork: "复刻",
        mention: "提及",
        system: "系统",
        admin: "管理",
        update: "更新",
      };
      return typeMap[type] || "通知";
    };

    // 根据通知类型获取图标
    const getIconForType = (iconType) => {
      const iconMap = {
        follow: "mdi-account-plus",
        like: "mdi-heart",
        comment: "mdi-comment-text",
        fork: "mdi-source-fork",
        mention: "mdi-at",
        system: "mdi-information",
        admin: "mdi-shield-account",
        update: "mdi-update",
      };

      return iconMap[iconType] || "mdi-bell";
    };

    // 对话框相关方法

    // 关闭对话框
    const closeDetailDialog = () => {
      showDetailDialog.value = false;
      selectedNotification.value = null;
    };

    // 获取通知标题
    const getNotificationTitle = () => {
      if (selectedNotification.value?.title) {
        return selectedNotification.value.title;
      }
      return "通知详情";
    };

    // 获取通知内容
    const getNotificationContent = () => {
      if (selectedNotification.value?.rendered_content) {
        return selectedNotification.value.rendered_content;
      }
      if (selectedNotification.value?.content) {
        return selectedNotification.value.content;
      }
      return "无内容描述";
    };

    // 获取通知图标
    const getNotificationIcon = (notification) => {
      const iconType = notification?.template_info?.icon || notification?.type;
      const iconMap = {
        follow: "mdi-account-plus",
        like: "mdi-heart",
        comment: "mdi-comment-text",
        fork: "mdi-source-fork",
        mention: "mdi-at",
        system: "mdi-information",
        admin: "mdi-shield-account",
        update: "mdi-update",
      };
      return iconMap[iconType] || "mdi-bell";
    };

    // 获取通知类型
    const getNotificationType = () => {
      const type =
        selectedNotification.value?.type ||
        selectedNotification.value?.template_info?.icon;
      const typeMap = {
        follow: "关注",
        like: "点赞",
        comment: "评论",
        fork: "复刻",
        mention: "提及",
        system: "系统",
        admin: "管理",
        update: "更新",
      };
      return typeMap[type] || type || "通知";
    };

    // 检查是否有目标链接（基于target生成的链接）
    const hasTargetLink = () => {
      return !!(selectedNotification.value?.redirect_url);
    };

    // 检查是否有原始链接（且不是auto或target）
    const hasOriginalLink = () => {
      const link = selectedNotification.value?.link;
      return !!(link && link !== "auto" && link !== "target" && link !== selectedNotification.value?.redirect_url);
    };

    // 检查是否有任何链接
    const hasNotificationLink = () => {
      return hasTargetLink() || hasOriginalLink();
    };

    // 获取目标链接
    const getTargetLink = () => {
      return selectedNotification.value?.redirect_url || "";
    };

    // 获取原始链接
    const getOriginalLink = () => {
      const link = selectedNotification.value?.link;
      if (
        link &&
        link !== "auto" &&
        link !== "target" &&
        link !== selectedNotification.value?.redirect_url
      ) {
        return link;
      }
      return "";
    };

    // 获取链接（兼容性方法，优先返回目标链接）
    const getNotificationLink = () => {
      return getTargetLink() || getOriginalLink();
    };

    // 获取目标链接描述
    const getTargetLinkDescription = () => {
      const url = getTargetLink();
      if (!url) return "";

      // 基于通知的target_type来生成更准确的描述
      if (selectedNotification.value?.target_type) {
        const targetType = selectedNotification.value.target_type;

        if (targetType === "project") {
          return "查看项目";
        } else if (targetType === "user") {
          return "查看用户资料";
        } else if (targetType === "projectlist") {
          return '查看项目列表';
        } else if (targetType === "comment") {
          return "查看评论";
        }
      }

      // 基于URL路径的描述（备用逻辑）
      if (url.includes("/app/projectlist/")) return "查看项目列表";
      if (url.includes("#comment-")) return "查看评论";
      if (url.includes("/") && url.split("/").length === 3) return "查看项目";
      if (url.includes("/") && url.split("/").length === 2)
        return "查看用户资料";

      return "相关页面";
    };

    // 获取原始链接描述
    const getOriginalLinkDescription = () => {
      const url = getOriginalLink();
      if (!url) return "";

      // 基于URL路径的描述
      if (url.includes("scratch.mit.edu")) return "访问Scratch官网";
      if (url.includes("github.com")) return "访问GitHub";
      if (url.includes("http")) return "访问外部链接";

      return "其他链接";
    };

    // 获取链接描述（兼容性方法）
    const getLinkDescription = () => {
      return getTargetLinkDescription() || getOriginalLinkDescription();
    };

    // 访问用户资料
    const visitUserProfile = () => {
      if (selectedNotification.value?.actor?.username) {
        const url = `/${selectedNotification.value.actor.username}`;
        closeDetailDialog();
        router.push(url);
      }
    };

    // 打开目标链接
    const openTargetLink = () => {
      const url = getTargetLink();
      if (url) {
        closeDetailDialog();
        router.push(url);
      }
    };

    // 打开原始链接
    const openOriginalLink = () => {
      const url = getOriginalLink();
      if (url) {
        closeDetailDialog();
        if (url.startsWith("http")) {
          // 外部链接在新窗口打开
          window.open(url, "_blank");
        } else {
          // 内部链接使用路由跳转
          router.push(url);
        }
      }
    };

    // 打开通知链接（兼容性方法）
    const openNotificationLink = () => {
      const targetUrl = getTargetLink();
      const originalUrl = getOriginalLink();

      if (targetUrl) {
        openTargetLink();
      } else if (originalUrl) {
        openOriginalLink();
      }
    };

    if (props.autoFetch) {
      onMounted(() => {
        fetchNotifications();
        // 如果使用窗口滚动，添加事件监听
        if (props.useWindowScroll) {
          window.addEventListener('scroll', handleWindowScroll);
        }
      });
    } else {
      onMounted(() => {
        // 如果使用窗口滚动，添加事件监听
        if (props.useWindowScroll) {
          window.addEventListener('scroll', handleWindowScroll);
        }
      });
    }

    // 清理窗口滚动事件监听器
    onUnmounted(() => {
      if (props.useWindowScroll) {
        window.removeEventListener('scroll', handleWindowScroll);
      }
    });

    return {
      notifications,
      loading,
      loadingMore,
      error,
      unreadCount,
      hasUnread,
      hasMoreNotifications,
      notificationsContainer,
      showDetailDialog,
      selectedNotification,
      fetchNotifications,
      loadMoreNotifications,
      handleScroll,
      handleWindowScroll,
      markAsRead,
      markAllAsRead,
      updateUnreadCount,
      handleNotificationClick,
      openNotificationDetail,
      formatDate,
      formatRelativeTime,
      getTypeColor,
      getTypeLabel,
      renderTemplate,
      getIconForType,
      processNotificationTemplates,
      prepareTemplateData,
      s3BucketUrl,
      projectCache,
      projectListCache,
      userCache,
      localuser,
      // 对话框相关方法
      closeDetailDialog,
      getNotificationTitle,
      getNotificationContent,
      getNotificationIcon,
      getNotificationType,
      hasNotificationLink,
      hasTargetLink,
      hasOriginalLink,
      getNotificationLink,
      getTargetLink,
      getOriginalLink,
      getLinkDescription,
      getTargetLinkDescription,
      getOriginalLinkDescription,
      visitUserProfile,
      openNotificationLink,
      openTargetLink,
      openOriginalLink,
    };
  },
};
</script>

<style scoped>
.notification-item.unread-notification {
  background-color: rgba(var(--v-theme-primary), 0.04);
  border-left: 3px solid rgb(var(--v-theme-primary));
}

.clickable-item {
  cursor: pointer;
}

.notification-item {
  padding-top: 14px;
  padding-bottom: 14px;
  transition: background-color 0.2s ease;
  border-bottom: 1px solid rgba(var(--v-border-color), 0.08);
}

.notification-item.is-page-mode {
  padding-top: 20px;
  padding-bottom: 20px;
  padding-inline: 20px;
}

.notification-item:last-child {
  border-bottom: none;
}

.notification-item:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.03);
}

.notification-item.unread-notification:hover {
  background-color: rgba(var(--v-theme-primary), 0.08);
}

.notification-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.notification-row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.notification-title-text {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-subtitle {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  opacity: 0.8;
}

.notification-detail-btn {
  min-width: 36px;
  padding: 0 6px;
  height: 24px;
}

.metadata-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

code {
  background-color: rgba(var(--v-theme-on-surface), 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: "Courier New", monospace;
}

.detail-info {
  background-color: rgba(var(--v-theme-on-surface), 0.05);
  padding: 12px;
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
  font-size: 12px;
}
</style>







