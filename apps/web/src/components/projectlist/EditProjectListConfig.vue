<template>
  <v-card :loading="loading" :subtitle="`ID: ${listInfo.id || ''}`" :title="`${listInfo.title || '加载中...'}`" border>
    <v-card-text>
      <v-text-field
        v-model="newListInfo.title"
        :rules="[v => !!v || '名称不能为空']"
        label="名称"
        required
      ></v-text-field>
      <v-text-field
        v-model="newListInfo.description"
        label="简介"
      ></v-text-field>

      <v-select
        v-model="newListInfo.state"
        :items="listStates"
        item-title="state"
        item-value="abbr"
        label="项目状态"
      ></v-select>
    </v-card-text>
    <v-card-actions>
      <v-btn
        color="error"
        prepend-icon="mdi-delete"
        text="删除"
        variant="plain"
        @click="confirmDelete"
      ></v-btn>

      <v-spacer></v-spacer>
      <v-btn
        :disabled="!hasChanges"
        prepend-icon="mdi-refresh"
        text="重置"
        variant="plain"
        @click="newListInfo = JSON.parse(JSON.stringify(listInfo))"
      ></v-btn>

      <v-btn text="关闭" variant="plain" @click="close()"></v-btn>

      <v-btn
        :disabled="!hasChanges || !newListInfo.title"
        :loading="saving"
        color="primary"
        prepend-icon="mdi-content-save"
        text="保存"
        variant="tonal"
        @click="updateProjectList"
      ></v-btn>
    </v-card-actions>

    <v-dialog v-model="deleteDialog" max-width="500px">
      <v-card>
        <v-card-title class="text-h5">确认删除</v-card-title>
        <v-card-text>
          您确定要删除列表 "{{ listInfo.title }}" 吗？此操作不可撤销。
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" variant="text" @click="deleteDialog = false">取消</v-btn>
          <v-btn :loading="deleting" color="error" variant="text" @click="deleteProjectList">删除</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script>
import request from "../../axios/axios";
import { useSudoManager } from '@/composables/useSudoManager';

export default {
  data() {
    return {
      listStates: [
        {state: "私密", abbr: "private"},
        {state: "公开", abbr: "public"},
      ],
      loading: true,
      saving: false,
      deleting: false,
      deleteDialog: false,
      listInfo: {},
      newListInfo: {},
      sudoManager: useSudoManager()
    };
  },
  props: {
    listid: {
      type: String,
      required: true,
    },
    callback: {
      type: Function,
      required: false,
    },
    close: {
      type: Function,
      required: false,
    },
  },
  computed: {
    hasChanges() {
      return JSON.stringify(this.listInfo) !== JSON.stringify(this.newListInfo);
    }
  },
  methods: {
    async getProjectList(listid) {
      this.loading = true;
      try {
        const res = await request.get(`/projectlist/lists/listid/${listid}`);

        if (res.data.status === "success") {
          this.listInfo = JSON.parse(JSON.stringify(res.data.data));
          this.newListInfo = JSON.parse(JSON.stringify(res.data.data));
        } else {
          this.$toast.add({
            severity: "error",
            summary: "错误",
            detail: res.data.message || "获取列表信息失败",
            life: 3000,
          });
        }
      } catch (error) {
        console.error("获取列表信息失败:", error);
        this.$toast.add({
          severity: "error",
          summary: "错误",
          detail: "获取列表信息失败",
          life: 3000,
        });
      } finally {
        this.loading = false;
      }
    },

    async updateProjectList() {
      if (!this.newListInfo.title) return;

      this.saving = true;
      try {
        const res = await request.post(`/projectlist/lists/update/${this.listid}`, this.newListInfo);

        this.$toast.add({
          severity: res.data.status === "success" ? "success" : "error",
          summary: res.data.status === "success" ? "成功" : "错误",
          detail: res.data.message || "更新列表信息",
          life: 3000,
        });

        if (res.data.status === "success") {
          this.listInfo = JSON.parse(JSON.stringify(this.newListInfo));
          if (this.callback) this.callback();
        }
      } catch (error) {
        console.error("更新列表信息失败:", error);
        this.$toast.add({
          severity: "error",
          summary: "错误",
          detail: "更新列表信息失败",
          life: 3000,
        });
      } finally {
        this.saving = false;
      }
    },

    confirmDelete() {
      this.deleteDialog = true;
    },

    async deleteProjectList() {
      this.deleting = true;
      try {
        // 请求sudo认证
        const sudoToken = await this.sudoManager.requireSudo({
          title: '删除作品列表',
          subtitle: `您正在删除作品列表"${this.listInfo.title}"。此操作不可逆，请验证您的身份。`,
          persistent: true
        });

        const res = await request.post(`/projectlist/lists/delete`, {id: this.listid}, {
          headers: {
            'X-Sudo-Token': sudoToken
          }
        });

        this.$toast.add({
          severity: res.data.status === "success" ? "info" : "error",
          summary: res.data.status === "success" ? "成功" : "错误",
          detail: res.data.message || "删除列表",
          life: 3000,
        });

        if (res.data.status === "success") {
          this.deleteDialog = false;
          if (this.callback) this.callback();
          if (this.close) this.close();
        }
      } catch (error) {
        if (error.type !== 'cancelled') {
          console.error("删除列表失败:", error);
          this.$toast.add({
            severity: "error",
            summary: "错误",
            detail: "删除列表失败",
            life: 3000,
          });
        }
      } finally {
        this.deleting = false;
      }
    },
  },
  mounted() {
    this.getProjectList(this.listid);
  },
};
</script>

<style scoped></style>
