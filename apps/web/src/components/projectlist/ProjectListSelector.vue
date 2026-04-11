<template>
  <v-menu v-model="menu" :close-on-content-click="false">
    <template v-slot:activator="{ props }">
      <v-btn
        :loading="loading"
        color="primary"
        prepend-icon="mdi-playlist-plus"
        v-bind="props"
        variant="tonal"
      >
        添加到列表
      </v-btn>
    </template>

    <v-card max-width="400" min-width="300">
      <v-card-title class="text-subtitle-1">
        选择列表
        <v-spacer></v-spacer>
        <v-btn
          color="primary"
          icon="mdi-plus"
          size="small"
          variant="text"
          @click="openNewListDialog"
        ></v-btn>
      </v-card-title>

      <v-divider></v-divider>

      <v-list v-if="loading">
        <v-list-item>
          <template v-slot:prepend>
            <v-progress-circular indeterminate size="20"></v-progress-circular>
          </template>
          <v-list-item-title>加载中...</v-list-item-title>
        </v-list-item>
      </v-list>

      <v-list v-else-if="myLists.length === 0">
        <v-list-item>
          <v-list-item-title>暂无列表</v-list-item-title>
          <v-list-item-subtitle>点击右上角加号创建</v-list-item-subtitle>
        </v-list-item>
      </v-list>

      <v-list v-else>
        <v-list-item
          v-for="list in myLists"
          :key="list.id"
          :active="isInList(list.id)"
          :subtitle="list.description || '无描述'"
          :title="list.title"
          @click="toggleListItem(list.id)"
        >
          <template v-slot:prepend>
            <v-icon :color="isInList(list.id) ? 'success' : ''">
              {{ isInList(list.id) ? 'mdi-check-circle' : 'mdi-playlist-plus' }}
            </v-icon>
          </template>
        </v-list-item>
      </v-list>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn text="关闭" variant="text" @click="menu = false"></v-btn>
      </v-card-actions>
    </v-card>

    <v-dialog v-model="newListDialog" max-width="600px">
      <NewProjectList
        :callback="fetchMyLists"
        :close="() => newListDialog = false"
      />
    </v-dialog>
  </v-menu>
</template>

<script>
import {getMyProjectLists, addProjectToList, removeProjectFromList} from "../../services/projectListService";
import request from "../../axios/axios";
import NewProjectList from "./NewProjectList.vue";

export default {
  components: {
    NewProjectList
  },
  props: {
    projectId: {
      type: [String, Number],
      required: true
    }
  },
  data() {
    return {
      menu: false,
      loading: false,
      myLists: [],
      projectLists: [],
      newListDialog: false
    };
  },
  watch: {
    menu(val) {
      if (val) {
        this.fetchMyLists();
        this.checkProjectLists();
      }
    }
  },
  methods: {
    async fetchMyLists() {
      this.loading = true;
      try {
        const response = await getMyProjectLists();
        if (response.status === "success") {
          this.myLists = response.data || [];
        }
      } catch (error) {
        console.error("获取我的列表失败:", error);
      } finally {
        this.loading = false;
      }
    },

    async checkProjectLists() {
      try {
        const response = await request.get(`/projectlist/lists/check?projectid=${this.projectId}`);
        if (response.data.status === "success") {
          this.projectLists = response.data.data || [];
        }
      } catch (error) {
        console.error("检查项目列表失败:", error);
      }
    },

    isInList(listId) {
      return this.projectLists.some(list => list.id === listId);
    },

    async toggleListItem(listId) {
      this.loading = true;
      try {
        if (this.isInList(listId)) {
          // 如果已在列表中，则移除
          const response = await removeProjectFromList(listId, this.projectId);

          if (response.status === "success") {
            this.$toast.add({
              severity: "success",
              summary: "成功",
              detail: "已从列表中移除",
              life: 3000,
            });
            await this.checkProjectLists();
          }
        } else {
          // 如果不在列表中，则添加
          const response = await addProjectToList(listId, this.projectId);

          if (response.status === "success") {
            this.$toast.add({
              severity: "success",
              summary: "成功",
              detail: "已添加到列表",
              life: 3000,
            });
            await this.checkProjectLists();
          }
        }
      } catch (error) {
        console.error("操作列表失败:", error);
        this.$toast.add({
          severity: "error",
          summary: "错误",
          detail: "操作失败",
          life: 3000,
        });
      } finally {
        this.loading = false;
      }
    },

    openNewListDialog() {
      this.newListDialog = true;
    }
  }
};
</script>
