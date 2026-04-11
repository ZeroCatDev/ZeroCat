<template>
  <v-container>
    <proxylicense url="https://scratch.mit.edu/explore/projects/all"></proxylicense>
    <br/>
    <v-row>
      <v-col cols="3"
      >
        <v-select
          v-model="search.order"
          :items="orderitems"
          :label="'排序 为：' + search.order"
          item-title="name"
          item-value="type"
        ></v-select
        >
      </v-col>

      <v-col cols="3"
      >
        <v-select
          v-model="search.tag"
          :items="tagitems"
          :label="'标签 为：' + search.tag"
          item-title="name"
          item-value="type"
        ></v-select
        >
      </v-col>

      <v-col cols="3">
        <v-btn @click="onPageChange(1, true)"> 加载</v-btn>
      </v-col>
    </v-row
    >
    <br/>
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
    <v-row>
      <v-col v-for="info in projects" :key="info" cols=" 12" md="3">
        <v-card :to="'/app/proxy/' + info.id">
          <v-img
            :src="`${scratch_proxy}/thumbnails/${info.id}`"
            cover
            lazy-src="../../../assets/43-lazyload.png"
          ></v-img
          >
          <v-card-item>
            <v-card-title>{{ info.title }}</v-card-title>

            <v-card-subtitle>{{
              info.description || "简介未找到"
              }}
            </v-card-subtitle>
          </v-card-item>
          <v-list>
            <v-list-item>
              <template v-slot:prepend>
                <v-avatar
                  :image="`${this.scratch_proxy}/avatars/${info.author.id}`"
                ></v-avatar>
              </template>
              <v-list-item-title>
                {{ info.author.username }}
              </v-list-item-title>
              <v-list-item-subtitle>{{ info.author.id }}</v-list-item-subtitle>
            </v-list-item>
          </v-list
          >
        </v-card>
      </v-col>
    </v-row
    >
    <br/>
    <v-btn @click="onPageChange(curPage + 1, false)">继续加载</v-btn>
  </v-container>
</template>

<script>
import {exploreProjects} from "@/services/proxy/projectService";
import {get} from '@/services/serverConfig';

export default {
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
      projects: [],
      projectscount: 0,
      curPage: 1,
      scratch_proxy: '',
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
    async onPageChange(page, clean) {
      if (clean) {
        this.projects = [];
      }
      this.usetime = Date.now();
      this.ProjectsLoading = true;
      try {
        const res = await exploreProjects(this.search.order, this.search.tag, page, this.search.limit);
        this.projects = this.projects.concat(res.data);
      } catch (err) {
        console.log(err);
      } finally {
        this.ProjectsLoading = false;
        this.usetime = Date.now() - this.usetime;
      }
      this.curPage = page;
    },
  },
};
</script>
