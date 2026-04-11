<template>
  <v-dialog v-model="this.isVisible" max-width="500px" persistent>
    <v-card border prepend-icon="mdi-xml" title="新建作品">
      <v-card-text>
        <v-row dense>
          <v-col cols="12" md="12" sm="12">
            <v-text-field
              v-model="projectinfo.title"
              hint="将会在首页展示"
              label="标题"
              required
            ></v-text-field>
          </v-col>

          <v-col cols="12" sm="6">
            <v-select
              v-model="projectinfo.type"
              :items="['scratch', 'scratch-clipcc', 'python', 'text']"
              hint="选择一个"
              label="类型"
              required
            ></v-select>
          </v-col>
        </v-row>
      </v-card-text>
      <v-divider></v-divider>
      <v-card-actions>
        <v-btn
          :disabled="!created"
          text="打开"
          variant="plain"
          @click="openEdit(newid, projectinfo.type)"
        ></v-btn>

        <v-spacer></v-spacer>

        <v-btn text="取消" variant="plain" @click="isVisible = false"></v-btn>

        <v-btn
          :disabled="created"
          color="primary"
          text="创建"
          variant="tonal"
          @click="newProject()"
        ></v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import openEdit from "../../stores/openEdit";
import request from "../../axios/axios";

export default {
  data() {
    return {
      projectinfo: {
        title: "新建作品",
        type: "scratch",
      },
      created: false,
      newid: 0,
      isVisible: false,
      openEdit,
    };
  },
  methods: {
    show() {
      (this.projectinfo = {
        title: "新建作品",
        type: "scratch",
      })
        (this.created = false);
      this.newid = 0;
      this.isVisible = true;
    },
    async newProject() {
      await request.post("/project/", this.projectinfo).then((res) => {
        console.log(res);
        this.$toast.add({
          severity: "info",
          summary: "info",
          detail: res.data,
          life: 3000,
        });
        if (res.data.status == "success") {
          //this.created = true
          this.newid = res.data.id;
        }
      });
    },
  },
};
</script>

<style scoped></style>
