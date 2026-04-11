<template>
  <v-dialog
    v-model="dialogVisible"
    max-width="560"
    :fullscreen="isSmallScreen"
    scrollable
  >
    <v-card rounded="xl">
      <v-card-title class="d-flex align-center pa-3">
        <v-btn icon size="small" variant="text" @click="dialogVisible = false">
          <v-icon>mdi-close</v-icon>
        </v-btn>
        <span class="ml-2 text-body-1 font-weight-bold">发帖</span>
      </v-card-title>

      <v-divider />

      <v-card-text class="pa-0">
        <PostComposer
          ref="composerRef"
          :submit="handleSubmit"
          no-border
          auto-focus
        />
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDisplay } from 'vuetify';
import PostsService from '@/services/postsService';
import { showSnackbar } from '@/composables/useNotifications';
import { postDialogVisible } from '@/composables/usePostDialog';
import PostComposer from './PostComposer.vue';

const route = useRoute();
const router = useRouter();
const display = useDisplay();

const composerRef = ref(null);
const dialogVisible = postDialogVisible;
const isSmallScreen = computed(() => display.smAndDown.value);

const handleSubmit = async (postData) => {
  await PostsService.createPost(postData);
  showSnackbar('发布成功', 'success');
  dialogVisible.value = false;
  if (!route.path.startsWith('/app/posts')) {
    router.push('/app/posts');
  }
};

watch(dialogVisible, (visible) => {
  if (!visible && composerRef.value) {
    composerRef.value.reset();
  }
});
</script>
