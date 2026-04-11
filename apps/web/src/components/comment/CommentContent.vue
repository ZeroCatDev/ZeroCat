<template>
  <v-card-item>
    <template v-slot:prepend>
      <v-avatar color="blue-darken-2">
        <v-img :src="avatarUrl"></v-img>
      </v-avatar>
    </template>

    <v-card-title :to="'/user/' + comment.user_id">
      {{ comment.user?.display_name || '未知用户' }}
    </v-card-title>

    <v-card-subtitle>
      <TimeAgo :date="comment.insertedAt"/>
      {{ comment.most_specific_country_or_region }}
      {{ userAgent }}
      {{ comment.addr }}
    </v-card-subtitle>
  </v-card-item>
  <v-card-text>
    <Markdown>{{ comment.text }}</Markdown>
  </v-card-text>
</template>

<script setup>
import {computed} from 'vue'
import TimeAgo from '../TimeAgo.vue'
import Markdown from '../Markdown.vue'
import {UAParser} from 'ua-parser-js'
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

const userAgent = computed(() => {
  if (!props.comment.user_ua) {
    return ''
  }
  const ua = UAParser(props.comment.user_ua)
  const parts = []

  if (ua.browser.name) parts.push(ua.browser.name)
  if (ua.os.name) parts.push(ua.os.name)
  if (ua.os.version) parts.push(ua.os.version)

  return parts.join(' ')
})
</script>
