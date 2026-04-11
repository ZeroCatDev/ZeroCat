<template>
  <v-card border prepend-icon="mdi-format-list-bulleted" title="新建列表">
    <v-card-text>
      <v-row dense>
        <v-col cols="12">
          <v-text-field
            v-model="projectInfo.title"
            :rules="[v => !!v || '标题不能为空']"
            hint="将便于查找"
            label="标题"
            required
          ></v-text-field>
        </v-col>
        <v-col cols="12">
          <v-text-field
            v-model="projectInfo.description"
            hint="简要描述列表内容"
            label="简介"
          ></v-text-field>
        </v-col>
        <v-col cols="12">
          <v-select
            v-model="projectInfo.state"
            :items="listStates"
            item-title="state"
            item-value="abbr"
            label="列表状态"
          ></v-select>
        </v-col>
      </v-row>
    </v-card-text>
    <v-divider></v-divider>
    <v-card-actions>
      <v-spacer></v-spacer>
      <v-btn text="关闭" variant="plain" @click="close()"></v-btn>
      <v-btn
        :disabled="!projectInfo.title"
        :loading="loading"
        color="primary"
        text="创建"
        variant="tonal"
        @click="newProjectList"
      ></v-btn>
    </v-card-actions>
  </v-card>
</template>

<script>
import openEdit from "../../stores/openEdit";
import request from "../../axios/axios";

export default {
  data() {
    return {
      projectInfo: {
        title: "",
        description: "",
        state: "private"
      },
      listStates: [
        {state: "私密", abbr: "private"},
        {state: "公开", abbr: "public"},
      ],
      loading: false,
      newId: 0,
      openEdit,
    };
  },
  props: {
    callback: {
      type: Function,
      required: false,
    },
    close: {
      type: Function,
      required: false,
    },
  },
  methods: {
    show() {
      this.projectInfo = {
        title: "",
        description: "",
        state: "private"
      };
      this.loading = false;
      this.newId = 0;
    },
    async newProjectList() {
      if (!this.projectInfo.title) return;

      this.loading = true;
      try {
        const res = await request.post("/projectlist/lists/create", this.projectInfo);

        this.$toast.add({
          severity: "info",
          summary: res.data.status === "success" ? "成功" : "错误",
          detail: res.data.message || "创建项目列表",
          life: 3000,
        });

        if (res.data.status === "success") {
          this.newId = res.data.data.id;
          if (this.callback) this.callback();
          if (this.close) this.close();
        }
      } catch (error) {
        console.error("创建项目列表失败:", error);
        this.$toast.add({
          severity: "error",
          summary: "错误",
          detail: "创建项目列表失败",
          life: 3000,
        });
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style scoped></style>
