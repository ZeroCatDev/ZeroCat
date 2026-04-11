<template>
  <error404/>
</template>

<script setup>
import error404 from "@/components/error/404.vue";
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

if (route.path.startsWith('/proxy')) {
  router.replace(`/app${route.path}`);
}
</script>
