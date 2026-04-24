import Link from "next/link";
import { PenSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import { CommandMenu } from "./command-menu";
import { UserNav } from "./user-nav";

const NAV_ITEMS = [
  { label: "文章", href: "/posts" },
  { label: "标签", href: "/tags" },
  { label: "发现", href: "/explore" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-md ring-border-light">
      <div className="mx-auto flex h-14 items-center gap-4 px-6">
        <Link
          href="/"
          className="flex items-center gap-1.5 font-semibold text-base tracking-tight"
        >
          <span className="grid h-6 w-6 place-items-center rounded-md bg-primary text-primary-foreground text-[10px] font-bold">
            Z
          </span>
          <span>ZeroCat</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-muted-foreground font-medium">Blog</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-4">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex-1" />

        <div className="hidden sm:block w-[260px]">
          <CommandMenu />
        </div>

        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
            <Link href="/write">
              <PenSquare className="h-4 w-4" />
              写文章
            </Link>
          </Button>
          <ThemeToggle />
          <UserNav />
        </div>
      </div>
    </header>
  );
}
