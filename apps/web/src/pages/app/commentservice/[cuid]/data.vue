<template>
  <div />
</template>

<script setup>
import { onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

onMounted(() => {
  router.replace(`/app/commentservice/${route.params.cuid}/settings?tab=data`);
});
</script>
