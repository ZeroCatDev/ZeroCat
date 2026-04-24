import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border mt-32">
      <div className="mx-auto max-w-7xl px-6 py-12 grid gap-8 md:grid-cols-4">
        <div className="md:col-span-2 space-y-3">
          <div className="flex items-center gap-1.5 font-semibold text-base tracking-tight">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-primary text-primary-foreground text-[10px] font-bold">
              Z
            </span>
            <span>ZeroCat Blog</span>
          </div>
          <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
            一个属于创作者的现代化博客社区。基于 ZeroCat 生态构建，
            支持 Markdown、协作与版本化写作。
          </p>
        </div>
        <div>
          <h3 className="font-mono uppercase tracking-wider text-xs text-muted-foreground mb-3">
            浏览
          </h3>
          <ul className="space-y-2 text-sm">
            <li>
              <Link className="hover:text-foreground text-muted-foreground" href="/posts">
                全部文章
              </Link>
            </li>
            <li>
              <Link className="hover:text-foreground text-muted-foreground" href="/tags">
                标签
              </Link>
            </li>
            <li>
              <Link className="hover:text-foreground text-muted-foreground" href="/explore">
                发现
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="font-mono uppercase tracking-wider text-xs text-muted-foreground mb-3">
            账户
          </h3>
          <ul className="space-y-2 text-sm">
            <li>
              <Link className="hover:text-foreground text-muted-foreground" href="/write">
                开始写作
              </Link>
            </li>
            <li>
              <Link className="hover:text-foreground text-muted-foreground" href="/drafts">
                草稿箱
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-6 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} ZeroCat. 全部内容遵循各作者授权。
          </p>
          <p className="font-mono uppercase tracking-wider text-[11px] text-muted-foreground">
            Built with ZeroCat · Next.js
          </p>
        </div>
      </div>
    </footer>
  );
}
