<template>
  <div>
    <PageAnalytics :target-id="project.id" target-type="project"/>
    <ProjectPageLayout>
      <template #main>
        <v-alert
          v-if="isMirroredFrom40code"
          class="mb-4"
          type="info"
          variant="tonal"
          density="comfortable"
        >
          此项目从 40code 镜像而来，建议直接访问
          <a :href="mirror40codeLink" target="_blank" rel="noopener noreferrer">40code 原项目</a>
          获取最新内容。
        </v-alert>

        <ProjectBranchNav
          v-if="project.type !== 'article'"
          :branch-history="projectbranchhistory"
          :branches="projectbranchs"
          :current-branch="player.branch"
          :current-commit-id="player.commit.id"
          :projectname="$route.params.projectname"
          :username="$route.params.username"
        />

        <ProjectPlayer
          v-if="project.type !== 'article'"
          :branch="player.branch"
          :commit-id="player.commit.id"
          :project-id="project.id"
          :showplayer="showplayer"
          :type="project.type"
        />
        <v-card class="mt-4">
          <v-tabs v-model="tab" bg-color="primary">
            <v-tab value="readme">README</v-tab>
            <v-tab value="license">LICENSE</v-tab>
          </v-tabs>

          <v-card-text class="markdown-body">
            <v-tabs-window v-model="tab">
              <v-tabs-window-item value="readme">
                <template v-if="project.type === 'article'">
                  <div class="d-flex justify-end mb-3">
                    <v-btn
                      :to="articleReadLink"
                      color="primary"
                      variant="tonal"
                      prepend-icon="mdi-open-in-new"
                    >跳转阅读页面</v-btn>
                  </div>

                  <v-skeleton-loader
                    v-if="articleContentLoading"
                    type="paragraph, paragraph"
                  />
                  <Markdown v-else>{{ articleMarkdownContent }}</Markdown>
                </template>
                <Markdown v-else>{{ project.description }}</Markdown>
              </v-tabs-window-item>

              <v-tabs-window-item value="license">
                <License :licenseKey="project.license || 'none'"/>
              </v-tabs-window-item>
            </v-tabs-window>
          </v-card-text>
        </v-card>
      </template>
      <template #sidebar>
        <ProjectInfoCard
          :author="author"
          :project="project"
          :projectname="$route.params.projectname"
          :username="$route.params.username"
        />
        <div class="mt-4">
          <CloudVariablesInfoCard
            v-if="project.id"
            :project-id="project.id"
            :projectname="$route.params.projectname"
            :username="$route.params.username"
          />
        </div>
        <div class="mt-4">
          <RelatedPostsPanel
            v-if="project.id"
            type="project"
            :id="project.id"
            :hide-current-context-base="true"
            :project-route-base="projectRouteBase"
          />
        </div>
        <div class="mt-4">
          <ProjectRecommendationPanel
             v-if="project.id"
             :project-id="project.id"
          />
        </div>
        <div class="mt-4">
          <Comment :url="'project-' + project.id" name="项目"></Comment>
        </div>
      </template>
    </ProjectPageLayout>
  </div>
</template>

<script>
import {use404Helper} from '@/composables/use404';
import {localuser} from "@/services/localAccount";
import Comment from '@/components/Comment.vue';
import RelatedPostsPanel from '@/components/posts/RelatedPostsPanel.vue';
import ProjectRecommendationPanel from '@/components/project/ProjectRecommendationPanel.vue';
import {useSeo} from "@/composables/useSeo";
import {ref} from "vue";
import {
  getProjectInfoByNamespace,
  initProject,
  getBranchs,
  getBranchHistoryByCommit,
} from "@/services/projectService";
import Markdown from "@/components/Markdown.vue";
import License from "@/components/license/License.vue";
import ProjectBranchNav from "@/components/project/ProjectBranchNav.vue";
import ProjectPlayer from "@/components/project/ProjectPlayer.vue";
import ProjectInfoCard from "@/components/project/ProjectInfoCard.vue";
import ProjectPageLayout from "@/components/project/ProjectPageLayout.vue";
import CloudVariablesInfoCard from "@/components/project/CloudVariablesInfoCard.vue";
import "github-markdown-css";
import PageAnalytics from "@/components/analytics/PageAnalytics.vue";
import request from "@/axios/axios";

export default {
  components: {
    Comment,
    RelatedPostsPanel,
    ProjectRecommendationPanel,
    Markdown,
    License,
    ProjectBranchNav,
    ProjectPlayer,
    ProjectInfoCard,
    ProjectPageLayout,
    CloudVariablesInfoCard,
    PageAnalytics,
  },
  data() {
    return {
      project: {},
      author: {},
      localuser,
      tab: "readme",
      projectbranchs: [],
      projectbranchhistory: [],
      articleContent: "",
      articleContentLoading: false,
      showplayer: true,
      player: {
        branch: "main",
        commit: {
          id: "latest",
        },
        latest_commit_hash: "latest",
      },
      initProject,
    };
  },
  computed: {
    projectRouteBase() {
      const username = this.$route.params.username;
      const projectname = this.$route.params.projectname;
      if (!username || !projectname) return '';
      return `/${username}/${projectname}`;
    },
    articleReadLink() {
      const username = this.$route.params.username;
      const projectname = this.$route.params.projectname;
      if (!username || !projectname) return '';
      return `/${username}/articles/${projectname}`;
    },
    isMirroredFrom40code() {
      const username = this.$route.params.username;
      const projectname = this.$route.params.projectname;
      if (!username || !projectname) return false;
      return username.toLowerCase().endsWith('@40code.com') && /^\d+$/.test(projectname);
    },
    mirror40codeLink() {
      const projectname = this.$route.params.projectname;
      if (!projectname || !/^\d+$/.test(projectname)) return 'https://40code.com/';
      return `https://40code.com/#page=work&id=${projectname}`;
    },
    articleMarkdownContent() {
      if (this.articleContent) return this.articleContent;
      return this.project?.description || "暂无文章内容";
    }
  },
  setup() {
    const pageTitle = ref("项目");
    const pageDescription = ref("");
    useSeo({
      title: pageTitle,
      description: pageDescription,
    });
    return {
      pageTitle,
      pageDescription,
    };
  },
  async mounted() {
    this.initlizeProject();
  },
  methods: {
    async initlizeProject() {
      const username = this.$route.params.username;
      const projectname = this.$route.params.projectname;

      // 遗留问题
      if (this.$route.params.username == "proxy") {
        this.$router.replace(`/app${this.$route.path}`);
      }

      // 获取云端数据
      const projectFromCloud = await getProjectInfoByNamespace(
        username,
        projectname
      );
      if (projectFromCloud.id == 0) {
        use404Helper.show404();
        return;
      }
      this.project = projectFromCloud;
      this.project.id = this.project.id; // 更新 projectid
      if (this.project.type === 'article') {
        this.showplayer = false;
        await this.loadArticleContent();
      }
      if (this.project.default_branch == null) this.showplayer = false;
      this.player.branch = this.project.default_branch;
      var res = await getBranchs(this.project.id);
      if (res.data.length == 0) this.showplayer = false;
      this.projectbranchs = res.data;
      const currentBranch = this.projectbranchs.find(
        (item) => item.name === this.player.branch
      );
      if (currentBranch) {
        this.player.commit.id = currentBranch.latest_commit_hash;
        this.player.latest_commit_hash = currentBranch.latest_commit_hash;
      }
      this.loadBranchHistory();
      this.pageTitle = this.project.title;
      this.pageDescription = this.project.description || `${this.project.title} - ZeroCat 社区项目`;
      this.author = this.project.author;
    },
    async loadBranchHistory() {
      const res = await getBranchHistoryByCommit(
        this.project.id,
        this.player.latest_commit_hash
      );
      this.projectbranchhistory = res;
    },
    async loadArticleContent() {
      this.articleContentLoading = true;
      this.articleContent = "";
      try {
        const commitRes = await request.get(`/project/${this.project.id}/main/latest`);
        if (commitRes.data?.status !== "success") return;

        const token = commitRes.data.accessFileToken;
        const commitFile = commitRes.data.commit?.commit_file;
        if (!token || !commitFile) return;

        const fileRes = await request.get(
          `/project/files/${commitFile}?accessFileToken=${token}&content=true`
        );

        let raw = fileRes.data;
        if (typeof raw === "object") {
          raw = raw.index ?? "";
        }
        this.articleContent = typeof raw === "string" ? raw : "";
      } catch (error) {
        this.articleContent = "";
        console.error("Failed to load article content:", error);
      } finally {
        this.articleContentLoading = false;
      }
    },
  },
  watch: {
    player: {
      handler: function (newVal, oldVal) {
        this.loadBranchHistory();
      },
      deep: true,
    },
  },
};
</script>


