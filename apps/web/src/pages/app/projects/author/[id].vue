<template>
  <v-container>
    <v-row>
      <v-col cols="12" lg="3" md="4">
        <user-info-card :user-id="$route.params.id"/>
      </v-col>
      <v-col cols="12" lg="9" md="8">
        <project-query-view :target="$route.params.id" type="author"/>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import ProjectQueryView from "@/components/project/ProjectQueryView.vue";
import UserInfoCard from "@/components/user/UserInfoCard.vue";

export default {
  components: {
    ProjectQueryView,
    UserInfoCard,
  },
};
</script>
