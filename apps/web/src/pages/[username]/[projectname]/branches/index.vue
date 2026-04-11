<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title class="d-flex align-center">
            <span>分支</span>
            <v-spacer></v-spacer>
            <v-btn
              color="primary"
              prepend-icon="mdi-source-branch-plus"
              @click="showNewBranchDialog = true"
            >新建分支
            </v-btn
            >
          </v-card-title>
          <v-card-text>
            <v-list>
              <v-list-item
                v-for="branch in branches"
                :key="branch.name"
                :value="branch.name"
              >
                <template v-slot:prepend>
                  <v-icon
                    :color="branch.name === project.default_branch ? 'primary' : ''"
                  >mdi-source-branch
                  </v-icon
                  >
                </template>

                <v-list-item-title>{{ branch.name }}</v-list-item-title>
                <v-list-item-subtitle>
                  <span class="text-caption">最新提交: {{ branch.latest_commit_hash.substring(0, 7) }}</span>
                </v-list-item-subtitle>

                <template v-slot:append>
                  <v-btn
                    :to="`/${$route.params.username}/${$route.params.projectname}/tree/${branch.name}`"
                    variant="text"
                  >查看
                  </v-btn
                  >
                  <v-btn
                    v-if="branch.name !== project.default_branch"
                    color="error"
                    variant="text"
                    @click="confirmDeleteBranch(branch.name)"
                  >删除
                  </v-btn
                  >
                </template>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 新建分支对话框 -->
    <v-dialog v-model="showNewBranchDialog" max-width="500px">
      <v-card>
        <v-card-title>新建分支</v-card-title>
        <v-card-text>
          <v-form ref="form" v-model="valid">
            <v-text-field
              v-model="newBranch.name"
              :rules="[v => !!v || '分支名称不能为空']"
              label="分支名称"
              required
            ></v-text-field>
            <v-select
              v-model="newBranch.source"
              :items="branches"
              :rules="[v => !!v || '请选择源分支']"
              item-title="name"
              item-value="name"
              label="源分支"
              required
            ></v-select>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" text @click="showNewBranchDialog = false"
          >取消
          </v-btn
          >
          <v-btn
            :disabled="!valid"
            :loading="loading"
            color="primary"
            @click="createBranch"
          >创建
          </v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 删除分支确认对话框 -->
    <v-dialog v-model="showDeleteDialog" max-width="500px">
      <v-card>
        <v-card-title>删除分支</v-card-title>
        <v-card-text>
          确定要删除分支 "{{ branchToDelete }}" 吗？此操作不可撤销。
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" text @click="showDeleteDialog = false"
          >取消
          </v-btn
          >
          <v-btn
            :loading="loading"
            color="error"
            @click="deleteBranch"
          >删除
          </v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script>
import {use404Helper} from '@/composables/use404';
import {
  getProjectInfoByNamespace,
  getBranchs,
  createBranch as createBranchApi,
  deleteBranch as deleteBranchApi,
} from "@/services/projectService";
import {useHead} from "@unhead/vue";
import {ref} from "vue";

export default {
  data() {
    return {
      project: {},
      branches: [],
      showNewBranchDialog: false,
      showDeleteDialog: false,
      branchToDelete: "",
      loading: false,
      valid: false,
      newBranch: {
        name: "",
        source: "",
      },
    };
  },
  setup() {
    const pageTitle = ref("分支");
    useHead({
      title: pageTitle,
    });
    return {
      pageTitle,
    };
  },
  async mounted() {
    await this.initializeProject();
  },
  methods: {
    async initializeProject() {
      const username = this.$route.params.username;
      const projectname = this.$route.params.projectname;

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
      await this.loadBranches();
      this.pageTitle = `分支 · ${this.project.title}`;
    },
    async loadBranches() {
      const res = await getBranchs(this.project.id);
      this.branches = res.data || [];
    },
    async createBranch() {
      if (!this.$refs.form.validate()) return;

      try {
        this.loading = true;
        await createBranchApi(
          this.project.id,
          this.newBranch.name,
          this.newBranch.source
        );
        await this.loadBranches();
        this.showNewBranchDialog = false;
        this.newBranch.name = "";
        this.newBranch.source = "";
      } catch (error) {
        console.error("创建分支失败:", error);
        alert("创建分支失败: " + (error.message || "未知错误"));
      } finally {
        this.loading = false;
      }
    },
    confirmDeleteBranch(branchName) {
      this.branchToDelete = branchName;
      this.showDeleteDialog = true;
    },
    async deleteBranch() {
      try {
        this.loading = true;
        await deleteBranchApi(this.project.id, this.branchToDelete);
        await this.loadBranches();
        this.showDeleteDialog = false;
        this.branchToDelete = "";
      } catch (error) {
        console.error("删除分支失败:", error);
        alert("删除分支失败: " + (error.message || "未知错误"));
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>
