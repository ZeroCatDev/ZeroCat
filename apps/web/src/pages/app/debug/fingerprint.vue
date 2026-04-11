<template>
  <v-container>
    <PageAnalytics :target-id="1" target-type="user"/>
    <v-card class="mx-auto mt-4" max-width="800">
      <v-card-title class="text-h5">
        Fingerprint Debug Info
      </v-card-title>

      <v-card-text>
        <v-alert
          v-if="error"
          :text="error"
          class="mb-4"
          type="error"
        />

        <div v-if="loading" class="d-flex justify-center align-center pa-4">
          <v-progress-circular color="primary" indeterminate/>
        </div>

        <div v-else-if="fingerprint">
          <v-list>
            <v-list-item>
              <v-list-item-title class="text-h6">Visitor ID</v-list-item-title>
              <v-list-item-subtitle>
                <code class="text-body-1">{{ fingerprint.visitorId }}</code>
              </v-list-item-subtitle>
            </v-list-item>

            <v-divider class="my-2"></v-divider>

            <v-list-item>
              <v-list-item-title class="text-h6">Components</v-list-item-title>
            </v-list-item>

            <v-list-item v-for="(value, key) in fingerprint.components" :key="key">
              <template v-slot:title>
                <span class="font-weight-medium">{{ key }}</span>
              </template>
              <template v-slot:subtitle>
                <pre class="component-value">{{ formatValue(value) }}</pre>
              </template>
            </v-list-item>
          </v-list>

          <v-btn
            :loading="loading"
            class="mt-4"
            color="primary"
            @click="refreshFingerprint"
          >
            Refresh Fingerprint
          </v-btn>
        </div>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import {ref, onMounted} from 'vue'
import * as FingerprintJS from '@fingerprintjs/fingerprintjs'
import PageAnalytics from '@/components/analytics/PageAnalytics.vue'

const fingerprint = ref(null)
const loading = ref(true)
const error = ref(null)

const formatValue = (value) => {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (Array.isArray(value)) return JSON.stringify(value, null, 2)
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

const getFingerprint = async () => {
  try {
    loading.value = true
    error.value = null

    // Initialize an agent at application startup.
    const fpPromise = FingerprintJS.load()

    // Get the visitor identifier when you need it.
    const fp = await fpPromise
    const result = await fp.get()

    fingerprint.value = {
      visitorId: result.visitorId,
      components: result.components
    }
  } catch (err) {
    error.value = `Error getting fingerprint: ${err.message}`
    console.error('Fingerprint error:', err)
  } finally {
    loading.value = false
  }
}

const refreshFingerprint = () => {
  getFingerprint()
}

onMounted(() => {
  getFingerprint()
})
</script>

<style scoped>
.component-value {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: monospace;
  font-size: 0.875rem;
  background-color: rgba(0, 0, 0, 0.03);
  padding: 8px;
  border-radius: 4px;
  margin: 4px 0;
}

code {
  background-color: rgba(0, 0, 0, 0.03);
  padding: 2px 4px;
  border-radius: 4px;
}
</style>
