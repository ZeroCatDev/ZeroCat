<template>
  <!-- 使用默认插槽传入的内容 -->
  <div v-if="ready" v-html="sanitizedHtmlContent"></div>
  <div v-else></div>
</template>

<script>
import "highlight.js/styles/atom-one-dark.css";
import twemoji from "twemoji";
import { TWEMOJI_SVG_OPTIONS } from "@/utils/twemoji";

// 懒加载重型依赖
let markdownInstancePromise = null;
let sanitizeFunctionPromise = null;

function getMarkdownInstance() {
  if (!markdownInstancePromise) {
    markdownInstancePromise = Promise.all([
      import("markdown-it"),
      import("highlight.js"),
      import("markdown-it-emoji"),
    ]).then(([MarkdownItModule, hljsModule, emojiModule]) => {
      const MarkdownIt = MarkdownItModule.default;
      const hljs = hljsModule.default;
      const emojiPlugin = emojiModule.full;

      const md = new MarkdownIt({
        highlight: function (str, lang) {
          if (lang && hljs.getLanguage(lang)) {
            try {
              return `<pre class="hljs"><code>${
                hljs.highlight(str, {language: lang, ignoreIllegals: true}).value
              }</code></pre>`;
            } catch (error) {
              console.error("代码高亮出错：", error);
            }
          }
          return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
        },
        breaks: true,
        linkify: true,
        typographer: true,
        html: true,
      });

      md.use(emojiPlugin);
      return md;
    });
  }
  return markdownInstancePromise;
}

function getSanitizeFunction() {
  if (!sanitizeFunctionPromise) {
    sanitizeFunctionPromise = import("dompurify").then((module) => {
      const createDOMPurify = module.default;
      const DOMPurify = createDOMPurify(window);

      DOMPurify.addHook("afterSanitizeAttributes", (node) => {
        if (node.href && !node.href.startsWith("about:blank#")) {
          node.setAttribute("target", "_blank");
          node.setAttribute("rel", "nofollow noreferrer noopener");
        }
        if (node.hasAttribute("xlink:href") || node.hasAttribute("href")) {
          node.setAttribute("xlink:show", "new");
        }
        if ("preload" in node) {
          node.setAttribute("preload", "none");
        }
      });

      return (content) =>
        DOMPurify.sanitize(content, {
          FORBID_TAGS: ["form", "input", "style"],
          FORBID_ATTR: ["autoplay", "style"],
        });
    });
  }
  return sanitizeFunctionPromise;
}

export default {
  name: "Markdown",

  data() {
    return {
      ready: false,
      markdownInstance: null,
      sanitizeContent: null,
    };
  },

  async created() {
    const [md, sanitize] = await Promise.all([
      getMarkdownInstance(),
      getSanitizeFunction(),
    ]);
    this.markdownInstance = md;
    this.sanitizeContent = sanitize;
    this.ready = true;
  },

  computed: {
    // 渲染并安全处理内容
    sanitizedHtmlContent() {
      if (!this.ready) return "";
      // 通过 slot 的内容作为 Markdown 输入
      const rawContent = this.$slots.default ? this.$slots.default()[0].children : "";
      const renderedMarkdown = this.markdownInstance.render(rawContent);
      const sanitized = this.sanitizeContent(renderedMarkdown);
      return twemoji.parse(sanitized, TWEMOJI_SVG_OPTIONS);
    },
  },
};
</script>

<style scoped>
:deep(img.twemoji) {
  width: 1.1em;
  height: 1.1em;
  margin: 0 0.05em;
  vertical-align: -0.2em;
}
</style>
