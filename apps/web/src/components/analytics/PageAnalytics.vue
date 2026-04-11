<template>
  <div style="display: none;"><!-- Empty div to satisfy transition requirements --></div>
</template>

<script setup>
import {onMounted, watch} from 'vue'
import * as FingerprintJS from '@fingerprintjs/fingerprintjs'
import axios from '@/axios/axios'

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

const sendAnalytics = async () => {
  // Only proceed if both targetType and targetId are valid
  if (!props.targetType || !props.targetId) {
    return
  }

  try {
    // Get fingerprint
    const fpPromise = FingerprintJS.load()
    const fp = await fpPromise
    const result = await fp.get()

    // Prepare analytics data
    const analyticsData = {
      visitor_id: result.visitorId,
      fingerprint: result.visitorId, // Using visitorId as fingerprint
      hostname: window.location.hostname,
      screen: `${window.screen.width}x${window.screen.height}`,
      language: navigator.language,
      url: window.location.href,
      referrer: document.referrer,
      page_title: document.title,
      target_type: props.targetType,
      target_id: Number(props.targetId) // Ensure number type for API
    }

    // Send analytics data
    await axios.post('/analytics/send', analyticsData)
  } catch (error) {
    console.error('Analytics error:', error)
    // Silently fail to not disturb user experience
  }
}

// Watch for changes in both props
watch(
  [() => props.targetType, () => props.targetId],
  ([newTargetType, newTargetId], [oldTargetType, oldTargetId]) => {
    // Only send analytics when both new values are present
    if (newTargetType && newTargetId) {
      sendAnalytics()
    }
  },
  {immediate: true}
)
</script>
