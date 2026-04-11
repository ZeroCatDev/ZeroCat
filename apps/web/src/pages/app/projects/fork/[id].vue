<template>
  <project-query-view :target="$route.params.id" type="fork"/>
</template>

<script>
import ProjectQueryView from "@/components/project/ProjectQueryView.vue";

export default {
  components: {
    ProjectQueryView,
  },
};
</script>
