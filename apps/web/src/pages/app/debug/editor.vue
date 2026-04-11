<template>
  <v-container>
    <v-row
    >
      <v-col cols="6">
        <v-textarea v-model="proejct.indexhtml"></v-textarea
        >
      </v-col>
      <v-col cols="6"
      >
        <v-textarea v-model="proejct.stylecss"></v-textarea
        >
      </v-col>

      <v-col cols="6"
      >
        <v-textarea v-model="proejct.scriptjs"></v-textarea
        >
      </v-col>
      <v-col cols="3">
        <v-btn @click="save()"> 搜索</v-btn>
      </v-col>
    </v-row
    >
  </v-container>
</template>

<script>
import request from "../../../axios/axios";

export default {
  data() {
    return {
      proejct: {
        indexhtml: "",
        stylecss: "",
        scriptjs: "",
      },
    };
  },
  methods: {
    async save() {
      await request({
        url: "/project/update/148",
        data: {
          "index.html": this.proejct.indexhtml,
          "style.css": this.proejct.stylecss,
          "script.js": this.proejct.scriptjs,
        },
        method: "post",
      }).then((res) => {
        console.log(res.data);
      });
    },
  },
};
</script>
