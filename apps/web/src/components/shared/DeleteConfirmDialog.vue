<template>
  <v-dialog v-model="confirmDelete" max-width="400">
    <v-card>
      <v-card-title class="text-h6 font-weight-medium">
        {{ deleteContext.title }}
      </v-card-title>

      <v-card-text class="text-body-1 pb-4">
        {{ deleteContext.message }}
      </v-card-text>

      <v-card-actions class="flex-column pa-4 pt-0">
        <v-btn
          :loading="deleteLoading"
          :disabled="deleteLoading"
          color="error"
          variant="flat"
          block
          @click="handleConfirm"
        >
          {{ deleteContext.confirmText }}
        </v-btn>
        <v-btn
          :disabled="deleteLoading"
          variant="text"
          block
          @click="handleCancel"
        >
          {{ deleteContext.cancelText }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { useDeleteConfirm } from '@/composables/useDeleteConfirm';

const {
  confirmDelete,
  deleteLoading,
  deleteContext,
  handleConfirm,
  handleCancel
} = useDeleteConfirm();
</script>

<style scoped>
.v-card-title {
  padding: 20px 20px 12px;
}

.v-card-text {
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.7;
}

.v-card-actions {
  gap: 8px;
}
</style>
