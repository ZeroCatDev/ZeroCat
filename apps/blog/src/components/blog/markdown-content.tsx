import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeHighlight from "rehype-highlight";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { cn } from "@/lib/utils";

const markdownComponents: Components = {
  h1: ({ className, ...props }) => (
    <h1
      className={cn("mt-10 scroll-mt-24 text-4xl font-semibold tracking-tight", className)}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={cn("mt-10 border-b border-border pb-2 scroll-mt-24 text-3xl font-semibold tracking-tight", className)}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3
      className={cn("mt-8 scroll-mt-24 text-2xl font-semibold tracking-tight", className)}
      {...props}
    />
  ),
  h4: ({ className, ...props }) => (
    <h4
      className={cn("mt-6 scroll-mt-24 text-xl font-semibold tracking-tight", className)}
      {...props}
    />
  ),
  p: ({ className, ...props }) => (
    <p className={cn("my-5 text-[17px] leading-8 text-foreground/90", className)} {...props} />
  ),
  a: ({ className, ...props }) => (
    <a
      className={cn(
        "text-[var(--color-link)] underline decoration-1 underline-offset-4 hover:decoration-2",
        className
      )}
      {...props}
    />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn("my-6 border-l-2 border-foreground pl-4 text-muted-foreground", className)}
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul className={cn("my-5 list-disc space-y-1 pl-6", className)} {...props} />
  ),
  ol: ({ className, ...props }) => (
    <ol className={cn("my-5 list-decimal space-y-1 pl-6", className)} {...props} />
  ),
  li: ({ className, ...props }) => (
    <li className={cn("text-[16px] leading-7", className)} {...props} />
  ),
  hr: ({ className, ...props }) => (
    <hr className={cn("my-10 border-border", className)} {...props} />
  ),
  table: ({ className, ...props }) => (
    <div className="my-6 overflow-x-auto rounded-lg ring-border">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  ),
  th: ({ className, ...props }) => (
    <th
      className={cn("bg-muted px-4 py-2 text-left text-sm font-semibold", className)}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td className={cn("border-t border-border px-4 py-2 align-top", className)} {...props} />
  ),
  img: ({ className, ...props }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={cn("my-6 rounded-xl ring-border", className)} {...props} alt={props.alt ?? ""} />
  ),
  code: ({ className, ...props }) => {
    const inline = !String(className ?? "").includes("language-");
    return inline ? (
      <code
        className={cn("rounded bg-muted px-1.5 py-0.5 font-mono text-[0.875em]", className)}
        {...props}
      />
    ) : (
      <code className={cn("font-mono text-sm", className)} {...props} />
    );
  },
  pre: ({ className, ...props }) => (
    <pre
      className={cn("my-6 overflow-x-auto rounded-lg bg-[#fafafa] p-4 text-sm ring-border dark:bg-[#111111]", className)}
      {...props}
    />
  ),
};

export function MarkdownContent({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  if (!source) return null;
  return (
    <div className={cn("max-w-none", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
        disallowedElements={["script", "iframe", "object", "embed"]}
        unwrapDisallowed
        rehypePlugins={[
          rehypeRaw,
          rehypeSlug,
          [
            rehypeAutolinkHeadings,
            {
              behavior: "prepend",
              properties: { className: ["anchor-link"], "aria-hidden": "true" },
              content: { type: "text", value: "#" },
            },
          ],
          [rehypeHighlight, { detect: true, ignoreMissing: true }],
        ]}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
