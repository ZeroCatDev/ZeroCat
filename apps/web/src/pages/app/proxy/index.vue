<template>
  <v-container>
    <proxylicense url="https://scratch.mit.edu/explore/projects/all"></proxylicense>
    <br/>
    <v-progress-linear
      :active="ProjectsLoading"
      height="4"
      indeterminate
    ></v-progress-linear>
    <div class="mb-2">
      <v-chip
      >
        <v-icon icon="mdi-clock" start></v-icon>
        本页加载用时{{
        Math.abs(usetime / 1000)
        }}秒
      </v-chip>
    </div>
    <div v-for="(name, key) in projects" :key="name">
      <h1>{{ translate[key] || key }}</h1>
      <br/>
      <v-row>
        <v-col v-for="info in name" :key="info" cols="4" md="2">
          <v-card v-if="info.type == 'project'" :to="'/app/proxy/' + info.id">
            <v-img
              :src="`${scratch_proxy}/thumbnails/${info.id}`"
              cover
              lazy-src="../../../assets/43-lazyload.png"
            ></v-img
            >
            <v-card-item>
              <v-card-title>{{ info.title }}</v-card-title>
              <v-card-subtitle>{{ info.creator }}</v-card-subtitle>
            </v-card-item>
          </v-card>
          <v-card
            v-if="info.type == 'gallery'"
            :to="'/app/proxy/studios/' + info.id"
          >
            <v-card-item>
              <v-card-title>{{ info.title }}</v-card-title>

              <v-card-subtitle>{{ info.id }}</v-card-subtitle>
            </v-card-item>
          </v-card>
        </v-col>
      </v-row
      >
      <br/><br/><br/><br/>
    </div>
  </v-container>
</template>

<script>
import {getFeaturedProjects} from "@/services/proxy/projectService";
import {useHead} from "@unhead/vue";
import {get} from '@/services/serverConfig';

export default {
  setup() {
    useHead({
      title: "Proxy",
    });
  },
  data() {
    return {
      orderitems: [
        {name: "热门的", type: "trending"},
        {name: "最受欢迎的", type: "popular"},
        {name: "新建的", type: "recent"},
      ],
      tagitems: [
        {name: "全部", type: "*"},
        {name: "动画", type: "animations"},
        {name: "艺术", type: "art"},
        {name: "游戏", type: "games"},
        {name: "音乐", type: "music"},
        {name: "故事", type: "stories"},
        {name: "教程", type: "tutorials"},
      ],
      search: {
        order: "trending",
        tag: "*",
        limit: 18,
      },
      usetime: 0,
      ProjectsLoading: false,
      projects: {},
      projectscount: 0,
      curPage: 1,
      scratch_proxy: '',
      translate: {
        community_newest_projects: "最新创建",
        community_most_remixed_projects: "大家在复刻的作品",
        scratch_design_studio: "Scratch设计室",
        curator_top_projects: "被特殊用户挑选的作品",

        community_featured_studios: "特色工作室",
        community_most_loved_projects: "大家在点赞的作品",
        community_featured_projects: "社区特殊作品",
      },
    };
  },
  async mounted() {
    this.scratch_proxy = get('scratchproxy.url');
    await this.getprojects();
  },
  methods: {
    async getprojects() {
      this.onPageChange(1);
    },
    async onPageChange() {
      this.usetime = Date.now();
      this.ProjectsLoading = true;
      try {
        const res = await getFeaturedProjects();
        this.projects = res.data;
      } catch (err) {
        console.log(err);
      } finally {
        this.ProjectsLoading = false;
        this.usetime = Date.now() - this.usetime;
      }
    },
  },
};
</script>
