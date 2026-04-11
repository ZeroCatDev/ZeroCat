<template>
  <ProjectPageLayout>
    <template #main>
      <div class="d-flex justify-space-between mb-4">
        <div>
          <v-menu :close-on-content-click="false">
            <template v-slot:activator="{ props }">
              <v-btn
                class="text-none"
                prepend-icon="mdi-source-commit"
                rounded="lg"
                v-bind="props"
                variant="tonal"
              >
                <template v-slot:prepend>
                  <v-icon/>
                </template>
                {{ commitInfo ? commitInfo.commit.branch : "加载中..." }}
              </v-btn>
            </template>
          </v-menu>
        </div>
        <v-btn
          :to="`/${$route.params.username}/${
            $route.params.projectname
          }/tree/${commitInfo?.commit.branch || 'main'}`"
          class="text-none"
          prepend-icon="mdi-source-branch"
          rounded="lg"
          variant="tonal"
        >
          <template v-slot:prepend>
            <v-icon/>
          </template>
          返回最新提交
        </v-btn>
      </div>

      <ProjectPlayer
        :commit-id="$route.params.commitId"
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
        :commit="$route.params.commitId"
        variant="commit"
      />
      <v-card
        class="mt-4"
        :subtitle="commitInfo ? commitInfo.commit.commit_date : '加载中...'"
        :title="commitInfo ? commitInfo.commit.commit_message : '加载中...'"
        border
        hover
      >
        <v-card-text>{{
          commitInfo ? commitInfo.commit.commit_description : "加载中..."
          }}
        </v-card-text>
        <v-card-actions>
          <v-btn
            class="text-none ml-2"
            prepend-icon="mdi-share-variant"
            rounded="lg"
            variant="tonal"
            color="primary"
            @click="handleShareCommit"
          >
            分享此提交
          </v-btn>
        </v-card-actions>
      </v-card>
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
  getCommitInfo,
} from "@/services/projectService";
import { openFloatingPostBar } from "@/composables/useFloatingPostBar";
import ProjectPlayer from "@/components/project/ProjectPlayer.vue";
import ProjectInfoCard from "@/components/project/ProjectInfoCard.vue";
import ProjectPageLayout from "@/components/project/ProjectPageLayout.vue";

export default {
  components: {
    ProjectPlayer,
    ProjectInfoCard,
    ProjectPageLayout,
  },
  data() {
    return {
      project: {},
      author: {},
      localuser,
      showplayer: true,
      commitInfo: null,
      initProject,
    };
  },
  setup() {
    const pageTitle = ref("提交详情");
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
      const commitId = this.$route.params.commitId;

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

      // 获取提交信息
      this.commitInfo = await getCommitInfo(this.project.id, commitId);
      if (!this.commitInfo) {
        use404Helper.show404();
        return;
      }
      this.pageTitle = `${this.project.title} at ${this.commitInfo.commit_message}`;
      this.author = this.project.author;
    },
    handleShareCommit() {
      const commitId = this.$route.params.commitId;
      openFloatingPostBar({
        text: ` @${this.author.username} 的项目 ${this.project.title || ''} (提交：${commitId.slice(0, 7)})`,
        embed: { type: 'project', id: this.project.id, commit: commitId },
        placeholder: `分享关于 ${this.project.title} 的内容...`
      });
    },
  },
  watch: {
    "$route.params.commitId": {
      handler: async function (newCommitId) {
        await this.initlizeProject();
      },
      immediate: true,
    },
  },
};
</script>
