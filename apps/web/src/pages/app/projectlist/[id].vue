<template>
  <showProjectList :listId="listId"/>
</template>

<script>
import showProjectList from "@/components/projectlist/showProjectList.vue";
import {useHead} from "@unhead/vue";
import {ref} from "vue";
import {getProjectListById} from "@/services/projectService";

export default {
  components: {
    showProjectList,
  },
  data() {
    return {
      listId: this.$route.params.id,
      listTitle: "项目列表",
    };
  },
  async mounted() {
    try {
      const listData = await getProjectListById(this.listId);
      if (listData && listData.title) {
        this.listTitle = listData.title;
        this.pageTitle = this.listTitle;
      }
    } catch (error) {
      console.error("获取列表信息失败:", error);
    }
  },
  methods: {},
  setup() {
    const pageTitle = ref("项目列表");
    useHead({
      title: pageTitle,
    });
    return {
      pageTitle,
    };
  },
};
</script>

