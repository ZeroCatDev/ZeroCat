<template>
  <v-container>
    <v-row>
      <v-col class="d-flex align-center mb-4" cols="12">
        <h2 class="text-h5">我的项目列表</h2>
        <v-spacer></v-spacer>
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          @click="openNewListDialog"
        >
          新建列表
        </v-btn>
      </v-col>
    </v-row>

    <v-row v-if="loading">
      <v-col class="text-center" cols="12">
        <v-progress-circular color="primary" indeterminate></v-progress-circular>
      </v-col>
    </v-row>

    <v-row v-else-if="myLists.length === 0">
      <v-col cols="12">
        <v-alert type="info" variant="tonal">
          您还没有创建任何项目列表，点击右上角的"新建列表"按钮创建一个吧！
        </v-alert>
      </v-col>
    </v-row>

    <v-row v-else>
      <v-col
        v-for="list in myLists"
        :key="list.id"
        cols="12"
        lg="3"
        md="4"
        sm="6"
      >
        <project-list-item
          :list="list"
          @edit="openEditDialog"
        />
      </v-col>
    </v-row>

    <!-- 新建列表对话框 -->
    <v-dialog v-model="newListDialog" max-width="600px">
      <NewProjectList
        :callback="fetchMyLists"
        :close="() => newListDialog = false"
      />
    </v-dialog>

    <!-- 编辑列表对话框 -->
    <v-dialog v-model="editDialog" max-width="600px">
      <EditProjectListConfig
        v-if="selectedListId"
        :callback="fetchMyLists"
        :close="() => editDialog = false"
        :listid="selectedListId"
      />
    </v-dialog>
  </v-container>
</template>

<script>
import {getMyProjectLists} from "../../services/projectListService";
import NewProjectList from "./NewProjectList.vue";
import EditProjectListConfig from "./EditProjectListConfig.vue";
import ProjectListItem from "./ProjectListItem.vue";

export default {
  components: {
    NewProjectList,
    EditProjectListConfig,
    ProjectListItem
  },
  data() {
    return {
      loading: true,
      myLists: [],
      newListDialog: false,
      editDialog: false,
      selectedListId: null,
    };
  },
  async created() {
    await this.fetchMyLists();
  },
  methods: {
    async fetchMyLists() {
      this.loading = true;
      try {
        const response = await getMyProjectLists();
        if (response.status === "success") {
          this.myLists = response.data || [];
        } else {
          this.$toast.add({
            severity: "error",
            summary: "错误",
            detail: response.message || "获取列表失败",
            life: 3000,
          });
        }
      } catch (error) {
        console.error("获取我的列表失败:", error);
        this.$toast.add({
          severity: "error",
          summary: "错误",
          detail: "获取列表失败",
          life: 3000,
        });
      } finally {
        this.loading = false;
      }
    },

    openNewListDialog() {
      this.newListDialog = true;
    },

    openEditDialog(listId) {
      this.selectedListId = listId;
      this.editDialog = true;
    }
  }
};
</script>
