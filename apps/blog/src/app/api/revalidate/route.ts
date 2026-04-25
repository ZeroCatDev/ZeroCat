import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { API_URL } from "@/lib/api";

type MeResponse = {
  status?: string;
  data?: { id?: number | string };
};

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const trimmed = authHeader.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase().startsWith("bearer ")) {
    const token = trimmed.slice(7).trim();
    return token || null;
  }
  return null;
}

export async function POST(req: Request) {
  const token = extractBearerToken(req.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }

  // Validate token by hitting backend /user/me.
  let userId: number | null = null;
  try {
    const res = await fetch(`${API_URL}/user/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const payload = (await res.json().catch(() => null)) as MeResponse | null;
    const rawId = payload?.data?.id;
    const parsedId =
      typeof rawId === "number"
        ? rawId
        : typeof rawId === "string"
          ? Number.parseInt(rawId, 10)
          : NaN;
    if (Number.isFinite(parsedId)) userId = Number(parsedId);
  } catch {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }

  // Only revalidate known cache tags (avoid arbitrary invalidation).
  const profile = "max";
  revalidateTag("blog-tags", profile);
  revalidateTag("blog-posts", profile);
  if (userId) {
    revalidateTag(`blog-posts-user-${userId}`, profile);
    revalidateTag(`blog-tags-user-${userId}`, profile);
  }

  return NextResponse.json({ status: "success" });
}
