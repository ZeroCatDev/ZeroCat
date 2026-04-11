<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" md="6" sm="8">
        <v-card class="text-center pa-4">
          <v-progress-circular
            v-if="loading"
            color="primary"
            indeterminate
          ></v-progress-circular>
          <template v-else-if="error">
            <v-alert text type="error">
              {{ error }}
            </v-alert>
          </template>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import {onMounted, ref} from 'vue'
import {useRoute, useRouter} from 'vue-router'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const error = ref(null)

onMounted(async () => {
  try {
    const userId = route.query.id
    if (!userId) {
      throw new Error('用户ID不能为空')
    }

    // 直接使用 event_data 中的 username 进行重定向
    const username = route.query.username
    if (!username) {
      throw new Error('用户名不能为空')
    }

    await router.push(`/${username}`)
  } catch (e) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
})
</script>
