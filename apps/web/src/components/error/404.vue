<template>
  <v-container>
    <h1>糟糕！该页面不存在或者是一个不公开页面。</h1>
    <br/><br/>
    <v-btn color="primary" @click="goBack">返回上一页</v-btn>

    <v-btn to="/" variant="text">返回首页</v-btn>
  </v-container>
</template>

<script setup>
import {useRouter} from "vue-router";
import {use404Helper} from "@/composables/use404";

const router = useRouter();

const goHome = () => {
  use404Helper.reset404();
  //window.location.replace("/");
};

const goBack = () => {
  use404Helper.reset404();
  router.back();
  //window.history.go(-1);
};
</script>
