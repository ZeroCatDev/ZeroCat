<template><v-card rounded="lg"  color="error" variant="tonal">
              <v-card-title class="py-3">
               “评论”正在被弃用！
              </v-card-title>

              <v-card-text>我们正在启用全新的方式组织社区内的文字内容，因此，单纯的评论区将被弃用，并可能被删除，您可以通过帖子中 @[用户名] 、引用某个作品或某位用户来发起讨论，只需点击页面下方发布动态按钮即可。</v-card-text>
            </v-card><br/>
  <v-card
    v-for="comment in commentList"
    :key="comment.id"
    border
    class="mb-2"
    elevation
    hover
    @click="showMore(comment)"
  >
    <CommentContent :comment="comment" :s3-bucket-url="s3BucketUrl"/>

    <!-- Child Comments Preview -->
    <v-card
      v-if="comment.children?.length"
      class="pb-3 pl-10 pr-3"
    >
      <v-list density="default">
        <v-list-item
          v-for="child in comment.children.slice(0, 2)"
          :key="child.id"
          link
          @click.stop="showMore(comment)"
        >
          <CommentListItem :comment="child" :s3-bucket-url="s3BucketUrl"/>
        </v-list-item>

        <v-list-item
          v-if="comment.children.length > 2"
          link
          @click.stop="showMore(comment)"
        >
          <v-list-item-title class="text-blue">查看全部</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-card>
  </v-card>

  <!-- Load More & Sort Buttons -->
  <div class="d-flex gap-2">
    <v-btn :disabled="isLoadingDisabled" border @click="loadMore">继续加载</v-btn>
    <v-btn border @click="toggleSort">{{ sortLabel }}</v-btn>
  </div>

  <!-- Comment Input -->
  <CommentInput
    v-model="commentText"
    :name="name"
    @submit="addComment"
  />

  <!-- Comment Detail Dialog -->
  <CommentDialog
    v-model="dialog"
    :comment="selectedComment"
    :s3-bucket-url="s3BucketUrl"
    @delete="handleDelete"
    @reply="handleReply"
  />
</template>

<script setup>
import {ref, computed, onMounted, watch} from 'vue'
import {get} from "@/services/serverConfig"
import request from "../axios/axios"
import {localuser} from "@/services/localAccount"
import {UAParser} from "ua-parser-js"
import CommentContent from './comment/CommentContent.vue'
import CommentListItem from './comment/CommentListItem.vue'
import CommentInput from './comment/CommentInput.vue'
import CommentDialog from './comment/CommentDialog.vue'

const props = defineProps({
  url: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  }
})

// State
const commentList = ref([])
const commentText = ref('')
const dialog = ref(false)
const selectedComment = ref(null)
const s3BucketUrl = ref('')
const page = ref(0)
const isLoadingDisabled = ref(false)
const sortOrder = ref('desc')

// Computed
const sortLabel = computed(() => sortOrder.value === 'desc' ? '时间倒序' : '时间正序')
const sortParam = computed(() => `insertedAt_${sortOrder.value}`)

// Methods
const loadComments = async (options = {}) => {
  try {
    if (options.reset) {
      page.value = 0
      commentList.value = []
    }

    const response = await request({
      url: '/comment/api/comment',
      params: {
        path: props.url,
        page: page.value + 1,
        pageSize: 10,
        sortBy: sortParam.value
      },
      method: 'get'
    })

    const {data} = response.data

    if (!data.data.length) {
      isLoadingDisabled.value = true
      return
    }

    commentList.value = commentList.value.concat(data.data)
    page.value = Number(data.page)
  } catch (error) {
    console.error('Failed to fetch comments:', error)
  }
}

const loadMore = () => loadComments()

const toggleSort = () => {
  sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc'
  loadComments({reset: true})
}

const addComment = async ({replyTo = null, rootId = null} = {}) => {
  try {
    await request({
      url: `/comment/api/comment?path=${props.url}`,
      method: 'post',
      data: {
        url: props.url,
        comment: commentText.value,
        pid: replyTo,
        rid: rootId
      }
    })

    commentText.value = ''
    await loadComments({reset: true})
    dialog.value = false
  } catch (error) {
    console.error('Failed to add comment:', error)
  }
}

const deleteComment = async (id) => {
  try {
    await request({
      url: `/comment/api/comment/${id}`,
      method: 'delete'
    })
    await loadComments({reset: true})
    dialog.value = false
  } catch (error) {
    console.error('Failed to delete comment:', error)
  }
}

const showMore = (comment) => {
  selectedComment.value = comment
  dialog.value = true
}

const handleReply = (params) => addComment(params)
const handleDelete = (id) => deleteComment(id)

// Lifecycle
onMounted(async () => {
  s3BucketUrl.value = get('s3.staticurl')
  loadComments()
})

// Watch
watch(() => props.url, () => loadComments({reset: true}))
</script>
