import { useHead } from "@unhead/vue";
import { computed, unref } from "vue";

const SITE_NAME = "ZeroCat社区";
const DEFAULT_DESCRIPTION = "ZeroCat是新一代开源编程社区！";
const DEFAULT_OG_IMAGE = "https://zerocat.houlangs.com/og.png";

export function useSeo({ title, description, ogImage, ogUrl, keywords } = {}) {
  const desc = computed(() => unref(description) || DEFAULT_DESCRIPTION);
  const image = computed(() => unref(ogImage) || DEFAULT_OG_IMAGE);
  const fullTitle = computed(() => {
    const t = unref(title);
    return t ? `${t} - ${SITE_NAME}` : SITE_NAME;
  });

  useHead({
    title: computed(() => unref(title) || ""),
    meta: [
      { name: "description", content: desc },
      ...(keywords
        ? [{ name: "keywords", content: computed(() => unref(keywords)) }]
        : []),
      { property: "og:title", content: fullTitle },
      { property: "og:description", content: desc },
      { property: "og:image", content: image },
      ...(ogUrl
        ? [{ property: "og:url", content: computed(() => unref(ogUrl)) }]
        : []),
      { name: "twitter:title", content: fullTitle },
      { name: "twitter:description", content: desc },
      { name: "twitter:image", content: image },
    ],
  });
}
