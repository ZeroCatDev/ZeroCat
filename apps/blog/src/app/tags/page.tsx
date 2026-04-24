import { Hash } from "lucide-react";
import { EmptyState } from "@/components/blog/empty-state";
import { TagChip } from "@/components/blog/tag-chip";
import { listTags } from "@/lib/api";

export const revalidate = 60;

export default async function TagsPage() {
  const tags = await listTags();

  return (
    <section className="mx-auto w-full max-w-[1600px] px-6 py-10">
      <div className="mb-8 space-y-2">
        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Topics / 标签</p>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-[-1.9px]">全部标签</h1>
        <p className="text-sm text-muted-foreground">
          点击标签可查看相关文章流与作者内容。
        </p>
      </div>

      {tags.length === 0 ? (
        <EmptyState
          icon={Hash}
          title="还没有标签"
          description="等第一批作者开始写作后，这里会快速增长。"
        />
      ) : (
        <div className="rounded-xl bg-card p-6 ring-border">
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <TagChip key={tag.id} tag={tag} size="lg" />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
