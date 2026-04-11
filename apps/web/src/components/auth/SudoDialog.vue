<template>
  <v-dialog
    v-model="dialogVisible"
    :persistent="persistent"
    :max-width="maxWidth"
    @keydown.esc="handleCancel"
  >
    <UnifiedAuth
      :title="title"
      :subtitle="subtitle"
      purpose="sudo"
      :identifier-label="identifierLabel"
      :submit-text="submitText"
      :show-cancel="showCancel"
      :force-mode="persistent"
      :user-id="userId"
      @success="handleSuccess"
      @cancel="handleCancel"
      @error="handleError"
      ref="authComponent"
    />
  </v-dialog>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import UnifiedAuth from './UnifiedAuth.vue';

// Props
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: 'Sudo 认证'
  },
  subtitle: {
    type: String,
    default: '为了您的账户安全，请验证您的身份'
  },
  identifierLabel: {
    type: String,
    default: '用户名或邮箱'
  },
  submitText: {
    type: String,
    default: '验证身份'
  },
  showCancel: {
    type: Boolean,
    default: true
  },
  persistent: {
    type: Boolean,
    default: false
  },
  maxWidth: {
    type: [String, Number],
    default: 450
  },
  userId: {
    type: Number,
    default: null
  }
});

// Emits
const emit = defineEmits(['update:modelValue', 'success', 'cancel', 'error']);

// 引用
const authComponent = ref(null);

// 计算属性
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

// 方法
const handleSuccess = (data) => {
  dialogVisible.value = false;
  emit('success', data);

  // 清理认证组件
  nextTick(() => {
    authComponent.value?.cleanup?.();
  });
};

const handleCancel = () => {
  dialogVisible.value = false;
  emit('cancel');

  // 清理认证组件
  nextTick(() => {
    authComponent.value?.cleanup?.();
  });
};

const handleError = (error) => {
  emit('error', error);
};

// 监听对话框关闭，清理组件状态
watch(dialogVisible, (newValue) => {
  if (!newValue) {
    nextTick(() => {
      authComponent.value?.cleanup?.();
    });
  }
});

// 导出方法供父组件调用
defineExpose({
  show: () => {
    dialogVisible.value = true;
  },
  hide: () => {
    dialogVisible.value = false;
  }
});
</script>
