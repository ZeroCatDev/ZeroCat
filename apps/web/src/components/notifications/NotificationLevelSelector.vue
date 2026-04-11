<template>
  <v-menu
    v-model="menuOpen"
    :close-on-content-click="true"
    location="bottom end"
    offset="8"
  >
    <template #activator="{ props: menuProps }">
      <v-btn
        v-bind="menuProps"
        :disabled="disabled || loading"
        class="notification-level-trigger"
        rounded="pill"
        variant="outlined"
        size="small"
      >
        <v-progress-circular
          v-if="loading"
          indeterminate
          size="14"
          width="2"
          class="mr-2"
        />
        <v-icon v-else size="16" class="mr-2">mdi-bell-outline</v-icon>
        <span class="level-label">{{ currentItem?.title || label }}</span>
        <v-icon size="16" class="ml-1">mdi-chevron-down</v-icon>
      </v-btn>
    </template>

    <v-card class="notification-level-menu" rounded="xl" elevation="8">
      <div class="notification-level-panel">
        <div class="notification-level-caption">{{ label }}</div>
        <v-btn
          v-for="item in normalizedItems"
          :key="item.value"
          class="notification-level-option"
          :class="{ 'notification-level-option--active': item.value === innerValue }"
          variant="text"
          rounded="lg"
          block
          @click="handleChange(item.value)"
        >
          <span class="notification-level-option__text">{{ item.title }}</span>
          <v-icon
            v-if="item.value === innerValue"
            color="primary"
            size="16"
          >mdi-check</v-icon>
        </v-btn>
      </div>
    </v-card>
  </v-menu>
</template>

<script setup>
import { computed, ref, watch } from "vue";

const props = defineProps({
  modelValue: {
    type: String,
    default: "BASIC",
  },
  label: {
    type: String,
    default: "通知等级",
  },
  items: {
    type: Array,
    default: () => [
      { title: "不接收任何", value: "NONE", color: "grey" },
      { title: "默认", value: "BASIC", color: "info" },
      { title: "关注", value: "ENHANCED", color: "primary" },
      { title: "全部", value: "ALL", color: "success" },
    ],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:modelValue", "change"]);

const innerValue = ref(props.modelValue);
const menuOpen = ref(false);

const normalizedItems = computed(() => {
  return props.items.map((item) => ({
    title: item.title,
    value: item.value,
    color: item.color || "primary",
  }));
});

const currentItem = computed(() => {
  return normalizedItems.value.find((item) => item.value === innerValue.value);
});

watch(
  () => props.modelValue,
  (newValue) => {
    innerValue.value = newValue;
  }
);

const handleChange = (value) => {
  innerValue.value = value;
  menuOpen.value = false;
  emit("update:modelValue", value);
  emit("change", value);
};
</script>

<style scoped>
.notification-level-trigger {
  min-width: 172px;
  height: 34px;
  justify-content: space-between;
  text-transform: none;
  border-color: rgba(var(--v-theme-on-surface), 0.2);
}

.level-label {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-level-menu {
  min-width: 220px;
}

.notification-level-panel {
  padding: 8px;
}

.notification-level-caption {
  font-size: 11px;
  line-height: 1.2;
  color: rgba(var(--v-theme-on-surface), 0.58);
  padding: 2px 8px 6px;
}

.notification-level-option {
  height: 32px;
  min-height: 32px;
  justify-content: space-between;
  text-transform: none;
  padding: 0 10px;
}

.notification-level-option__text {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-level-option--active {
  background: rgba(var(--v-theme-primary), 0.1);
}
</style>
