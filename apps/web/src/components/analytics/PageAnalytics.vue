<template>
  <div style="display: none;"><!-- Empty div to satisfy transition requirements --></div>
</template>

<script setup>
import { watch } from 'vue'
import { sendAnalyticsEvent } from '@/services/analyticsService'

const props = defineProps({
  targetType: {
    type: String,
    required: false,
    default: null,
    validator: (value) => value === null || ['project', 'user', 'home'].includes(value)
  },
  targetId: {
    type: [Number, String],
    required: false,
    default: null,
    validator: (value) => value === null || !isNaN(Number(value))
  }
})

// 使用本地生成并缓存的访客指纹发送分析事件，
// 避免在首屏加载 FingerprintJS 并执行同步指纹计算。
watch(
  [() => props.targetType, () => props.targetId],
  ([type, id]) => {
    if (!type || id === null || id === undefined || `${id}` === '') {
      return
    }

    sendAnalyticsEvent({
      targetType: type,
      targetId: Number(id),
    }).catch(() => {
      // 静默失败，不影响用户体验
    })
  },
  { immediate: true }
)
</script>
