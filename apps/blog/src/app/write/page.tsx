"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  BookText,
  ChevronRight,
  CircleCheck,
  Loader2,
  PanelRight,
  Rocket,
  Save,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MilkdownEditorPane } from "@/components/blog/editor/milkdown-editor-pane";
import { ToastEditorPane } from "@/components/blog/editor/toast-editor-pane";
import { CoverUpload } from "@/components/blog/cover-upload";
import { buildZcLoginUrl, useAuthToken, useCurrentUser } from "@/lib/auth";
import {
  createPost,
  discardDraft,
  getCacheKV,
  getDraft,
  getPostBody,
  getPostById,
  publishDraft,
  saveDraft,
  setCacheKV,
  updatePostMeta,
  updateProjectState,
} from "@/lib/api";
import { formatDate } from "@/lib/utils";

type EditorMode = "toast" | "milkdown";

type EditorPreference = {
  mode?: EditorMode;
  lastProjectId?: number;
};

export default function WritePage() {
  return (
    <React.Suspense fallback={<WriteLoading label="正在初始化写作工作台" />}>
      <WritePageInner />
    </React.Suspense>
  );
}

function WriteLoading({ label }: { label: string }) {
  return (
    <section className="mx-auto w-full max-w-2xl px-6 py-16">
      <div className="rounded-xl bg-card p-8 ring-border flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{label}...</p>
      </div>
    </section>
  );
}

function WritePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, ready, isAuthed } = useAuthToken();
  const user = useCurrentUser();

  const requestedDraftId = React.useMemo(() => {
    const raw = searchParams.get("draft") || searchParams.get("projectId") || "";
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [searchParams]);

  const [projectId, setProjectId] = React.useState<number | null>(requestedDraftId);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [editorMode, setEditorMode] = React.useState<EditorMode>("milkdown");
  const [editorSeed, setEditorSeed] = React.useState(0);
  const [immersiveMode, setImmersiveMode] = React.useState(false);
  const [isSettingsSheetOpen, setIsSettingsSheetOpen] = React.useState(false);
  const [content, setContent] = React.useState("");
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(null);
  const [publishMessage, setPublishMessage] = React.useState("");

  const [title, setTitle] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [tagsInput, setTagsInput] = React.useState("");
  const [cover, setCover] = React.useState<string | null>(null);
  const [canonicalUrl, setCanonicalUrl] = React.useState("");
  const [seoTitle, setSeoTitle] = React.useState("");
  const [seoDescription, setSeoDescription] = React.useState("");
  const [seoKeywords, setSeoKeywords] = React.useState("");

  const cacheKey = React.useMemo(
    () => `usercachekv:blog:${user?.id ?? "anonymous"}:editor-preference`,
    [user?.id]
  );

  const wordCount = React.useMemo(() => {
    const text = content.trim();
    if (!text) return 0;
    // naive count: CJK chars count individually, other words split on whitespace
    const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const rest = text
      .replace(/[\u4e00-\u9fff]/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    return cjk + rest;
  }, [content]);

  const applyDraft = React.useCallback(
    (id: number, draft: Awaited<ReturnType<typeof getDraft>>) => {
      if (!draft) return;
      setProjectId(id);
      setTitle(draft.title || "");
      setSummary(draft.description || "");
      setSlug(draft.slug || "");
      setSlugTouched(Boolean(draft.slug));
      setContent(draft.content || "");
      setCover(draft.cover || null);
      setTagsInput((draft.tags || []).join(", "));
      setDirty(false);
      setLastSavedAt(draft.savedAt || draft.updatedAt || new Date().toISOString());
      setEditorSeed((seed) => seed + 1);
    },
    []
  );

  const applyPublishedPost = React.useCallback(
    async (id: number) => {
      const post = await getPostById(id);
      if (!post) return false;

      const body = post.file?.source || (await getPostBody(post));
      setProjectId(id);
      setTitle(post.title || post.name || "");
      setSummary(post.summary || post.description || "");
      setSlug(post.blogConfig?.slug || "");
      setSlugTouched(Boolean(post.blogConfig?.slug));
      setContent(body || "");
      setCover(post.blogConfig?.cover || post.thumbnail || null);
      setTagsInput((post.project_tags ?? []).map((tag) => tag.name).join(", "));
      setSeoTitle(post.blogConfig?.seo?.title || "");
      setSeoDescription(post.blogConfig?.seo?.description || "");
      setSeoKeywords(post.blogConfig?.seo?.keywords || "");
      setDirty(false);
      setLastSavedAt(post.time || new Date().toISOString());
      setEditorSeed((seed) => seed + 1);
      return true;
    },
    []
  );

  React.useEffect(() => {
    if (!ready || !isAuthed || !token) return;

    let canceled = false;

    async function bootstrap() {
      const authToken = token ?? undefined;
      setLoading(true);
      try {
        const preference = await getCacheKV<EditorPreference>(cacheKey, authToken);
        if (canceled) return;

        if (preference?.mode) {
          setEditorMode(preference.mode);
        }

        const targetId = requestedDraftId || preference?.lastProjectId || null;
        if (targetId) {
          const draft = await getDraft(targetId, authToken);
          if (canceled) return;
          if (draft) {
            applyDraft(targetId, draft);
          } else {
            const loaded = await applyPublishedPost(targetId);
            if (canceled) return;
            if (!loaded && requestedDraftId) {
              toast.error("文章加载失败");
            }
          }
        }
      } catch {
        if (!canceled) {
          toast.error("初始化编辑器失败");
        }
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      canceled = true;
    };
  }, [applyDraft, applyPublishedPost, cacheKey, isAuthed, ready, requestedDraftId, token]);

  const isPageLoading = !ready || (isAuthed && loading);

  React.useEffect(() => {
    if (!ready || !isAuthed || !token) return;
    const payload: EditorPreference = {
      mode: editorMode,
      lastProjectId: projectId ?? undefined,
    };
    void setCacheKV(cacheKey, payload, token);
  }, [cacheKey, editorMode, isAuthed, projectId, ready, token]);

  React.useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const ensureProject = React.useCallback(async () => {
    if (!token) {
      throw new Error("未登录");
    }

    if (projectId) return projectId;

    const created = await createPost(
      {
        title: title.trim() || "未命名文章",
        summary: summary.trim(),
        state: "draft",
      },
      token
    );

    setProjectId(created.id);
    router.replace(`/write?draft=${created.id}`);
    return created.id;
  }, [projectId, router, summary, title, token]);

  const persistDraft = React.useCallback(
    async (silent = false) => {
      if (!token) {
        throw new Error("未登录");
      }

      setSaving(true);
      try {
        const id = await ensureProject();
        const payloadTags = parseTags(tagsInput);
        const normalizedTitle = title.trim() || "未命名文章";

        await saveDraft(
          id,
          {
            title: normalizedTitle,
            description: summary.trim(),
            content,
            slug: slug.trim() || undefined,
            cover: cover || null,
            tags: payloadTags,
            updatedAt: new Date().toISOString(),
          },
          token
        );

        await updatePostMeta(
          id,
          {
            title: normalizedTitle,
            summary: summary.trim(),
            slug: slug.trim() || undefined,
            cover: cover || null,
            state: "draft",
            seo: {
              title: seoTitle.trim() || undefined,
              description: seoDescription.trim() || undefined,
              keywords: seoKeywords.trim() || undefined,
            },
          },
          token
        );

        const now = new Date().toISOString();
        setLastSavedAt(now);
        setDirty(false);

        if (!silent) {
          toast.success("草稿已保存");
        }
      } catch (error) {
        if (!silent) {
          toast.error(error instanceof Error ? error.message : "保存失败");
        }
        throw error;
      } finally {
        setSaving(false);
      }
    },
    [
      content,
      cover,
      ensureProject,
      seoDescription,
      seoKeywords,
      seoTitle,
      slug,
      summary,
      tagsInput,
      title,
      token,
    ]
  );

  React.useEffect(() => {
    if (!ready || !isAuthed || !token || !dirty) return;

    const timer = window.setTimeout(() => {
      void persistDraft(true);
    }, 2400);

    return () => window.clearTimeout(timer);
  }, [dirty, isAuthed, persistDraft, ready, token]);

  const handlePublish = React.useCallback(async () => {
    if (!token) {
      toast.error("未登录");
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("请先填写标题");
      setIsSettingsSheetOpen(true);
      return;
    }

    setPublishing(true);
    try {
      await persistDraft(true);
      const id = await ensureProject();
      const payloadTags = parseTags(tagsInput);

      await updatePostMeta(
        id,
        {
          title: trimmedTitle,
          summary: summary.trim(),
          slug: slug.trim() || undefined,
          cover: cover || null,
          state: "public",
          tags: payloadTags,
          seo: {
            title: seoTitle.trim() || undefined,
            description: seoDescription.trim() || undefined,
            keywords: seoKeywords.trim() || undefined,
          },
        },
        token
      );

      await publishDraft(id, publishMessage.trim() || "发布文章", token);
      await updateProjectState(id, "public", token);

      void fetch("/api/revalidate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).catch(() => null);

      toast.success("发布成功 🎉");
      setDirty(false);
      setIsSettingsSheetOpen(false);

      if (user?.username) {
        const finalSlug = slug.trim() || String(id);
        router.push(`/${user.username}/${encodeURIComponent(finalSlug)}`);
      } else {
        router.push("/posts");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "发布失败");
    } finally {
      setPublishing(false);
    }
  }, [
    cover,
    ensureProject,
    persistDraft,
    publishMessage,
    router,
    seoDescription,
    seoKeywords,
    seoTitle,
    slug,
    summary,
    tagsInput,
    title,
    token,
    user,
  ]);

  const handleDiscard = React.useCallback(async () => {
    if (!token) {
      toast.error("未登录");
      return;
    }

    if (!projectId) {
      setTitle("");
      setSummary("");
      setSlug("");
      setTagsInput("");
      setCover(null);
      setContent("");
      setDirty(false);
      setEditorSeed((seed) => seed + 1);
      toast.success("内容已重置");
      return;
    }

    const ok = window.confirm("确定要丢弃这份草稿吗？此操作不可恢复。");
    if (!ok) return;

    try {
      const removed = await discardDraft(projectId, token);
      if (!removed) {
        toast.error("草稿删除失败");
        return;
      }

      setProjectId(null);
      setTitle("");
      setSummary("");
      setSlug("");
      setTagsInput("");
      setCover(null);
      setContent("");
      setDirty(false);
      setLastSavedAt(null);
      setEditorSeed((seed) => seed + 1);
      router.replace("/write");
      toast.success("草稿已删除");
    } catch {
      toast.error("草稿删除失败");
    }
  }, [projectId, router, token]);

  const markDirty = React.useCallback(() => setDirty(true), []);

  const tags = parseTags(tagsInput);

  if (isPageLoading) {
    return <WriteLoading label="正在加载编辑器" />;
  }

  if (!isAuthed) {
    return (
      <section className="flex flex-1 items-center justify-center px-6 py-16">
        <Card className="max-w-md w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
          <CardHeader>
            <CardTitle>请先登录后写作</CardTitle>
            <CardDescription>
              编辑器、草稿与发布都需要登录身份。登录后即可开始创作。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button asChild>
              <Link href={buildZcLoginUrl(typeof window !== "undefined" ? window.location.href : "")}>
                前往登录
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  const statusIcon = saving ? (
    <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
  ) : dirty ? (
    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
  ) : (
    <CircleCheck className="h-3.5 w-3.5 text-emerald-500" />
  );
  const statusLabel = saving ? "保存中" : dirty ? "未保存" : "已保存";

  const editorNode = (
    <div className="relative flex-1 min-h-0 animate-in fade-in duration-500">
      <div className="mx-auto w-full max-w-3xl h-full">
        {editorMode === "milkdown" ? (
          <MilkdownEditorPane
            key={`milkdown-${editorSeed}`}
            token={token}
            initialValue={content}
            onChange={(value) => {
              setContent(value);
              setDirty(true);
            }}
          />
        ) : (
          <ToastEditorPane
            key={`toast-${editorSeed}`}
            initialValue={content}
            onChange={(value) => {
              setContent(value);
              setDirty(true);
            }}
          />
        )}
      </div>
    </div>
  );

  if (immersiveMode) {
    return (
      <section className="fixed inset-0 z-50 flex flex-col bg-background animate-in fade-in duration-200">
        <header className="flex h-12 items-center justify-between border-b border-border/60 bg-background/90 px-4 backdrop-blur-sm">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-sm font-medium truncate">
              {title || "未命名文章"}
            </h2>
            <span className="flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {statusIcon}
              {statusLabel}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void persistDraft(false)}
              disabled={saving || publishing}
            >
              <Save className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setImmersiveMode(false)}>
              <Minimize2 className="h-4 w-4" />
              退出
            </Button>
          </div>
        </header>
        {editorNode}
      </section>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-[calc(100vh-theme(spacing.14))] md:min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="flex h-14 items-center gap-3 px-4 md:px-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0 flex-1">
            <Link href="/drafts" className="hover:text-foreground transition-colors shrink-0">
              草稿
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <span className="text-foreground font-medium truncate">
              {title || "未命名文章"}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    <BookText className="h-3.5 w-3.5" />
                    {wordCount}
                  </span>
                </TooltipTrigger>
                <TooltipContent>字数</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    {statusIcon}
                    <span className="hidden sm:inline">{statusLabel}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {lastSavedAt ? `最近保存: ${formatDate(lastSavedAt)}` : "还未保存"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSettingsSheetOpen(true)}
              className="hidden sm:inline-flex"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              文章设置
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => void persistDraft(false)} disabled={saving}>
                  <Save className="h-4 w-4" />
                  立即保存
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setImmersiveMode(true)}>
                  <Maximize2 className="h-4 w-4" />
                  沉浸模式
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    setEditorMode(editorMode === "milkdown" ? "toast" : "milkdown")
                  }
                >
                  <PanelRight className="h-4 w-4" />
                  切换到 {editorMode === "milkdown" ? "Toast UI" : "Milkdown"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDiscard} className="text-destructive">
                  丢弃草稿
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              onClick={() => {
                if (!title.trim()) {
                  setIsSettingsSheetOpen(true);
                  toast.info("补全信息后即可发布");
                  return;
                }
                setIsSettingsSheetOpen(true);
              }}
              disabled={saving || publishing}
              className="gap-1.5"
            >
              {publishing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Rocket className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">发布</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="px-4 md:px-6 pt-6 pb-2">
        <div className="mx-auto w-full max-w-3xl">
          <input
            type="text"
            value={title}
            onChange={(event) => {
              const next = event.target.value;
              setTitle(next);
              if (!seoTitle.trim() && next.trim()) {
                setSeoTitle(next.trim());
              }
              if (!slugTouched) {
                setSlug(slugify(next));
              }
              markDirty();
            }}
            placeholder="文章标题"
            className="w-full bg-transparent text-3xl md:text-4xl font-bold tracking-[-0.025em] leading-tight outline-none placeholder:text-muted-foreground/40"
          />
          <input
            type="text"
            value={summary}
            onChange={(event) => {
              const next = event.target.value;
              setSummary(next);
              if (!seoDescription.trim() && next.trim()) {
                setSeoDescription(next.trim());
              }
              markDirty();
            }}
            placeholder="一句话摘要（可选）"
            className="mt-3 w-full bg-transparent text-lg text-muted-foreground outline-none placeholder:text-muted-foreground/40"
          />
        </div>
      </div>

      {editorNode}

      <Sheet open={isSettingsSheetOpen} onOpenChange={setIsSettingsSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto flex flex-col">
          <SheetHeader>
            <SheetTitle>文章设置</SheetTitle>
            <SheetDescription>
              补全基础信息、SEO 和封面，然后一键发布。
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-6">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">基础</TabsTrigger>
                <TabsTrigger value="seo">SEO</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-5 mt-6">
                <div className="space-y-2">
                  <Label>封面图</Label>
                  <CoverUpload
                    value={cover}
                    onChange={(url) => {
                      setCover(url);
                      markDirty();
                    }}
                    token={token}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sheet-title">标题</Label>
                  <Input
                    id="sheet-title"
                    value={title}
                    onChange={(event) => {
                      const next = event.target.value;
                      setTitle(next);
                      if (!seoTitle.trim() && next.trim()) {
                        setSeoTitle(next.trim());
                      }
                      if (!slugTouched) {
                        setSlug(slugify(next));
                      }
                      markDirty();
                    }}
                    placeholder="文章标题"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sheet-summary">摘要</Label>
                  <Textarea
                    id="sheet-summary"
                    value={summary}
                    onChange={(event) => {
                      const next = event.target.value;
                      setSummary(next);
                      if (!seoDescription.trim() && next.trim()) {
                        setSeoDescription(next.trim());
                      }
                      markDirty();
                    }}
                    placeholder="简述文章主题"
                    className="min-h-20"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sheet-slug">Slug</Label>
                  <Input
                    id="sheet-slug"
                    value={slug}
                    onChange={(event) => {
                      setSlugTouched(true);
                      setSlug(slugify(event.target.value));
                      markDirty();
                    }}
                    placeholder="modern-web-architecture"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sheet-tags">标签</Label>
                  <Input
                    id="sheet-tags"
                    value={tagsInput}
                    onChange={(event) => {
                      setTagsInput(event.target.value);
                      markDirty();
                    }}
                    placeholder="多个标签使用逗号分隔"
                  />
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="h-6 rounded-full px-2 text-xs"
                        >
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="seo" className="space-y-5 mt-6">
                <div className="space-y-2">
                  <Label htmlFor="sheet-seo-title">SEO 标题</Label>
                  <Input
                    id="sheet-seo-title"
                    value={seoTitle}
                    onChange={(event) => {
                      setSeoTitle(event.target.value);
                      setDirty(true);
                    }}
                    placeholder="用于搜索引擎显示"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sheet-seo-description">SEO 描述</Label>
                  <Textarea
                    id="sheet-seo-description"
                    value={seoDescription}
                    onChange={(event) => {
                      setSeoDescription(event.target.value);
                      setDirty(true);
                    }}
                    placeholder="搜索结果中的描述文本"
                    className="min-h-20"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sheet-canonical-url">Canonical URL</Label>
                  <Input
                    id="sheet-canonical-url"
                    value={canonicalUrl}
                    onChange={(event) => {
                      setCanonicalUrl(event.target.value);
                      setDirty(true);
                    }}
                    placeholder="https://example.com/article"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sheet-seo-keywords">SEO 关键词</Label>
                  <Input
                    id="sheet-seo-keywords"
                    value={seoKeywords}
                    onChange={(event) => {
                      setSeoKeywords(event.target.value);
                      markDirty();
                    }}
                    placeholder="关键词1, 关键词2, 关键词3"
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="publish-message">发布说明</Label>
                  <Textarea
                    id="publish-message"
                    value={publishMessage}
                    onChange={(event) => setPublishMessage(event.target.value)}
                    placeholder="提交说明（可选，用于 Git 历史）"
                    className="min-h-20"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <SheetFooter className="border-t border-border bg-background px-4 py-3 gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setIsSettingsSheetOpen(false)}
              className="w-full sm:w-auto"
            >
              返回编辑
            </Button>
            <Button
              onClick={() => void handlePublish()}
              disabled={saving || publishing}
              className="w-full sm:flex-1"
            >
              {publishing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Rocket className="h-4 w-4 mr-2" />
              )}
              发布文章
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function parseTags(value: string) {
  const unique = new Set(
    value
      .split(/[,，]/)
      .map((item) => item.trim())
      .filter(Boolean)
  );
  return Array.from(unique);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
