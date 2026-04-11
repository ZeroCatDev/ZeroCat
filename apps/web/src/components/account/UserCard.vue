<template>
  <v-card :loading="loading" border class="mb-4" hover variant="elevated">
    <template v-slot:prepend>
      <v-avatar class="ma-3" size="64">
        <v-img
          :alt="userData.display_name"
          :src="localuser.getUserAvatar(userData.avatar)"
          cover
        ></v-img>
      </v-avatar>
    </template>

    <v-card-item>
      <v-card-title class="font-weight-bold text-h5">
        {{ userData.display_name || '加载中...' }}
      </v-card-title>

      <v-card-subtitle class="mt-2">
        <v-chip class="mr-2" size="small">
          <v-icon icon="mdi-account-circle" size="small" start></v-icon>
          ID: {{ userData.id || '—' }}
        </v-chip>
        <v-chip size="small">
          <v-icon icon="mdi-tag" size="small" start></v-icon>
          创作者
        </v-chip>
      </v-card-subtitle>
    </v-card-item>

    <v-card-text v-if="userData.bio"><!--超出一行则显示...-->
      <div class="text-body-2 text-medium-emphasis"
           style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        {{ userData.bio }}
      </div>
    </v-card-text>

    <template v-slot:loader="{ isActive }">
      <v-progress-linear :active="isActive" color="primary" height="4" indeterminate></v-progress-linear>
    </template>
  </v-card>
</template>

<script>
import { localuser } from "@/services/localAccount";
export default {
  name: "UserCard",
  props: {
    userData: {
      type: Object,
      required: true
    },
    loading: {
      type: Boolean,
      default: false
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
};
</script>
