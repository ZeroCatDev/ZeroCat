<template>
  <v-timeline align="start" class="mt-4" side="end">
    <v-timeline-item
      v-for="event in timeline.events"
      :key="event.id"
      dot-color="primary"
      size="small"
    >
      <template v-slot:opposite>
        {{ new Date(event.created_at).toLocaleString() }}
      </template>
      <template v-slot:icon>
        <v-avatar
          :image="localuser.getUserAvatar(event.actor.avatar)"
        ></v-avatar>
      </template>
      <div class="timeline-item-content">
        <!-- Event Header -->
        <div class="event-header">
          <h3 class="text-h6">
            {{ event.actor.display_name }}
            {{ eventTypes[event.type]?.text || "进行了操作" }}
          </h3>
          <v-chip
            :color="eventTypes[event.type]?.color || 'primary'"
            class="ml-2"
            size="x-small"
          >
            {{ eventTypes[event.type]?.label || event.type }}
          </v-chip>
        </div>

        <router-link
          v-if="eventTypes[event.type]?.isProject"
          :to="getProjectLink(event.target?.id)"
          class="text-decoration-none"
        >
          {{ event.event_data?.project_title }}
        </router-link>

        <div class="mb-2"></div>

        <!-- Project Event Card -->
        <v-card
          v-if="
            eventTypes[event.type]?.isProject &&
            !['project_rename', 'project_commit'].includes(event.type)
          "
          :to="getProjectLink(event.target?.id)"
          class="mb-3 project-event"
        >
          <v-card-text>
            <div class="project-info">
              <v-icon
                class="mr-2"
                color="primary"
                icon="mdi-source-repository"
              />
              <span class="font-weight-medium">{{
                event.event_data?.project_name || "未命名项目"
              }}</span>

              <div class="mt-2 text-caption text-medium-emphasis">
                {{ event.event_data?.project_description }}
              </div>
            </div>
          </v-card-text>
        </v-card>

        <!-- Special Project Events -->
        <template
          v-else-if="
            [
              'project_rename',
              'project_commit',
              'project_info_update',
            ].includes(event.type)
          "
        >
          <!-- Rename Event -->
          <template v-if="event.type === 'project_rename'">
            <v-card
              :to="getProjectLink(event.target?.id)"
              class="rename-card mb-3"
            >
              <v-card-text>
                <div class="d-flex align-center mb-2">
                  <v-icon class="mr-2" color="warning" icon="mdi-rename-box"/>
                  <span class="font-weight-medium">{{
                    event.event_data?.project_title
                  }}</span>
                </div>
                <div class="rename-details text-body-2">
                  <div class="d-flex align-center">
                    <span class="text-medium-emphasis">从</span>
                    <v-chip class="mx-2" color="surface-variant" size="small">
                      {{ event.event_data?.old_name }}
                    </v-chip>
                  </div>
                  <div class="d-flex align-center mt-1">
                    <span class="text-medium-emphasis">到</span>
                    <v-chip class="mx-2" color="warning" size="small">
                      {{ event.event_data?.new_name }}
                    </v-chip>
                  </div>
                </div>
                <div
                  class="project-meta text-caption text-medium-emphasis mt-2"
                >
                  <v-chip class="mr-1" size="x-small">{{
                    event.event_data?.project_type
                    }}
                  </v-chip>
                  <v-chip size="x-small">{{
                    event.event_data?.project_state
                    }}
                  </v-chip>
                </div>
              </v-card-text>
            </v-card>
          </template>

          <!-- Commit Event -->
          <template v-else-if="event.type === 'project_commit'">
            <v-card
              :to="getProjectLink(event.target?.id)"
              class="commit-card mb-3"
            >
              <v-card-text>
                <div class="d-flex align-center mb-2">
                  <v-icon class="mr-2" color="info" icon="mdi-source-commit"/>
                  <span class="font-weight-medium"
                  >分支: {{ event.event_data?.branch }}</span
                  >
                </div>
                <div class="commit-message text-body-2">
                  {{ event.event_data?.commit_message }}
                </div>
                <div class="commit-hash text-caption text-medium-emphasis mt-1">
                  提交ID: {{ event.event_data?.commit_id.substring(0, 7) }}
                </div>
              </v-card-text>
            </v-card>
          </template>

          <!-- Project Info Update Event -->
          <template v-else-if="event.type === 'project_info_update'">
            <v-card
              :to="getProjectLink(event.target?.id)"
              class="info-update-card mb-3"
            >
              <v-card-text>
                <div class="d-flex align-center mb-2">
                  <v-icon
                    class="mr-2"
                    color="info"
                    icon="mdi-file-document-edit"
                  />
                  <span class="font-weight-medium">{{
                    event.event_data?.project_title
                  }}</span>
                </div>

                <div class="info-updates text-body-2">
                  <template
                    v-for="field in event.event_data?.updated_fields"
                    :key="field"
                  >
                    <div class="update-item mb-2">
                      <div class="d-flex align-center">
                        <v-chip class="mr-2" color="info" size="x-small">{{
                          getFieldDisplayName(field)
                          }}
                        </v-chip>
                      </div>
                      <div class="d-flex flex-column mt-1 field-changes">
                        <div class="old-value">
                          <span class="text-medium-emphasis">从：</span>
                          <span class="ml-2">{{
                            event.event_data?.old_values[field]
                          }}</span>
                        </div>
                        <div class="new-value">
                          <span class="text-medium-emphasis">到：</span>
                          <span class="ml-2 text-info">{{
                            event.event_data?.new_values[field]
                          }}</span>
                        </div>
                      </div>
                    </div>
                  </template>
                </div>

                <div
                  class="project-meta text-caption text-medium-emphasis mt-2"
                >
                  <v-chip class="mr-1" size="x-small">{{
                    event.event_data?.project_type
                    }}
                  </v-chip>
                  <v-chip size="x-small">{{
                    event.event_data?.project_state
                    }}
                  </v-chip>
                </div>
              </v-card-text>
            </v-card>
          </template>
        </template>

        <!-- Simple Event Content -->
        <div v-else class="event-content pa-2">
          <!-- Profile Update Event -->
          <template v-if="event.type === 'user_profile_update'">
            <div class="text-body-2">
              更新了：{{ getUpdatedFields(event.event_data?.updated_fields) }}
            </div>
          </template>

          <!-- Project Related Events -->
          <template v-else-if="event.target?.type === 'project'">
            <div class="text-body-2">
              <span>{{ eventTypes[event.type]?.text || "操作了" }}</span>
              <router-link
                :to="getProjectLink(event.target.id)"
                class="text-decoration-none ml-1"
              >
                {{
                event.event_data?.project_name ||
                event.target.title ||
                `项目 #${event.target.id}`
                }}
              </router-link>
            </div>
          </template>

          <!-- Other Events -->
          <div v-else class="text-body-2 text-medium-emphasis">
            {{ getTargetContent(event.target, event.type) }}
          </div>
        </div>
      </div>
    </v-timeline-item>
  </v-timeline>

  <div class="d-flex justify-center mt-4 mb-4">
    <v-btn
      v-if="hasMoreEvents"
      :loading="isLoadingMore"
      variant="tonal"
      @click="loadMore"
    >
      加载更多
    </v-btn>
    <div v-else-if="timeline.events.length > 0" class="text-medium-emphasis">
      没有更多内容了
    </div>
  </div>
</template>

<script>
import {get} from "@/services/serverConfig";
import {getProjectInfo} from "@/services/projectService";
import { localuser } from "@/services/localAccount";
export default {
  name: "Timeline",
  props: {
    timeline: {
      type: Object,
      required: true,
      default: () => ({
        events: [],
        pagination: {
          current: 1,
          size: 20,
          total: 0,
        },
      }),
    },
    isLoadingMore: {
      type: Boolean,
      default: false,
    },
    username: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      localuser,
      events: [],
      loading: false,
      error: null,
      page: 1,
      hasMore: true,
      s3BucketUrl: "",
      projectInfoMap: new Map(),
      eventTypes: {
        project_create: {
          text: "创建了新项目",
          label: "新建",
          color: "success",
          isProject: true,
        },
        project_publish: {
          text: "更新了项目",
          label: "更新",
          color: "info",
          isProject: true,
        },
        project_fork: {
          text: "复刻了项目",
          label: "复刻",
          color: "warning",
          isProject: true,
        },
        project_delete: {
          text: "删除了项目",
          label: "删除",
          color: "error",
          isProject: true,
        },
        project_star: {
          text: "给项目点了星标",
          label: "星标",
          color: "primary",
          isProject: true,
        },
        user_profile_update: {
          text: "更新了个人资料",
          label: "更新",
          color: "info",
        },
        user_register: {
          text: "加入了 ZeroCat",
          label: "注册",
          color: "primary",
        },
        project_commit: {
          text: "提交了项目更新",
          label: "提交",
          color: "info",
          isProject: true,
        },
        project_rename: {
          text: "重命名了项目",
          label: "重命名",
          color: "warning",
          isProject: true,
        },
        project_info_update: {
          text: "更新了项目信息",
          label: "更新信息",
          color: "info",
          isProject: true,
        },
      },
      fieldDisplayNames: {
        display_name: "昵称",
        bio: "个性签名",
        sex: "性别",
        birthday: "生日",
        avatar: "头像",
        background: "背景图片",
        email: "邮箱",
        phone: "手机号",
        website: "个人网站",
        social_links: "社交链接",
        preferences: "偏好设置",
        visibility: "可见性设置",
        language: "语言设置",
      },
    };
  },
  async mounted() {
    this.s3BucketUrl = get("s3.staticurl");
    // 初始加载时获取项目信息
    if (this.timeline.events.length > 0) {
      await this.fetchProjectInfoForEvents(this.timeline.events);
    }
  },
  watch: {
    "timeline.events": {
      immediate: true,
      async handler(newEvents) {
        if (newEvents.length > 0) {
          await this.fetchProjectInfoForEvents(newEvents);
        }
      },
    },
  },
  computed: {
    hasMoreEvents() {
      return this.timeline.events.length < this.timeline.pagination.total;
    },
  },
  methods: {
    async fetchProjectInfoForEvents(events) {
      // 收集所有需要获取信息的项目ID
      const projectIds = events
        .filter((event) => event.target?.type === "project")
        .map((event) => event.target.id);

      if (projectIds.length > 0) {
        await this.fetchProjectInfo(projectIds);
      }
    },
    async fetchProjectInfo(projectIds) {
      try {
        const projects = await getProjectInfo(projectIds);
        projects.forEach((project) => {
          this.projectInfoMap.set(project.id, project);
        });
      } catch (error) {
        console.error("Error fetching project info:", error);
      }
    },
    getProjectLink(projectId) {
      if (!projectId) return "";

      const project = this.projectInfoMap.get(projectId);
      if (!project) {
        // 如果没有找到项目信息，返回一个基于ID的临时链接
        return `/project/${projectId}`;
      }

      return `/${project.author.username}/${project.name || project.id}`;
    },
    loadMore() {
      this.$emit("load-more");
    },
    getUpdatedFields(fields) {
      if (!fields?.length) return "";
      return fields
        .map((field) => this.fieldDisplayNames[field] || field)
        .join("、");
    },
    getTargetContent(target, eventType) {
      if (!target) return "";

      switch (target.type) {
        case "project": {
          return target.title || `项目 #${target.id}`;
        }
        case "user": {
          return target.display_name || `用户 #${target.id}`;
        }
        case "projectlist":
          return `项目列表 #${target.id}`;
        default:
          return `${target.type} #${target.id}`;
      }
    },
    getFieldDisplayName(field) {
      const fieldNames = {
        title: "标题",
        description: "描述",
        type: "类型",
        state: "状态",
        visibility: "可见性",
        tags: "标签",
        category: "分类",
      };
      return fieldNames[field] || field;
    },
  },
};
</script>

<style scoped>
.text-decoration-none {
  color: inherit;

  &:hover {
    text-decoration: underline;
    opacity: 0.8;
  }
}

.v-card {
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1) !important;
  }
}

.v-card[href] {
  cursor: pointer;
}

.v-btn {
  min-width: 120px;
}

.timeline-item-content {
  width: 100%;
}

.project-card {
  border-left: 3px solid var(--v-primary-base);
  padding-left: 12px;
}

.comment-preview {
  background-color: rgba(0, 0, 0, 0.03);
  border-radius: 4px;
  padding: 8px 12px;
  font-style: italic;
}

.v-timeline-item {
  margin-bottom: 16px;
}

.simple-event {
  border-radius: 4px;
  transition: background-color 0.2s;
}

.simple-event:hover {
  background-color: rgba(var(--v-theme-surface-variant), 0.06);
}

.comment-text {
  font-style: italic;
  color: var(--v-medium-emphasis-color);
}

.text-decoration-none {
  color: var(--v-primary-base);

  &:hover {
    text-decoration: underline;
  }
}

.event-header {
  display: flex;
  align-items: center;
}

.project-event {
  border-left: 3px solid var(--v-primary-base);
  background-color: var(--v-surface-variant);
}

.project-info {
  padding-left: 12px;
}

.event-content {
  border-radius: 4px;
  transition: background-color 0.2s;
}

.event-content:hover {
  background-color: rgba(var(--v-theme-surface-variant), 0.06);
}

.comment-text {
  font-style: italic;
  color: var(--v-medium-emphasis-color);
  padding: 8px 12px;
  background-color: rgba(0, 0, 0, 0.03);
  border-radius: 4px;
}

.commit-card {
  border-left: 3px solid var(--v-info-base);
  background-color: var(--v-surface-variant);
  transition: transform 0.2s;
}

.commit-card:hover {
  transform: translateY(-2px);
}

.commit-message {
  white-space: pre-wrap;
  word-break: break-word;
}

.commit-hash {
  font-family: monospace;
}

.rename-card {
  border-left: 3px solid var(--v-warning-base);
  background-color: var(--v-surface-variant);
  transition: transform 0.2s;
}

.rename-card:hover {
  transform: translateY(-2px);
}

.rename-details {
  padding: 8px;
  background-color: rgba(0, 0, 0, 0.03);
  border-radius: 4px;
}

.project-meta {
  margin-top: 8px;
}

.info-update-card {
  border-left: 3px solid var(--v-info-base);
  background-color: var(--v-surface-variant);
  transition: transform 0.2s;
}

.info-update-card:hover {
  transform: translateY(-2px);
}

.info-updates {
  padding: 8px;
  background-color: rgba(0, 0, 0, 0.03);
  border-radius: 4px;
}

.update-item {
  padding: 8px;
  border-radius: 4px;
  background-color: rgba(255, 255, 255, 0.5);
}

.field-changes {
  margin-left: 8px;
  padding: 4px 8px;
  border-left: 2px solid var(--v-info-base);
}

.old-value,
.new-value {
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-word;
}

.new-value {
  font-weight: 500;
}
</style>
