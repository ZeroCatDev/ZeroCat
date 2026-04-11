<template>
  <v-list-item>
    <template #prepend>
      <v-avatar size="40">
        <v-img :alt="comment.user?.display_name || '未知用户'" :src="avatarUrl"></v-img>
      </v-avatar>
    </template>

    <v-list-item-title>{{ comment.user?.display_name || '未知用户' }}</v-list-item-title>
    <v-list-item-subtitle>{{ comment.text }}</v-list-item-subtitle>
  </v-list-item>
</template>

<script setup>
import {computed} from 'vue'
import { localuser } from "@/services/localAccount";
const props = defineProps({
  comment: {
    type: Object,
    required: true
  },
  s3BucketUrl: {
    type: String,
    required: true
  }
})

const avatarUrl = computed(() => {
  if (props.comment?.user?.avatar) {
    return  localuser.getUserAvatar(props.comment.user.avatar)
  }
  return ''
})
</script>
