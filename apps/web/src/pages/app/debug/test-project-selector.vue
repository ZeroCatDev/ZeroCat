<template>
  <div class="pa-6">
    <v-container>
      <h1 class="text-h4 mb-6">项目选择器测试</h1>

      <v-row>
        <v-col cols="12" md="6">
          <v-card class="mb-4">
            <v-card-title>单选模式</v-card-title>
            <v-card-text>
              <ProjectSelector
                v-model="singleSelection"
                :multiple="false"
              />
              <div class="mt-3">
                <strong>选中的项目ID:</strong> {{ singleSelection || '未选择' }}
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="6">
          <v-card class="mb-4">
            <v-card-title>多选模式</v-card-title>
            <v-card-text>
              <ProjectSelector
                v-model="multipleSelection"
                :multiple="true"
              />
              <div class="mt-3">
                <strong>选中的项目IDs:</strong>
                <div v-if="multipleSelection.length === 0">未选择</div>
                <v-chip
                  v-else
                  v-for="id in multipleSelection"
                  :key="id"
                  class="me-1 mt-1"
                  size="small"
                  color="primary"
                >
                  {{ id }}
                </v-chip>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12">
          <v-card>
            <v-card-title>测试控制</v-card-title>
            <v-card-text>
              <div class="d-flex gap-3 mb-3">
                <v-btn @click="clearSingle" color="warning" variant="outlined">
                  清空单选
                </v-btn>
                <v-btn @click="clearMultiple" color="warning" variant="outlined">
                  清空多选
                </v-btn>
                <v-btn @click="setSampleSingle" color="primary" variant="outlined">
                  设置单选示例值
                </v-btn>
                <v-btn @click="setSampleMultiple" color="primary" variant="outlined">
                  设置多选示例值
                </v-btn>
              </div>

              <div class="mt-4">
                <h3>当前状态:</h3>
                <pre class="mt-2 pa-3 bg-grey-lighten-4 rounded">{{ debugInfo }}</pre>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import ProjectSelector from '@/components/shared/ProjectSelector.vue'

const singleSelection = ref(null)
const multipleSelection = ref([])

const debugInfo = computed(() => {
  return {
    singleSelection: singleSelection.value,
    multipleSelection: multipleSelection.value,
    singleType: typeof singleSelection.value,
    multipleType: typeof multipleSelection.value,
    multipleLength: Array.isArray(multipleSelection.value) ? multipleSelection.value.length : 'Not an array'
  }
})

const clearSingle = () => {
  singleSelection.value = null
}

const clearMultiple = () => {
  multipleSelection.value = []
}

const setSampleSingle = () => {
  singleSelection.value = 10338
}

const setSampleMultiple = () => {
  multipleSelection.value = [10338, 10338, 789]
}
</script>

<style scoped>
pre {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  white-space: pre-wrap;
}
</style>