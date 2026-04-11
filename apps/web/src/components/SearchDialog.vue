<template>
  <v-dialog
    v-if="!isMobileOrTablet"
    v-model="dialog"
    :scrim="false"
    class="search-dialog"
    transition="dialog-bottom-transition"
    width="80%"
  >
    <template v-slot:activator="{ props }">
      <v-btn
        class="search-trigger"
        icon="mdi-magnify"
        v-bind="props"
        variant="text"
      ></v-btn>
    </template>
    <v-card
      border
      class="d-flex flex-column search-dialog-card bg-surface-light"
      hover
      max-height="90vh"
    >
      <v-card-text class="pa-0 flex-grow-0" style="margin: 16px">
        <SearchComponent mode="dialog" @search-submitted="closeDialog"/>
      </v-card-text>
    </v-card>
  </v-dialog>
  <v-btn
    v-else
    class="search-trigger"
    icon="mdi-magnify"
    variant="text"
    @click="navigateToSearch"
  ></v-btn>
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
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobile = /mobile|android|iphone|ipad|phone/i.test(userAgent);
      this.isMobileOrTablet = isMobile;
    },
    navigateToSearch() {
      this.dialog = false;
      this.$router.push("/app/search");
    },
    closeDialog() {
      this.dialog = false;
    },
  },
  mounted() {
    if (typeof window !== "undefined") {
      this.checkDevice();
      window.addEventListener("resize", this.checkDevice);
    }
  },
  beforeUnmount() {
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", this.checkDevice);
    }
  },
};
</script>

<style scoped>
.search-dialog {
  animation: dialogFadeIn 0.3s ease;
}

.search-trigger {
  transition: transform 0.3s ease;
}

.search-trigger:hover {
  transform: scale(1.1);
}

.search-dialog-card {
  animation: slideInFromTop 0.3s ease;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1) !important;
}

@keyframes dialogFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideInFromTop {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

:deep(.v-overlay__content) {
  transition: transform 0.3s ease !important;
}

:deep(.dialog-bottom-transition-enter-active),
:deep(.dialog-bottom-transition-leave-active) {
  transition: transform 0.3s ease, opacity 0.3s ease !important;
}

:deep(.dialog-bottom-transition-enter-from),
:deep(.dialog-bottom-transition-leave-to) {
  transform: translateY(-20px) !important;
  opacity: 0;
}
</style>
