<template>
  <v-card border class="mb-6" v-if="extension">
    <v-card-title> 扩展详细信息 </v-card-title>

    <v-card-text class="pa-0">
      <v-list>
        <v-list-item>
          <v-list-item-title class="text-caption text-medium-emphasis"
            >扩展ID</v-list-item-title
          >
          <v-list-item-subtitle class="text-body-2 font-weight-medium">
            {{ extension?.id || "N/A" }}
          </v-list-item-subtitle>
        </v-list-item>

        <v-divider></v-divider>

        <v-list-item>
          <v-list-item-title class="text-caption text-medium-emphasis"
            >项目ID</v-list-item-title
          >
          <v-list-item-subtitle class="text-body-2 font-weight-medium">
            {{ extension?.project?.id || "N/A" }}
          </v-list-item-subtitle>
        </v-list-item>

        <v-divider></v-divider>

        <v-list-item>
          <v-list-item-title class="text-caption text-medium-emphasis"
            >分支信息</v-list-item-title
          >
          <v-list-item-subtitle>
            <v-chip
              color="primary"
              variant="tonal"
              size="small"
              prepend-icon="mdi-source-branch"
            >
              {{ extension?.branch || "main" }}
            </v-chip>
          </v-list-item-subtitle>
        </v-list-item>

        <v-divider></v-divider>

        <v-list-item>
          <v-list-item-title class="text-caption text-medium-emphasis"
            >提交信息</v-list-item-title
          >
          <v-list-item-subtitle class="d-flex align-center">
            <v-chip
              color="success"
              variant="tonal"
              size="small"
              prepend-icon="mdi-source-commit"
            >
              {{ extension?.commit?.substring(0, 8) || "latest" }}
            </v-chip>
            <v-btn
              v-if="
                isOwner &&
                extension?.commit &&
                extension.commit !== 'latest'
              "
              size="small"
              variant="text"
              prepend-icon="mdi-refresh"
              :loading="updateLoading"
              @click="$emit('update-to-latest')"
              class="ml-2"
            >
              更新到最新
            </v-btn>
          </v-list-item-subtitle>
        </v-list-item>

        <v-divider></v-divider>

        <v-list-item>
          <v-list-item-title class="text-caption text-medium-emphasis"
            >创建时间</v-list-item-title
          >
          <v-list-item-subtitle class="d-flex align-center">
            <v-icon class="mr-2" size="small" color="primary"
              >mdi-clock-outline</v-icon
            >
            <TimeAgo :date="extension?.created_at" />
          </v-list-item-subtitle>
        </v-list-item>

        <v-divider></v-divider>

        <v-list-item>
          <v-list-item-title class="text-caption text-medium-emphasis"
            >更新时间</v-list-item-title
          >
          <v-list-item-subtitle class="d-flex align-center">
            <v-icon class="mr-2" size="small" color="primary"
              >mdi-clock-outline</v-icon
            >
            <TimeAgo :date="extension?.updated_at" />
          </v-list-item-subtitle>
        </v-list-item>

        <v-divider
          v-if="extension?.has_docs && extension?.docs_url"
        ></v-divider>

        <v-list-item v-if="extension?.has_docs && extension?.docs_url">
          <v-list-item-title class="text-caption text-medium-emphasis"
            >扩展文档</v-list-item-title
          >
          <v-list-item-subtitle>
            <v-btn
              variant="tonal"
              size="small"
              prepend-icon="mdi-book-open-variant"
              :href="extension.docs_url"
              target="_blank"
            >
              查看文档
            </v-btn>
          </v-list-item-subtitle>
        </v-list-item>

        <v-divider></v-divider>

        <v-list-item>
          <v-list-item-title class="text-caption text-medium-emphasis"
            >兼容性信息</v-list-item-title
          >
          <v-list-item-subtitle>
            <v-chip
              :color="extension?.scratchCompatible ? 'orange' : 'grey'"
              variant="tonal"
              size="small"
              prepend-icon="mdi-puzzle"
              class="mb-2"
            >
              {{
                extension?.scratchCompatible
                  ? "兼容原版Scratch"
                  : "不兼容原版Scratch"
              }}
            </v-chip>

          </v-list-item-subtitle>
        </v-list-item>

        <v-divider
          v-if="
            extension?.project?.tags &&
            extension.project.tags.length > 0
          "
        ></v-divider>

        <v-list-item
          v-if="
            extension?.project?.tags &&
            extension.project.tags.length > 0
          "
        >
          <v-list-item-title class="text-caption text-medium-emphasis"
            >项目标签</v-list-item-title
          >
          <v-list-item-subtitle>
            <v-chip
              v-for="tag in extension.project.tags"
              :key="tag"
              size="small"
              variant="outlined"
              class="mr-1 mb-1"
            >
              {{ tag }}
            </v-chip>
          </v-list-item-subtitle>
        </v-list-item>
      </v-list>
    </v-card-text>
  </v-card>
</template>

<script>
import TimeAgo from "@/components/TimeAgo.vue";

export default {
  name: "ExtensionDetailsCard",
  components: {
    TimeAgo,
  },
  props: {
    extensionId: {
      type: [String, Number],
      required: true,
    },
    extension: {
      type: Object,
      default: () => null,
    },
    isOwner: {
      type: Boolean,
      default: false,
    },
    updateLoading: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update-to-latest'],
};
</script>