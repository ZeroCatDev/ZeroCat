<template>
  <v-dialog v-model="this.show" max-width="320" persistent>
    <v-list class="py-2" color="primary" elevation="12" rounded="lg">
      <v-list-item :title="text" prepend-icon="mdi-plus-circle">
        <template v-slot:prepend>
          <div class="pe-4">
            <v-icon color="primary" size="x-large"></v-icon>
          </div>
        </template>

        <template v-slot:append>
          <v-progress-circular
            color="primary"
            indeterminate="disable-shrink"
            size="16"
            width="2"
          ></v-progress-circular>
        </template>
      </v-list-item>
    </v-list>
  </v-dialog>
</template>

<script>
export default {
  props: {
    show: {
      type: Boolean,
      default: false,
    },
    text: {
      type: String,
      default: "加载中",
    },
  },
  watch: {
    show(val) {
      this.loading = val;
    },
    text(val) {
      this.text = val;
    },
  },
};
</script>

<style scoped></style>
