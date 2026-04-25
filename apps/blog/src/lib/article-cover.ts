export type ArticleCoverInput = {
  title: string;
  summary?: string | null;
  content?: string | null;
  slug?: string | null;
};

function normalizePayload(input: ArticleCoverInput) {
  return {
    title: (input.title || "未命名文章").trim(),
    summary: input.summary || "",
    content: input.content || "",
    slug: (input.slug || "zerocat-blog").trim(),
  };
}

export async function generateArticleCoverDataUrl(
  input: ArticleCoverInput,
  signal?: AbortSignal
) {
  const response = await fetch("/api/covers/render", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(normalizePayload(input)),
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error("头图生成失败");
  }

  const data = (await response.json()) as { dataUrl?: string };
  if (!data.dataUrl) {
    throw new Error("头图生成失败");
  }

  return data.dataUrl;
}
