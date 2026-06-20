<template>
  <div class="account-user-skeleton" :class="[`account-user-skeleton--${variant}`]">
    <v-skeleton-loader type="avatar" :width="avatarSize" :height="avatarSize" />
    <div v-if="variant === 'profile'" class="account-user-skeleton__text">
      <v-skeleton-loader type="text" width="96" class="mb-1" />
      <v-skeleton-loader type="text" width="72" />
    </div>
  </div>
</template>

<script setup>
defineProps({
  variant: {
    type: String,
    default: "profile",
    validator: (v) => ["avatar", "profile", "header"].includes(v),
  },
  avatarSize: {
    type: [Number, String],
    default: 40,
  },
});
</script>

<style scoped>
.account-user-skeleton {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 9999px;
  min-height: 64px;
}

.account-user-skeleton--avatar,
.account-user-skeleton--header {
  justify-content: center;
  padding: 0;
  min-height: auto;
}

.account-user-skeleton__text {
  flex: 1;
  min-width: 0;
}
</style>
