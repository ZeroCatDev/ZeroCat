<template>
  <v-container>
    <proxylicense url="https://scratch.mit.edu/explore/projects/all"></proxylicense>
    <br/>
    <v-row>
      <v-col cols="12">
        <v-text-field
          v-model="search.text"
          :label="'搜索 为：' + search.text"
        ></v-text-field>
      </v-col>

      <v-col cols="3">
        <v-select
          v-model="search.order"
          :items="orderitems"
          :label="'排序 为：' + search.order"
          item-title="name"
          item-value="type"
        ></v-select>
      </v-col>

      <v-col cols="3">
        <v-btn @click="onSearch"> 搜索</v-btn>
      </v-col>
    </v-row>
    <br/>
    <br/>

    <ProxyShowProjects
      :autoload="true"
      :show-user-info="true"
      :url="searchUrl"
      subtitle="搜索结果"
      title="搜索结果"
    ></ProxyShowProjects>
  </v-container>
</template>

<script>
import ProxyShowProjects from "@/components/proxy/ProxyShowProjects.vue";

export default {
  components: {ProxyShowProjects},
  data() {
    return {
      orderitems: [
        {name: "热门的", type: "trending"},
        {name: "最受欢迎的", type: "popular"},
        {name: "新建的", type: "recent"},
      ],
      search: {
        text: "",
        order: "trending",
      },
      searchUrl: "",
    };
  },
  methods: {
    onSearch() {
      this.searchUrl = `/projects/search/projects?mode=${this.search.order}&q=${this.search.text}&`;
    },
  },
  watch: {
    '$route.query': {
      handler() {
        this.search.text = this.$route.query.text || "";
        this.search.order = this.$route.query.order || "trending";
      },
      immediate: true,
    },
  },
};
</script>
