<template>
  <ProjectPageLayout>
    <template #main>
      <ProjectBranchNav
        :branch-history="projectbranchhistory"
        :branches="projectbranchs"
        :current-branch="$route.params.branch"
        :current-commit-id="currentCommitId"
        :projectname="$route.params.projectname"
        :username="$route.params.username"
      />

      <ProjectPlayer
        :branch="$route.params.branch"
        :commit-id="currentCommitId"
        :project-id="project.id"
        :showplayer="showplayer"
        :type="project.type"
      />
    </template>
    <template #sidebar>
      <ProjectInfoCard
        :author="author"
        :project="project"
        :projectname="$route.params.projectname"
        :username="$route.params.username"
        :branch="$route.params.branch"
        variant="branch"
      />
      <v-btn
        class="text-none mt-4"
        prepend-icon="mdi-share-variant"
        rounded="lg"
        variant="tonal"
        color="primary"
        @click="handleShareBranch"
      >
        分享此分支
      </v-btn>
    </template>
  </ProjectPageLayout>
</template>

<script>
import {use404Helper} from "@/composables/use404";
import {localuser} from "@/services/localAccount";
import {useHead} from "@unhead/vue";
import {ref} from "vue";
import {
  getProjectInfoByNamespace,
  initProject,
  getBranchs,
  getBranchHistoryByCommit,
} from "@/services/projectService";
import { openFloatingPostBar } from "@/composables/useFloatingPostBar";
import ProjectBranchNav from "@/components/project/ProjectBranchNav.vue";
import ProjectPlayer from "@/components/project/ProjectPlayer.vue";
import ProjectInfoCard from "@/components/project/ProjectInfoCard.vue";
import ProjectPageLayout from "@/components/project/ProjectPageLayout.vue";

export default {
  components: {
    ProjectBranchNav,
    ProjectPlayer,
    ProjectInfoCard,
    ProjectPageLayout,
  },
  data() {
    return {
      project: {},
      author: {},
      localuser,
      projectbranchs: [],
      projectbranchhistory: [],
      showplayer: true,
      currentCommitId: "",
      initProject,
    };
  },
    setup() {
      const pageTitle = ref("项目分支");
      useHead({
        title: pageTitle,
      });
      return {
        pageTitle,
      };
    },
  async mounted() {
    await this.initlizeProject();
  },
  methods: {
    async initlizeProject() {
      const username = this.$route.params.username;
      const projectname = this.$route.params.projectname;
      const branch = this.$route.params.branch;

      // 遗留问题
      if (username === "proxy") {
        this.$router.replace(`/app${this.$route.path}`);
        return;
      }

      // 获取云端数据
      const projectFromCloud = await getProjectInfoByNamespace(
        username,
        projectname
      );
      if (projectFromCloud.id === 0) {
        use404Helper.show404();
        return;
      }

      this.project = projectFromCloud;
      if (this.project.default_branch == null) {
        this.showplayer = false;
        return;
      }

      var res = await getBranchs(this.project.id);
      if (res.data.length === 0) {
        this.showplayer = false;
        return;
      }

      this.projectbranchs = res.data;
      const currentBranch = this.projectbranchs.find(
        (item) => item.name === branch
      );

      if (!currentBranch) {
        use404Helper.show404();
        return;
      }

      this.currentCommitId = currentBranch.latest_commit_hash;
      this.loadBranchHistory();
        this.pageTitle = `${this.project.title} at ${branch}`;
        this.author = this.project.author;
    },
    async loadBranchHistory() {
      const res = await getBranchHistoryByCommit(
        this.project.id,
        this.currentCommitId
      );
      this.projectbranchhistory = res;
    },
    handleShareBranch() {
      const branch = this.$route.params.branch;
      openFloatingPostBar({
        text: `分享分支 ${branch}`,
        embed: { type: 'project', id: this.project.id, branch },
        placeholder: `分享关于 ${this.project.title} 的内容...`
      });
    },
  },
  watch: {
    "$route.params.branch": {
      handler: async function (newBranch) {
        await this.initlizeProject();
      },
      immediate: true,
    },
  },
};
</script>
