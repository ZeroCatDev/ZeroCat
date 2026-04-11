<template>
  <v-container>
    <v-row
    >
      <v-col cols="8" lg="8" md="8" sm="8" xl="8" xs="8">
        <v-card border hover style="aspect-ratio: 4 / 3"
        >
          <iframe
            :src="embedurl"
            frameborder="0"
            scrolling="no"
            style="width: 100%; height: 100%"
          ></iframe
          >
        </v-card>
        <br/><br/>
        <v-card border hover>
          <v-card-title>操作说明</v-card-title>
          <v-card-text>{{ project.instructions }}</v-card-text>
        </v-card
        >
        <br/>
        <v-card border hover>
          <v-card-title>备注与鸣谢</v-card-title>
          <v-card-text>{{ project.description }}</v-card-text>
        </v-card
        >
        <br/><br/>
        <ProxyShowProjects
          :showUserInfo="true"
          :url="`/projects/${project.id}/remixes?`"
          autoload="false"
          subtitle="对此项目的fork"
          title="forks"
        ></ProxyShowProjects>
      </v-col>

      <v-col cols="4">
        <v-card border hover>
          <v-card-list
          >
            <v-card-item>
              <v-card-title>{{ project.title }}</v-card-title>
              <v-card-subtitle>{{ project.id }}</v-card-subtitle>
            </v-card-item
            >
            <v-card-item></v-card-item>
            <v-card-item>
              <v-chip pill>
                <v-avatar start>
                  <v-img
                    :src="`${this.scratch_proxy}/avatars/${project.author.id}`"
                  ></v-img>
                </v-avatar
                >
                {{ project.author.username || "加载中" }}
              </v-chip
              >
            </v-card-item>
            <v-card-item>
              <v-chip pill prepend-icon="mdi-eye"
              >{{ project.stats.views }}浏览
              </v-chip
              >
              <v-chip pill prepend-icon="mdi-heart"
              >{{ project.stats.loves }}赞
              </v-chip
              >
              <v-chip pill prepend-icon="mdi-star"
              >{{ project.stats.favorites }}star
              </v-chip
              >
              <v-chip pill prepend-icon="mdi-source-fork"
              >{{ project.stats.remixes }}fork
              </v-chip
              >

              <v-chip pill prepend-icon="mdi-clock"
              >{{ project.history.created }}创建
              </v-chip
              >
              <v-chip pill prepend-icon="mdi-clock"
              >{{ project.history.modified }}更新
              </v-chip
              >
              <v-chip pill prepend-icon="mdi-clock"
              >{{ project.history.shared }}公开
              </v-chip
              >
            </v-card-item>
            <v-card-item v-if="project.project_tags && project.project_tags.length > 0">
              <v-chip
                v-for="tag in project.project_tags"
                :key="tag.id"
                class="ma-1"
                pill
                prepend-icon="mdi-tag"
              >
                {{ tag.name }}
              </v-chip>
            </v-card-item>
          </v-card-list>

          <div class="px-4 d-flex ga-2 mb-2">
            <v-btn
              :href="scratch_proxy_gui + '/editor.html#' + project.id"
              target="_blank"
              variant="text"
            >打开创造页
            </v-btn
            >
          </div>

          <div class="px-4">
            <v-card
              :to="'/app/proxy/user/' + project.author.username"
              hover
              variant="tonal"
            >
              <v-card-item>
                <template v-slot:prepend>
                  <v-avatar>
                    <v-img
                      :src="`${this.scratch_proxy}/avatars/${project.author.id}`"
                    ></v-img>
                  </v-avatar>
                </template>
                <v-card-title class="text-white">
                  {{ project.author.username }}
                </v-card-title>
                <v-card-subtitle class="text-white">
                  {{ project.author.id }}
                </v-card-subtitle>
              </v-card-item>
            </v-card
            >
          </div>

          <br/>
        </v-card>
        <br/>
        <v-card
          v-if="parentProject"
          :to="'/app/proxy/' + parentProject.id"
          border
          hover
        >
          <v-card-item>
            <v-card-title>{{
              parentProject.id == project.remix.root ? "根项目" : "父项目为"
              }}
            </v-card-title>
            <v-card-subtitle>{{
              parentProject.id == project.remix.root ? "最初的项目" : "父项目"
              }}
            </v-card-subtitle>
          </v-card-item
          >
          <v-img
            :src="`${scratch_proxy}/thumbnails/${parentProject.id}`"
            cover
            lazy-src="../../../../assets/43-lazyload.png"
          ></v-img>
          <v-card-item>
            <v-card-title>{{ parentProject.title }}</v-card-title>
            <v-card-subtitle>{{ parentProject.description }}</v-card-subtitle>
          </v-card-item>
        </v-card>
        <br/>
        <v-card
          v-if="rootProject"
          :to="'/app/proxy/' + rootProject.id"
          border
          hover
        >
          <v-card-item>
            <v-card-title>根项目为</v-card-title>
            <v-card-subtitle>最初的项目</v-card-subtitle>
          </v-card-item
          >
          <v-img
            :src="`${scratch_proxy}/thumbnails/${rootProject.id}`"
            cover
            lazy-src="../../../../assets/43-lazyload.png"
          ></v-img>
          <v-card-title>{{ rootProject.title }}</v-card-title>
          <v-card-subtitle>{{ rootProject.description }}</v-card-subtitle>
        </v-card>
        <br/>
        <!--<v-card subtitle="此项目可以被存储到ZeroCat服务器" title="存储此项目">
          <v-card-text class="bg-surface-light pt-4">
            此项目可以被存储到ZeroCat服务器
          </v-card-text>
          <template v-slot:actions>
            <v-btn :to="'/app/proxy/' + project.id + '/fork'" variant="text"
              >保存到ZeroCat</v-btn
            >
          </template>
        </v-card>
        <br />-->
        <proxylicense
          :url="'https://scratch.mit.edu/projects/' + project.id"
        ></proxylicense>
      </v-col>
    </v-row>

    <RelatedPostsPanel
      v-if="project.id"
      type="project"
      :id="project.id"
      :hide-current-context-base="true"
    />
  </v-container>
</template>

<script>
import {getProject} from "@/services/proxy/projectService";
import RelatedPostsPanel from '@/components/posts/RelatedPostsPanel.vue';
import ProxyShowUsers from "../../../../components/proxy/ProxyShowUsers.vue";
import ProxyShowProjects from "../../../../components/proxy/ProxyShowProjects.vue";
import {get} from '@/services/serverConfig';

export default {
  components: {RelatedPostsPanel, ProxyShowProjects},
  data() {
    return {
      project: {
        id: 1,
        title: "加载中",
        description: "加载中",
        instructions: "加载中",
        visibility: "visible",
        public: true,
        comments_allowed: true,
        is_published: true,
        author: {
          id: 1,
          username: "加载中",
          scratchteam: false,
          history: {
            joined: "2000-01-01T00:00:00.000Z",
          },
          profile: {
            id: null,
            avatar: {
              "90x90": "",
              "60x60": "",
              "55x55": "",
              "50x50": "",
              "32x32": "",
            },
          },
        },
        image: "",
        avatar: {
          "282x218": "",
          "216x163": "",
          "200x200": "",
          "144x108": "",
          "135x102": "",
          "100x80": "",
        },
        history: {
          created: "2000-01-01T00:00:00.000Z",
          modified: "2000-01-01T00:00:00.000Z",
          shared: "2000-01-01T00:00:00.000Z",
        },
        stats: {
          views: 0,
          loves: 0,
          favorites: 0,
          remixes: 0,
        },
        remix: {
          parent: null,
          root: null,
        },
        project_token: "",
        project_tags: [],
      },
      parentProject: null,
      rootProject: null,
      projectid: this.$route.params.id,
      embedurl: "",
      scratch_proxy: '',
      scratch_proxy_gui: '',
    };
  },

  async mounted() {
    this.scratch_proxy = get('scratchproxy.url');
    this.scratch_proxy_gui = get('scratchproxy.gui');
    await this.fetchProjectData();
  },
  methods: {
    async fetchProjectData() {
      try {
        const res = await getProject(this.$route.params.id);
        this.project = res.data;
        this.embedurl = `${this.scratch_proxy_gui}/embed.html#${this.$route.params.id}`;
        if (this.project.remix.parent) {
          this.parentProject = (
            await getProject(this.project.remix.parent)
          ).data;
        }
        if (
          this.project.remix.root &&
          this.project.remix.root != this.project.remix.parent
        ) {
          this.rootProject = (
            await getProject(this.project.remix.root)
          ).data;
        }
      } catch (err) {
        console.log(err);
      }
    },
  },
};
</script>
