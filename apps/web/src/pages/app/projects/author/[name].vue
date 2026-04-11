<template>
  <project-query-view :target="$route.params.name" type="author"/>
</template>

<script>
import ProjectQueryView from "@/components/project/ProjectQueryView.vue";

export default {
  components: {
    ProjectQueryView,
  },
};
</script>
