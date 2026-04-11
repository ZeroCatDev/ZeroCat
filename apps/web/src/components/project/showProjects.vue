<template>
  <v-row>
    <v-col
      v-for="project in projects"
      :key="project.id"
      cols="12"
      lg="3"
      md="4"
      sm="6"
      xl="2"
      xs="12"
      xxl="2"
    >
      <project-card
        :author="project.author"
        :project="project"
        :show-author="showAuthor"
      />
    </v-col>
  </v-row>
</template>

<script>
import ProjectCard from "./ProjectCard.vue";

export default {
  components: {
    ProjectCard
  },
  props: {
    projects: {
      type: Array,
      required: true,
      default: () => []
    },
    showAuthor: {
      type: Boolean,
      default: false
    }
  }
};
</script>
