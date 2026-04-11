<template>


  <div v-if="localuser.isLogin" class="object-notification-level-control">
    <NotificationLevelSelector
      v-model="level"
      :loading="loading"
      :disabled="updating"
      label="选择通知等级"
      @change="updateLevel"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { localuser } from "@/services/localAccount";
import { showSnackbar } from "@/composables/useNotifications";
import NotificationLevelSelector from "@/components/notifications/NotificationLevelSelector.vue";
import {
  getNotificationSetting,
  updateNotificationSetting,
} from "@/services/notificationService";

const props = defineProps({
  targetType: {
    type: String,
    required: true,
  },
  targetId: {
    type: [String, Number],
    required: true,
  },
});

const loading = ref(false);
const updating = ref(false);
const level = ref("BASIC");
const persistedLevel = ref("BASIC");


const canLoad = computed(() => {
  return (
    !!localuser.isLogin.value &&
    props.targetType &&
    props.targetId !== null &&
    props.targetId !== undefined &&
    String(props.targetId).length > 0
  );
});

const loadCurrentSetting = async () => {
  if (!canLoad.value) return;

  loading.value = true;
  try {
    const result = await getNotificationSetting(props.targetType, props.targetId);
    const currentLevel = result?.setting?.level || "BASIC";
    level.value = currentLevel;
    persistedLevel.value = currentLevel;
  } catch (error) {
    level.value = "BASIC";
    persistedLevel.value = "BASIC";
    console.error("加载对象通知等级失败:", error);
  } finally {
    loading.value = false;
  }
};

const updateLevel = async (nextLevel) => {
  if (!canLoad.value || updating.value) return;

  const previousLevel = persistedLevel.value;
  updating.value = true;

  try {
    await updateNotificationSetting({
      targetId: props.targetId,
      targetType: props.targetType,
      level: nextLevel,
    });
    level.value = nextLevel;
    persistedLevel.value = nextLevel;
    showSnackbar("通知等级已更新", "success");
  } catch (error) {
    level.value = previousLevel;
    const message = error?.response?.data?.error || "更新通知等级失败";
    showSnackbar(message, "error");
    console.error("更新对象通知等级失败:", error);
  } finally {
    updating.value = false;
  }
};

watch(
  () => [props.targetType, props.targetId, localuser.isLogin.value],
  () => {
    loadCurrentSetting();
  },
  { immediate: true }
);
</script>

<style scoped>
.object-notification-level-control {
  width: 100%;
}
</style>
