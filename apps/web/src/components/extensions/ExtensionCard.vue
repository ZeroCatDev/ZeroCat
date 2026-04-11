<template> <v-card class="box-shadow" rounded="lg">
    <v-card
      :to="'/app/extensions/' + extension.id"
      rounded="lg"
      style="aspect-ratio: 4/3"
    >
      <v-img
        :src="extension.image ? s3BucketUrl + '/material/asset/' + extension.image+'.png' : ''"
        class="align-end"
        cover
        gradient="to bottom, rgba(0,0,0,.1), rgba(0,0,0,.5)"
        height="100%"
        lazy-src="../../assets/43-lazyload.png"
      >
        <v-card-item>
            <v-chip size="small" color="primary" variant="tonal">
  扩展
</v-chip>
          <v-card-title>{{ extension?.name || "加载中..." }}</v-card-title>
          <v-card-subtitle>{{ extension?.description || "" }}</v-card-subtitle>
        </v-card-item>
      </v-img>
    </v-card>
    <!-- 作者信息区域 -->
    <v-card-item v-if="extension.author"
                 :append-avatar="extension.author.avatar ? localuser.getUserAvatar(extension.author.avatar) : ''">
      <v-card-title>{{ extension.author.display_name || extension.author.username || "未知用户" }}</v-card-title>
      <v-card-subtitle>{{ extension.author.username || "" }}</v-card-subtitle>
    </v-card-item>


  </v-card>
</template>

<script>
import { localuser } from "@/services/localAccount";
export default {
  name: 'ExtensionCard',
  props: {
    extension: {
      type: Object,
      required: true
    },
    s3BucketUrl: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      localuser,
    };
  },
  computed: {
    extensionTags() {
      if (!this.extension.project?.tags) return [];
      // 如果tags是数组，直接返回
      if (Array.isArray(this.extension.project.tags)) {
        return this.extension.project.tags;
      }
      return [];
    }
  },
  emits: ['view-extension', 'open-docs']
};
</script>

<style scoped>
.extension-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 12px;
  overflow: hidden;
}

.extension-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  border-color: rgb(var(--v-theme-primary));
}

.extension-avatar {
  border: 2px solid rgba(var(--v-theme-primary), 0.1);
}

.extension-title {
  font-weight: 600;
  line-height: 1.3;
  margin-bottom: 4px;
}

.extension-description {
  line-height: 1.4;
  color: rgba(var(--v-theme-on-surface), 0.7);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.extension-content {
  padding-top: 0;
  flex-grow: 1;
}

.extension-actions {
  padding: 12px 16px;
  border-top: 1px solid rgba(var(--v-theme-outline), 0.12);
}

.h-100 {
  height: 100%;
}

/* 响应式设计 */
@media (max-width: 600px) {
  .extension-card {
    margin-bottom: 16px;
  }

  .extension-title {
    font-size: 1.1rem;
  }
}
</style>