<template>
  <v-card
    :subtitle="list.description || '无描述'"
    :title="list.title"
    :to="`/app/projectlist/${list.id}`"
    class="h-100"
  >
    <v-card-text>
      <div class="d-flex align-center">
        <v-chip :color="list.state === 'public' ? 'success' : 'warning'" class="mr-2" size="small">
          {{ list.state === 'public' ? '公开' : '私密' }}
        </v-chip>
        <span class="text-caption">{{ formatDate(list.updateTime || list.updatedAt) }}</span>
      </div>
      <div class="mt-2 d-flex align-center">
        <span class="text-caption">项目数: {{ projectCount }}</span>
        <v-spacer></v-spacer>
        <span v-if="list.author" class="text-caption">
          <v-avatar class="mr-1" size="16">
            <v-img :src="getUserAvatar(list.author)" alt="用户头像"></v-img>
          </v-avatar>
          {{ list.author.display_name || list.author.username || `用户${list.authorid}` }}
        </span>
      </div>
    </v-card-text>

    <v-card-actions>
      <v-btn
        v-if="isOwner"
        color="primary"
        icon="mdi-pencil"
        size="small"
        variant="text"
        @click.stop.prevent="$emit('edit', list.id)"
      ></v-btn>
      <v-spacer></v-spacer>
      <v-btn
        :to="`/app/projectlist/${list.id}`"
        icon="mdi-eye"
        size="small"
        variant="text"
      ></v-btn>
    </v-card-actions>
  </v-card>
</template>

<script>
import {localuser} from "../../services/localAccount";
import {getProjectListById} from "../../services/projectListService";
import {ref, onMounted} from "vue";


export default {
  props: {
    list: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      projectCount: 0,
      loading: false,
      error: null,
    };
  },
  computed: {
    isOwner() {
      const currentUser = localuser.user.value;
      return currentUser && currentUser.id === (this.list.authorid || this.list.userId);
    }
  },
  async created() {
    await this.fetchProjectCount();
  },
  setup() {

    const getUserAvatar = (user) => {
      if (!user || !user.avatar) return '';
      return localuser.getUserAvatar(user.avatar);
    };

    return {
      localuser,
      getUserAvatar,
    };
  },
  methods: {
    async fetchProjectCount() {
      if (!this.list.projects) {
        try {
          this.loading = true;
          const response = await getProjectListById(this.list.id);
          if (response.status === "success" && response.data) {
            this.projectCount = response.data.projects?.length || 0;
          }
        } catch (error) {
          console.error(`获取列表 ${this.list.id} 项目数量失败:`, error);
        } finally {
          this.loading = false;
        }
      } else {
        this.projectCount = this.list.projects.length;
      }
    },

    formatDate(dateString) {
      if (!dateString) return '未知';
      const date = new Date(dateString);
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    }
  }
};
</script>
