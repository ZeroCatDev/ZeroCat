<template>
  <span></span>
</template>

<script>
import Typewriter from 'typewriter-effect/dist/core';

export default {
  props: {
    strings: {
      type: Array,
      required: false, // 不强制，允许使用 slot 内容
      default: () => []
    },
    config: {
      type: Object,
      required: false,
      default: () => ({})
    }
  },
  data() {
    return {
      instance: null,
    };
  },
  mounted() {
    // 检查是否提供了 slot 内容
    const slotContent = this.getSlotContent();
    const finalStrings = this.strings.length > 0 ? this.strings : [slotContent];

    // 合并用户配置，并确保 autoStart 和 loop 默认为 true
    const newConfig = {
      strings: finalStrings,
      autoStart: true,
      loop: true,
      ...this.config
    };

    // 初始化 Typewriter 实例
    this.instance = new Typewriter(this.$el, newConfig);
  },
  methods: {
    // 获取 slot 中的文本内容
    getSlotContent() {
      const nodes = this.$slots.default?.() || [];
      return nodes.map(node => (node.children ? node.children : '')).join('');
    }
  },
  beforeDestroy() {
    if (this.instance) {
      this.instance.stop();
    }
  }
};
</script>
