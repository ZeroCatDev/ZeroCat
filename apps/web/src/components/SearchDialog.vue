<template>
  <v-dialog
    v-if="!isMobileOrTablet"
    v-model="dialog"
    width="80%"
    max-width="800px"
    transition="dialog-bottom-transition"
  >
    <template v-slot:activator="{ props }">
      <v-btn icon="mdi-magnify" variant="text" v-bind="props" />
    </template>
    <v-card>
      <v-card-text>
        <SearchComponent mode="dialog" @search-submitted="closeDialog" />
      </v-card-text>
    </v-card>
  </v-dialog>
  <v-btn
    v-else
    icon="mdi-magnify"
    variant="text"
    @click="navigateToSearch"
  />
</template>

<script>
import SearchComponent from "./SearchComponent.vue";

export default {
  name: "SearchDialog",
  components: {
    SearchComponent,
  },
  data() {
    return {
      dialog: false,
      isMobileOrTablet: false,
    };
  },
  methods: {
    checkDevice() {
      this.isMobileOrTablet = window.matchMedia("(max-width: 768px)").matches;
    },
    navigateToSearch() {
      this.dialog = false;
      this.$router.push("/app/search");
    },
    closeDialog() {
      this.dialog = false;
    },
    handleKeydown(e) {
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) {
        return;
      }
      if (e.key === "/" || (e.ctrlKey && e.key === "k")) {
        e.preventDefault();
        this.dialog = !this.dialog;
      }
      if (e.key === "Escape" && this.dialog) {
        this.dialog = false;
      }
    },
  },
  mounted() {
    this.checkDevice();
    this._mq = window.matchMedia("(max-width: 768px)");
    this._mq.addEventListener("change", this.checkDevice);
    window.addEventListener("keydown", this.handleKeydown);
  },
  beforeUnmount() {
    this._mq?.removeEventListener("change", this.checkDevice);
    window.removeEventListener("keydown", this.handleKeydown);
  },
};
</script>
