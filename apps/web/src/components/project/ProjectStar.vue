<template>
  <v-btn-group border density="compact" rounded="lg" size="x-small">
    <v-btn
      :loading="starLoading"
      class="text-none"
      text="Star"
      variant="tonal"
      @click="toggleStar"
    >
      <template v-slot:prepend>
        <v-icon
          :color="isStarred ? 'yellow' : ''"
          :icon="isStarred ? 'mdi-star' : 'mdi-star-outline'"
        />
      </template>
      {{ isStarred ? "Starred" : "Star" }} {{ starCount }}
    </v-btn>
    <v-divider color="surface-light" vertical/>
    <v-menu v-model="menu" :close-on-content-click="false">
      <template v-slot:activator="{ props }">
        <v-btn class="px-5" icon="mdi-menu-down" v-bind="props"/>
      </template>

      <v-card max-width="400" min-width="300">
        <v-progress-linear
          v-if="listLoading"
          color="primary"
          indeterminate
        ></v-progress-linear>

        <v-list>
          <div v-for="list in myLists" :key="list.id">
            <v-list-item
              :active="list.hasProject"
              :prepend-icon="list.hasProject ? 'mdi-check-circle' : 'mdi-playlist-plus'"
              :prepend-icon-color="list.hasProject ? 'success' : undefined"
              @click.stop="toggleListItem(list.id)"
            >
              <v-list-item-title>{{ list.title }}</v-list-item-title>
              <v-list-item-subtitle>{{ list.description }}</v-list-item-subtitle>
            </v-list-item>
          </div>
          <v-divider class="my-2"></v-divider>
          <v-list-item @click.stop="isVisibleDialog = true">
            <template v-slot:prepend>
              <v-icon>mdi-plus</v-icon>
            </template>
            <v-list-item-title>新建列表</v-list-item-title>
          </v-list-item>
        </v-list>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text="关闭" variant="text" @click="menu = false"></v-btn>
        </v-card-actions>
      </v-card>

      <v-dialog v-model="isVisibleDialog" min-width="400" width="auto" @click:outside="isVisibleDialog = false">
        <v-card border prepend-icon="mdi-format-list-bulleted" title="新建列表">
          <v-card-text>
            <v-text-field
              v-model="newListInfo.title"
              :rules="[v => !!v || '标题不能为空']"
              hint="将便于查找"
              label="标题"
              required
            ></v-text-field>
            <v-text-field
              v-model="newListInfo.description"
              hint="简要描述列表内容"
              label="简介"
            ></v-text-field>
            <v-select
              v-model="newListInfo.state"
              :items="listStates"
              item-title="state"
              item-value="abbr"
              label="列表状态"
            ></v-select>
          </v-card-text>
          <v-divider></v-divider>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn
              text="关闭"
              variant="plain"
              @click="isVisibleDialog = false"
            ></v-btn>
            <v-btn
              :disabled="!newListInfo.title"
              :loading="creatingList"
              color="primary"
              text="创建"
              variant="tonal"
              @click.stop="createNewList"
            ></v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-menu>
  </v-btn-group>
</template>

<script>
import {
  checkStarStatus,
  starProject,
  unstarProject,
  getProjectStarCount,
  getMyProjectLists,
  addProjectToList,
  removeProjectFromList,
  createProjectList
} from "../../services/projectListService";
import request from "../../axios/axios";

export default {
  props: {
    projectId: {
      type: [String, Number],
      required: true,
      validator: (value) => {
        if (value === undefined || value === null) return false;
        if (typeof value === 'string') return value.trim() !== '';
        if (typeof value === 'number') return !isNaN(value) && value > 0;
        return false;
      }
    }
  },
  data() {
    return {
      isStarred: false,
      starCount: 0,
      starLoading: false,
      listLoading: false,
      creatingList: false,
      isVisibleDialog: false,
      menu: false,
      myLists: [],
      newListInfo: {
        title: "",
        description: "",
        state: "private"
      },
      listStates: [
        {state: "私密", abbr: "private"},
        {state: "公开", abbr: "public"},
      ],
      error: null
    };
  },
  computed: {
    isValidProjectId() {
      return this.projectId !== undefined &&
        this.projectId !== null &&
        (typeof this.projectId === 'string' ? this.projectId.trim() !== '' : !isNaN(this.projectId) && this.projectId > 0);
    }
  },
  async created() {
    if (this.isValidProjectId) {
      await this.checkStarStatus();
      await this.getStarCount();
    } else {
      console.error('Invalid projectId provided:', this.projectId);
      this.error = '无效的项目ID';
    }
  },
  watch: {
    menu(val) {
      if (val && this.isValidProjectId) {
        this.fetchMyLists();
      }
    },
    projectId: {
      immediate: true,
      handler(newVal) {
        if (this.isValidProjectId) {
          this.checkStarStatus();
          this.getStarCount();
        }
      }
    }
  },
  methods: {
    async checkStarStatus() {
      if (!this.isValidProjectId) return;

      try {
        const response = await checkStarStatus(this.projectId);
        if (response?.status === "success") {
          this.isStarred = response.star;
        } else {
          throw new Error(response?.message || '检查收藏状态失败');
        }
      } catch (error) {
        console.error("检查收藏状态失败:", error);
        this.error = error.message || '检查收藏状态失败';
        this.$toast.add({
          severity: "error",
          summary: "错误",
          detail: this.error,
          life: 3000,
        });
      }
    },

    async getStarCount() {
      if (!this.isValidProjectId) return;

      try {
        const response = await getProjectStarCount(this.projectId);
        if (response?.status === "success") {
          this.starCount = response.data;
        } else {
          throw new Error(response?.message || '获取收藏数失败');
        }
      } catch (error) {
        console.error("获取收藏数失败:", error);
        this.error = error.message || '获取收藏数失败';
        this.$toast.add({
          severity: "error",
          summary: "错误",
          detail: this.error,
          life: 3000,
        });
      }
      this.$emit('star-updated');
    },

    async toggleStar() {
      if (!this.isValidProjectId) {
        this.$toast.add({
          severity: "error",
          summary: "错误",
          detail: "无效的项目ID",
          life: 3000,
        });
        return;
      }

      this.starLoading = true;
      try {
        const response = this.isStarred
          ? await unstarProject(this.projectId)
          : await starProject(this.projectId);

        if (response?.status === "success") {
          this.isStarred = !this.isStarred;
          await this.getStarCount();

          this.$toast.add({
            severity: "success",
            summary: "成功",
            detail: response.message,
            life: 2000,
          });
        } else {
          throw new Error(response?.message || '操作失败');
        }
      } catch (error) {
        console.error("切换收藏状态失败:", error);
        this.error = error.message || '切换收藏状态失败';
        this.$toast.add({
          severity: "error",
          summary: "错误",
          detail: this.error,
          life: 3000,
        });
      } finally {
        this.starLoading = false;
      }
    },

    async fetchMyLists() {
      if (!this.isValidProjectId) return;

      this.listLoading = true;
      try {
        const response = await request.get(`/projectlist/lists/check?projectid=${this.projectId}`);
        if (response?.data?.status === "success") {
          this.myLists = response.data.data || [];
        } else {
          throw new Error(response?.data?.message || '获取列表状态失败');
        }
      } catch (error) {
        console.error("获取我的列表失败:", error);
        this.error = error.message || '获取我的列表失败';
        this.$toast.add({
          severity: "error",
          summary: "错误",
          detail: this.error,
          life: 3000,
        });
      } finally {
        this.listLoading = false;
      }
    },

    async toggleListItem(listId) {
      // 不设置整体加载状态，避免菜单关闭
      const list = this.myLists.find(l => l.id === listId);
      if (!list) return;

      // 只更新当前项的加载状态
      list.loading = true;

      try {
        let response;
        if (list.hasProject) {
          // 如果已在列表中，则移除
          response = await removeProjectFromList(listId, this.projectId);

          if (response.status === "success") {
            this.$toast.add({
              severity: "success",
              summary: "成功",
              detail: "已从列表中移除",
              life: 3000,
            });
            // 更新本地状态
            list.hasProject = false;
          }
        } else {
          // 如果不在列表中，则添加
          response = await addProjectToList(listId, this.projectId);

          if (response.status === "success") {
            this.$toast.add({
              severity: "success",
              summary: "成功",
              detail: "已添加到列表",
              life: 3000,
            });
            // 更新本地状态
            list.hasProject = true;
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
        // 移除当前项的加载状态
        list.loading = false;
      }
    },

    async createNewList() {
      if (!this.newListInfo.title) return;

      this.creatingList = true;
      try {
        const response = await createProjectList(this.newListInfo);

        if (response.status === "success") {
          this.$toast.add({
            severity: "success",
            summary: "成功",
            detail: "列表创建成功",
            life: 3000,
          });

          // 重置表单
          this.newListInfo = {
            title: "",
            description: "",
            state: "private"
          };

          // 关闭对话框，但保持菜单打开
          this.isVisibleDialog = false;

          // 如果创建成功，自动将当前项目添加到新列表
          if (response.data && response.data.id) {
            await addProjectToList(response.data.id, this.projectId);
          }

          // 刷新列表
          await this.fetchMyLists();
        } else {
          this.$toast.add({
            severity: "error",
            summary: "错误",
            detail: response.message || "创建列表失败",
            life: 3000,
          });
        }
      } catch (error) {
        console.error("创建列表失败:", error);
        this.$toast.add({
          severity: "error",
          summary: "错误",
          detail: "创建列表失败",
          life: 3000,
        });
      } finally {
        this.creatingList = false;
      }
    }
  }
};
</script>
