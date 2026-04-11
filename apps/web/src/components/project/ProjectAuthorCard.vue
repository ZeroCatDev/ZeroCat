<template>
  <v-card :to="'/' + author.username" border hover>
    <v-card-item>
      <template v-slot:prepend>
        <v-avatar>
          <v-img
            :alt="author.display_name"
            :src="localuser.getUserAvatar(author.avatar)"
          ></v-img>
        </v-avatar>
      </template>
      <v-card-title class="text-white">{{ author.display_name }}</v-card-title>
      <v-card-subtitle class="text-white">{{ author.bio }}</v-card-subtitle>

      <template v-if="localuser.id && localuser.id !== author.id" v-slot:append>
        <user-relation-controls
          :display-name="author.display_name"
          :user-id="author.id"
          :username="author.username"
        />
      </template>
    </v-card-item>
  </v-card>
</template>

<script>
import {localuser} from "@/services/localAccount";
import UserRelationControls from "@/components/user/UserRelationControls.vue";


export default {
  name: 'ProjectAuthorCard',
  components: {
    UserRelationControls
  },
  props: {
    author: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      localuser,
      loading: false,
      error: null,
      localuser,
    }
  },

}
</script>
