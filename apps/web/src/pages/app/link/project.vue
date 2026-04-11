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
          <template v-else>
            <v-card-text>
              正在跳转到项目页面...
            </v-card-text>
          </template>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import {onMounted, ref} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import {getProjectInfo} from '@/services/projectService'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const error = ref(null)

onMounted(async () => {
  try {
    const projectId = route.query.id
    if (!projectId) {
      throw new Error('项目ID不能为空')
    }

    // 获取项目信息
    const projectInfo = await getProjectInfo(projectId)
    if (!projectInfo) {
      throw new Error('项目不存在')
    }

    // 检查项目作者信息
    if (!projectInfo.author || !projectInfo.author.username) {
      throw new Error('作者信息不存在')
    }

    // 重定向到项目页面
    await router.push(`/${projectInfo.author.username}/${projectInfo.name}`)
  } catch (e) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
})
</script>
