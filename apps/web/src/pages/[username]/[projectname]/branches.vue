<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-btn @click="newBranch.dialog = true">新建分支</v-btn>
        <v-card border hover>
          <v-card-title>分支列表</v-card-title>
          <v-list dense>
            <v-list-item
              v-for="item in projectbranchs"
              :key="item.name"
              :subtitle="JSON.stringify(item)"
              :title="item.name"
            >
              <template v-slot:append>
                <v-menu>
                  <template v-slot:activator="{ props }">
                    <v-btn
                      icon="mdi-dots-horizontal"
                      v-bind="props"
                      variant="text"
                    >
                    </v-btn>
                  </template>
                  <v-list>
                    <v-list-item
                      prepend-icon="mdi-pencil"
                      subtitle="设置此分支的简介"
                      title="设置分支简介"
                      @click="editBranchDescription(item.name)"
                    >
                    </v-list-item>
                    <v-list-item
                      disabled
                      prepend-icon="mdi-delete"
                      subtitle="将永久删除掉此分支所有数据，难以恢复"
                      title="删除此分支"
                    >
                    </v-list-item>
                  </v-list>
                </v-menu>
              </template>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>
    </v-row>
    <v-dialog v-model="branchDescription.dialog" max-width="500">
      <v-card>
        <v-card-title
        >设置分支 {{ branchDescription.branch }} 的简介
        </v-card-title
        >
        <v-card-text>
          <v-text-field
            v-model="branchDescription.description"
            counter="100"
            hint="设置此分支的简介"
            label="分支简介"
            variant="outlined"
            @keyup.enter="saveBranchDescription"
            @keyup.esc="branchDescription.dialog = false"
            @keyup.ctrl.s="saveBranchDescription"
          ></v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="branchDescription.dialog = false">取消</v-btn>
          <v-btn color="primary" @click="saveBranchDescription">保存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog v-model="newBranch.dialog" max-width="500">
      <v-card>
        <v-card-title>创建分支</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newBranch.name"
            counter="100"
            hint="设置此分支的名称"
            label="分支名称"
            variant="outlined"
            @keyup.enter="createBranch"
            @keyup.esc="newBranch.dialog = false"
            @keyup.ctrl.s="createBranch"
          ></v-text-field>
          <!--选择基于某个分支-->
          <v-select
            v-model="newBranch.base"
            :items="projectbranchs"
            item-title="name"
            item-value="name"
            label="选择基于某个分支"
          ></v-select>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="newBranch.dialog = false">取消</v-btn>
          <v-btn color="primary" @click="createBranch">创建</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script>
import {
  getProjectInfoByNamespace,
  getBranchs,
} from "@/services/projectService";
import request from "@/axios/axios";

export default {
  data() {
    return {
      projectbranchs: [],
      project: {},
      branchDescription: {
        branch: "",
        dialog: false,
        description: "",
      },
      newBranch: {
        name: "",
        dialog: false,
        base: "",
      },
    };
  },
  async mounted() {
    await this.fetchProjectInfo();
    this.fetchBranches();
  },
  methods: {
    async fetchProjectInfo() {
      const username = this.$route.params.username;
      const projectname = this.$route.params.projectname;
      const projectFromCloud = await getProjectInfoByNamespace(
        username,
        projectname
      );
      this.project = projectFromCloud;
    },
    async fetchBranches() {
      const projectId = this.project.id;
      const res = await getBranchs(projectId);
      this.projectbranchs = res.data;
    },
    async editBranchDescription(branchName) {
      this.branchDescription.branch = branchName;
      this.branchDescription.description = this.projectbranchs.find(
        (item) => item.name === branchName
      ).description;
      this.branchDescription.dialog = true;
    },
    async saveBranchDescription() {
      const projectId = this.project.id;
      const branchName = this.branchDescription.branch;
      const description = this.branchDescription.description;
      const res = await request.post(
        `/project/branches/description/?branch=${branchName}&projectid=${projectId}`,
        {description}
      );
      this.branchDescription.dialog = false;
      this.fetchBranches();
    },
    async createBranch() {
      const projectId = this.project.id;
      const branchName = this.newBranch.name;
      const res = await request(
        {
          url: `/project/branches?projectid=${projectId}`,
          method: "post",
          data: {
            name: branchName,
            branch: this.newBranch.base,
            projectid: projectId
          }
        }
      );
      this.$toast.add({
        severity: res.data.status,
        summary: res.data.message,
        detail: res.data.message,
        life: 3000,
      })
      this.newBranch.dialog = false;
      this.fetchBranches();
    },
  },
};
</script>
