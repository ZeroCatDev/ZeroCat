<template>
  <v-container>
      <h1>创建一个新的作品</h1>
      <p>作品包含你的代码文件，包括修订历史记录。作品信息可以随时修改。</p>
      <br/>

    <v-text-field
      v-model="projectinfo.name"
      :prefix="localuser.user.username + '/'"
      active
      label="项目名称"
      required
      variant="outlined"
      width="40%"
    ></v-text-field>
    <p>
      优秀的项目名称简短而令人难忘。需要灵感吗？<a
      color="primary"
      href="javascript:void(0)"
      style="text-decoration: none"
      @click.native="projectinfo.name = examplename"
    >{{ examplename }}</a
    >
      如何？
    </p>
    <br/>
    <v-textarea
      v-model="projectinfo.description"
      active
      counter="1000"
      label="简介（不必填）"
      required
      variant="outlined"
    ></v-textarea
    >
    <v-divider></v-divider>
    <br/>
    <v-radio-group v-model="projectinfo.state" row>
      <v-radio value="public">
        <template v-slot:label>
          <div>
            <strong>公开</strong><br/>互联网上的任何人都可以看到这个作品。
          </div>
        </template>
      </v-radio
      >
      <v-radio value="private">
        <template v-slot:label>
          <div><strong>私密</strong><br/>只有你可以看到这个作品。</div>
        </template>
      </v-radio
      >
    </v-radio-group
    >
    <v-divider></v-divider>
    <br/>
    <LanguageSelector
      v-model="projectinfo.type"
      label="选择作品类型"
      required
    />

    <LicenseSelector v-model="projectinfo.license"/>


    <br/>
    <v-divider></v-divider>
    <br/>

    <div class="d-flex justify-end">
      <v-btn
        :disabled="created"
        border
        color="primary"
        text="创建"
        variant="tonal"
        @click="newProject()"
      ></v-btn>
    </div>
  </v-container>
</template>

<script>
import openEdit from "../../stores/openEdit";
import request from "@/axios/axios";
import {useHead} from "@unhead/vue";
import {localuser} from "@/services/localAccount";
import {generate} from "random-words";
import LicenseSelector from "@/components/LicenseSelector.vue";
import LanguageSelector from "@/components/LanguageSelector.vue";

export default {
  components: {
    LicenseSelector,
    LanguageSelector
  },
  setup() {
    useHead({
      title: "新建作品",
    });
  },

  data() {
    return {
      localuser: localuser,
      projectinfo: {
        title: "新建作品",
        type: "scratch",
        name: "",
        state: "public",
        description: "",
        license: "None",
      },
      examplename: generate(Math.floor(Math.random() * 2) + 2).join("-"),
    };
  },

  methods: {
    async newProject() {
      this.projectinfo.title = this.projectinfo.name;
      await request.post("/project/", this.projectinfo).then((res) => {
        console.log(res.data);
        if (res.data.status == "error") {
          this.$toast.add({
            severity: "error",
            life: 3000,
            summary: "创建失败",
            detail: res.data.message,
          });
        }
        if (res.data.status == "success") {
          this.$router.push("/" + localuser.user.value.username + "/" + this.projectinfo.name);
        }
      });
    },
  },
};
</script>

<style scoped></style>
