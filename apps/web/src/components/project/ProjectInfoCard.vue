<template>
  <div class="project-info">
    <!-- Title (top, multi-line) -->
    <h1 class="project-info__title">{{ project.title }}</h1>

    <!-- Description -->
    <p v-if="false" class="project-info__desc">{{ project.description }}</p>

    <!-- Author rounded card -->
    <div v-if="author.username" class="project-info__author-card">
      <UserHoverCard :username="author.username">
        <router-link :to="'/' + author.username" class="project-info__author-link">
          <v-avatar size="42">
            <v-img :src="localuser.getUserAvatar(author.avatar)" :alt="author.display_name" />
          </v-avatar>
          <div class="project-info__author-text">
            <span class="project-info__author-name">{{ author.display_name }}</span>
            <span v-if="author.bio" class="project-info__author-bio">{{ author.bio }}</span>
          </div>
        </router-link>
      </UserHoverCard>
      <div
        v-if="variant === 'full' && localuser.id && author.id && localuser.id !== author.id"
        class="project-info__author-follow"
      >
        <UserRelationControls
          :display-name="author.display_name"
          :user-id="author.id"
          :username="author.username"
        />
      </div>
    </div>

    <!-- Stats -->
    <div class="project-info__stats">
      <span class="project-info__stat">
        <v-icon size="18" icon="mdi-poll" />
        {{ stats.pageviews }} 浏览
      </span>
      <span class="project-info__stat">
        <v-icon size="18" icon="mdi-account-outline" />
        {{ stats.visitors }} 访客
      </span>
      <span class="project-info__stat">
        <v-icon size="18" icon="mdi-clock-outline" />
        <TimeAgo :date="project.time" />
      </span>
    </div>

    <!-- State & Type -->
    <div class="project-info__meta">
      <span v-if="project.state === 'public'" class="project-info__badge">
        <v-icon size="16" icon="mdi-earth" />
        开源作品
      </span>
      <span v-if="project.state === 'private'" class="project-info__badge project-info__badge--private">
        <v-icon size="16" icon="mdi-lock-outline" />
        私密作品
      </span>
      <span class="project-info__badge">
        <v-icon size="16" icon="mdi-application" />
        {{ project.type }}
      </span>
    </div>

    <!-- Tags (full only) -->
    <div v-if="variant === 'full' && project.tags && project.tags.length" class="project-info__tags">
      <router-link
        v-for="tag in project.tags"
        :key="tag.name"
        :to="`/app/projects/tag/${tag.name}`"
        class="project-info__tag"
      >
        {{ tag.name }}
      </router-link>
    </div>

    <!-- Actions -->
    <div class="project-info__actions">
      <ProjectStar :projectId="project.id" :starcount="project.star_count" />
      <v-btn-group v-if="variant === 'full'" border density="compact" rounded="lg">
        <v-btn
          :to="`/${username}/${projectname}/fork`"
          class="text-none"
          variant="tonal"
        >
          复刻
        </v-btn>
        <v-btn :to="`/app/projects/fork/${project.id}`" text>{{
          stats.forks
        }}</v-btn>
      </v-btn-group>
      <v-btn
        variant="tonal"
        rounded="lg"
        class="text-none"
        prepend-icon="mdi-share-variant"
        @click="handleShare"
      >
        分享
      </v-btn>
    </div>

    <div v-if="project.id" class="project-info__notification-level">
      <ObjectNotificationLevelControl
        target-type="PROJECT"
        :target-id="project.id"
      />
    </div>

    <!-- Editor buttons (full only) -->
    <div v-if="variant === 'full'" class="project-info__actions">
      <v-btn
        v-if="['scratch', 'scratch3', 'scratch-clipcc', 'scratch-02engine'].includes(project.type)"
        variant="tonal"
        rounded="lg"
        class="text-none"
        append-icon="mdi-open-in-new"
        @click="openEditor(project.id, project.type)"
      >
        <template v-if="project.type === 'scratch-clipcc'">ClipCC 编辑器</template>
        <template v-else-if="project.type === 'scratch-02engine'">02Engine 编辑器</template>
        <template v-else>Scratch 编辑器</template>
      </v-btn>
      <v-btn
        :to="`/${username}/${projectname}/edit`"
        variant="tonal"
        rounded="lg"
        class="text-none"
        prepend-icon="mdi-pencil-outline"
      >
        编辑
      </v-btn>
    </div>
  </div>
</template>

<script>
import TimeAgo from "@/components/TimeAgo.vue";
import ProjectStar from "@/components/project/ProjectStar.vue";
import UserRelationControls from "@/components/user/UserRelationControls.vue";
import UserHoverCard from "@/components/UserHoverCard.vue";
import ObjectNotificationLevelControl from "@/components/notifications/ObjectNotificationLevelControl.vue";
import openEditor from "@/stores/openEdit";
import { getProjectStats } from "@/services/projectService";
import { openFloatingPostBar } from "@/composables/useFloatingPostBar";
import { localuser } from "@/services/localAccount";
export default {
  name: "ProjectInfoCard",
  components: {
    TimeAgo,
    ProjectStar,
    UserRelationControls,
    ObjectNotificationLevelControl,
  },
  props: {
    project: {
      type: Object,
      required: true,
    },
    author: {
      type: Object,
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    projectname: {
      type: String,
      required: true,
    },
    branch: {
      type: String,
      default: null,
    },
    commit: {
      type: String,
      default: null,
    },
    variant: {
      type: String,
      default: "full",
      validator: (value) => ["full", "commit", "branch"].includes(value),
    },
  },
  data() {
    return {
      openEditor,
      loading: false,
      error: null,
      stats: {
        pageviews: 0,
        visitors: 0,
      },
      localuser,
    };
  },
  async mounted() {},
  watch: {
    "project.id": {
      immediate: true,
      handler(newId) {
        if (newId) {
          this.loadProjectStats();
        }
      },
    },
  },
  methods: {
    async loadProjectStats() {
      try {
        this.stats = await getProjectStats(this.project.id);
      } catch (error) {
        console.error("Error fetching project stats:", error);
        this.stats = {
          pageviews: 0,
          visitors: 0,
        };
      }
    },
    handleShare() {
      const embed = { type: 'project', id: this.project.id };
      let text = `@${this.author.username} 的项目 ${this.project.title || ''}`;

      if (this.commit) {
        embed.commit = this.commit;
        text = `@${this.author.username} 的项目 ${this.project.title || ''} (提交：${this.commit.slice(0, 7)})`;
      } else if (this.branch && this.branch !== 'main') {
        embed.branch = this.branch;
        text = `@${this.author.username} 的项目 ${this.project.title || ''} (分支：${this.branch})`;
      }

      openFloatingPostBar({
        text,
        embed,
        placeholder: `分享关于 ${this.project.title} 的内容...`
      });
    },
  },
};
</script>

<style scoped>
.project-info {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* Title */
.project-info__title {
  font-size: 1.6rem;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: -0.015em;
  margin: 0;
  word-break: break-word;
}

/* Description */
.project-info__desc {
  font-size: 0.95rem;
  line-height: 1.6;
  opacity: 0.65;
  margin: -6px 0 0 0;
}

/* Author rounded card */
.project-info__author-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  transition: background 0.15s;
}
.project-info__author-card:hover {
  background: rgba(var(--v-theme-on-surface), 0.07);
}
.project-info__author-link {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: inherit;
  min-width: 0;
  flex: 1;
}
.project-info__author-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.project-info__author-name {
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.project-info__author-bio {
  font-size: 0.85rem;
  opacity: 0.5;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.project-info__author-follow {
  flex-shrink: 0;
}

/* Stats */
.project-info__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.project-info__stat {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.9rem;
  opacity: 0.55;
  font-variant-numeric: tabular-nums;
}

/* State & Type badges */
.project-info__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.project-info__badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.85rem;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.project-info__badge--private {
  color: rgb(var(--v-theme-error));
  background: rgba(var(--v-theme-error), 0.08);
}

/* Tags */
.project-info__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.project-info__tag {
  font-size: 0.85rem;
  font-weight: 500;
  padding: 4px 14px;
  border-radius: 999px;
  background: rgba(var(--v-theme-primary), 0.08);
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
  transition: background 0.15s;
}
.project-info__tag:hover {
  background: rgba(var(--v-theme-primary), 0.16);
}

/* Actions */
.project-info__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.project-info__notification-level {
  max-width: 280px;
}
</style>
