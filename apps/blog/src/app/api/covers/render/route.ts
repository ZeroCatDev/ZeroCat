import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { renderArticleCoverDataUrl } from "@/lib/article-cover-render";

const payloadSchema = z.object({
  title: z.string().trim().min(1).max(160),
  summary: z.string().optional().default(""),
  content: z.string().optional().default(""),
  slug: z.string().trim().optional().default("zerocat-blog"),
});

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const payload = payloadSchema.parse(json);
    const dataUrl = await renderArticleCoverDataUrl(payload);
    return NextResponse.json({ dataUrl }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ message: "头图生成失败" }, { status: 400 });
  }
}
