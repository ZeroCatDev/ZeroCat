<template>
  <v-card :title="title" border hover>
    <v-list v-for="user in users" :key="user.id">
      <v-list-item :to="'/app/proxy/user/' + user.username">
        <template v-slot:prepend>
          <v-avatar :image="`${scratch_proxy}/avatars/${user.id}`"></v-avatar>
        </template>
        <v-list-item-title>{{ user.username }}</v-list-item-title>
        <v-list-item-subtitle>{{ user.profile.bio }}</v-list-item-subtitle>
      </v-list-item>
    </v-list>
    <v-card-actions>
      <v-btn :disabled="!canLoad" @click="fetchUsers">继续加载</v-btn>
    </v-card-actions>
  </v-card>
</template>

<script>
import request from "@/axios/axios";
import {get} from '@/services/serverConfig';

export default {
  props: {
    url: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: false,
    },
    subtitle: {
      type: String,
      required: false,
    }
  },
  data() {
    return {
      users: [],
      page: 0,
      canLoad: true,
      scratch_proxy: '',
      limit: 20,
    };
  },
  methods: {
    async fetchUsers() {
      await request
        .get(
          `${this.scratch_proxy}${this.url}limit=${this.limit}&offset=${this.page * this.limit}`
        )
        .then((res) => {
          this.users = this.users.concat(res.data);
          this.page += 1;
          if (res.data.length === 0) {
            this.canLoad = false;
          }
        });
    },
  },
  async mounted() {
    this.scratch_proxy = get('scratchproxy.url');
    this.fetchUsers();
  },
};
</script>
