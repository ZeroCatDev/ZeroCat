<template>
  <div
    class="account-user-skeleton"
    :class="[`account-user-skeleton--${variant}`]"
    aria-hidden="true"
  >
    <div
      class="account-user-skeleton__avatar"
      :style="{ width: avatarSizePx, height: avatarSizePx }"
    />
    <div v-if="variant === 'profile'" class="account-user-skeleton__text">
      <div class="account-user-skeleton__line account-user-skeleton__line--name" />
      <div class="account-user-skeleton__line account-user-skeleton__line--handle" />
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
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

const avatarSizePx = computed(() => {
  const size = Number(props.avatarSize);
  return Number.isFinite(size) && size > 0 ? `${size}px` : "40px";
});
</script>

<style scoped>
/* 轻量占位：尺寸与真实用户条目保持一致，不再撑出大块胶囊骨架 */
.account-user-skeleton {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
}

.account-user-skeleton--avatar,
.account-user-skeleton--header {
  justify-content: center;
  padding: 0;
}

.account-user-skeleton__avatar {
  flex-shrink: 0;
  border-radius: 50%;
  background: rgba(var(--v-theme-on-surface), 0.08);
  animation: account-skeleton-pulse 1.6s ease-in-out infinite;
}

.account-user-skeleton__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.account-user-skeleton__line {
  height: 10px;
  border-radius: 4px;
  background: rgba(var(--v-theme-on-surface), 0.08);
  animation: account-skeleton-pulse 1.6s ease-in-out infinite;
}

.account-user-skeleton__line--name {
  width: 96px;
  height: 12px;
}

.account-user-skeleton__line--handle {
  width: 72px;
}

/* 中等屏幕下侧栏只显示头像，避免文字条溢出错位 */
@media (max-width: 1279px) {
  .account-user-skeleton:not(.account-user-skeleton--header) {
    justify-content: center;
  }

  .account-user-skeleton:not(.account-user-skeleton--header)
    .account-user-skeleton__text {
    display: none;
  }
}

@keyframes account-skeleton-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}

@media (prefers-reduced-motion: reduce) {
  .account-user-skeleton__avatar,
  .account-user-skeleton__line {
    animation: none;
  }
}
</style>
