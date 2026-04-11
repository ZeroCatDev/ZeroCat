<template>
  <v-card v-if="visible" class="cloud-vars-info-card">
    <v-card-title class="d-flex justify-space-between align-center">
      <span>该项目使用了云变量</span>
    </v-card-title>

    <v-card-text>
<span class="text-body-2 text-medium-emphasis">你对该项目的操作可能被记录在云变量历史中，其他人也可以查看这些记录。</span>
      <div class="d-flex ga-2 flex-wrap">
        <v-btn
          color="primary"
          size="small"
          variant="tonal"
          :to="detailLink"
          class="mt-2"
        >
          查看云变量历史
        </v-btn>
        <v-btn
          v-if="loading"
          size="small"
          variant="text"
          disabled
        >
          检测中...
        </v-btn>
      </div>
    </v-card-text>
  </v-card>
</template>

<script>

export default {
  name: "CloudVariablesInfoCard",
  props: {
    projectId: {
      type: [String, Number],
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    projectname: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      loading: false,
      visible: false,
    };
  },
  computed: {
    detailLink() {
      return `/${this.username}/${this.projectname}/cloud`;
    },
  },
  mounted() {
    this.checkCloudVariables();
  },
  watch: {
    projectId() {
      this.checkCloudVariables();
    },
  },
  methods: {
    async checkCloudVariables() {
      if (!this.projectId) {
        this.visible = false;
        return;
      }
      this.loading = true;
      try {
        const apiBase = import.meta.env.VITE_APP_BASE_API || window.location.origin;
        const url = new URL(`/scratch/cloud/${this.projectId}/updates`, apiBase);
        url.searchParams.set("since", "0");
        url.searchParams.set("limit", "1");
        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const res = await fetch(url.toString(), { headers });
        const payload = await res.json();
        const list = this.extractList(payload);
        this.visible = list.length > 0;
      } catch (error) {
        this.visible = false;
      } finally {
        this.loading = false;
      }
    },
    extractList(payload) {
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.data)) return payload.data;
      if (Array.isArray(payload?.updates)) return payload.updates;
      if (Array.isArray(payload?.items)) return payload.items;
      if (Array.isArray(payload?.history)) return payload.history;
      return [];
    },
  },
};
</script>

<style scoped>
.cloud-vars-info-card {
  width: 100%;
}
</style>
