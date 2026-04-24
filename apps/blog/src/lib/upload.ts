import { API_URL, getStoredToken } from "./api";

export interface UploadedAsset {
  id?: number | string;
  url: string;
  md5?: string;
  file_hash?: string;
  file_size?: number;
  file_type?: string;
  [key: string]: unknown;
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

  const asset = payload.data.asset;
  if (!asset.url) {
    throw new Error("上传成功但未返回 URL");
  }
  return asset;
}
