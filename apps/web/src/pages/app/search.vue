<template>
  <v-container>
    <SearchComponent mode="page"/>
  </v-container>
</template>

<script>
import {useSeo} from "@/composables/useSeo";
import SearchComponent from '../../components/SearchComponent.vue';

export default {
  components: {
    SearchComponent
  },

  setup() {
    useSeo({
      title: "搜索",
      description: "搜索 ZeroCat 社区的项目、用户和内容。",
    });
  }
};
</script>
