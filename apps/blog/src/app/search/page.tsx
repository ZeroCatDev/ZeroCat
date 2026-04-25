import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const paramsString = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const resolved = Array.isArray(value) ? value[0] : value;
    if (resolved) paramsString.set(key, resolved);
  }
  const suffix = paramsString.toString();
  redirect(suffix ? `/posts?${suffix}` : "/posts");
}

