<template>
  <v-card border hover subtitle="这是Scratch上的内容" title="ZeroCatScratchMirror">
    <v-card-text class="bg-surface-light pt-4">
      我们使用这种方式促进Scratch及其社区的发展，这些内容是按照<a
      href="https://creativecommons.org/licenses/by-sa/2.0/"
    >CC BY-SA 2.0</a
    >协议传播的，您可以点击链接查看协议全文。
    </v-card-text>
    <template v-slot:actions>
      <v-btn :href="url" target="_blank">在Scratch上查看此页面</v-btn>
      <v-btn href="https://scratch.mit.edu/terms_of_use" target="_blank"
      >Scratch使用条款
      </v-btn
      >
    </template>
  </v-card>
</template>
<script>
export default {
  data() {
    return {};
  },
  components: {},
  props: {
    url: {
      type: String,
      required: false,
    },
  },
  methods: {},
  mounted() {
  },
  computed: {},
  watch: {},
};
</script>
