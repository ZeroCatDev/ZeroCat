import path from "node:path";
import { readFile } from "node:fs/promises";
import satori from "satori";
import { truncate } from "./utils";
import type { ArticleCoverInput } from "./article-cover";

const coverFontPath = path.resolve(
  process.cwd(),
  "src",
  "assets",
  "fonts",
  "LXGWWenKaiLite-Medium.ttf"
);

const fontDataPromise = readFile(coverFontPath);

function cleanMarkdown(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/[\*_~]/g, "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pickExcerptLines(input: ArticleCoverInput) {
  const source = `${input.summary?.trim() ? `${input.summary.trim()}\n\n` : ""}${cleanMarkdown(input.content || "")}`.trim();

  return source
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((line) => truncate(line, 34));
}

export async function renderArticleCoverDataUrl(input: ArticleCoverInput) {
  const coverFont = await fontDataPromise;
  const title = truncate((input.title || "未命名文章").trim(), 32);
  const excerptLines = pickExcerptLines(input);

  const svg = await satori(
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        padding: "84px 96px",
        background:
          "linear-gradient(135deg, #fcfcf7 0%, #f6f2e9 52%, #efe7d8 100%)",
        color: "#161616",
        fontFamily: "LXGW WenKai Lite",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 160,
            height: 8,
            borderRadius: 999,
            background: "#d7c5a7",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 30,
            maxWidth: 1220,
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              textAlign: "left",
              fontSize: 112,
              lineHeight: 1.08,
              letterSpacing: "-0.045em",
              color: "#111111",
            }}
          >
            {title}
          </div>

          {excerptLines.length ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 14,
                maxWidth: 980,
                fontSize: 34,
                lineHeight: 1.45,
                color: "rgba(17,17,17,0.72)",
                letterSpacing: "-0.02em",
              }}
            >
              {excerptLines.map((line, index) => (
                <div key={`${line}-${index}`} style={{ display: "flex" }}>
                  {line}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 64,
            lineHeight: 1,
            letterSpacing: "0.08em",
            color: "rgba(17,17,17,0.45)",
          }}
        >
          ZeroCat Blog
        </div>
      </div>
    </div>,
    {
      width: 1600,
      height: 900,
      fonts: [
        {
          name: "LXGW WenKai Lite",
          data: coverFont,
          weight: 500,
          style: "normal",
        },
      ],
    }
  );

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
