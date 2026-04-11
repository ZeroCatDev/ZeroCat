<template>
  <v-snackbar
    v-model="globalSnackbar.show"
    :color="globalSnackbar.color"
    :timeout="globalSnackbar.timeout"
    location="top"
  >
    {{ globalSnackbar.text }}
    
    <template v-slot:actions>
      <v-btn
        color="white"
        variant="text"
        @click="globalSnackbar.show = false"
      >
        关闭
      </v-btn>
    </template>
  </v-snackbar>
</template>

<script>
import { globalSnackbar } from '@/composables/useNotifications.js';

export default {
  name: 'GlobalSnackbar',
  setup() {
    return {
      globalSnackbar
    };
  }
};
</script>