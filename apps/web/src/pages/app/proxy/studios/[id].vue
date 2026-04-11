<template>
  <v-container>
    <div class="mb-2">
      <v-card
        :disabled="UserCardLoading"
        :loading="UserCardLoading"
        class="mx-auto mb-4"
      >
        <template v-slot:prepend>
          <v-avatar class="mb-2">
            <v-img :alt="studioinfo.username" :src="studioinfo.image"></v-img>
          </v-avatar>
        </template>
        <template v-slot:title>
          <span class="font-weight-black">{{ studioinfo.title }}</span>
        </template>
        <template v-slot:loader="{ isActive }">
          <v-progress-linear
            :active="isActive"
            height="4"
            indeterminate
          ></v-progress-linear>
        </template>
        <template v-slot:subtitle>
          <v-chip-group column>
            <v-chip>
              <v-icon icon="mdi-account-circle" start></v-icon>

              ID:{{ studioinfo.id }}
            </v-chip>
            <v-chip>
              <v-icon icon="mdi-clock" start></v-icon>

              {{ studioinfo.history.created }}创建
            </v-chip>
            <v-chip>
              <v-icon icon="mdi-clock" start></v-icon>

              {{ studioinfo.history.modified }}更新
            </v-chip
            >
            <v-chip>
              <v-icon icon="mdi-earth" start></v-icon>

              {{ studioinfo.public == true ? "公开" : "私密" }}
            </v-chip
            >
            <v-chip>
              <v-icon icon="mdi-earth" start></v-icon>

              {{
              studioinfo.open_to_all == true ? "对所有人开放" : "需要邀请"
              }}
            </v-chip
            >
            <v-chip>
              <v-icon icon="mdi-earth" start></v-icon>

              {{
              studioinfo.comments_allowed == true
              ? "Scratch官网允许评论"
              : "Scratch官网不允许评论"
              }}
            </v-chip
            >
            <v-chip>
              <v-icon icon="mdi-earth" start></v-icon>

              Scratch官网{{ studioinfo.stats.comments }}评论
            </v-chip
            >
            <v-chip>
              <v-icon icon="mdi-earth" start></v-icon>

              {{ studioinfo.stats.followers }}被关注
            </v-chip
            >
            <v-chip>
              <v-icon icon="mdi-earth" start></v-icon>

              {{ studioinfo.stats.managers }}成员
            </v-chip
            >
            <v-chip>
              <v-icon icon="mdi-earth" start></v-icon>

              {{ studioinfo.stats.projects }}项目
            </v-chip
            >
          </v-chip-group
          >
        </template>
        <v-tabs v-model="tab">
          <v-tab value="description">简介</v-tab>
          <v-tab value="members">成员</v-tab>
        </v-tabs>

        <v-card-text>
          <v-tabs-window v-model="tab">
            <v-tabs-window-item value="description">
              <pre>{{ studioinfo.description }}</pre>
            </v-tabs-window-item>

            <v-tabs-window-item value="members">

              <ProxyShowUsers
                :autoload="true"
                :url="`/studios/${studioinfo.id}/managers?`"
                subtitle="用户列表"
                title="管理员"
              ></ProxyShowUsers>
              <br/>

              <ProxyShowUsers
                :autoload="true"
                :url="`/studios/${studioinfo.id}/curators?`"
                subtitle="用户列表"
                title="成员"
              ></ProxyShowUsers>
            </v-tabs-window-item>
          </v-tabs-window>
        </v-card-text>
      </v-card>

      <ProxyShowProjects
        :autoload="true"
        :showUserInfo="true"
        :url="`/studios/${studioinfo.id}/projects?`"
        subtitle="项目列表"
        title="项目"
      ></ProxyShowProjects>
      <proxylicense :url="'https://scratch.mit.edu/studios/' + studioinfo.id"></proxylicense>

    </div>

    <Comment
      :url="'scratchmitedustudio-' + studioinfo.id"
      name="Scratch官网工作室"
    ></Comment>
  </v-container>
</template>

<script>
import {getStudio, getStudioProjects, getStudioCurators, getStudioManagers} from "@/services/proxy/studioService";
import Comment from "../../../../components/Comment.vue";
import ProxyShowProjects from "@/components/proxy/ProxyShowProjects.vue";
import ProxyShowUsers from "@/components/proxy/ProxyShowUsers.vue";
import {get} from '@/services/serverConfig';

export default {
  components: {Comment, ProxyShowUsers, ProxyShowProjects},
  data() {
    return {
      tab: ref(null),
      UserCardLoading: true,
      ProjectsLoading: true,
      userid: this.$route.params.id,
      studioinfo: {
        id: 1,
        title: "加载中",
        host: 1,
        description: "加载中",
        visibility: "visible",
        public: true,
        open_to_all: true,
        comments_allowed: true,
        image: "",
        history: {
          created: "2000-01-01T00:00:00.000Z",
          modified: "2000-01-01T00:00:00.000Z",
        },
        stats: {
          comments: 0,
          followers: 0,
          managers: 0,
          projects: 0,
        },
      },
      curators: [],
      curatorspage: 0,
      curatorscanload: true,

      managers: [],
      managerspage: 0,
      managerscanload: true,

      usetime: 0,
      projects: [],
      curPage: 1,
      limit: 18,

      scratch_proxy: '',
    };
  },

  async created() {
    await this.fetchStudioInfo();
    await this.onPageChange(1, false);
  },

  async mounted() {
    this.scratch_proxy = get('scratchproxy.url');
  },

  methods: {
    async fetchStudioInfo() {
      try {
        const res = await getStudio(this.$route.params.id);
        this.studioinfo = res.data;
      } catch (err) {
        console.log(err);
      } finally {
        this.UserCardLoading = false;
      }
    },
    async onPageChange(page, clean) {
      if (clean) {
        this.projects = [];
      }
      this.usetime = Date.now();
      this.ProjectsLoading = true;
      try {
        const res = await getStudioProjects(this.$route.params.id, page, this.limit);
        this.projects = this.projects.concat(res.data);
      } catch (err) {
        console.log(err);
      } finally {
        this.ProjectsLoading = false;
        this.usetime = Date.now() - this.usetime;
      }
      this.curPage = page;
    },
    async onCuratorsPageChange(page) {
      try {
        const res = await getStudioCurators(this.$route.params.id, page, this.limit);
        if (res.data.length === 0) {
          this.curatorscanload = false;
        }
        this.curators = this.curators.concat(res.data);
      } catch (err) {
        console.log(err);
      }
      this.curatorspage = page;
    },
    async onManagersPageChange(page) {
      try {
        const res = await getStudioManagers(this.$route.params.id, page, this.limit);
        if (res.data.length === 0) {
          this.managerscanload = false;
        }
        this.managers = this.managers.concat(res.data);
      } catch (err) {
        console.log(err);
      }
      this.managerspage = page;
    },
  },
};
</script>
