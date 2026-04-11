<template>
  <v-container>
    <v-list>
      <v-list-item v-for="item in news" :key="item.id" :href="item.url" :prepend-avatar="item.image" target="_blank">

        <v-list-item-title>{{ item.headline }}</v-list-item-title>
        <v-list-item-subtitle>{{ item.copy }} - {{ item.stamp }}</v-list-item-subtitle>
      </v-list-item>

    </v-list>
  </v-container>
</template>
<script>
import request from "@/axios/axios";
import {get} from '@/services/serverConfig';

export default {
  data() {
    return {
      news: [],
      loading: false,
      scratch_proxy: '',
    };
  },
  methods: {
    async fetchNews() {
      this.loading = true;
      try {
        const res = await request.get(this.scratch_proxy + "/news");
        this.news = res.data;
      } catch (err) {
        console.log(err);
      } finally {
        this.loading = false;
      }
    },
  },
  async mounted() {
    this.scratch_proxy = get('scratchproxy.url');
    this.fetchNews();
  },
}
</script>
