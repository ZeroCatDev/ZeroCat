import type { Metadata } from "next";
import { getUserByUsername } from "@/lib/api";
import { resolveAvatarUrl } from "@/lib/avatar";
import { getServerStaticBase } from "@/lib/site-config";
import { UserProfilePageClient } from "@/components/blog/pages/user-profile-page-client";

type PageProps = { params: Promise<{ username: string }> };

function buildAbsoluteProfileUrl(username: string) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4000").replace(/\/+$/, "");
  return `${base}/${encodeURIComponent(username)}`;
}

export async function generateMetadata(
  { params }: PageProps
): Promise<Metadata> {
  const { username } = await params;
  const [user, staticBase] = await Promise.all([
    getUserByUsername(username),
    getServerStaticBase(),
  ]);
  if (!user) {
    return {
      title: "用户不存在",
      description: "未找到对应作者主页。",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const profileUrl = buildAbsoluteProfileUrl(user.username);
  const avatarUrl = resolveAvatarUrl(user.avatar, staticBase);
  const displayName = user.display_name || user.username;
  const title = `${displayName} (@${user.username})`;
  const description =
    user.bio || `${displayName} 在 ZeroCat Blog 上的主页。`;

  return {
    title,
    description,
    alternates: {
      canonical: `/${encodeURIComponent(user.username)}`,
    },
    authors: [{ name: displayName, url: profileUrl }],
    creator: displayName,
    keywords: [displayName, user.username, "ZeroCat Blog", "作者主页", "个人主页"],
    openGraph: {
      type: "profile",
      url: profileUrl,
      title,
      description,
      siteName: "ZeroCat Blog",
      username: user.username,
      images: avatarUrl
        ? [{ url: avatarUrl, alt: `${displayName} 的头像` }]
        : [],
    },
    twitter: {
      card: avatarUrl ? "summary" : "summary_large_image",
      title,
      description,
      images: avatarUrl ? [avatarUrl] : [],
      creator: `@${user.username}`,
    },
  };
}

export default async function UserProfilePage({ params }: PageProps) {
  const { username } = await params;
  return <UserProfilePageClient username={username} />;
}
