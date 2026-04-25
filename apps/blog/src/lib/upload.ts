import { API_URL, getStoredToken } from "./api";
import { resolveMediaUrl } from "./avatar";

export interface UploadedAsset {
  id?: number | string;
  url: string;
  md5?: string;
  file_hash?: string;
  file_size?: number;
  file_type?: string;
  extension?: string;
  [key: string]: unknown;
}

function normalizeUploadedAsset(asset: UploadedAsset): UploadedAsset {
  const normalizedUrl = resolveMediaUrl(
    asset.url ||
      (asset.md5 && typeof asset.extension === "string"
        ? `${asset.md5}.${asset.extension}`
        : asset.md5 || null)
  );

  if (!normalizedUrl) {
    throw new Error("上传成功但未返回 URL");
  }

  return {
    ...asset,
    url: normalizedUrl,
  };
}

/**
 * Upload an image via the API's /posts/upload-image endpoint.
 * Returns the asset including a public URL.
 */
export async function uploadImage(
  file: File | Blob,
  token?: string | null
): Promise<UploadedAsset> {
  const useToken = token ?? getStoredToken();
  if (!useToken) {
    throw new Error("请先登录后再上传图片");
  }

  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_URL}/posts/upload-image`, {
    method: "POST",
    body: form,
    credentials: "include",
    headers: {
      Authorization: `Bearer ${useToken}`,
    },
  });

  const payload = (await res.json().catch(() => null)) as
    | { status?: string; message?: string; data?: { asset?: UploadedAsset } }
    | null;

  if (!res.ok || payload?.status !== "success" || !payload.data?.asset) {
    throw new Error(payload?.message || `上传失败 (${res.status})`);
  }

  return normalizeUploadedAsset(payload.data.asset);
}

export async function uploadGeneratedCover(
  dataUrl: string,
  filename = "article-cover.png",
  token?: string | null
): Promise<UploadedAsset> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const file = new File([blob], filename, {
    type: blob.type || "image/png",
  });

  return uploadImage(file, token);
}
